/**
 * MessagingFeature Schema
 * 
 * This file contains database schema definitions for the messaging feature.
 */

import { pgTable, serial, varchar, timestamp, text, jsonb, index, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Chat sessions table
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey(), // UUID for session identifier
  createdAt: timestamp("created_at").notNull().defaultNow(),
  contactInfo: jsonb("contact_info") // Optional contact information when provided
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

// Chat messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id").notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: varchar("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow()
}, (table) => {
  return {
    sessionIdx: index("session_idx").on(table.sessionId)
  };
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const insertMessageSchema = createInsertSchema(messages);

// Support messages for admin dashboard
export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
  threadId: varchar("thread_id").notNull()
}, (table) => {
  return {
    userIdx: index("user_msg_idx").on(table.userId),
    threadIdx: index("thread_idx").on(table.threadId)
  };
});

export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = typeof supportMessages.$inferInsert;

export const insertSupportMessageSchema = createInsertSchema(supportMessages);