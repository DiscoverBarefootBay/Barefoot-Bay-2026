import express from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { messages, messageAttachments, messageRecipients } from '../../shared/schema-messages';
import { eq, and, or, desc, inArray, sql, isNull, isNotNull } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

// Diagnostic endpoint to identify unread message count discrepancies
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || isNaN(Number(userId))) {
      return res.status(401).json({ error: 'User not authenticated or invalid ID' });
    }
    
    // Ensure userId is treated as a number
    const userIdNum = Number(userId);
    console.log(`Running message diagnostics for user ${userIdNum}`);
    
    try {
      // Count from the message_recipients table (what should drive the UI notification)
      const rawCountResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(messageRecipients)
        .where(
          and(
            eq(messageRecipients.recipientId, userIdNum),
            eq(messageRecipients.status, 'unread')
          )
        );
      
      const rawUnreadCount = Number(rawCountResult[0]?.count || 0);
      console.log(`Raw unread count (just from message_recipients): ${rawUnreadCount}`);
      
      // Count records that have a null readAt field
      const nullReadAtCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(messageRecipients)
        .where(
          and(
            eq(messageRecipients.recipientId, userIdNum),
            isNull(messageRecipients.readAt)
          )
        );
      
      const nullReadAtTotal = Number(nullReadAtCount[0]?.count || 0);
      console.log(`Count of null readAt fields: ${nullReadAtTotal}`);
      
      // Count with inner join to ensure messages still exist
      const validatedCountResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(messageRecipients)
        .innerJoin(
          messages,
          eq(messageRecipients.messageId, messages.id)
        )
        .where(
          and(
            eq(messageRecipients.recipientId, userIdNum),
            eq(messageRecipients.status, 'unread')
          )
        );
      
      const validatedUnreadCount = Number(validatedCountResult[0]?.count || 0);
      console.log(`Validated unread count (with message join): ${validatedUnreadCount}`);
      
      // Get the unread messages that will display on the /messages page
      const displayedMessages = await db
        .select({
          id: messages.id,
          subject: messages.subject,
          recipientStatus: messageRecipients.status
        })
        .from(messages)
        .innerJoin(
          messageRecipients,
          eq(messages.id, messageRecipients.messageId)
        )
        .where(
          and(
            eq(messageRecipients.recipientId, userIdNum),
            eq(messageRecipients.status, 'unread')
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(30);
      
      // Get a count of the unread messages (same as the count that shows in the UI)
      const unreadMessagesCount = await db
        .select({
          count: sql<number>`COUNT(*)`
        })
        .from(messages)
        .innerJoin(
          messageRecipients,
          eq(messages.id, messageRecipients.messageId)
        )
        .where(
          and(
            eq(messageRecipients.recipientId, userIdNum),
            eq(messageRecipients.status, 'unread')
          )
        );
      
      const uiUnreadCount = Number(unreadMessagesCount[0]?.count || 0);
      console.log(`UI unread messages count: ${uiUnreadCount}`);
      
      return res.json({
        rawUnreadCount,
        nullReadAtTotal,
        validatedUnreadCount,
        uiUnreadCount,
        displayedMessagesCount: displayedMessages.length,
        currentUserId: userIdNum
      });
    } catch (dbError) {
      console.error('Database error in message diagnostics:', dbError);
      return res.status(500).json({ 
        error: 'Database error', 
        details: dbError instanceof Error ? dbError.message : 'Unknown database error' 
      });
    }
  } catch (error) {
    console.error('Error running message diagnostics:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;