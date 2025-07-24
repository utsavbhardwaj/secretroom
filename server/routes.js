const express = require('express');
const { WebSocketServer } = require('ws');
const { db } = require('./db.js');
const { users, rooms, roomMembers, messages } = require('../shared/schema');
const { eq, and, desc, gte } = require('drizzle-orm');
const { setupWebSocket } = require('./websocket');

function generateRoomCode() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function findOrCreateUser(sessionId, username) {
    // Try to find existing user by session ID
    let [user] = await db.select().from(users).where(eq(users.sessionId, sessionId));
    
    if (!user) {
        // Create new user
        [user] = await db.insert(users).values({
            sessionId,
            username,
            isActive: true
        }).returning();
    } else {
        // Update username if different
        if (user.username !== username) {
            [user] = await db.update(users)
                .set({ username, updatedAt: new Date() })
                .where(eq(users.id, user.id))
                .returning();
        }
    }
    
    return user;
}

function setupRoutes(app, httpServer) {
    const router = express.Router();
    
    // Health check
    router.get('/health', (req, res) => {
        res.json({ 
            success: true, 
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    });
    
    // Create room
    router.post('/rooms', async (req, res) => {
        try {
            const { sessionId, username, duration = 15, maxMembers = 10, enableScreenshotProtection = true, enableMessageEncryption = true } = req.body;
            
            if (!sessionId || !username) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID and username are required'
                });
            }
            
            if (duration < 5 || duration > 480) { // 5 minutes to 8 hours
                return res.status(400).json({
                    success: false,
                    error: 'Duration must be between 5 and 480 minutes'
                });
            }
            
            // Find or create user
            const user = await findOrCreateUser(sessionId, username);
            
            // Generate unique room code
            let roomCode;
            let attempts = 0;
            do {
                roomCode = generateRoomCode();
                const [existingRoom] = await db.select().from(rooms).where(eq(rooms.code, roomCode));
                if (!existingRoom) break;
                attempts++;
            } while (attempts < 10);
            
            if (attempts >= 10) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to generate unique room code'
                });
            }
            
            // Calculate expiry time
            const expiresAt = new Date(Date.now() + duration * 60 * 1000);
            
            // Create room
            const [room] = await db.insert(rooms).values({
                code: roomCode,
                adminId: user.id,
                duration,
                maxMembers,
                enableScreenshotProtection,
                enableMessageEncryption,
                memberCount: 1,
                isActive: true,
                expiresAt
            }).returning();
            
            // Add creator as member
            await db.insert(roomMembers).values({
                roomId: room.id,
                userId: user.id,
                sessionId,
                isAdmin: true,
                isActive: true
            });
            
            res.json({
                success: true,
                room: {
                    ...room,
                    admin: user
                },
                user
            });
        } catch (error) {
            console.error('Create room error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create room'
            });
        }
    });
    
    // Get room info
    router.get('/rooms/:code', async (req, res) => {
        try {
            const { code } = req.params;
            
            // Find room
            const [room] = await db.select().from(rooms)
                .where(and(eq(rooms.code, code), eq(rooms.isActive, true)))
                .limit(1);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }
            
            // Check if room is expired
            if (new Date() > new Date(room.expiresAt)) {
                // Mark as inactive
                await db.update(rooms)
                    .set({ isActive: false })
                    .where(eq(rooms.id, room.id));
                
                return res.status(404).json({
                    success: false,
                    error: 'Room has expired'
                });
            }
            
            // Get admin info
            const [admin] = await db.select().from(users).where(eq(users.id, room.adminId));
            
            res.json({
                success: true,
                room: {
                    ...room,
                    admin,
                    encrypted: room.enableMessageEncryption
                }
            });
        } catch (error) {
            console.error('Get room error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get room information'
            });
        }
    });
    
    // Join room
    router.post('/rooms/:code/join', async (req, res) => {
        try {
            const { code } = req.params;
            const { sessionId, username } = req.body;
            
            if (!sessionId || !username) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID and username are required'
                });
            }
            
            // Find room
            const [room] = await db.select().from(rooms)
                .where(and(eq(rooms.code, code), eq(rooms.isActive, true)))
                .limit(1);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }
            
            // Check if room is expired
            if (new Date() > new Date(room.expiresAt)) {
                await db.update(rooms)
                    .set({ isActive: false })
                    .where(eq(rooms.id, room.id));
                
                return res.status(404).json({
                    success: false,
                    error: 'Room has expired'
                });
            }
            
            // Check if room is full
            if (room.memberCount >= room.maxMembers) {
                return res.status(403).json({
                    success: false,
                    error: 'Room is full'
                });
            }
            
            // Find or create user
            const user = await findOrCreateUser(sessionId, username);
            
            // Check if user is already in room
            const [existingMember] = await db.select().from(roomMembers)
                .where(and(
                    eq(roomMembers.roomId, room.id),
                    eq(roomMembers.sessionId, sessionId),
                    eq(roomMembers.isActive, true)
                ));
            
            if (existingMember) {
                return res.json({
                    success: true,
                    room,
                    user,
                    message: 'Already in room'
                });
            }
            
            // Add user to room
            await db.insert(roomMembers).values({
                roomId: room.id,
                userId: user.id,
                sessionId,
                isAdmin: false,
                isActive: true
            });
            
            // Update member count
            await db.update(rooms)
                .set({ memberCount: room.memberCount + 1 })
                .where(eq(rooms.id, room.id));
            
            res.json({
                success: true,
                room: {
                    ...room,
                    memberCount: room.memberCount + 1
                },
                user
            });
        } catch (error) {
            console.error('Join room error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to join room'
            });
        }
    });
    
    // Leave room
    router.post('/rooms/:code/leave', async (req, res) => {
        try {
            const { code } = req.params;
            const { sessionId } = req.body;
            
            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID is required'
                });
            }
            
            // Find room
            const [room] = await db.select().from(rooms)
                .where(eq(rooms.code, code))
                .limit(1);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }
            
            // Find member
            const [member] = await db.select().from(roomMembers)
                .where(and(
                    eq(roomMembers.roomId, room.id),
                    eq(roomMembers.sessionId, sessionId),
                    eq(roomMembers.isActive, true)
                ));
            
            if (!member) {
                return res.json({
                    success: true,
                    message: 'Not in room'
                });
            }
            
            // Mark as left
            await db.update(roomMembers)
                .set({ 
                    isActive: false, 
                    leftAt: new Date() 
                })
                .where(eq(roomMembers.id, member.id));
            
            // Update member count
            if (room.memberCount > 0) {
                await db.update(rooms)
                    .set({ memberCount: room.memberCount - 1 })
                    .where(eq(rooms.id, room.id));
            }
            
            res.json({
                success: true,
                message: 'Left room successfully'
            });
        } catch (error) {
            console.error('Leave room error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to leave room'
            });
        }
    });
    
    // Get room members
    router.get('/rooms/:code/members', async (req, res) => {
        try {
            const { code } = req.params;
            
            // Find room
            const [room] = await db.select().from(rooms)
                .where(and(eq(rooms.code, code), eq(rooms.isActive, true)))
                .limit(1);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }
            
            // Get active members
            const members = await db.select({
                id: roomMembers.id,
                sessionId: roomMembers.sessionId,
                isAdmin: roomMembers.isAdmin,
                joinedAt: roomMembers.joinedAt,
                username: users.username,
                userId: users.id
            })
            .from(roomMembers)
            .innerJoin(users, eq(roomMembers.userId, users.id))
            .where(and(
                eq(roomMembers.roomId, room.id),
                eq(roomMembers.isActive, true)
            ))
            .orderBy(roomMembers.joinedAt);
            
            res.json({
                success: true,
                members
            });
        } catch (error) {
            console.error('Get members error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get room members'
            });
        }
    });
    
    // Kick member (admin only)
    router.post('/rooms/:code/members/:targetSessionId/kick', async (req, res) => {
        try {
            const { code, targetSessionId } = req.params;
            const { sessionId } = req.body;
            
            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID is required'
                });
            }
            
            // Find room
            const [room] = await db.select().from(rooms)
                .where(and(eq(rooms.code, code), eq(rooms.isActive, true)))
                .limit(1);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }
            
            // Check if requester is admin
            const [adminMember] = await db.select().from(roomMembers)
                .where(and(
                    eq(roomMembers.roomId, room.id),
                    eq(roomMembers.sessionId, sessionId),
                    eq(roomMembers.isAdmin, true),
                    eq(roomMembers.isActive, true)
                ));
            
            if (!adminMember) {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }
            
            // Find target member
            const [targetMember] = await db.select().from(roomMembers)
                .innerJoin(users, eq(roomMembers.userId, users.id))
                .where(and(
                    eq(roomMembers.roomId, room.id),
                    eq(roomMembers.sessionId, targetSessionId),
                    eq(roomMembers.isActive, true)
                ));
            
            if (!targetMember) {
                return res.status(404).json({
                    success: false,
                    error: 'Member not found'
                });
            }
            
            // Cannot kick admin
            if (targetMember.room_members.isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Cannot kick admin'
                });
            }
            
            // Remove member
            await db.update(roomMembers)
                .set({ 
                    isActive: false, 
                    leftAt: new Date() 
                })
                .where(eq(roomMembers.id, targetMember.room_members.id));
            
            // Update member count
            if (room.memberCount > 0) {
                await db.update(rooms)
                    .set({ memberCount: room.memberCount - 1 })
                    .where(eq(rooms.id, room.id));
            }
            
            res.json({
                success: true,
                message: 'Member kicked successfully'
            });
        } catch (error) {
            console.error('Kick member error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to kick member'
            });
        }
    });
    
    // Extend room (admin only)
    router.post('/rooms/:code/extend', async (req, res) => {
        try {
            const { code } = req.params;
            const { sessionId, minutes = 15 } = req.body;
            
            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID is required'
                });
            }
            
            // Find room
            const [room] = await db.select().from(rooms)
                .where(and(eq(rooms.code, code), eq(rooms.isActive, true)))
                .limit(1);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }
            
            // Check if requester is admin
            const [adminMember] = await db.select().from(roomMembers)
                .where(and(
                    eq(roomMembers.roomId, room.id),
                    eq(roomMembers.sessionId, sessionId),
                    eq(roomMembers.isAdmin, true),
                    eq(roomMembers.isActive, true)
                ));
            
            if (!adminMember) {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }
            
            // Extend expiry time
            const newExpiresAt = new Date(new Date(room.expiresAt).getTime() + minutes * 60 * 1000);
            
            const [updatedRoom] = await db.update(rooms)
                .set({ expiresAt: newExpiresAt })
                .where(eq(rooms.id, room.id))
                .returning();
            
            res.json({
                success: true,
                room: updatedRoom,
                message: `Room extended by ${minutes} minutes`
            });
        } catch (error) {
            console.error('Extend room error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to extend room'
            });
        }
    });
    
    // Close room (admin only)
    router.delete('/rooms/:code/close', async (req, res) => {
        try {
            const { code } = req.params;
            const { sessionId } = req.body;
            
            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID is required'
                });
            }
            
            // Find room
            const [room] = await db.select().from(rooms)
                .where(and(eq(rooms.code, code), eq(rooms.isActive, true)))
                .limit(1);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }
            
            // Check if requester is admin
            const [adminMember] = await db.select().from(roomMembers)
                .where(and(
                    eq(roomMembers.roomId, room.id),
                    eq(roomMembers.sessionId, sessionId),
                    eq(roomMembers.isAdmin, true),
                    eq(roomMembers.isActive, true)
                ));
            
            if (!adminMember) {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }
            
            // Mark room as inactive
            await db.update(rooms)
                .set({ isActive: false })
                .where(eq(rooms.id, room.id));
            
            // Mark all members as inactive
            await db.update(roomMembers)
                .set({ 
                    isActive: false, 
                    leftAt: new Date() 
                })
                .where(eq(roomMembers.roomId, room.id));
            
            res.json({
                success: true,
                message: 'Room closed successfully'
            });
        } catch (error) {
            console.error('Close room error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to close room'
            });
        }
    });
    
    // Get room messages
    router.get('/rooms/:code/messages', async (req, res) => {
        try {
            const { code } = req.params;
            const sessionId = req.headers['x-session-id'];
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            
            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID header required'
                });
            }
            
            // Find room
            const [room] = await db.select().from(rooms)
                .where(and(eq(rooms.code, code), eq(rooms.isActive, true)))
                .limit(1);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }
            
            // Check if user is member
            const [member] = await db.select().from(roomMembers)
                .where(and(
                    eq(roomMembers.roomId, room.id),
                    eq(roomMembers.sessionId, sessionId),
                    eq(roomMembers.isActive, true)
                ));
            
            if (!member) {
                return res.status(403).json({
                    success: false,
                    error: 'Not a member of this room'
                });
            }
            
            // Get messages
            const roomMessages = await db.select({
                id: messages.id,
                content: messages.content,
                encrypted: messages.encrypted,
                messageType: messages.messageType,
                createdAt: messages.createdAt,
                sessionId: messages.sessionId,
                user: {
                    id: users.id,
                    username: users.username
                }
            })
            .from(messages)
            .innerJoin(users, eq(messages.userId, users.id))
            .where(eq(messages.roomId, room.id))
            .orderBy(desc(messages.createdAt))
            .limit(limit)
            .offset(offset);
            
            // Reverse to get chronological order
            roomMessages.reverse();
            
            res.json({
                success: true,
                messages: roomMessages.map(msg => ({
                    ...msg,
                    timestamp: new Date(msg.createdAt).getTime()
                }))
            });
        } catch (error) {
            console.error('Get messages error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get messages'
            });
        }
    });
    
    // Send message (handled via WebSocket, but keeping for completeness)
    router.post('/rooms/:code/messages', async (req, res) => {
        try {
            const { code } = req.params;
            const { sessionId, content, encrypted = false } = req.body;
            
            if (!sessionId || !content) {
                return res.status(400).json({
                    success: false,
                    error: 'Session ID and content are required'
                });
            }
            
            // Find room
            const [room] = await db.select().from(rooms)
                .where(and(eq(rooms.code, code), eq(rooms.isActive, true)))
                .limit(1);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }
            
            // Check if user is member
            const [member] = await db.select().from(roomMembers)
                .innerJoin(users, eq(roomMembers.userId, users.id))
                .where(and(
                    eq(roomMembers.roomId, room.id),
                    eq(roomMembers.sessionId, sessionId),
                    eq(roomMembers.isActive, true)
                ));
            
            if (!member) {
                return res.status(403).json({
                    success: false,
                    error: 'Not a member of this room'
                });
            }
            
            // Save message
            const [message] = await db.insert(messages).values({
                roomId: room.id,
                userId: member.users.id,
                sessionId,
                content,
                encrypted,
                messageType: 'user'
            }).returning();
            
            res.json({
                success: true,
                message: {
                    ...message,
                    user: {
                        id: member.users.id,
                        username: member.users.username
                    },
                    timestamp: new Date(message.createdAt).getTime()
                }
            });
        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send message'
            });
        }
    });
    
    // Mount API routes
    app.use('/api', router);
    
    // Setup WebSocket server
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
    setupWebSocket(wss, db);
}

module.exports = { setupRoutes };
