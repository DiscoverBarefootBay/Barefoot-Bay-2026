import express from 'express';
import { db } from '../db';
import { desc, eq, sql, inArray, gt, and, or, isNull, not } from 'drizzle-orm';
import { authenticateUser } from '../middleware/authenticate';
import { messages, messageAttachments, messageRecipients } from '../../shared/schema-messages';
import { users } from '../../shared/schema';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure the uploads directory exists
    const dir = 'uploads/attachments';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max file size
  }
});

// Get all messages for the current user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get all messages where current user is either sender or recipient
    const result = await db
      .select({
        message: messages,
        sender: users,
        isRead: sql<boolean>`EXISTS (
          SELECT 1 FROM ${messageRecipients}
          WHERE ${messageRecipients.messageId} = ${messages.id}
          AND ${messageRecipients.recipientId} = ${userId}
          AND ${messageRecipients.readAt} IS NOT NULL
        )`
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(
        or(
          eq(messages.senderId, userId),
          sql`EXISTS (
            SELECT 1 FROM ${messageRecipients}
            WHERE ${messageRecipients.messageId} = ${messages.id}
            AND ${messageRecipients.recipientId} = ${userId}
          )`
        )
      )
      .orderBy(desc(messages.createdAt));

    // Get attachments for each message
    const messageIds = result.map(r => r.message.id);
    
    let attachments = [];
    if (messageIds.length > 0) {
      attachments = await db
        .select()
        .from(messageAttachments)
        .where(inArray(messageAttachments.messageId, messageIds));
    }
    
    // Group attachments by message id
    const attachmentsByMessageId = {};
    for (const attachment of attachments) {
      if (!attachmentsByMessageId[attachment.messageId]) {
        attachmentsByMessageId[attachment.messageId] = [];
      }
      attachmentsByMessageId[attachment.messageId].push(attachment);
    }
    
    // Format the messages for the response
    const messages = result.map(r => {
      const senderName = r.sender ? (r.sender.fullName || r.sender.username) : 'Unknown';
      
      return {
        ...r.message,
        senderName,
        read: r.isRead,
        attachments: attachmentsByMessageId[r.message.id] || []
      };
    });
    
    // Return messages in thread format (group replies with their parent messages)
    const threaded = getThreadedMessages(messages);
    
    return res.json({ messages: threaded });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to organize messages in thread format
function getThreadedMessages(messages) {
  // Group replies with their parent messages
  const messageMap = {};
  const topLevelMessages = [];
  
  // First, create a map of all messages by ID
  for (const message of messages) {
    messageMap[message.id] = {
      ...message,
      replies: []
    };
  }
  
  // Then, organize messages into threads - replies go under parent messages
  for (const message of messages) {
    if (message.inReplyTo && messageMap[message.inReplyTo]) {
      // This is a reply, add it to its parent's replies
      messageMap[message.inReplyTo].replies.push(messageMap[message.id]);
    } else {
      // This is a top-level message
      topLevelMessages.push(messageMap[message.id]);
    }
  }
  
  // Sort replies within each thread by date (newest first)
  for (const message of Object.values(messageMap)) {
    message.replies.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  
  // Sort top-level messages by date (newest first)
  topLevelMessages.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return topLevelMessages;
}

// Mark a message as read
router.post('/read/:messageId', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const messageId = parseInt(req.params.messageId);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    // Check if the user is a recipient of this message
    const recipient = await db
      .select()
      .from(messageRecipients)
      .where(
        and(
          eq(messageRecipients.messageId, messageId),
          eq(messageRecipients.recipientId, userId)
        )
      )
      .limit(1);
    
    if (recipient.length === 0) {
      return res.status(403).json({ error: 'You are not a recipient of this message' });
    }
    
    // Update the message as read if not already read
    if (!recipient[0].readAt) {
      await db
        .update(messageRecipients)
        .set({
          readAt: new Date(),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(messageRecipients.messageId, messageId),
            eq(messageRecipients.recipientId, userId)
          )
        );
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific message with details
router.get('/:messageId', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const messageId = parseInt(req.params.messageId);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    // Get the message
    const messageResult = await db
      .select({
        message: messages,
        sender: users
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.id, messageId))
      .limit(1);
    
    if (messageResult.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const message = messageResult[0].message;
    const sender = messageResult[0].sender;
    
    // Check if the user is authorized to view this message
    const isAuthorized = message.senderId === userId || await isMessageRecipient(userId, messageId);
    
    if (!isAuthorized) {
      return res.status(403).json({ error: 'You are not authorized to view this message' });
    }
    
    // Get attachments for this message
    const attachments = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, messageId));
    
    // Get recipient info
    const recipients = await db
      .select({
        recipient: messageRecipients,
        user: users
      })
      .from(messageRecipients)
      .leftJoin(users, eq(messageRecipients.recipientId, users.id))
      .where(eq(messageRecipients.messageId, messageId));
    
    // Mark as read if current user is a recipient and message is unread
    const recipientInfo = recipients.find(r => r.recipient.recipientId === userId);
    if (recipientInfo && !recipientInfo.recipient.readAt) {
      await db
        .update(messageRecipients)
        .set({
          readAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(messageRecipients.id, recipientInfo.recipient.id));
    }
    
    return res.json({
      ...message,
      attachments,
      sender: sender ? {
        id: sender.id,
        name: sender.fullName || sender.username
      } : { name: 'Unknown' },
      recipient: recipientInfo
    });
  } catch (error) {
    console.error('Error fetching message details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reply to a message
router.post('/reply', authenticateUser, upload.array('attachments'), async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { content, inReplyTo } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    if (!inReplyTo) {
      return res.status(400).json({ error: 'Original message ID is required' });
    }
    
    // Get the original message to determine the recipient
    const originalMessageId = parseInt(inReplyTo);
    if (isNaN(originalMessageId)) {
      return res.status(400).json({ error: 'Invalid original message ID' });
    }
    
    const originalMessage = await db.select().from(messages).where(eq(messages.id, originalMessageId)).limit(1);
    
    if (originalMessage.length === 0) {
      return res.status(404).json({ error: 'Original message not found' });
    }
    
    // The recipient of the reply is the sender of the original message
    const recipientId = originalMessage[0].senderId;
    
    // Create the reply subject with "Re:" prefix if not already present
    const replySubject = originalMessage[0].subject.startsWith('Re:') 
      ? originalMessage[0].subject 
      : `Re: ${originalMessage[0].subject}`;
    
    // Create the reply message
    const result = await db.insert(messages)
      .values({
        subject: replySubject,
        content,
        senderId: currentUserId,
        messageType: 'user', // Direct user-to-user message
        inReplyTo: originalMessageId, // This is critical for threading
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
      
    console.log(`Created reply message ${result[0].id} to message ${originalMessageId}`);
      
    const newMessage = result[0];
    
    // Add the original sender as recipient of this reply
    await db.insert(messageRecipients)
      .values({
        messageId: newMessage.id,
        recipientId,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'delivered'
      });
    
    // Handle file uploads if any
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const files = req.files as Express.Multer.File[];
      
      // Process each file
      for (const file of files) {
        try {
          // Generate a unique filename for storing the attachment
          const originalExt = path.extname(file.originalname);
          const uniqueFilename = `${uuidv4()}${originalExt}`;
          
          // Define the destination directory
          const destinationDir = 'uploads/attachments';
          
          // Ensure the directory exists
          if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
          }
          
          // Determine the destination path for the file
          const destinationPath = path.join(destinationDir, uniqueFilename);
          
          // Move the file from the temporary upload location to the destination
          fs.copyFileSync(file.path, destinationPath);
          
          // Generate a URL for the attachment
          const attachmentUrl = `/uploads/attachments/${uniqueFilename}`;
          
          // Save attachment info to the database with required fields
          await db.insert(messageAttachments)
            .values({
              id: uuidv4(), // Required primary key
              messageId: newMessage.id,
              filename: file.originalname,
              url: attachmentUrl, // Required field
              size: file.size ? file.size.toString() : null,
              contentType: file.mimetype,
              createdAt: new Date()
            });
          
          // Remove the temporary file
          fs.unlinkSync(file.path);
        } catch (fileError) {
          console.error(`Error handling file ${file.originalname}:`, fileError);
          // Continue processing other files even if one fails
        }
      }
    }
    
    // Get sender info to return with response
    const sender = await db.select().from(users).where(eq(users.id, currentUserId)).limit(1);
    const senderName = sender.length > 0 ? (sender[0].fullName || sender[0].username) : 'Unknown';
    
    // Get attachments for response
    const attachments = await db.select().from(messageAttachments).where(eq(messageAttachments.messageId, newMessage.id));
    
    // Format response with all needed data
    const messageResponse = {
      ...newMessage,
      senderName,
      attachments,
      read: true // Sender has read their own message
    };
    
    return res.status(201).json({ message: messageResponse });
  } catch (error) {
    console.error('Error creating reply:', error);
    
    // Clean up any temporary files that may have been uploaded
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a new message
router.post('/', authenticateUser, upload.array('attachments'), async (req, res) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { subject, content, recipientId, recipientType } = req.body;
    
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    if (!recipientId && !recipientType) {
      return res.status(400).json({ error: 'Recipient ID or type is required' });
    }
    
    // Get sender info from the database
    const sender = await db.select().from(users).where(eq(users.id, senderId)).limit(1);
    if (sender.length === 0) {
      return res.status(404).json({ error: 'Sender user not found' });
    }
    
    // Check if the sender is allowed to send to this recipient
    // Regular users can only message admins
    if (sender[0].role !== 'admin' && recipientType !== 'admin') {
      return res.status(403).json({ error: 'You can only send messages to administrators' });
    }
    
    // Create the message
    const result = await db.insert(messages)
      .values({
        subject,
        content,
        senderId,
        messageType: recipientType ? 'role' : 'user', // Role-based or direct user message
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    const newMessage = result[0];
    
    // Add recipient(s)
    if (recipientType) {
      // Find all users with the given role
      const recipients = await db.select().from(users).where(eq(users.role, recipientType));
      
      // Add each recipient
      for (const recipient of recipients) {
        await db.insert(messageRecipients)
          .values({
            messageId: newMessage.id,
            recipientId: recipient.id,
            targetRole: recipientType,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'delivered'
          });
      }
    } else {
      // Single recipient
      await db.insert(messageRecipients)
        .values({
          messageId: newMessage.id,
          recipientId: parseInt(recipientId),
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'delivered'
        });
    }
    
    // Handle file uploads if any
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const files = req.files as Express.Multer.File[];
      
      // Process each file
      for (const file of files) {
        try {
          // Generate a unique filename for storing the attachment
          const originalExt = path.extname(file.originalname);
          const uniqueFilename = `${uuidv4()}${originalExt}`;
          
          // Define the destination directory
          const destinationDir = 'uploads/attachments';
          
          // Ensure the directory exists
          if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
          }
          
          // Determine the destination path for the file
          const destinationPath = path.join(destinationDir, uniqueFilename);
          
          // Move the file from the temporary upload location to the destination
          fs.copyFileSync(file.path, destinationPath);
          
          // Generate a URL for frontend access to the attachment
          const fileUrl = `/uploads/attachments/${uniqueFilename}`;
          
          // Save attachment info to the database
          await db.insert(messageAttachments)
            .values({
              id: uuidv4(), // Required primary key
              messageId: newMessage.id,
              filename: file.originalname,
              url: fileUrl, // Required field
              size: file.size ? file.size.toString() : null,
              contentType: file.mimetype,
              createdAt: new Date()
            });
          
          // Remove the temporary file
          fs.unlinkSync(file.path);
        } catch (fileError) {
          console.error(`Error handling file ${file.originalname}:`, fileError);
          // Continue processing other files even if one fails
        }
      }
    }
    
    return res.status(201).json({ 
      message: newMessage,
      success: true,
      recipientType: recipientType || 'user'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    // Clean up any temporary files that may have been uploaded
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a message
router.delete('/:messageId', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const messageId = parseInt(req.params.messageId);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    // Get the message
    const message = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    
    if (message.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if the user is authorized to delete this message
    const isAuthor = message[0].senderId === userId;
    const isAdmin = await isUserAdmin(userId);
    
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to delete this message' });
    }
    
    // Delete the message's recipients
    await db.delete(messageRecipients)
      .where(eq(messageRecipients.messageId, messageId));
    
    // Delete the message's attachments
    await db.delete(messageAttachments)
      .where(eq(messageAttachments.messageId, messageId));
    
    // Delete the message
    await db.delete(messages)
      .where(eq(messages.id, messageId));
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all messages that need admin attention (admin only)
router.get('/admin/unread', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Check if the user is an admin
    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only administrators can view this resource' });
    }
    
    // Get unread messages where an admin is a recipient
    const unreadMessages = await db
      .select({
        message: messages,
        sender: users
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(
        and(
          // Message is not from current admin
          not(eq(messages.senderId, userId)),
          // Message has the current admin as recipient
          sql`EXISTS (
            SELECT 1 FROM ${messageRecipients}
            WHERE ${messageRecipients.messageId} = ${messages.id}
            AND (
              ${messageRecipients.recipientId} = ${userId}
              OR ${messageRecipients.targetRole} = 'admin'
            )
            AND ${messageRecipients.readAt} IS NULL
          )`
        )
      )
      .orderBy(desc(messages.createdAt));
    
    // Get the total count of unread messages
    const countResult = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(messages)
      .where(
        and(
          not(eq(messages.senderId, userId)),
          sql`EXISTS (
            SELECT 1 FROM ${messageRecipients}
            WHERE ${messageRecipients.messageId} = ${messages.id}
            AND (
              ${messageRecipients.recipientId} = ${userId}
              OR ${messageRecipients.targetRole} = 'admin'
            )
            AND ${messageRecipients.readAt} IS NULL
          )`
        )
      );
    
    const totalUnread = countResult[0]?.count || 0;
    
    // Format the messages
    const formattedMessages = unreadMessages.map(r => ({
      ...r.message,
      senderName: r.sender ? (r.sender.fullName || r.sender.username) : 'Unknown',
      read: false
    }));
    
    return res.json({
      messages: formattedMessages,
      totalUnread
    });
  } catch (error) {
    console.error('Error fetching admin unread messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get message count for current user
router.get('/count/unread', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Count unread messages where current user is recipient
    const countResult = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(messages)
      .where(
        sql`EXISTS (
          SELECT 1 FROM ${messageRecipients}
          WHERE ${messageRecipients.messageId} = ${messages.id}
          AND (
            ${messageRecipients.recipientId} = ${userId}
            OR (${messageRecipients.targetRole} = 'admin' AND EXISTS (
              SELECT 1 FROM ${users} WHERE id = ${userId} AND role = 'admin'
            ))
          )
          AND ${messageRecipients.readAt} IS NULL
        )`
      );
    
    const totalUnread = countResult[0]?.count || 0;
    
    return res.json({ count: totalUnread });
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to check if a user is an admin
async function isUserAdmin(userId) {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user.length > 0 && user[0].role === 'admin';
}

// Helper function to check if a user is a recipient of a message
async function isMessageRecipient(userId, messageId) {
  const recipient = await db
    .select()
    .from(messageRecipients)
    .where(
      and(
        eq(messageRecipients.messageId, messageId),
        eq(messageRecipients.recipientId, userId)
      )
    )
    .limit(1);
  
  return recipient.length > 0;
}

export default router;