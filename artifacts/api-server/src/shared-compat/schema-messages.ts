import { pgTable, serial, text, boolean, timestamp, varchar, foreignKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Messages schema for the community messaging system
 * 
 * - Messages can be sent from any user to specific recipients
 * - Regular users can only message admins
 * - Admins can message any user or user groups
 * - Messages support attachments
 */

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  senderId: serial('sender_id').notNull(),
  messageType: text('message_type').notNull().default('user'),
  inReplyTo: serial('in_reply_to'),
  deletedAt: timestamp('deleted_at'), // Soft delete for senders
  deletedBySender: boolean('deleted_by_sender').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const messageAttachments = pgTable('message_attachments', {
  id: varchar('id').primaryKey(),
  messageId: serial('message_id').notNull(),
  filename: varchar('filename').notNull(),
  url: varchar('url').notNull(),
  storedFilename: varchar('stored_filename'),
  size: varchar('size'),
  contentType: varchar('content_type'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const messageRecipients = pgTable('message_recipients', {
  id: serial('id').primaryKey(),
  messageId: serial('message_id').notNull(),
  recipientId: serial('recipient_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  readAt: timestamp('read_at'),
  targetRole: text('target_role'),
  status: text('status')
});