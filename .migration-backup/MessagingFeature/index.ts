/**
 * Messaging Feature
 * 
 * A complete and modular chat/messaging system with real-time capabilities.
 * 
 * Features:
 * - Real-time messaging using WebSockets
 * - Persistent message storage in PostgreSQL
 * - Responsive UI for desktop and mobile
 * - Typing indicators
 * - Quick replies
 * - Support for authenticated users
 * 
 * Version: 1.0.0
 */

// Export client-side components and hooks
export * from './client';

// Export server-side components
export * from './server';

// Export type interfaces only to avoid naming conflicts
// Users should import specific schema objects directly if needed
export type {
  Message,
  ChatSession,
  QuickReply,
  SupportMessage,
  WebSocketMessage
} from './shared/types';