import { eq, and, desc, sql, asc, inArray } from 'drizzle-orm';
import { db } from './db';
import { messages, messageAttachments, messageReadStatus } from '../shared/chat-schema';
import { users } from '../shared/schema';
import { Client as ObjectStorage } from '@replit/object-storage';

class ChatStorage {
  // Get new messages for a user since a specific timestamp
  async getNewMessages(userId: string, since?: string) {
    try {
      // Parse the timestamp if provided
      let timestamp: Date | undefined;
      if (since) {
        timestamp = new Date(since);
      }
      
      // Query for messages after the timestamp
      const messagesResult = await db
        .select({
          id: messages.id,
          subject: messages.subject,
          content: messages.content,
          senderId: messages.senderId,
          recipientId: messages.recipientId,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
          messageType: messages.messageType,
        })
        .from(messages)
        .where(
          and(
            // Messages where this user is recipient
            sql`(${messages.recipientId} = ${userId} OR ${messages.recipientId} = 'all' OR ${messages.recipientId} = 'registered')`,
            // Only get messages after the provided timestamp
            timestamp ? sql`${messages.createdAt} > ${timestamp}` : sql`1=1`
          )
        )
        .orderBy(desc(messages.createdAt));

      // Get read status for these messages
      const messageIds = messagesResult.map(msg => msg.id.toString());
      
      let readStatusResult: any[] = [];
      if (messageIds.length > 0) {
        readStatusResult = await db
          .select()
          .from(messageReadStatus)
          .where(
            and(
              inArray(messageReadStatus.messageId, messageIds),
              eq(messageReadStatus.userId, userId)
            )
          );
      }

      // Create a map of message ID to read status
      const readStatusMap = new Map();
      readStatusResult.forEach(status => {
        readStatusMap.set(status.messageId, status.read);
      });

      // Get sender info for messages
      const senderIds = new Set(messagesResult.map(msg => msg.senderId));
      const senderResults = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(inArray(users.id, Array.from(senderIds)));

      // Create a map of user ID to user info
      const senderMap = new Map();
      senderResults.forEach(user => {
        senderMap.set(user.id, user);
      });

      // Format and return the messages
      const formattedMessages = await Promise.all(
        messagesResult.map(async message => {
          // Get attachment info
          const attachmentsResult = await db
            .select()
            .from(messageAttachments)
            .where(eq(messageAttachments.messageId, message.id.toString()));

          // Get sender info
          const sender = senderMap.get(message.senderId) || { fullName: 'Unknown' };

          return {
            id: message.id.toString(),
            subject: message.subject,
            content: message.content,
            preview: this.createPreview(message.content),
            senderId: message.senderId.toString(),
            senderName: sender.fullName || sender.username,
            recipientId: message.recipientId,
            recipientName: null, // Would need a separate lookup for recipient names
            timestamp: message.createdAt.toISOString(),
            read: readStatusMap.has(message.id.toString()) ? readStatusMap.get(message.id.toString()) : false,
            attachments: attachmentsResult.map(att => ({
              id: att.id,
              url: att.url,
              filename: att.filename,
              size: att.size,
              contentType: att.contentType
            }))
          };
        })
      );

      return formattedMessages;
    } catch (error) {
      console.error('Error getting new messages:', error);
      return [];
    }
  }

