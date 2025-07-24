const { db } = require('./db');
const { users, rooms, roomMembers, messages } = require('../shared/schema');
const { eq, and, lt } = require('drizzle-orm');
const { cleanupExpiredRooms } = require('./websocket');

// Cleanup configuration
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MESSAGE_RETENTION_DAYS = 7; // Keep messages for 7 days after room expires
const USER_RETENTION_DAYS = 30; // Keep inactive users for 30 days

function startCleanup() {
    console.log('Starting cleanup service...');
    
    // Initial cleanup
    performCleanup();
    
    // Schedule periodic cleanup
    setInterval(performCleanup, CLEANUP_INTERVAL);
}

async function performCleanup() {
    try {
        console.log('Running cleanup tasks...');
        
        await Promise.all([
            cleanupExpiredRooms(db),
            cleanupInactiveRooms(),
            cleanupOldMessages(),
            cleanupInactiveUsers(),
            cleanupOrphanedMembers()
        ]);
        
        console.log('Cleanup completed successfully');
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

async function cleanupInactiveRooms() {
    try {
        const now = new Date();
        
        // Find rooms that have expired but are still marked as active
        const expiredRooms = await db.select()
            .from(rooms)
            .where(and(
                eq(rooms.isActive, true),
                lt(rooms.expiresAt, now)
            ));
        
        if (expiredRooms.length === 0) {
            return;
        }
        
        console.log(`Found ${expiredRooms.length} expired rooms to cleanup`);
        
        for (const room of expiredRooms) {
            // Mark room as inactive
            await db.update(rooms)
                .set({ isActive: false })
                .where(eq(rooms.id, room.id));
            
            // Mark all active members as inactive
            await db.update(roomMembers)
                .set({ 
                    isActive: false, 
                    leftAt: now 
                })
                .where(and(
                    eq(roomMembers.roomId, room.id),
                    eq(roomMembers.isActive, true)
                ));
            
            console.log(`Deactivated expired room: ${room.code}`);
        }
    } catch (error) {
        console.error('Cleanup inactive rooms error:', error);
    }
}

async function cleanupOldMessages() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - MESSAGE_RETENTION_DAYS);
        
        // Find rooms that expired more than MESSAGE_RETENTION_DAYS ago
        const oldRooms = await db.select()
            .from(rooms)
            .where(and(
                eq(rooms.isActive, false),
                lt(rooms.expiresAt, cutoffDate)
            ));
        
        if (oldRooms.length === 0) {
            return;
        }
        
        console.log(`Found ${oldRooms.length} old rooms with messages to cleanup`);
        
        let totalMessagesDeleted = 0;
        
        for (const room of oldRooms) {
            // Count messages before deletion
            const messageCount = await db.select({ count: messages.id })
                .from(messages)
                .where(eq(messages.roomId, room.id));
            
            // Delete messages for this room
            await db.delete(messages)
                .where(eq(messages.roomId, room.id));
            
            const deletedCount = messageCount.length;
            totalMessagesDeleted += deletedCount;
            
            if (deletedCount > 0) {
                console.log(`Deleted ${deletedCount} messages from room ${room.code}`);
            }
        }
        
        if (totalMessagesDeleted > 0) {
            console.log(`Total messages cleaned up: ${totalMessagesDeleted}`);
        }
    } catch (error) {
        console.error('Cleanup old messages error:', error);
    }
}

async function cleanupInactiveUsers() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - USER_RETENTION_DAYS);
        
        // Find users who haven't been active in rooms for a long time
        const inactiveUsers = await db.select()
            .from(users)
            .where(and(
                eq(users.isActive, true),
                lt(users.updatedAt, cutoffDate)
            ));
        
        if (inactiveUsers.length === 0) {
            return;
        }
        
        console.log(`Found ${inactiveUsers.length} inactive users to cleanup`);
        
        for (const user of inactiveUsers) {
            // Check if user has any recent room activity
            const recentActivity = await db.select()
                .from(roomMembers)
                .where(and(
                    eq(roomMembers.userId, user.id),
                    eq(roomMembers.isActive, true)
                ))
                .limit(1);
            
            // If no recent activity, mark user as inactive
            if (recentActivity.length === 0) {
                await db.update(users)
                    .set({ isActive: false })
                    .where(eq(users.id, user.id));
                
                console.log(`Deactivated inactive user: ${user.username} (${user.sessionId})`);
            }
        }
    } catch (error) {
        console.error('Cleanup inactive users error:', error);
    }
}

async function cleanupOrphanedMembers() {
    try {
        // Find room members that belong to inactive rooms
        const orphanedMembers = await db.select({
            memberId: roomMembers.id,
            roomId: roomMembers.roomId,
            userId: roomMembers.userId
        })
        .from(roomMembers)
        .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
        .where(and(
            eq(roomMembers.isActive, true),
            eq(rooms.isActive, false)
        ));
        
        if (orphanedMembers.length === 0) {
            return;
        }
        
        console.log(`Found ${orphanedMembers.length} orphaned room members to cleanup`);
        
        // Mark orphaned members as inactive
        for (const member of orphanedMembers) {
            await db.update(roomMembers)
                .set({ 
                    isActive: false, 
                    leftAt: new Date() 
                })
                .where(eq(roomMembers.id, member.memberId));
        }
        
        console.log(`Cleaned up ${orphanedMembers.length} orphaned room members`);
    } catch (error) {
        console.error('Cleanup orphaned members error:', error);
    }
}

// Cleanup statistics
async function getCleanupStats() {
    try {
        const [
            totalRooms,
            activeRooms,
            expiredRooms,
            totalUsers,
            activeUsers,
            totalMessages,
            totalMembers,
            activeMembers
        ] = await Promise.all([
            db.select().from(rooms),
            db.select().from(rooms).where(eq(rooms.isActive, true)),
            db.select().from(rooms).where(and(eq(rooms.isActive, false), lt(rooms.expiresAt, new Date()))),
            db.select().from(users),
            db.select().from(users).where(eq(users.isActive, true)),
            db.select().from(messages),
            db.select().from(roomMembers),
            db.select().from(roomMembers).where(eq(roomMembers.isActive, true))
        ]);
        
        return {
            rooms: {
                total: totalRooms.length,
                active: activeRooms.length,
                expired: expiredRooms.length
            },
            users: {
                total: totalUsers.length,
                active: activeUsers.length
            },
            messages: {
                total: totalMessages.length
            },
            members: {
                total: totalMembers.length,
                active: activeMembers.length
            }
        };
    } catch (error) {
        console.error('Get cleanup stats error:', error);
        return null;
    }
}

// Force cleanup (for admin use)
async function forceCleanup() {
    console.log('Force cleanup requested...');
    await performCleanup();
    return await getCleanupStats();
}

module.exports = {
    startCleanup,
    performCleanup,
    forceCleanup,
    getCleanupStats,
    cleanupInactiveRooms,
    cleanupOldMessages,
    cleanupInactiveUsers,
    cleanupOrphanedMembers
};
