const { WebSocket } = require('ws');
const { users, rooms, roomMembers, messages } = require('../shared/schema');
const { eq, and } = require('drizzle-orm');

// Store active connections
const connections = new Map();
const roomConnections = new Map();

function setupWebSocket(wss, db) {
    wss.on('connection', (ws, req) => {
        console.log('New WebSocket connection');
        
        ws.isAlive = true;
        ws.roomCode = null;
        ws.sessionId = null;
        ws.userId = null;
        
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                await handleMessage(ws, message, db);
            } catch (error) {
                console.error('WebSocket message error:', error);
                sendError(ws, 'Invalid message format');
            }
        });
        
        ws.on('close', () => {
            handleDisconnection(ws, db);
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            handleDisconnection(ws, db);
        });
    });
    
    // Heartbeat to detect broken connections
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                console.log('Terminating dead connection');
                handleDisconnection(ws, db);
                return ws.terminate();
            }
            
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
    
    wss.on('close', () => {
        clearInterval(interval);
    });
}

async function handleMessage(ws, message, db) {
    const { type, roomCode, sessionId } = message;
    
    switch (type) {
        case 'ping':
            send(ws, { type: 'pong' });
            break;
            
        case 'join':
            await handleJoin(ws, message, db);
            break;
            
        case 'leave':
            await handleLeave(ws, message, db);
            break;
            
        case 'message':
            await handleChatMessage(ws, message, db);
            break;
            
        case 'typing':
            await handleTyping(ws, message, db);
            break;
            
        case 'kick_user':
            await handleKickUser(ws, message, db);
            break;
            
        default:
            sendError(ws, 'Unknown message type');
    }
}

async function handleJoin(ws, message, db) {
    try {
        const { roomCode, sessionId } = message;
        
        if (!roomCode || !sessionId) {
            return sendError(ws, 'Room code and session ID are required');
        }
        
        // Find room
        const [room] = await db.select().from(rooms)
            .where(and(eq(rooms.code, roomCode), eq(rooms.isActive, true)))
            .limit(1);
        
        if (!room) {
            return sendError(ws, 'Room not found');
        }
        
        // Check if room is expired
        if (new Date() > new Date(room.expiresAt)) {
            await db.update(rooms)
                .set({ isActive: false })
                .where(eq(rooms.id, room.id));
            
            return sendError(ws, 'Room has expired');
        }
        
        // Find user and membership
        const [member] = await db.select({
            id: roomMembers.id,
            isAdmin: roomMembers.isAdmin,
            userId: users.id,
            username: users.username,
            sessionId: roomMembers.sessionId
        })
        .from(roomMembers)
        .innerJoin(users, eq(roomMembers.userId, users.id))
        .where(and(
            eq(roomMembers.roomId, room.id),
            eq(roomMembers.sessionId, sessionId),
            eq(roomMembers.isActive, true)
        ))
        .limit(1);
        
        if (!member) {
            return sendError(ws, 'Not a member of this room');
        }
        
        // Store connection info
        ws.roomCode = roomCode;
        ws.sessionId = sessionId;
        ws.userId = member.userId;
        ws.username = member.username;
        ws.isAdmin = member.isAdmin;
        
        // Add to connection maps
        connections.set(sessionId, ws);
        
        if (!roomConnections.has(roomCode)) {
            roomConnections.set(roomCode, new Set());
        }
        roomConnections.get(roomCode).add(ws);
        
        // Notify room of new user
        const memberCount = roomConnections.get(roomCode).size;
        broadcastToRoom(roomCode, {
            type: 'user_joined',
            user: {
                id: member.userId,
                username: member.username,
                sessionId: sessionId,
                isAdmin: member.isAdmin
            },
            memberCount
        }, sessionId);
        
        // Send success response
        send(ws, {
            type: 'joined',
            roomCode,
            user: {
                id: member.userId,
                username: member.username,
                isAdmin: member.isAdmin
            },
            memberCount
        });
        
        console.log(`User ${member.username} joined room ${roomCode}`);
    } catch (error) {
        console.error('Join error:', error);
        sendError(ws, 'Failed to join room');
    }
}

async function handleLeave(ws, message, db) {
    const { sessionId } = message;
    
    if (ws.roomCode && ws.sessionId) {
        await removeFromRoom(ws, db);
    }
}

async function handleChatMessage(ws, message, db) {
    try {
        const { content, sessionId, encrypted = false } = message;
        
        if (!ws.roomCode || !ws.sessionId) {
            return sendError(ws, 'Not connected to a room');
        }
        
        if (!content || content.trim().length === 0) {
            return sendError(ws, 'Message content is required');
        }
        
        if (content.length > 1000) {
            return sendError(ws, 'Message too long');
        }
        
        // Find room
        const [room] = await db.select().from(rooms)
            .where(and(eq(rooms.code, ws.roomCode), eq(rooms.isActive, true)))
            .limit(1);
        
        if (!room) {
            return sendError(ws, 'Room not found');
        }
        
        // Save message to database
        const [savedMessage] = await db.insert(messages).values({
            roomId: room.id,
            userId: ws.userId,
            sessionId: ws.sessionId,
            content: content.trim(),
            encrypted,
            messageType: 'user'
        }).returning();
        
        // Broadcast to room
        const messageData = {
            type: 'message',
            id: savedMessage.id,
            content: savedMessage.content,
            encrypted: savedMessage.encrypted,
            user: {
                id: ws.userId,
                username: ws.username,
                isAdmin: ws.isAdmin
            },
            sessionId: ws.sessionId,
            timestamp: new Date(savedMessage.createdAt).getTime()
        };
        
        broadcastToRoom(ws.roomCode, messageData);
        
    } catch (error) {
        console.error('Chat message error:', error);
        sendError(ws, 'Failed to send message');
    }
}