  // Get all messages for a user with filters
  async getUserMessages(userId: string, filters: { onlyUnread?: boolean, folder?: string } = {}) {
    try {
      // Get messages based on folder (inbox, sent, all)
      const { folder = 'all', onlyUnread = false } = filters;
      
      // Build query conditions
      let whereCondition;
      if (folder === 'sent') {
        // Only messages sent by this user
        whereCondition = eq(messages.senderId, parseInt(userId, 10));
      } else if (folder === 'inbox') {
        // Only messages received by this user
        whereCondition = sql`(${messages.recipientId} = ${userId} OR ${messages.recipientId} = 'all' OR ${messages.recipientId} = 'registered')`;
      } else {
        // Both sent and received (all)
        whereCondition = sql`(
          ${messages.senderId} = ${parseInt(userId, 10)} OR 
          ${messages.recipientId} = ${userId} OR 
          ${messages.recipientId} = 'all' OR 
          ${messages.recipientId} = 'registered'
        )`;
      }
      
      // Query for messages
      const messagesResult = await db
        .select({
          id: messages.id,
          subject: messages.subject,
          content: messages.content,
          senderId: messages.senderId,
          recipientId: messages.recipientId,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
          messageType: messages.messageType,
        })
        .from(messages)
        .where(whereCondition)
        .orderBy(desc(messages.createdAt));

      // Get message IDs
      const messageIds = messagesResult.map(msg => msg.id.toString());
      
      // Get read status for these messages
      let readStatusResult: any[] = [];
      if (messageIds.length > 0) {
        readStatusResult = await db
          .select()
          .from(messageReadStatus)
          .where(
            and(
              inArray(messageReadStatus.messageId, messageIds),
              eq(messageReadStatus.userId, userId)
            )
          );
      }
      
      // Create a map of message ID to read status
      const readStatusMap = new Map();
      readStatusResult.forEach(status => {
        readStatusMap.set(status.messageId, status.read);
      });
      
      // Get sender info for messages
      const userIds = new Set();
      messagesResult.forEach(msg => {
        userIds.add(msg.senderId);
        // Also add recipient ID if it's a numeric user ID
        if (!isNaN(Number(msg.recipientId))) {
          userIds.add(parseInt(msg.recipientId, 10));
        }
      });
      
      const userResults = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(inArray(users.id, Array.from(userIds)));
      
      // Create a map of user ID to user info
      const userMap = new Map();
      userResults.forEach(user => {
        userMap.set(user.id, user);
      });
      
      // Create list of sent message IDs for the user
      const sentMessageIds = await this.getSentMessageIds(userId);
      
      // Format and filter messages
      const formattedMessages = await Promise.all(
        messagesResult.map(async message => {
          // Skip this message if it's unread-only filter and the message is read
          const isRead = readStatusMap.has(message.id.toString()) ? readStatusMap.get(message.id.toString()) : false;
          
          if (onlyUnread && isRead && !sentMessageIds.has(message.id)) {
            return null;
          }
          
          // Get attachment info for message preview
          const attachmentsResult = await db
            .select()
            .from(messageAttachments)
            .where(eq(messageAttachments.messageId, message.id.toString()));
          
          // Get sender info
          const sender = userMap.get(message.senderId) || { fullName: 'Unknown' };
          
          // Get recipient info if it's a user (not 'all' or 'registered')
          let recipientName = null;
          if (!isNaN(Number(message.recipientId))) {
            const recipientId = parseInt(message.recipientId, 10);
            const recipient = userMap.get(recipientId);
            if (recipient) {
              recipientName = recipient.fullName || recipient.username;
            }
          } else if (message.recipientId === 'all') {
            recipientName = 'All Users';
          } else if (message.recipientId === 'registered') {
            recipientName = 'All Registered Users';
          }
          
          return {
            id: message.id.toString(),
            subject: message.subject,
            content: message.content,
            preview: this.createPreview(message.content),
            senderId: message.senderId.toString(),
            senderName: sender.fullName || sender.username,
            recipientId: message.recipientId,
            recipientName,
            timestamp: message.createdAt.toISOString(),
            read: isRead,
            attachments: attachmentsResult.map(att => ({
              id: att.id,
              url: att.url,
              filename: att.filename,
              size: att.size,
              contentType: att.contentType
            }))
          };
        })
      );
      
      // Filter out null entries (from the unread filter)
      return formattedMessages.filter(msg => msg !== null);
    } catch (error) {
      console.error('Error getting user messages:', error);
      return [];
    }
  }
  
  // Create a preview of the message content
  private createPreview(content: string): string {
    // Strip HTML tags, if any
    const textContent = content.replace(/<[^>]*>?/gm, '');
    
    // Trim to max 100 characters and add ellipsis if needed
    const MAX_PREVIEW_LENGTH = 100;
    return textContent.length > MAX_PREVIEW_LENGTH 
      ? `${textContent.substring(0, MAX_PREVIEW_LENGTH)}...` 
      : textContent;
  }
  
