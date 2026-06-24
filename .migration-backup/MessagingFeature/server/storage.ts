/**
 * MessagingFeature Storage Interface
 * 
 * This file contains database access methods for the messaging feature.
 */

import { 
  chatSessions, 
  messages, 
  supportMessages,
  type ChatSession, 
  type InsertChatSession,
  type Message,
  type InsertMessage,
  type SupportMessage,
  type InsertSupportMessage
} from '../shared/schema';

import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// This interface assumes you'll inject a database connection
export interface IMessagingStorage {
  // Chat sessions
  createChatSession(): Promise<string>;
  getChatSession(sessionId: string): Promise<ChatSession | null>;
  
  // Messages
  getMessages(sessionId: string): Promise<Message[]>;
  addMessage(message: InsertMessage): Promise<Message>;
  
  // Support messages
  getSupportMessages(userId: string): Promise<SupportMessage[]>;
  getSupportMessagesForAdmin(): Promise<SupportMessage[]>;
  addSupportMessage(message: InsertSupportMessage): Promise<SupportMessage>;
  markSupportMessageAsRead(messageId: number): Promise<boolean>;
}

// Implementation class - requires a database instance to be injected
export class MessagingStorage implements IMessagingStorage {
  private db: any;
  
  constructor(db: any) {
    this.db = db;
  }
  
  // Chat sessions
  async createChatSession(): Promise<string> {
    const sessionId = uuidv4();
    
    await this.db.insert(chatSessions).values({
      id: sessionId,
      createdAt: new Date()
    });
    
    return sessionId;
  }
  
  async getChatSession(sessionId: string): Promise<ChatSession | null> {
    const result = await this.db.select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  }
  
  // Messages
  async getMessages(sessionId: string): Promise<Message[]> {
    return await this.db.select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.timestamp);
  }
  
  async addMessage(message: InsertMessage): Promise<Message> {
    const result = await this.db.insert(messages)
      .values(message)
      .returning();
    
    return result[0];
  }
  
  // Support messages
  async getSupportMessages(userId: string): Promise<SupportMessage[]> {
    return await this.db.select()
      .from(supportMessages)
      .where(eq(supportMessages.userId, userId))
      .orderBy(desc(supportMessages.timestamp));
  }
  
  async getSupportMessagesForAdmin(): Promise<SupportMessage[]> {
    return await this.db.select()
      .from(supportMessages)
      .orderBy(desc(supportMessages.timestamp));
  }
  
  async addSupportMessage(message: InsertSupportMessage): Promise<SupportMessage> {
    const result = await this.db.insert(supportMessages)
      .values(message)
      .returning();
    
    return result[0];
  }
  
  async markSupportMessageAsRead(messageId: number): Promise<boolean> {
    const result = await this.db.update(supportMessages)
      .set({ isRead: true })
      .where(eq(supportMessages.id, messageId))
      .returning();
    
    return result.length > 0;
  }
}