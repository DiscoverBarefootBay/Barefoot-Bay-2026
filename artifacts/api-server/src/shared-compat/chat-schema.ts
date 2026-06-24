import { pgTable, serial, text, timestamp, varchar, boolean } from 'drizzle-orm/pg-core';

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  senderId: serial('sender_id').notNull(),
  recipientId: varchar('recipient_id', { length: 255 }).notNull(), // User ID or 'all', 'registered', etc.
  messageType: varchar('message_type', { length: 50 }).default('standard').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const messageAttachments = pgTable('message_attachments', {
  id: serial('id').primaryKey(),
  messageId: varchar('message_id', { length: 255 }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  size: serial('size').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messageReadStatus = pgTable('message_read_status', {
  id: serial('id').primaryKey(),
  messageId: varchar('message_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  read: boolean('read').default(false).notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});