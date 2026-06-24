/**
 * MessagingFeature Types
 * 
 * This file contains type definitions for the messaging feature.
 */

// Basic message structure
export interface Message {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  sessionId?: string;
}

// Chat session
export interface ChatSession {
  id: string;
  createdAt: Date;
  contactInfo?: any;
}

// Quick reply options for chat interface
export interface QuickReply {
  emoji: string;
  text: string;
  action: string;
}

// Support message for admin dashboard
export interface SupportMessage {
  id: number;
  userId: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  threadId: string;
}

// Websocket message type
export interface WebSocketMessage {
  type: 'message' | 'typing' | 'read' | 'connect' | 'disconnect';
  payload: any;
  sessionId: string;
  timestamp: Date;
}