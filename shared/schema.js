const { pgTable, text, integer, timestamp, boolean, varchar, serial, uuid } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');

// Users table
const users = pgTable('users', {
    id: serial('id').primaryKey(),
    sessionId: varchar('session_id', { length: 255 }).notNull().unique(),
    username: varchar('username', { length: 50 }).notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Rooms table
const rooms = pgTable('rooms', {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 8 }).notNull().unique(),
    adminId: integer('admin_id').notNull(),
    duration: integer('duration').notNull(), // in minutes
    maxMembers: integer('max_members').default(10),
    enableScreenshotProtection: boolean('enable_screenshot_protection').default(true),
    enableMessageEncryption: boolean('enable_message_encryption').default(true),
    memberCount: integer('member_count').default(0),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at').notNull()
});

// Room members table (junction table)
const roomMembers = pgTable('room_members', {
    id: serial('id').primaryKey(),
    roomId: integer('room_id').notNull(),
    userId: integer('user_id').notNull(),
    sessionId: varchar('session_id', { length: 255 }).notNull(),
    isAdmin: boolean('is_admin').default(false),
    joinedAt: timestamp('joined_at').defaultNow(),
    leftAt: timestamp('left_at'),
    isActive: boolean('is_active').default(true)
});

// Messages table
const messages = pgTable('messages', {
    id: serial('id').primaryKey(),
    roomId: integer('room_id').notNull(),
    userId: integer('user_id').notNull(),
    sessionId: varchar('session_id', { length: 255 }).notNull(),
    content: text('content').notNull(),
    encrypted: boolean('encrypted').default(false),
    messageType: varchar('message_type', { length: 20 }).default('user'), // user, system
    createdAt: timestamp('created_at').defaultNow()
});

// Relations
const usersRelations = relations(users, ({ many }) => ({
    roomMembers: many(roomMembers),
    messages: many(messages),
    adminRooms: many(rooms)
}));

const roomsRelations = relations(rooms, ({ one, many }) => ({
    admin: one(users, {
        fields: [rooms.adminId],
        references: [users.id]
    }),
    members: many(roomMembers),
    messages: many(messages)
}));

const roomMembersRelations = relations(roomMembers, ({ one }) => ({
    room: one(rooms, {
        fields: [roomMembers.roomId],
        references: [rooms.id]
    }),
    user: one(users, {
        fields: [roomMembers.userId],
        references: [users.id]
    })
}));

const messagesRelations = relations(messages, ({ one }) => ({
    room: one(rooms, {
        fields: [messages.roomId],
        references: [rooms.id]
    }),
    user: one(users, {
        fields: [messages.userId],
        references: [users.id]
    })
}));

module.exports = {
    users,
    rooms,
    roomMembers,
    messages,
    usersRelations,
    roomsRelations,
    roomMembersRelations,
    messagesRelations
};