  // Get message by ID for a specific user
  async getMessage(messageId: string, userId: string) {
    try {
      // Get the message
      const result = await db
        .select()
        .from(messages)
        .where(eq(messages.id, parseInt(messageId, 10)))
        .limit(1);
      
      if (!result.length) {
        throw new Error('Message not found');
      }
      
      const message = result[0];
      
      // Check if user has access to this message
      const userHasAccess = 
        // User is the sender
        message.senderId === parseInt(userId, 10) ||
        // User is the specific recipient
        message.recipientId === userId ||
        // Message is for all users
        message.recipientId === 'all' ||
        // Message is for all registered users
        message.recipientId === 'registered';
      
      if (!userHasAccess) {
        throw new Error('Unauthorized access to message');
      }
      
      // Mark as read if user is recipient and not sender
      if (message.senderId !== parseInt(userId, 10)) {
        await this.markMessageAsRead(messageId, userId);
      }
      
      // Get attachments
      const attachmentsResult = await db
        .select()
        .from(messageAttachments)
        .where(eq(messageAttachments.messageId, messageId));
      
      // Get sender user info
      const senderResult = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(eq(users.id, message.senderId))
        .limit(1);
      
      if (!senderResult.length) {
        throw new Error('Sender not found');
      }
      
      const sender = senderResult[0];
      
      // Get recipient name if it's a user ID
      let recipientName = null;
      if (!isNaN(Number(message.recipientId))) {
        const recipientResult = await db
          .select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
          })
          .from(users)
          .where(eq(users.id, parseInt(message.recipientId, 10)))
          .limit(1);
        
        recipientName = recipientResult.length 
          ? (recipientResult[0].fullName || recipientResult[0].username) 
          : null;
      }

      // Get read status
      const readStatusResult = await db
        .select()
        .from(messageReadStatus)
        .where(
          and(
            eq(messageReadStatus.messageId, messageId),
            eq(messageReadStatus.userId, userId)
          )
        )
        .limit(1);

