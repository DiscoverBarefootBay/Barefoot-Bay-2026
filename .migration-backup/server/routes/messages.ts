import express from 'express';
import multer from 'multer';
import { db } from '../db';
import { users } from '../../shared/schema';
import { messages, messageAttachments, messageRecipients } from '../../shared/schema-messages';
import { eq, and, or, desc, asc, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticateUser } from '../middleware/auth';
import { isAdmin } from '../utils/role-utils';
import * as fs from 'fs';
import * as path from 'path';
import { uploadAttachmentToObjectStorage, getAttachmentUrl } from '../attachment-storage-proxy';
import { sendMessageEmail } from '../sendgrid-service';

const router = express.Router();
const upload = multer({ dest: 'temp_upload/' });

// Ensure temp upload directory exists
if (!fs.existsSync('temp_upload')) {
  fs.mkdirSync('temp_upload', { recursive: true });
}

// Create uploads/messages directory if it doesn't exist
const messagesUploadDir = path.join('uploads', 'messages');
if (!fs.existsSync(messagesUploadDir)) {
  fs.mkdirSync(messagesUploadDir, { recursive: true });
}

// Create uploads/attachments directory if it doesn't exist
const attachmentsUploadDir = path.join('uploads', 'attachments');
if (!fs.existsSync(attachmentsUploadDir)) {
  fs.mkdirSync(attachmentsUploadDir, { recursive: true });
}

// Bulk delete messages - MUST BE FIRST to avoid route conflicts
router.post('/bulk-delete', authenticateUser, async (req, res) => {
  try {
    console.log('Bulk delete endpoint reached!');
    console.log('Request body:', req.body);
    
    const { messageIds } = req.body;
    const currentUserId = req.user?.id;
    
    console.log('Message IDs received:', messageIds);
    console.log('Current user ID:', currentUserId);
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'Message IDs array is required' });
    }
    
    // Convert string IDs to numbers
    const numericMessageIds = messageIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (numericMessageIds.length === 0) {
      return res.status(400).json({ error: 'No valid message IDs provided' });
    }
    
    let deletedCount = 0;
    const errors = [];
    
    // Process each message individually to avoid SQL syntax issues
    for (const messageId of numericMessageIds) {
      try {
        // Check if message exists and user has permission
        const messageResult = await db.select()
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1);
        
        if (messageResult.length === 0) {
          errors.push(`Message ${messageId} not found`);
          continue;
        }
        
        const message = messageResult[0];
        const isSender = message.senderId === currentUserId;
        const isUserAdmin = isAdmin(req.user?.role);
        
        // Check if user is a recipient of this message
        const recipientCheck = await db.select()
          .from(messageRecipients)
          .where(
            and(
              eq(messageRecipients.messageId, messageId),
              eq(messageRecipients.recipientId, currentUserId)
            )
          )
          .limit(1);
        
        const isRecipient = recipientCheck.length > 0;
        
        // Gmail-style deletion: anyone can delete messages from their own inbox
        // Just remove the message from this user's view
        if (isRecipient) {
          // Remove from user's inbox
          await db.delete(messageRecipients)
            .where(
              and(
                eq(messageRecipients.messageId, messageId),
                eq(messageRecipients.recipientId, currentUserId)
              )
            );
        } else if (isSender) {
          // If user is sender but not recipient, they can still "delete" it from their sent items
          // by removing all recipients (effectively hiding it from everyone)
          await db.delete(messageRecipients)
            .where(eq(messageRecipients.messageId, messageId));
            
          // Delete attachments
          await db.delete(messageAttachments)
            .where(eq(messageAttachments.messageId, messageId));
            
          // Delete the message completely
          await db.delete(messages)
            .where(eq(messages.id, messageId));
        } else if (!isUserAdmin) {
          errors.push(`No permission to delete message ${messageId}`);
          continue;
        }
        
        deletedCount++;
        
      } catch (error) {
        console.error(`Error deleting message ${messageId}:`, error);
        errors.push(`Failed to delete message ${messageId}: ${error.message}`);
      }
    }
    
    return res.json({ 
      success: true,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error bulk deleting messages:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    });
  }
});

