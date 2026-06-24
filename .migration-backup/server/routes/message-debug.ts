import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { db } from '../storage';
import { messages, messageRecipients } from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

const router = Router();

// Add a debug endpoint to help diagnose unread message counting issues
router.get('/messages/debug/count', authenticateUser, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get all messages where the current user is the recipient
    const messageIds = await db.select({
      id: messages.id
    })
    .from(messages)
    .innerJoin(messageRecipients, eq(messages.id, messageRecipients.messageId))
    .where(eq(messageRecipients.recipientId, currentUserId));
    
    // Extract the message IDs
    const messageIdsList = messageIds.map(m => m.id);
    
    if (messageIdsList.length === 0) {
      return res.json({ 
        status: 'debug',
        totalMessages: 0,
        unreadCount: 0,
        details: "No messages found for this user"
      });
    }
    
    // Get read status for these messages
    const messageReadStatus = await db.select()
      .from(messageRecipients)
      .where(
        and(
          inArray(messageRecipients.messageId, messageIdsList),
          eq(messageRecipients.recipientId, currentUserId)
        )
      );
    
    // Count unread messages using the same logic as the main messages endpoint
    let unreadCount = 0;
    
    // Create a map of message IDs to read status
    const readStatusMap = {};
    messageReadStatus.forEach(status => {
      // Use the same logic as in the main messages endpoint
      readStatusMap[status.messageId] = (status.readAt !== null) || (status.status === 'read');
    });
    
    // Count messages that are not in the readStatusMap or are explicitly unread
    const unreadMessages = [];
    messageIdsList.forEach(messageId => {
      if (!readStatusMap[messageId]) {
        unreadCount++;
        unreadMessages.push(messageId);
      }
    });
    
    // Get all message details to compare with the UI
    const allMessages = await db.select()
      .from(messages)
      .where(inArray(messages.id, messageIdsList));
    
    // Return detailed debug information
    return res.json({ 
      status: 'debug',
      totalMessages: messageIdsList.length,
      unreadCount,
      readStatusMapEntries: Object.keys(readStatusMap).length,
      messageReadStatusCount: messageReadStatus.length,
      unreadMessageIds: unreadMessages,
      allMessageDetails: allMessages.map(msg => ({
        id: msg.id,
        subject: msg.subject,
        senderId: msg.senderId,
        isRead: readStatusMap[msg.id] || false,
        createdAt: msg.createdAt
      })),
      readStatusEntries: Object.entries(readStatusMap).map(([msgId, isRead]) => ({
        messageId: parseInt(msgId),
        isRead
      }))
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;