      return {
        id: message.id.toString(),
        subject: message.subject,
        content: message.content,
        preview: this.createPreview(message.content),
        senderId: message.senderId.toString(),
        senderName: sender.fullName || sender.username,
        recipientId: message.recipientId,
        recipientName: recipientName,
        timestamp: message.createdAt.toISOString(),
        read: readStatusResult.length > 0 ? readStatusResult[0].read : false,
        attachments: attachmentsResult.map(att => ({
          id: att.id,
          url: att.url,
          filename: att.filename,
          size: att.size,
          contentType: att.contentType
        }))
      };
    } catch (error) {
      console.error('Error getting message details:', error);
      throw new Error('Failed to fetch message details');
    }
  }

  // Send a new message
  async sendMessage(message: {
    subject: string;
    content: string;
    senderId: string;
    recipientId: string; // User ID or 'all'/'registered'/'badge_holders'
    attachments?: Array<{
      filename: string;
      contentType: string;
      size: number;
      url: string;
    }>;
  }) {
    try {
      // Insert message
      const result = await db
        .insert(messages)
        .values({
          subject: message.subject,
          content: message.content,
          senderId: parseInt(message.senderId, 10),
          recipientId: message.recipientId,
          messageType: 'default',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      if (!result.length) {
        throw new Error('Failed to create message');
      }
      
      const newMessage = result[0];
      
      // Add attachments if any
      if (message.attachments && message.attachments.length > 0) {
        for (const attachment of message.attachments) {
          await db
            .insert(messageAttachments)
            .values({
              messageId: newMessage.id.toString(),
              filename: attachment.filename,
              contentType: attachment.contentType,
              size: attachment.size,
              url: attachment.url,
              createdAt: new Date()
            });
        }
      }
      
      return {
        id: newMessage.id.toString(),
        subject: newMessage.subject,
        senderId: newMessage.senderId.toString(),
        recipientId: newMessage.recipientId,
        timestamp: newMessage.createdAt.toISOString()
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }

  // Mark a message as read
  async markMessageAsRead(messageId: string, userId: string) {
    try {
      // Check if read status entry exists
      const existingEntry = await db
        .select()
        .from(messageReadStatus)
        .where(
          and(
            eq(messageReadStatus.messageId, messageId),
            eq(messageReadStatus.userId, userId)
          )
        )
        .limit(1);
      
      if (existingEntry.length > 0) {
        // Update existing entry
        await db
          .update(messageReadStatus)
          .set({ 
            read: true,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(messageReadStatus.messageId, messageId),
              eq(messageReadStatus.userId, userId)
            )
          );
      } else {
        // Create new entry
        await db
          .insert(messageReadStatus)
          .values({
            messageId,
            userId,
            read: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw new Error('Failed to mark message as read');
    }
  }

  // Delete a message for a user
  async deleteMessage(messageId: string, userId: string) {
    try {
      // Get the message to check permissions
      const messageResult = await db
        .select()
        .from(messages)
        .where(eq(messages.id, parseInt(messageId, 10)))
        .limit(1);
      
      if (!messageResult.length) {
        throw new Error('Message not found');
      }
      
      const message = messageResult[0];
      
      // Only the sender or recipient can delete a message
      const canDelete = 
        message.senderId === parseInt(userId, 10) ||
        message.recipientId === userId ||
        message.recipientId === 'all' ||
        message.recipientId === 'registered';
      
      if (!canDelete) {
        throw new Error('Unauthorized to delete this message');
      }
      
      // For now, just mark message as deleted for this user
      // A more complete solution would track deletions per user
      const existingEntry = await db
        .select()
        .from(messageReadStatus)
        .where(
          and(
            eq(messageReadStatus.messageId, messageId),
            eq(messageReadStatus.userId, userId)
          )
        )
        .limit(1);
      
      if (existingEntry.length > 0) {
        // Update existing entry to mark as deleted
        await db
          .update(messageReadStatus)
          .set({ 
            read: true, // Also mark as read
            deleted: true,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(messageReadStatus.messageId, messageId),
              eq(messageReadStatus.userId, userId)
            )
          );
      } else {
        // Create new entry marking as deleted
        await db
          .insert(messageReadStatus)
          .values({
            messageId,
            userId,
            read: true,
            deleted: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error);
      throw new Error('Failed to delete message');
    }
  }

  // Get count of unread messages for a user
  async getUnreadCount(userId: string) {
    try {
      // Get all message IDs for this user
      const messageResult = await db
        .select({
          id: messages.id
        })
        .from(messages)
        .where(
          sql`(
            ${messages.recipientId} = ${userId} OR 
            ${messages.recipientId} = 'all' OR 
            ${messages.recipientId} = 'registered'
          )`
        );
      
      const messageIds = messageResult.map(msg => msg.id.toString());
      
      // Get read message IDs for this user
      const readResult = await db
        .select({
          messageId: messageReadStatus.messageId
        })
        .from(messageReadStatus)
        .where(
          and(
            inArray(messageReadStatus.messageId, messageIds),
            eq(messageReadStatus.userId, userId),
            eq(messageReadStatus.read, true)
          )
        );
      
      const readMessageIds = new Set(readResult.map(msg => msg.messageId));
      
      // Count unread by subtracting the read ones
      const unreadCount = messageIds.filter(id => !readMessageIds.has(id)).length;

      return { count: unreadCount };
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw new Error('Failed to get unread message count');
    }
  }
  
  private async getSentMessageIds(userId: string): Promise<Set<number>> {
    try {
      const result = await db
        .select({
          id: messages.id
        })
        .from(messages)
        .where(eq(messages.senderId, parseInt(userId, 10)));
      
      return new Set(result.map(m => m.id));
    } catch (error) {
      console.error('Error getting sent messages:', error);
      return new Set();
    }
  }

  // Get all users except the current user (for admins to select message recipients)
  async getAllUsers(currentUserId: string): Promise<{ id: number, username: string, fullName: string }[]> {
    try {
      const result = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(sql`${users.id} != ${parseInt(currentUserId, 10)}`)
        .orderBy(asc(users.fullName));
      
      return result;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }
  
  // Get admin users (for regular users to message)
  async getAdminUsers(): Promise<{ id: number, username: string, fullName: string }[]> {
    try {
      const result = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(sql`${users.role} IN ('admin', 'moderator')`)
        .orderBy(asc(users.fullName));
      
      return result;
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  }
}

export const chatStorage = new ChatStorage();