// Get all messages for the current user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isUserAdmin = isAdmin(req.user?.role);
    
    // Get message IDs where this user is a recipient
    const receivedMessageIds = await db.select({
      messageId: messageRecipients.messageId
    })
    .from(messageRecipients)
    .where(eq(messageRecipients.recipientId, currentUserId));
    
    // Extract just the message IDs
    const messageIdsList = receivedMessageIds.map(m => m.messageId);
    
    // Get all messages sent by this user or where this user is a recipient
    // Filter out messages deleted by sender when current user is not the sender
    const userMessages = await db.select()
      .from(messages)
      .where(
        or(
          // Messages sent by this user (show even if deleted by sender, for their sent items)
          eq(messages.senderId, currentUserId),
          // Messages received by this user (only show if not deleted by sender)
          and(
            inArray(messages.id, messageIdsList),
            or(
              eq(messages.deletedBySender, false),
              sql`${messages.deletedBySender} IS NULL`
            )
          )
        )
      )
      .orderBy(desc(messages.createdAt));
    
    // Get info about read status for these messages
    let messageReadStatus = [];
    
    if (messageIdsList.length > 0) {
      messageReadStatus = await db.select()
        .from(messageRecipients)
        .where(
          and(
            inArray(messageRecipients.messageId, messageIdsList),
            eq(messageRecipients.recipientId, currentUserId)
          )
        );
    }
    
    // Create a map of message IDs to read status
    const readStatusMap = {};
    messageReadStatus.forEach(status => {
      readStatusMap[status.messageId] = status.readAt !== null;
    });
    
    // Get sender names for each message
    const senderIds = userMessages.map(msg => msg.senderId);
    const messageAttachmentsList = await db.select()
      .from(messageAttachments)
      .where(inArray(messageAttachments.messageId, userMessages.map(m => m.id)));
    
    // Group attachments by message ID
    const attachmentsByMessage = {};
    messageAttachmentsList.forEach(attachment => {
      if (!attachmentsByMessage[attachment.messageId]) {
        attachmentsByMessage[attachment.messageId] = [];
      }
      attachmentsByMessage[attachment.messageId].push(attachment);
    });
    
    // Get sender information for all messages
    const senderInfo = await db.select()
      .from(users)
      .where(inArray(users.id, senderIds));
    
    // Create a map of user IDs to user names
    const userNameMap = {};
    senderInfo.forEach(user => {
      userNameMap[user.id] = user.fullName || user.username;
    });
    
    // Process all messages
    const messagesWithReadStatus = userMessages.map(message => {
      return {
        ...message,
        senderName: userNameMap[message.senderId] || 'Unknown',
        read: message.senderId === currentUserId || readStatusMap[message.id] || false,
        attachments: attachmentsByMessage[message.id] || []
      };
    });
    
    // Sort messages by date (newest first) and handle parent-child relationships
    const processedMessages = processMessageThreads(messagesWithReadStatus);
    
    return res.json(processedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to organize messages into threads
function processMessageThreads(messages) {
  console.log(`Processing ${messages.length} messages into threads`);
  
  // First, create a map of parent messages to their replies
  const messageThreads = {};
  const topLevelMessages = [];
  
  // Create a map of all messages by ID for easier lookup
  const messagesById = {};
  messages.forEach(message => {
    messagesById[message.id] = message;
  });
  
  // Identify parent and child messages
  messages.forEach(message => {
    // Use inReplyTo for camelCase (TypeScript) and in_reply_to for snake_case (database)
    const replyToId = message.inReplyTo || message.in_reply_to;
    
    if (replyToId) {
      // This is a reply message
      console.log(`Message ID ${message.id} is a reply to ${replyToId}`);
      
      if (!messageThreads[replyToId]) {
        messageThreads[replyToId] = [];
      }
      messageThreads[replyToId].push(message);
    } else {
      // This is a top-level message
      topLevelMessages.push(message);
    }
  });
  
  // Sort all replies by date (newest first)
  Object.keys(messageThreads).forEach(threadId => {
    messageThreads[threadId].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    console.log(`Thread ${threadId} has ${messageThreads[threadId].length} replies`);
  });
  
  // Add replies to their parent messages
  const result = topLevelMessages.map(message => {
    return {
      ...message,
      replies: messageThreads[message.id] || []
    };
  });
  
  // Sort parent messages by date (newest first)
  result.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  console.log(`Processed ${result.length} top-level messages with their replies`);
  return result;
}

// Get a specific message
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get the message details
    const message = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    
    if (message.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const msg = message[0];
    
    // Check if user has access to this message (using messageRecipients for access check)
    const isRecipient = await db.select()
      .from(messageRecipients)
      .where(and(
        eq(messageRecipients.messageId, messageId),
        eq(messageRecipients.recipientId, currentUserId)
      ))
      .limit(1);
      
    if (msg.senderId !== currentUserId && isRecipient.length === 0 && !isAdmin(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Mark message as read if user is a recipient
    if (isRecipient.length > 0 && isRecipient[0].readAt === null) {
      await db.update(messageRecipients)
        .set({ 
          readAt: new Date(),
          status: 'read'
        })
        .where(and(
          eq(messageRecipients.messageId, messageId),
          eq(messageRecipients.recipientId, currentUserId)
        ));
    }
    
    // Fetch attachments
    const attachments = await db.select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, messageId));
    
    // Get sender info
    const sender = await db.select()
      .from(users)
      .where(eq(users.id, msg.senderId))
      .limit(1);
    
    // Determine recipient info
    let recipientInfo = { name: 'Unknown' };
    
    if (msg.messageType === 'user') {
      // For user type, we need to check the messageRecipients table
      const recipients = await db.select()
        .from(messageRecipients)
        .leftJoin(users, eq(messageRecipients.recipientId, users.id))
        .where(eq(messageRecipients.messageId, messageId))
        .limit(1);
      
      if (recipients.length > 0 && recipients[0].users) {
        recipientInfo = {
          id: recipients[0].users.id,
          name: recipients[0].users.fullName || recipients[0].users.username
        };
      }
    } else if (msg.messageType === 'admin') {
      recipientInfo = { name: 'Admin Team' };
    } else if (msg.messageType === 'all') {
      recipientInfo = { name: 'All Users' };
    } else if (msg.messageType === 'registered') {
      recipientInfo = { name: 'All Registered Users' };
    } else if (msg.messageType === 'badge_holders') {
      recipientInfo = { name: 'All Badge Holders' };
    }
    
    // Fetch message replies with better debugging
    console.log(`Fetching replies for message ID: ${messageId}`);
    const replies = await db.select()
      .from(messages)
      .where(eq(messages.in_reply_to, messageId));
    
    console.log(`Found ${replies.length} replies for message ID ${messageId}:`, replies);
    
    // Format replies with sender info and attachments
    const formattedReplies = await Promise.all(replies.map(async (reply) => {
      console.log(`Processing reply ID ${reply.id} to message ${messageId}`);
      
      // Get sender info for this reply
      const replySender = await db.select()
        .from(users)
        .where(eq(users.id, reply.senderId))
        .limit(1);
      
      const senderName = replySender.length > 0 
        ? (replySender[0].fullName || replySender[0].username) 
        : 'Unknown';
        
      console.log(`Reply ${reply.id} sender: ${senderName}`);
      
      // Get any attachments for this reply
      const replyAttachments = await db.select()
        .from(messageAttachments)
        .where(eq(messageAttachments.messageId, reply.id));
      
      // Create a properly formatted reply object with all fields needed by UI
      const formattedReply = {
        id: reply.id,
        senderId: reply.senderId,
        senderName: senderName,
        subject: reply.subject || msg.subject,
        content: reply.content,
        messageType: reply.messageType,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        timestamp: reply.createdAt,
        recipientName: 'You',
        read: true,
        in_reply_to: reply.in_reply_to,
        inReplyTo: reply.in_reply_to,
        attachments: replyAttachments || []
      };
      
      console.log(`Formatted reply:`, formattedReply);
      return formattedReply;
    }));
    
    // Return the message with additional details including replies
    return res.json({
      ...msg,
      attachments,
      sender: sender.length > 0 ? {
        id: sender[0].id,
        name: sender[0].fullName || sender[0].username
      } : { name: 'Unknown' },
      recipient: recipientInfo,
      replies: formattedReplies,
      // Add both versions for compatibility
      inReplyTo: msg.in_reply_to
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reply to a message
router.post('/:id/reply', authenticateUser, upload.array('attachments'), async (req, res) => {
  try {
    console.log('📨 Processing reply to message ID:', req.params.id);
    
    // Validate message ID is a number
    const parentMessageId = parseInt(req.params.id, 10);
    if (isNaN(parentMessageId)) {
      console.error('Invalid parent message ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    console.log('Request body:', req.body);
    console.log('Attachments count:', req.files ? (req.files as Express.Multer.File[]).length : 0);
    
    const { content, sendEmail } = req.body;
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    let targetedUserIds: number[] | null = null;
    
    // Verify that the parent message exists and user has access
    const parentMessage = await db.select()
      .from(messages)
      .where(eq(messages.id, parentMessageId))
      .limit(1);
    
    if (parentMessage.length === 0) {
      return res.status(404).json({ error: 'Parent message not found' });
    }
    
    // Check if user has access to reply to this message
    const isRecipient = await db.select()
      .from(messageRecipients)
      .where(and(
        eq(messageRecipients.messageId, parentMessageId),
        eq(messageRecipients.recipientId, currentUserId)
      ))
      .limit(1);
      
    const isSender = parentMessage[0].senderId === currentUserId;
    
    if (!isSender && isRecipient.length === 0 && !isAdmin(req.user?.role)) {
      return res.status(403).json({ error: 'You cannot reply to this message' });
    }
    
    // Determine the recipient of the reply
    let recipientId;
    let messageType = 'user';
    
    if (isSender) {
      // If current user is the sender of the parent, reply goes to the original recipient
      if (['admin', 'admins', 'all', 'registered', 'badge_holders'].includes(parentMessage[0].messageType)) {
        // When replying to a message sent to a group, keep the same type
        messageType = parentMessage[0].messageType;
        recipientId = null;
      } else {
        // For user-to-user messages, find the recipient
        const originalRecipient = await db.select()
          .from(messageRecipients)
          .where(eq(messageRecipients.messageId, parentMessageId))
          .limit(1);
          
        if (originalRecipient.length > 0) {
          recipientId = originalRecipient[0].recipientId;
        }
      }
    } else {
      // If current user is a recipient, reply goes to the original sender
      recipientId = parentMessage[0].senderId;
    }
    
    // Create the reply
    const newMessage = await db.insert(messages)
      .values({
        subject: `Re: ${parentMessage[0].subject}`,
        content,
        senderId: currentUserId,
        messageType,
        inReplyTo: parentMessageId,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    if (messageType === 'user' && recipientId) {
      // Add specific user as recipient
      await db.insert(messageRecipients)
        .values({
          messageId: newMessage[0].id,
          recipientId,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'delivered'
        });
    } else if (messageType === 'admin' || messageType === 'admins') {
      // Find all admin users (handles both 'admin' and 'admins' parent message types
      // for parity with the new-message handler).
      const adminUsers = await db.select()
        .from(users)
        .where(eq(users.role, 'admin'));
      
      targetedUserIds = adminUsers
        .filter(admin => admin.id !== currentUserId)
        .map(admin => admin.id);
      
      // Add each admin as a recipient (except the sender)
      for (const admin of adminUsers) {
        if (admin.id !== currentUserId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage[0].id,
              recipientId: admin.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered',
              targetRole: messageType
            });
        }
      }
    } else if (messageType === 'all') {
      const allUsers = await db.select().from(users);
      targetedUserIds = allUsers
        .filter(user => user.id !== currentUserId)
        .map(user => user.id);
      for (const user of allUsers) {
        if (user.id !== currentUserId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage[0].id,
              recipientId: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered',
              targetRole: 'all'
            });
        }
      }
    } else if (messageType === 'registered') {
      const registeredUsers = await db.select()
        .from(users)
        .where(eq(users.role, 'paid'));
      targetedUserIds = registeredUsers
        .filter(user => user.id !== currentUserId)
        .map(user => user.id);
      for (const user of registeredUsers) {
        if (user.id !== currentUserId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage[0].id,
              recipientId: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered',
              targetRole: 'registered'
            });
        }
      }
    } else if (messageType === 'badge_holders') {
      const badgeHolders = await db.select()
        .from(users)
        .where(eq(users.hasMembershipBadge, true));
      targetedUserIds = badgeHolders
        .filter(user => user.id !== currentUserId)
        .map(user => user.id);
      for (const user of badgeHolders) {
        if (user.id !== currentUserId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage[0].id,
              recipientId: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered',
              targetRole: 'badge_holders'
            });
        }
      }
    }
    
    // Handle file uploads if any. Track stored attachments so we can attach
    // them to the SendGrid email below (mirrors the new-message handler).
    const uploadedAttachments: Array<{ path: string; filename: string; mimetype: string }> = [];
    
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} attachment(s) for reply message`);
      const files = req.files as Express.Multer.File[];
      
      // Process each file
      for (const file of files) {
        try {
          console.log(`Processing attachment: ${file.originalname} (${file.size} bytes)`);
          
          // Generate a unique filename for storing the attachment
          const originalExt = path.extname(file.originalname);
          const uniqueFilename = `${uuidv4()}${originalExt}`;
          
          // Define the destination directory
          const destinationDir = 'uploads/attachments';
          
          // Ensure the directory exists
          if (!fs.existsSync(destinationDir)) {
            console.log(`Creating directory: ${destinationDir}`);
            fs.mkdirSync(destinationDir, { recursive: true });
          }
          
          // Determine the destination path for the file
          const destinationPath = path.join(destinationDir, uniqueFilename);
          
          console.log(`Copying file from ${file.path} to ${destinationPath}`);
          
          // Check source file exists
          if (!fs.existsSync(file.path)) {
            throw new Error(`Source file not found at path: ${file.path}`);
          }
          
          // Move the file from the temporary upload location to the destination
          fs.copyFileSync(file.path, destinationPath);
          
          // Verify the file was copied correctly
          if (!fs.existsSync(destinationPath)) {
            throw new Error(`Failed to copy file to destination: ${destinationPath}`);
          }
          
          // Track the stored attachment so the SendGrid email can include it.
          uploadedAttachments.push({
            path: destinationPath,
            filename: file.originalname,
            mimetype: file.mimetype
          });
          
          // Use the getAttachmentUrl helper to generate the appropriate URL for the current environment
          // Import this function from attachment-storage-proxy.ts
          // CRITICAL FIX: Always generate a relative URL path that will work in any environment
          let objectStorageUrl = null;
          
          // Upload to object storage in production before generating URL
          if (process.env.NODE_ENV === 'production') {
            try {
              console.log(`Pre-uploading attachment to Object Storage: ${uniqueFilename}`);
              objectStorageUrl = await uploadAttachmentToObjectStorage(destinationPath, uniqueFilename);
              console.log(`Successfully uploaded to Object Storage, URL: ${objectStorageUrl}`);
            } catch (uploadError) {
              console.error(`Error pre-uploading to Object Storage: ${uploadError}`);
              // Continue with local URL if upload fails
            }
          }
          
          // Generate environment-appropriate URL using the helper
          const attachmentUrl = getAttachmentUrl(uniqueFilename, objectStorageUrl);
          
          // Detailed logging for debugging
          console.log(`[MessageAttachment] Generated URL: ${attachmentUrl}`);
          console.log(`[MessageAttachment] File details - Original name: ${file.originalname}, Stored as: ${uniqueFilename}`);
          console.log(`[MessageAttachment] File size: ${file.size} bytes, MIME type: ${file.mimetype}`);
          console.log(`[MessageAttachment] Environment: ${process.env.NODE_ENV}, Production: ${process.env.NODE_ENV === 'production'}`);
          console.log(`[MessageAttachment] Base URL path: ${req.protocol}://${req.get('host')}`);
          console.log(`[MessageAttachment] Final URL format: ${attachmentUrl}`);
          console.log(`[MessageAttachment] Expected access path in browser: ${req.protocol}://${req.get('host')}${attachmentUrl}`);
          
          // FIXED: We already uploaded above, don't duplicate the upload process
          // The objectStorageUrl has already been generated if we're in production
          // and it's already been passed to getAttachmentUrl
          
          // Save attachment info to the database
          await db.insert(messageAttachments)
            .values({
              id: uuidv4(), // Generate unique ID
              messageId: newMessage[0].id,
              filename: file.originalname,
              storedFilename: uniqueFilename,
              size: file.size.toString(),
              contentType: file.mimetype,
              url: attachmentUrl, // Store the appropriate URL for the environment
              createdAt: new Date()
            });
          
          console.log(`Attachment record created in database for: ${file.originalname}`);
          
          // Remove the temporary file
          try {
            fs.unlinkSync(file.path);
            console.log(`Temporary file removed: ${file.path}`);
          } catch (unlinkError) {
            console.warn(`Warning: Could not remove temporary file ${file.path}:`, unlinkError);
            // Non-critical error, can continue
          }
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
    const attachments = await db.select().from(messageAttachments).where(eq(messageAttachments.messageId, newMessage[0].id));
    
    // Send email if requested. Mirrors the new-message handler so admins
    // replying via /messages with email delivery enabled get the same
    // SendGrid email the recipients receive (sender self-copy).
    if (sendEmail === 'true') {
      try {
        const replySubject = `Re: ${parentMessage[0].subject}`;
        console.log('[SendGrid Message] Email sending requested for reply:', newMessage[0].id);
        
        let recipientEmails: string[] = [];
        
        if (targetedUserIds && targetedUserIds.length > 0) {
          console.log(`[SendGrid Message] 📊 Fetching email data for ${targetedUserIds.length} targeted users`);
          
          const targetedUsersData = await db.select({
            id: users.id,
            email: users.email,
            username: users.username,
            fullName: users.fullName
          })
          .from(users)
          .where(inArray(users.id, targetedUserIds));
          
          console.log(`[SendGrid Message] 📋 Retrieved ${targetedUsersData.length} user records from database`);
          
          const usersWithValidEmails: string[] = [];
          const usersWithoutValidEmails: Array<{id: number, name: string, email: string | null, username: string | null}> = [];
          
          targetedUsersData.forEach(user => {
            const emailAddress = user.email || user.username;
            const userName = user.fullName || user.username || `User ID ${user.id}`;
            
            if (emailAddress && emailAddress.includes('@')) {
              usersWithValidEmails.push(emailAddress);
              console.log(`[SendGrid Message] ✅ Valid email found for ${userName}: ${emailAddress}`);
            } else {
              usersWithoutValidEmails.push({
                id: user.id,
                name: userName,
                email: user.email,
                username: user.username
              });
              console.log(`[SendGrid Message] ❌ No valid email for ${userName} (email: ${user.email || 'null'}, username: ${user.username || 'null'})`);
            }
          });
          
          recipientEmails = usersWithValidEmails;
          
          console.log(`[SendGrid Message] ═══════════════════════════════════════════`);
          console.log(`[SendGrid Message] 📧 EMAIL SENDING SUMMARY (reply)`);
          console.log(`[SendGrid Message] Total targeted users: ${targetedUserIds.length}`);
          console.log(`[SendGrid Message] Users with valid emails: ${usersWithValidEmails.length}`);
          console.log(`[SendGrid Message] Users WITHOUT valid emails: ${usersWithoutValidEmails.length}`);
          
          if (usersWithoutValidEmails.length > 0) {
            console.log(`[SendGrid Message] ⚠️  WARNING: ${usersWithoutValidEmails.length} users will NOT receive emails!`);
            console.log(`[SendGrid Message] Users being skipped:`);
            usersWithoutValidEmails.forEach(user => {
              console.log(`[SendGrid Message]   - ${user.name} (ID: ${user.id})`);
            });
          }
          
          if (usersWithValidEmails.length === 0) {
            console.log(`[SendGrid Message] ⚠️  CRITICAL: No valid email addresses found! No emails will be sent.`);
          } else {
            console.log(`[SendGrid Message] 📨 Will send ${usersWithValidEmails.length} emails`);
          }
          console.log(`[SendGrid Message] ═══════════════════════════════════════════`);
        } else if (recipientId) {
          const recipientData = await db.select({
            email: users.email,
            username: users.username
          })
          .from(users)
          .where(eq(users.id, typeof recipientId === 'string' ? parseInt(recipientId, 10) : recipientId))
          .limit(1);
          
          if (recipientData.length > 0) {
            const recipientEmail = recipientData[0].email || recipientData[0].username;
            if (recipientEmail && recipientEmail.includes('@')) {
              recipientEmails.push(recipientEmail);
            }
          }
          
          console.log(`[SendGrid Message] Found ${recipientEmails.length} email address for individual recipient`);
        }
        
        // Get sender info (also used for self-copy below)
        const senderData = await db.select({
          email: users.email,
          username: users.username,
          fullName: users.fullName
        })
        .from(users)
        .where(eq(users.id, currentUserId))
        .limit(1);
        
        const senderDisplayName = senderData[0]?.fullName || senderData[0]?.username || 'Message System';
        const senderEmail = senderData[0]?.email || 'noreply@barefootbay.com';
        
        // Send the sender a copy of the email so they have a record in their own inbox.
        // Skip if the sender has no valid email on file - rest of recipients still get emailed.
        const senderInboxAddress = senderData[0]?.email || senderData[0]?.username;
        if (senderInboxAddress && senderInboxAddress.includes('@')) {
          const alreadyIncluded = recipientEmails.some(
            e => e.toLowerCase() === senderInboxAddress.toLowerCase()
          );
          if (alreadyIncluded) {
            console.log(`[SendGrid Message] 📨 Sender ${senderInboxAddress} is already in the recipient list; no duplicate self-copy will be sent`);
          } else {
            recipientEmails.push(senderInboxAddress);
            console.log(`[SendGrid Message] 📨 Sender added as additional recipient for self-copy: ${senderInboxAddress} (recipient count now ${recipientEmails.length})`);
          }
        } else {
          console.log(`[SendGrid Message] ⚠️ Sender (ID: ${currentUserId}) has no valid email on file - skipping self-copy. Other recipients will still receive the email.`);
        }

        // Normalize to lowercase and dedupe so two users sharing a mailbox
        // (e.g. a couple registered with the same email) only get one copy.
        const recipientCountBeforeDedup = recipientEmails.length;
        recipientEmails = Array.from(
          new Set(recipientEmails.map(e => e.toLowerCase()))
        );
        if (recipientEmails.length !== recipientCountBeforeDedup) {
          const duplicatesRemoved = recipientCountBeforeDedup - recipientEmails.length;
          console.log(`[SendGrid Message] 🧹 Removed ${duplicatesRemoved} duplicate reply recipient email(s); ${recipientEmails.length} unique mailbox(es) will be emailed`);
        }

        if (recipientEmails.length > 0) {
          // Prepare email attachments from uploaded files (if any)
          const emailAttachments: Array<{ content: string; filename: string; type: string }> = [];
          
          if (uploadedAttachments.length > 0) {
            console.log(`[SendGrid Message] Processing ${uploadedAttachments.length} attachment(s) for email`);
            
            for (const attachment of uploadedAttachments) {
              try {
                if (fs.existsSync(attachment.path)) {
                  const fileBuffer = fs.readFileSync(attachment.path);
                  const base64Content = fileBuffer.toString('base64');
                  
                  emailAttachments.push({
                    content: base64Content,
                    filename: attachment.filename,
                    type: attachment.mimetype
                  });
                  
                  console.log(`[SendGrid Message] Added attachment to email: ${attachment.filename} (${attachment.mimetype})`);
                } else {
                  console.warn(`[SendGrid Message] Attachment file not found: ${attachment.path}`);
                }
              } catch (attachmentError) {
                console.error(`[SendGrid Message] Error processing attachment ${attachment.filename}:`, attachmentError);
              }
            }
          }
          
          let successCount = 0;
          const failedEmails: Array<{email: string, error?: string}> = [];
          
          console.log(`[SendGrid Message] 📤 Starting to send ${recipientEmails.length} reply emails...`);
          
          for (const recipientEmail of recipientEmails) {
            try {
              const success = await sendMessageEmail(
                recipientEmail,
                replySubject,
                content,
                senderDisplayName,
                senderEmail,
                emailAttachments.length > 0 ? emailAttachments : undefined
              );
              
              if (success) {
                successCount++;
                console.log(`[SendGrid Message] ✅ Email sent successfully to ${recipientEmail}`);
              } else {
                failedEmails.push({email: recipientEmail, error: 'SendGrid returned false'});
                console.error(`[SendGrid Message] ❌ Failed to send email to ${recipientEmail} (sendMessageEmail returned false)`);
              }
            } catch (emailError: any) {
              const errorMessage = emailError?.message || 'Unknown error';
              failedEmails.push({email: recipientEmail, error: errorMessage});
              console.error(`[SendGrid Message] ❌ Error sending email to ${recipientEmail}:`, emailError);
            }
          }
          
          console.log(`[SendGrid Message] ═══════════════════════════════════════════`);
          console.log(`[SendGrid Message] 📬 FINAL EMAIL DELIVERY REPORT (reply)`);
          console.log(`[SendGrid Message] Successfully sent: ${successCount}/${recipientEmails.length} emails`);
          
          if (failedEmails.length > 0) {
            console.log(`[SendGrid Message] ⚠️  Failed to send ${failedEmails.length} emails:`);
            failedEmails.forEach(failure => {
              console.log(`[SendGrid Message]   - ${failure.email}: ${failure.error || 'Unknown error'}`);
            });
          }
          
          if (successCount === 0 && recipientEmails.length > 0) {
            console.log(`[SendGrid Message] 🚨 CRITICAL: ALL email sends failed! Check SendGrid configuration.`);
          } else if (successCount === recipientEmails.length) {
            console.log(`[SendGrid Message] ✅ All emails sent successfully!`);
          }
          console.log(`[SendGrid Message] ═══════════════════════════════════════════`);
        } else {
          console.log('[SendGrid Message] No valid email addresses found for reply recipients');
        }
      } catch (emailError) {
        console.error('[SendGrid Message] Error in reply email sending process:', emailError);
        // Don't fail the reply creation if email fails, just log the error
      }
    }
    
    // Format response with all needed data
    const messageResponse = {
      ...newMessage[0],
      senderName,
      attachments,
      read: true, // Sender has read their own message
      inReplyTo: parentMessageId // Explicitly add inReplyTo to ensure proper threading
    };
    
    console.log('✅ Reply created successfully:', messageResponse);
    
    // Return the complete response
    return res.status(201).json({ 
      message: messageResponse,
      success: true
    });
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
    
    return res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Create a new message
router.post('/', authenticateUser, upload.array('attachments'), async (req, res) => {
  try {
    const { recipient, subject, content, templateId, sendEmail } = req.body;
    const senderId = req.user?.id;
    
    if (!senderId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!subject || !content) {
      return res.status(400).json({ error: 'Subject and content are required' });
    }
    
    // All users can now send messages to any recipient
    
    let recipientId = recipient;
    let recipientType = 'user';
    let targetedUserIds = null;
    
    // Check if this is a template-targeted message
    if (recipient && recipient.startsWith('template:')) {
      // This is a message using a template's dynamic targeting
      const targetQuery = recipient.substring(9); // remove 'template:' prefix
      
      try {
        // First, verify this is an admin user (only admins can use templates)
        if (!isAdmin(req.user?.role)) {
          return res.status(403).json({ error: 'Only administrators can use message templates' });
        }
        
        console.log(`Processing template-targeted message with query: ${targetQuery}`);
        
        // Fetch the target users based on the template query
        let targetedUsers = [];
        
        switch (targetQuery) {
          case 'sponsorship_expiring_7days':
            // Import the function from message-templates module
            const { getUsersWithExpiringSponsorship } = await import('./message-templates');
            targetedUsers = await getUsersWithExpiringSponsorship();
            recipientType = 'template_sponsorship_expiring';
            break;
            
          case 'badge_holders':
            const { getBadgeHolders } = await import('./message-templates');
            targetedUsers = await getBadgeHolders();
            recipientType = 'template_badge_holders';
            break;
            
          case 'new_paid_users':
            const { getNewPaidUsers } = await import('./message-templates');
            targetedUsers = await getNewPaidUsers();
            recipientType = 'template_new_paid_users';
            break;
            
          default:
            // Unknown template target type
            return res.status(400).json({ error: `Unknown template targeting type: ${targetQuery}` });
        }
        
        // Store the IDs of targeted users for later use
        targetedUserIds = targetedUsers.map(user => user.id);
        
        console.log(`Template targeting found ${targetedUserIds.length} recipient(s)`);
        
        // If no targeted users found, return an error
        if (targetedUserIds.length === 0) {
          return res.status(404).json({ error: 'No recipients match the template criteria' });
        }
        
        // We'll set recipientId to null since this is a dynamically targeted message
        recipientId = null;
      } catch (error) {
        console.error('Error processing template-targeted message:', error);
        return res.status(500).json({ error: 'Failed to process template-targeted message' });
      }
    }
    // Handle "admins" recipient - fetch all admin users
    else if (recipient === 'admins') {
      try {
        const adminUsers = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.role, 'admin'));
        
        if (adminUsers.length === 0) {
          return res.status(404).json({ error: 'No admin users found' });
        }
        
        targetedUserIds = adminUsers.map(user => user.id);
        recipientType = 'admins';
        recipientId = null;
        
        console.log(`Found ${targetedUserIds.length} admin recipient(s)`);
      } catch (error) {
        console.error('Error fetching admin users:', error);
        return res.status(500).json({ error: 'Failed to fetch admin users' });
      }
    }
    // Handle standard recipient types
    else if (['all', 'registered', 'badge_holders', 'admin'].includes(recipient)) {
      recipientType = recipient;
      recipientId = null;
    } else {
      // Handle individual user recipients - no restrictions
      // recipientId already contains the target user ID
    }
    
    // Create the message based on actual database schema
    const result = await db.insert(messages)
      .values({
        // Don't include ID - it's a serial type that auto-increments
        subject,
        content,
        senderId, // Already a number
        messageType: recipientType,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
      
    // Use the result from the insert operation instead of querying again
    const newMessage = result[0];
    
    // Create message recipients based on recipient type
    if (recipientType.startsWith('template_')) {
      // Handle template-targeted messages using the targetedUserIds array
      if (targetedUserIds && targetedUserIds.length > 0) {
        console.log(`Adding ${targetedUserIds.length} targeted recipients for template message ${newMessage.id}`);
        
        // Add each targeted user as a recipient (excluding sender)
        for (const userId of targetedUserIds) {
          if (userId !== senderId) {
            await db.insert(messageRecipients)
              .values({
                messageId: newMessage.id,
                recipientId: userId,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'delivered',
                targetRole: recipientType // Store the template targeting info
              });
          }
        }
      }
    } else if (recipientType === 'admins') {
      // Handle "admins" recipient - use the pre-fetched targetedUserIds
      if (targetedUserIds && targetedUserIds.length > 0) {
        console.log(`Adding ${targetedUserIds.length} admin recipients for message ${newMessage.id}`);
        
        // Add each admin user as a recipient (excluding sender if they're also an admin)
        for (const userId of targetedUserIds) {
          if (userId !== senderId) {
            await db.insert(messageRecipients)
              .values({
                messageId: newMessage.id,
                recipientId: userId,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'delivered',
                targetRole: 'admins'
              });
          }
        }
      }
    } else if (recipientType === 'admin') {
      // Find all admin users
      const adminUsers = await db.select()
        .from(users)
        .where(eq(users.role, 'admin'));
      
      // Populate targetedUserIds for email sending (excluding sender)
      targetedUserIds = adminUsers
        .filter(admin => admin.id !== senderId)
        .map(admin => admin.id);
      console.log(`Found ${targetedUserIds.length} admin users for message recipients (excluding sender)`);
      
      // Add each admin as a recipient (excluding sender)
      for (const admin of adminUsers) {
        if (admin.id !== senderId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage.id,
              recipientId: admin.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered',
              targetRole: 'admin'
            });
        }
      }
    } else if (recipientType === 'all') {
      // Find all users
      const allUsers = await db.select()
        .from(users);
      
      // Populate targetedUserIds for email sending (excluding sender)
      targetedUserIds = allUsers
        .filter(user => user.id !== senderId)
        .map(user => user.id);
      console.log(`Found ${targetedUserIds.length} users for 'all' message recipients (excluding sender)`);
      
      // Add each user as a recipient (excluding sender)
      for (const user of allUsers) {
        if (user.id !== senderId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage.id,
              recipientId: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered',
              targetRole: 'all'
            });
        }
      }
    } else if (recipientType === 'registered') {
      // Find all registered users (paid members)
      const registeredUsers = await db.select()
        .from(users)
        .where(eq(users.role, 'paid'));
      
      // Populate targetedUserIds for email sending (excluding sender)
      targetedUserIds = registeredUsers
        .filter(user => user.id !== senderId)
        .map(user => user.id);
      console.log(`Found ${targetedUserIds.length} paid users for message recipients (excluding sender)`);
      
      // Add each registered user as a recipient (excluding sender)
      for (const user of registeredUsers) {
        if (user.id !== senderId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage.id,
              recipientId: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered',
              targetRole: 'registered'
            });
        }
      }
    } else if (recipientType === 'badge_holders') {
      // Find all badge holders
      const badgeHolders = await db.select()
        .from(users)
        .where(eq(users.hasMembershipBadge, true));
      
      // Populate targetedUserIds for email sending (excluding sender)
      targetedUserIds = badgeHolders
        .filter(user => user.id !== senderId)
        .map(user => user.id);
      console.log(`Found ${targetedUserIds.length} badge holders for message recipients (excluding sender)`);
      
      // Add each badge holder as a recipient (excluding sender)
      for (const user of badgeHolders) {
        if (user.id !== senderId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage.id,
              recipientId: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered',
              targetRole: 'badge_holders'
            });
        }
      }
    } else if (recipientId) {
      // Add specific user as recipient
      const convertedRecipientId = typeof recipientId === 'string' ? parseInt(recipientId, 10) : recipientId;
      await db.insert(messageRecipients)
        .values({
          messageId: newMessage.id,
          recipientId: convertedRecipientId,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'delivered'
        });
    }

    // Handle file uploads if any and store attachment info for email
    const uploadedAttachments: Array<{ path: string; filename: string; mimetype: string }> = [];
    
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
          
          // Store attachment info for email sending
          uploadedAttachments.push({
            path: destinationPath,
            filename: file.originalname,
            mimetype: file.mimetype
          });
          
          // Upload to Object Storage in production or use local path in development
          console.log(`[Attachment] Processing attachment for message ${newMessage.id}: ${uniqueFilename}`);
          console.log(`[Attachment] DIAGNOSTIC - NODE_ENV: ${process.env.NODE_ENV}`);
          console.log(`[Attachment] DIAGNOSTIC - Original filename: ${file.originalname}`);
          
          // In production, upload to Object Storage
          let objectStorageUrl = null;
          try {
            console.log(`[Attachment] DIAGNOSTIC - Calling uploadAttachmentToObjectStorage with path: ${destinationPath} and filename: ${uniqueFilename}`);
            objectStorageUrl = await uploadAttachmentToObjectStorage(destinationPath, uniqueFilename);
            if (objectStorageUrl) {
              console.log(`[Attachment] Uploaded to Object Storage: ${objectStorageUrl}`);
              console.log(`[Attachment] DIAGNOSTIC - Object Storage URL received: ${objectStorageUrl}`);
            } else {
              console.log(`[Attachment] DIAGNOSTIC - No Object Storage URL received (null/undefined)`);
            }
          } catch (uploadError) {
            console.error(`[Attachment] Error uploading to Object Storage:`, uploadError);
            console.log(`[Attachment] DIAGNOSTIC - Upload to Object Storage failed with error`);
            // Continue anyway, we'll use local file as fallback
          }
          
          // Generate appropriate URL based on environment and available Object Storage URL
          // This is the critical fix - pass the objectStorageUrl to ensure proper URL generation
          console.log(`[Attachment] DIAGNOSTIC - Calling getAttachmentUrl with filename: ${uniqueFilename} and objectStorageUrl: ${objectStorageUrl}`);
          const attachmentUrl = getAttachmentUrl(uniqueFilename, objectStorageUrl);
          
          // Log the actual URL being stored in the database for debugging
          console.log(`[Attachment] DIAGNOSTIC - Received attachmentUrl from getAttachmentUrl: ${attachmentUrl}`);
          console.log(`[Attachment] Storing attachment URL in database: ${attachmentUrl}`);
          
          // Save attachment info to the database with URL
          await db.insert(messageAttachments)
            .values({
              id: uuidv4(), // Generate unique ID for attachment
              messageId: newMessage.id,
              filename: file.originalname,
              storedFilename: uniqueFilename,
              size: file.size.toString(), // Use size instead of fileSize
              contentType: file.mimetype,
              url: attachmentUrl, // Use proper environment-specific URL
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
    
    // Send email if requested
    if (sendEmail === 'true') {
      try {
        console.log('[SendGrid Message] Email sending requested for message:', newMessage.id);
        
        // Get recipient email addresses based on the recipient type
        let recipientEmails: string[] = [];
        
        if (targetedUserIds && targetedUserIds.length > 0) {
          // For template-targeted or admin messages, get emails from targeted users
          console.log(`[SendGrid Message] 📊 Fetching email data for ${targetedUserIds.length} targeted users`);
          
          const targetedUsersData = await db.select({
            id: users.id,
            email: users.email,
            username: users.username,
            fullName: users.fullName
          })
          .from(users)
          .where(inArray(users.id, targetedUserIds));
          
          console.log(`[SendGrid Message] 📋 Retrieved ${targetedUsersData.length} user records from database`);
          
          // Track users with and without valid emails for detailed logging
          const usersWithValidEmails: string[] = [];
          const usersWithoutValidEmails: Array<{id: number, name: string, email: string | null, username: string | null}> = [];
          
          // Process each user and categorize them
          targetedUsersData.forEach(user => {
            const emailAddress = user.email || user.username;
            const userName = user.fullName || user.username || `User ID ${user.id}`;
            
            if (emailAddress && emailAddress.includes('@')) {
              usersWithValidEmails.push(emailAddress);
              console.log(`[SendGrid Message] ✅ Valid email found for ${userName}: ${emailAddress}`);
            } else {
              usersWithoutValidEmails.push({
                id: user.id,
                name: userName,
                email: user.email,
                username: user.username
              });
              console.log(`[SendGrid Message] ❌ No valid email for ${userName} (email: ${user.email || 'null'}, username: ${user.username || 'null'})`);
            }
          });
          
          recipientEmails = usersWithValidEmails;
          
          // Log comprehensive summary
          console.log(`[SendGrid Message] ═══════════════════════════════════════════`);
          console.log(`[SendGrid Message] 📧 EMAIL SENDING SUMMARY`);
          console.log(`[SendGrid Message] Total targeted users: ${targetedUserIds.length}`);
          console.log(`[SendGrid Message] Users with valid emails: ${usersWithValidEmails.length}`);
          console.log(`[SendGrid Message] Users WITHOUT valid emails: ${usersWithoutValidEmails.length}`);
          
          if (usersWithoutValidEmails.length > 0) {
            console.log(`[SendGrid Message] ⚠️  WARNING: ${usersWithoutValidEmails.length} users will NOT receive emails!`);
            console.log(`[SendGrid Message] Users being skipped:`);
            usersWithoutValidEmails.forEach(user => {
              console.log(`[SendGrid Message]   - ${user.name} (ID: ${user.id})`);
            });
          }
          
          if (usersWithValidEmails.length === 0) {
            console.log(`[SendGrid Message] ⚠️  CRITICAL: No valid email addresses found! No emails will be sent.`);
          } else {
            console.log(`[SendGrid Message] 📨 Will send ${usersWithValidEmails.length} emails`);
          }
          console.log(`[SendGrid Message] ═══════════════════════════════════════════`);
        } else if (recipientId) {
          // For individual recipient, get their email
          const recipientData = await db.select({
            email: users.email,
            username: users.username
          })
          .from(users)
          .where(eq(users.id, typeof recipientId === 'string' ? parseInt(recipientId, 10) : recipientId))
          .limit(1);
          
          if (recipientData.length > 0) {
            const recipientEmail = recipientData[0].email || recipientData[0].username;
            if (recipientEmail && recipientEmail.includes('@')) {
              recipientEmails.push(recipientEmail);
            }
          }
          
          console.log(`[SendGrid Message] Found ${recipientEmails.length} email address for individual recipient`);
        }
        
        // Get sender info (also used for self-copy below)
        const senderData = await db.select({
          email: users.email,
          username: users.username,
          fullName: users.fullName
        })
        .from(users)
        .where(eq(users.id, senderId))
        .limit(1);
        
        const senderName = senderData[0]?.fullName || senderData[0]?.username || 'Message System';
        const senderEmail = senderData[0]?.email || 'noreply@barefootbay.com';
        
        // Send the sender a copy of the email so they have a record in their own inbox.
        // Skip if the sender has no valid email on file - rest of recipients still get emailed.
        const senderInboxAddress = senderData[0]?.email || senderData[0]?.username;
        if (senderInboxAddress && senderInboxAddress.includes('@')) {
          const alreadyIncluded = recipientEmails.some(
            e => e.toLowerCase() === senderInboxAddress.toLowerCase()
          );
          if (alreadyIncluded) {
            console.log(`[SendGrid Message] 📨 Sender ${senderInboxAddress} is already in the recipient list; no duplicate self-copy will be sent`);
          } else {
            recipientEmails.push(senderInboxAddress);
            console.log(`[SendGrid Message] 📨 Sender added as additional recipient for self-copy: ${senderInboxAddress} (recipient count now ${recipientEmails.length})`);
          }
        } else {
          console.log(`[SendGrid Message] ⚠️ Sender (ID: ${senderId}) has no valid email on file - skipping self-copy. Other recipients will still receive the email.`);
        }

        // Normalize to lowercase and dedupe so two users sharing a mailbox
        // (e.g. a couple registered with the same email) only get one copy.
        const recipientCountBeforeDedup = recipientEmails.length;
        recipientEmails = Array.from(
          new Set(recipientEmails.map(e => e.toLowerCase()))
        );
        if (recipientEmails.length !== recipientCountBeforeDedup) {
          const duplicatesRemoved = recipientCountBeforeDedup - recipientEmails.length;
          console.log(`[SendGrid Message] 🧹 Removed ${duplicatesRemoved} duplicate recipient email(s); ${recipientEmails.length} unique mailbox(es) will be emailed`);
        }

        // Send email to each recipient
        if (recipientEmails.length > 0) {
          
          // Process template variables in content if templateId exists
          let processedContent = content;
          if (templateId && templateId !== 'custom') {
            // Replace template variables - this is a basic implementation
            // In a real scenario, you'd replace these with actual user data
            processedContent = content
              .replace(/\{\{firstName\}\}/g, 'Member')
              .replace(/\{\{expirationDate\}\}/g, '[Date]');
          }
          
          // Prepare email attachments from uploaded files (if any)
          let emailAttachments: Array<{ content: string; filename: string; type: string }> = [];
          
          if (uploadedAttachments.length > 0) {
            console.log(`[SendGrid Message] Processing ${uploadedAttachments.length} attachment(s) for email`);
            
            for (const attachment of uploadedAttachments) {
              try {
                // Check if file exists
                if (fs.existsSync(attachment.path)) {
                  // Read file and convert to base64
                  const fileBuffer = fs.readFileSync(attachment.path);
                  const base64Content = fileBuffer.toString('base64');
                  
                  emailAttachments.push({
                    content: base64Content,
                    filename: attachment.filename,
                    type: attachment.mimetype
                  });
                  
                  console.log(`[SendGrid Message] Added attachment to email: ${attachment.filename} (${attachment.mimetype})`);
                } else {
                  console.warn(`[SendGrid Message] Attachment file not found: ${attachment.path}`);
                }
              } catch (attachmentError) {
                console.error(`[SendGrid Message] Error processing attachment ${attachment.filename}:`, attachmentError);
                // Continue with other attachments even if one fails
              }
            }
          }
          
          // Send email to each recipient using the proper template
          let successCount = 0;
          let failedEmails: Array<{email: string, error?: string}> = [];
          
          console.log(`[SendGrid Message] 📤 Starting to send ${recipientEmails.length} emails...`);
          
          for (const recipientEmail of recipientEmails) {
            try {
              const success = await sendMessageEmail(
                recipientEmail,
                subject,
                processedContent,
                senderName,
                senderEmail,
                emailAttachments.length > 0 ? emailAttachments : undefined
              );
              
              if (success) {
                successCount++;
                console.log(`[SendGrid Message] ✅ Email sent successfully to ${recipientEmail}`);
              } else {
                failedEmails.push({email: recipientEmail, error: 'SendGrid returned false'});
                console.error(`[SendGrid Message] ❌ Failed to send email to ${recipientEmail} (sendMessageEmail returned false)`);
              }
            } catch (emailError: any) {
              const errorMessage = emailError?.message || 'Unknown error';
              failedEmails.push({email: recipientEmail, error: errorMessage});
              console.error(`[SendGrid Message] ❌ Error sending email to ${recipientEmail}:`, emailError);
              // Continue sending to other recipients even if one fails
            }
          }
          
          // Final summary
          console.log(`[SendGrid Message] ═══════════════════════════════════════════`);
          console.log(`[SendGrid Message] 📬 FINAL EMAIL DELIVERY REPORT`);
          console.log(`[SendGrid Message] Successfully sent: ${successCount}/${recipientEmails.length} emails`);
          
          if (failedEmails.length > 0) {
            console.log(`[SendGrid Message] ⚠️  Failed to send ${failedEmails.length} emails:`);
            failedEmails.forEach(failure => {
              console.log(`[SendGrid Message]   - ${failure.email}: ${failure.error || 'Unknown error'}`);
            });
          }
          
          if (successCount === 0 && recipientEmails.length > 0) {
            console.log(`[SendGrid Message] 🚨 CRITICAL: ALL email sends failed! Check SendGrid configuration.`);
          } else if (successCount === recipientEmails.length) {
            console.log(`[SendGrid Message] ✅ All emails sent successfully!`);
          }
          console.log(`[SendGrid Message] ═══════════════════════════════════════════`);
        } else {
          console.log('[SendGrid Message] No valid email addresses found for recipients');
        }
      } catch (emailError) {
        console.error('[SendGrid Message] Error in email sending process:', emailError);
        // Don't fail the message creation if email fails, just log the error
      }
    }
    
    return res.status(201).json({ message: 'Message sent successfully', data: newMessage });
  } catch (error) {
    console.error('Error creating message:', error);
    
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
    
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark a message as read
router.put('/:id/read', authenticateUser, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if the message exists
    const message = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
      
    if (message.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if the user is a recipient of this message
    const recipient = await db.select()
      .from(messageRecipients)
      .where(and(
        eq(messageRecipients.messageId, messageId),
        eq(messageRecipients.recipientId, currentUserId)
      ))
      .limit(1);
      
    if (recipient.length === 0) {
      return res.status(403).json({ error: 'You are not a recipient of this message' });
    }
    
    // Mark as read
    await db.update(messageRecipients)
      .set({ 
        readAt: new Date(),
        status: 'read'
      })
      .where(and(
        eq(messageRecipients.messageId, messageId),
        eq(messageRecipients.recipientId, currentUserId)
      ));
      
    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get replies for a specific message
router.get('/:id/replies', authenticateUser, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // First, verify the original message exists and user has access to it
    const originalMessage = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
      
    if (originalMessage.length === 0) {
      return res.status(404).json({ error: 'Original message not found' });
    }
    
    console.log(`Fetching replies for message ID: ${messageId}`);
    
    // Fetch all replies to this message
    const replies = await db.select()
      .from(messages)
      .where(eq(messages.inReplyTo, messageId))
      .orderBy(asc(messages.createdAt));
    
    console.log(`Found ${replies.length} replies for message ${messageId}`);
    
    // Format replies with sender info
    const formattedReplies = await Promise.all(replies.map(async (reply) => {
      // Get sender info
      const senderInfo = await db.select()
        .from(users)
        .where(eq(users.id, reply.senderId))
        .limit(1);
      
      const senderName = senderInfo.length > 0 
        ? (senderInfo[0].fullName || senderInfo[0].username) 
        : 'Unknown';
      
      // Get attachments
      const attachments = await db.select()
        .from(messageAttachments)
        .where(eq(messageAttachments.messageId, reply.id));
      
      return {
        id: reply.id,
        senderId: reply.senderId,
        senderName,
        subject: reply.subject,
        content: reply.content,
        messageType: reply.messageType,
        read: true,
        timestamp: reply.createdAt,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        inReplyTo: reply.inReplyTo,
        attachments: attachments || []
      };
    }));
    
    return res.json(formattedReplies);
  } catch (error) {
    console.error('Error fetching message replies:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});



// Delete a message
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    console.log('🗑️ Single delete endpoint reached with ID:', req.params.id);
    console.log('Request path:', req.path);
    console.log('Request URL:', req.url);
    
    // Skip if this is the bulk delete route
    if (req.params.id === 'bulk') {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id;
    
    console.log(`💡 Attempting to delete message ID: ${messageId} by user ID: ${currentUserId}`);
    console.log(`Message ID type: ${typeof messageId}, User ID type: ${typeof currentUserId}`);
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID format' });
    }
    
    // Use database transaction for consistency
    const result = await db.transaction(async (tx) => {
      // Check if the message exists
      const messageResult = await tx.select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);
        
      if (messageResult.length === 0) {
        throw new Error('Message not found');
      }
      
      const message = messageResult[0];
      const isSender = message.senderId === currentUserId;
      const isUserAdmin = isAdmin(req.user?.role);
      
      console.log(`👤 User permission check: isSender=${isSender}, isAdmin=${isUserAdmin}`);
      
      // Check if user is a recipient of this message
      const recipientCheck = await tx.select()
        .from(messageRecipients)
        .where(
          and(
            eq(messageRecipients.messageId, messageId),
            eq(messageRecipients.recipientId, currentUserId)
          )
        )
        .limit(1);
      
      const isRecipient = recipientCheck.length > 0;
      console.log(`📨 User is recipient: ${isRecipient}`);
      
      // Implement Gmail-style per-user deletion
      if (isRecipient) {
        // User is a recipient - remove from their inbox (soft delete for recipient)
        console.log('🗂️ Removing message from recipient\'s inbox');
        await tx.delete(messageRecipients)
          .where(
            and(
              eq(messageRecipients.messageId, messageId),
              eq(messageRecipients.recipientId, currentUserId)
            )
          );
        
        return { success: true, deletionType: 'recipient_removal' };
        
      } else if (isSender) {
        // User is the sender - mark as deleted by sender but keep for recipients
        console.log('📤 Marking message as deleted by sender');
        await tx.update(messages)
          .set({ 
            deletedBySender: true,
            deletedAt: new Date()
          })
          .where(eq(messages.id, messageId));
        
        return { success: true, deletionType: 'sender_deletion' };
        
      } else if (isUserAdmin) {
        // Admin can perform hard delete if needed
        console.log('🛡️ Admin performing complete message deletion');
        
        // Get attachments before deletion
        const attachments = await tx.select()
          .from(messageAttachments)
          .where(eq(messageAttachments.messageId, messageId));
        
        // Delete in proper order: recipients -> attachments -> message
        await tx.delete(messageRecipients)
          .where(eq(messageRecipients.messageId, messageId));
          
        await tx.delete(messageAttachments)
          .where(eq(messageAttachments.messageId, messageId));
          
        await tx.delete(messages)
          .where(eq(messages.id, messageId));
        
        // Delete attachment files from filesystem (outside transaction)
        return { success: true, deletionType: 'admin_hard_delete', attachments };
        
      } else {
        throw new Error('No permission to delete this message');
      }
    });
    
    // Handle file deletion outside of transaction (if admin hard delete)
    if (result.deletionType === 'admin_hard_delete' && result.attachments) {
      for (const attachment of result.attachments) {
        if (attachment.storedFilename) {
          try {
            const filePath = path.join('uploads', 'attachments', attachment.storedFilename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Deleted attachment file: ${filePath}`);
            }
          } catch (fileError) {
            console.error(`❌ Failed to delete attachment file: ${fileError.message}`);
            // Don't fail the whole operation for file deletion errors
          }
        }
      }
    }
    
    console.log(`✅ Message deletion successful. Type: ${result.deletionType}`);
    return res.json({ 
      success: true, 
      deletionType: result.deletionType,
      message: result.deletionType === 'recipient_removal' 
        ? 'Message removed from your inbox' 
        : result.deletionType === 'sender_deletion'
        ? 'Message deleted from your sent items'
        : 'Message deleted permanently'
    });
    
  } catch (error) {
    console.error('❌ Error deleting message:', error);
    console.error('Stack trace:', error.stack);
    
    // Return more specific error messages
    if (error.message === 'Message not found') {
      return res.status(404).json({ error: 'Message not found' });
    } else if (error.message === 'No permission to delete this message') {
      return res.status(403).json({ error: 'You do not have permission to delete this message' });
    } else {
      return res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Get unread message counts for the current user
router.get('/unread/count', authenticateUser, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Count unread messages
    const unreadCount = await db.select({
      count: sql`count(*)`
    })
    .from(messageRecipients)
    .where(and(
      eq(messageRecipients.recipientId, currentUserId),
      eq(messageRecipients.readAt, null)
    ));
    
    return res.json({ count: parseInt(unreadCount[0].count.toString(), 10) || 0 });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all messages as read for the current user
router.post('/mark-all-read', authenticateUser, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Update all unread messages for this user
    const result = await db.update(messageRecipients)
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(messageRecipients.recipientId, currentUserId),
        eq(messageRecipients.readAt, null)
      ))
      .returning();
    
    console.log(`Marked ${result.length} messages as read for user ${currentUserId}`);
    
    return res.json({ 
      success: true, 
      markedCount: result.length,
      message: `Marked ${result.length} messages as read` 
    });
  } catch (error) {
    console.error('Error marking all messages as read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions for message management
function getUserNameById(userId) {
  return db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then(result => {
      if (result.length > 0) {
        return result[0].fullName || result[0].username;
      }
      return 'Unknown';
    })
    .catch(error => {
      console.error('Error fetching user name:', error);
      return 'Unknown';
    });
}

function markMessageAsRead(userId, messageId) {
  return db.update(messageRecipients)
    .set({ 
      readAt: new Date(),
      status: 'read'
    })
    .where(and(
      eq(messageRecipients.messageId, messageId),
      eq(messageRecipients.recipientId, userId)
    ))
    .catch(error => {
      console.error('Error marking message as read:', error);
    });
}

export default router;