async function handleTyping(ws, message, db) {
    const { isTyping } = message;
    
    if (!ws.roomCode || !ws.sessionId) {
        return;
    }
    
    // Broadcast typing status to room (except sender)
    broadcastToRoom(ws.roomCode, {
        type: 'typing',
        user: {
            id: ws.userId,
            username: ws.username
        },
        sessionId: ws.sessionId,
        isTyping: !!isTyping
    }, ws.sessionId);
}

async function handleKickUser(ws, message, db) {
    try {
        const { targetSessionId } = message;
        
        if (!ws.roomCode || !ws.sessionId || !ws.isAdmin) {
            return sendError(ws, 'Admin access required');
        }
        
        if (!targetSessionId) {
            return sendError(ws, 'Target session ID required');
        }
        
        // Find target connection
        const targetWs = connections.get(targetSessionId);
        if (targetWs && targetWs.roomCode === ws.roomCode) {
            // Send kick message to target
            send(targetWs, {
                type: 'user_kicked',
                sessionId: targetSessionId,
                reason: 'Kicked by admin'
            });
            
            // Remove from room
            await removeFromRoom(targetWs, db);
            
            // Notify room
            broadcastToRoom(ws.roomCode, {
                type: 'user_kicked',
                user: {
                    username: targetWs.username
                },
                sessionId: targetSessionId
            });
        }
        
    } catch (error) {
        console.error('Kick user error:', error);
        sendError(ws, 'Failed to kick user');
    }
}

async function handleDisconnection(ws, db) {
    if (ws.sessionId) {
        connections.delete(ws.sessionId);
    }
    
    if (ws.roomCode) {
        await removeFromRoom(ws, db);
    }
}

async function removeFromRoom(ws, db) {
    try {
        const roomCode = ws.roomCode;
        const sessionId = ws.sessionId;
        const username = ws.username;
        
        // Remove from room connections
        if (roomConnections.has(roomCode)) {
            roomConnections.get(roomCode).delete(ws);
            
            // Clean up empty room
            if (roomConnections.get(roomCode).size === 0) {
                roomConnections.delete(roomCode);
            }
        }
        
        // Update database - mark as left
        if (sessionId && roomCode) {
            const [room] = await db.select().from(rooms)
                .where(eq(rooms.code, roomCode))
                .limit(1);
            
            if (room) {
                await db.update(roomMembers)
                    .set({ 
                        isActive: false, 
                        leftAt: new Date() 
                    })
                    .where(and(
                        eq(roomMembers.roomId, room.id),
                        eq(roomMembers.sessionId, sessionId)
                    ));
                
                // Update member count
                const remainingCount = roomConnections.get(roomCode)?.size || 0;
                await db.update(rooms)
                    .set({ memberCount: remainingCount })
                    .where(eq(rooms.id, room.id));
                
                // Notify room of user leaving
                if (username && remainingCount > 0) {
                    broadcastToRoom(roomCode, {
                        type: 'user_left',
                        user: {
                            username: username
                        },
                        sessionId: sessionId,
                        memberCount: remainingCount
                    }, sessionId);
                }
            }
        }
        
        // Clear connection data
        ws.roomCode = null;
        ws.sessionId = null;
        ws.userId = null;
        ws.username = null;
        ws.isAdmin = false;
        
        console.log(`User ${username || 'unknown'} left room ${roomCode || 'unknown'}`);
    } catch (error) {
        console.error('Remove from room error:', error);
    }
}

function broadcastToRoom(roomCode, message, excludeSessionId = null) {
    const roomConnections_ = roomConnections.get(roomCode);
    if (!roomConnections_) return;
    
    roomConnections_.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN && 
            ws.sessionId !== excludeSessionId) {
            send(ws, message);
        }
    });
}

function send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('Send message error:', error);
        }
    }
}

function sendError(ws, error) {
    send(ws, {
        type: 'error',
        error: error
    });
}

// Periodic cleanup of expired rooms
async function cleanupExpiredRooms(db) {
    try {
        // Find expired rooms
        const expiredRooms = await db.select()
            .from(rooms)
            .where(and(
                eq(rooms.isActive, true),
                eq(rooms.expiresAt, new Date())
            ));
        
        for (const room of expiredRooms) {
            // Mark room as inactive
            await db.update(rooms)
                .set({ isActive: false })
                .where(eq(rooms.id, room.id));
            
            // Notify connected users
            broadcastToRoom(room.code, {
                type: 'room_expired',
                roomCode: room.code
            });
            
            // Remove all connections
            const roomConnections_ = roomConnections.get(room.code);
            if (roomConnections_) {
                roomConnections_.forEach(ws => {
                    ws.close(3000, 'Room expired');
                });
                roomConnections.delete(room.code);
            }
            
            console.log(`Cleaned up expired room: ${room.code}`);
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

module.exports = { 
    setupWebSocket, 
    cleanupExpiredRooms,
    broadcastToRoom,
    connections,
    roomConnections
};
