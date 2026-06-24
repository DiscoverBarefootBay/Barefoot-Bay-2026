/**
 * MessagingFeature Routes
 * 
 * This file contains API routes for the messaging feature.
 */

import express, { Request, Response, Router } from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { IMessagingStorage } from './storage';
import { z } from 'zod';
import { insertMessageSchema } from '../shared/schema';

// Type definition for authenticated request if authentication is used
interface AuthRequest extends Request {
  user?: {
    id: string;
    role?: string;
  };
}

// Authentication middleware - replace with your own implementation
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  // TODO: Replace with your authentication logic
  if ((req as AuthRequest).user) {
    return next();
  }
  
  return res.status(401).json({ message: "Unauthorized" });
};

// Create and configure the messaging routes
export function configureMessagingRoutes(
  app: express.Express, 
  httpServer: ReturnType<typeof createServer>,
  storage: IMessagingStorage
) {
  const router = Router();
  
  // Create chat session
  router.post("/session", async (req: Request, res: Response) => {
    try {
      const sessionId = await storage.createChatSession();
      res.json({ sessionId });
    } catch (error) {
      console.error("Error creating chat session:", error);
      res.status(500).json({ message: "Failed to create chat session" });
    }
  });
  
  // Get messages for a chat session
  router.get("/messages/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getMessages(sessionId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  
  // Send a message
  router.post("/messages", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = insertMessageSchema.parse(req.body);
      
      // Add message to database
      const message = await storage.addMessage(validatedData);
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  
  // Get support messages (for authenticated users)
  router.get("/support", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user is admin to determine which messages to fetch
      const isAdmin = req.user?.role === "admin";
      let messages;
      
      if (isAdmin) {
        messages = await storage.getSupportMessagesForAdmin();
      } else {
        messages = await storage.getSupportMessages(userId);
      }
      
      return res.json(messages);
    } catch (error) {
      console.error("Error fetching support messages:", error);
      return res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  
  // Mark support message as read
  router.patch("/support/:messageId/read", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const { messageId } = req.params;
      
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const updated = await storage.markSupportMessageAsRead(parseInt(messageId));
      
      if (!updated) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error marking message as read:", error);
      return res.status(500).json({ message: "Failed to update message" });
    }
  });
  
  // Send support message
  router.post("/support", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Validate request body using zod schema
      const messageSchema = z.object({
        content: z.string().min(1),
        threadId: z.string().default(() => crypto.randomUUID())
      });
      
      const { content, threadId } = messageSchema.parse(req.body);
      
      // Add message to database
      const message = await storage.addSupportMessage({
        userId,
        content,
        threadId,
        timestamp: new Date(),
        isRead: false
      });
      
      return res.status(201).json(message);
    } catch (error) {
      console.error("Error sending support message:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      
      return res.status(500).json({ message: "Failed to send message" });
    }
  });
  
  // Register the router
  app.use("/api/chat", router);
  
  // Set up WebSocket server for real-time messaging
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws'  // Distinct path so it doesn't conflict with other WebSockets
  });
  
  // WebSocket connection handler
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Validate message structure
        if (!message.type || !message.sessionId) {
          ws.send(JSON.stringify({ 
            error: 'Invalid message format. Must include type and sessionId.' 
          }));
          return;
        }
        
        // Handle different message types
        switch (message.type) {
          case 'message':
            // Store message in database
            if (message.payload?.content && message.payload?.role) {
              const storedMessage = await storage.addMessage({
                sessionId: message.sessionId,
                content: message.payload.content,
                role: message.payload.role,
                timestamp: new Date()
              });
              
              // Broadcast message to all connected clients for the same session
              wss.clients.forEach((client) => {
                client.send(JSON.stringify({
                  type: 'message',
                  payload: storedMessage,
                  sessionId: message.sessionId
                }));
              });
            }
            break;
            
          case 'typing':
            // Broadcast typing indicator
            wss.clients.forEach((client) => {
              if (client !== ws) {
                client.send(JSON.stringify({
                  type: 'typing',
                  payload: { isTyping: message.payload?.isTyping ?? true },
                  sessionId: message.sessionId
                }));
              }
            });
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({ error: 'Failed to process message' }));
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  return { router, wss };
}