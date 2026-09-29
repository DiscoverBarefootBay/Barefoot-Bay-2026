import { pgTable, text, integer, jsonb, timestamp, uniqueIndex, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const messageSendRequests = pgTable("message_send_requests", {
  id: text("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  requestKey: text("request_key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  emailRequested: boolean("email_requested").notNull().default(false),
  templateId: text("template_id"),
  messageId: integer("message_id"),
  state: text("state").notNull().default("preparing"),
  response: jsonb("response"),
  responseCode: integer("response_code"),
  skipped: integer("skipped").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("message_send_requests_sender_key").on(t.senderId, t.requestKey)]);
export const messageEmailAttempts = pgTable("message_email_attempts", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  address: text("address").notNull(),
  recipientIds: integer("recipient_ids").array().notNull().default([]),
  state: text("state").notNull().default("queued"),
  startedAt: timestamp("started_at", { withTimezone: true }),
}, t => [index("message_email_attempts_queue").on(t.state), index("message_email_attempts_request").on(t.requestId)]);
export const insertMessageSendRequestSchema = createInsertSchema(messageSendRequests);
export type MessageSendRequest = typeof messageSendRequests.$inferSelect;