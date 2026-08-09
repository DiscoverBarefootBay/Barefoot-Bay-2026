import express from 'express';
import multer from 'multer';
import { db } from '../db';
import { users } from '@workspace/db';
import { messages, messageAttachments, messageRecipients } from '@workspace/db';
import { eq, and, or, desc, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticateUser } from '../middleware/auth';
import { isAdmin } from '../utils/role-utils';
import * as fs from 'fs';
import * as path from 'path';
import { sendMessageEmail } from '../sendgrid-service';

const router = express.Router();
const upload = multer({ dest: 'temp_upload/' });

// Track recent message submissions to prevent duplicates
const recentSubmissions = new Map();

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

// Get all messages for the current user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isUserAdmin = isAdmin(req.user?.role);
    
    // Get message IDs where this user is a recipient and the message actually exists
    // This prevents orphaned recipients (where the message was deleted)
    const receivedMessageIds = await db.select({
      messageId: messageRecipients.messageId
    })
    .from(messageRecipients)
    .innerJoin(messages, eq(messageRecipients.messageId, messages.id))
    .where(eq(messageRecipients.recipientId, currentUserId));
    
    // Extract just the message IDs
    const messageIdsList = receivedMessageIds.map(m => m.messageId);
    
    // Get all messages sent by this user or where this user is a recipient
    // Making sure we only include messages that actually exist (not deleted)
    const userMessages = await db.select()
      .from(messages)
      .where(
        or(
          eq(messages.senderId, currentUserId),
          inArray(messages.id, messageIdsList)
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
      // Update read status based on both readAt and status fields for maximum compatibility
      // IMPORTANT: Ensure consistent read status determination across all endpoints
      // A message is read if it has a readAt value OR if status is explicitly 'read'
      readStatusMap[status.messageId] = (status.readAt !== null) || (status.status === 'read');
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
  // First, create a map of parent messages to their replies
  const messageThreads = {};
  const topLevelMessages = [];
  
  // Identify parent and child messages
  messages.forEach(message => {
    if (message.inReplyTo) {
      // This is a reply
      if (!messageThreads[message.inReplyTo]) {
        messageThreads[message.inReplyTo] = [];
      }
      messageThreads[message.inReplyTo].push(message);
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
    
    // Validate messageId is a valid number
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    console.log(`[Message Details] Fetching message ${messageId} for user ${currentUserId}`);
    
    // Get the message details
    const message = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    
    if (message.length === 0) {
      console.log(`[Message Details] Message ${messageId} not found`);
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
    
    // Return the message with additional details
    return res.json({
      ...msg,
      attachments,
      sender: sender.length > 0 ? {
        id: sender[0].id,
        name: sender[0].fullName || sender[0].username
      } : { name: 'Unknown' },
      recipient: recipientInfo
    });
  } catch (error) {
    console.error('[Message Details] Error fetching message:', error);
    console.error('[Message Details] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[Message Details] Error details:', {
      messageId: req.params.id,
      userId: req.user?.id,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
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
    
    // Check if the user has access to the parent message
    const parentMessage = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
      
    if (parentMessage.length === 0) {
      return res.status(404).json({ error: 'Parent message not found' });
    }
    
    // Check if the user has access to this message
    const isRecipient = await db.select()
      .from(messageRecipients)
      .where(and(
        eq(messageRecipients.messageId, messageId),
        eq(messageRecipients.recipientId, currentUserId)
      ))
      .limit(1);
      
    if (parentMessage[0].senderId !== currentUserId && isRecipient.length === 0 && !isAdmin(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get all replies to this message
    const repliesData = await db.select()
      .from(messages)
      .where(eq(messages.inReplyTo, messageId))
      .orderBy(desc(messages.createdAt)); // Newest first
    
    // Get the sender IDs to fetch their information
    const senderIds = repliesData.map(reply => reply.senderId);
    
    // Get all attachment IDs to fetch attachments
    const replyIds = repliesData.map(reply => reply.id);
    
    // Fetch all attachments for these replies
    const attachmentsData = replyIds.length > 0 ? 
      await db.select().from(messageAttachments).where(inArray(messageAttachments.messageId, replyIds)) : 
      [];
    
    // Group attachments by message ID
    const attachmentsByMessage = {};
    attachmentsData.forEach(attachment => {
      if (!attachmentsByMessage[attachment.messageId]) {
        attachmentsByMessage[attachment.messageId] = [];
      }
      attachmentsByMessage[attachment.messageId].push(attachment);
    });
    
    // Get sender information
    const senderInfo = senderIds.length > 0 ? 
      await db.select().from(users).where(inArray(users.id, senderIds)) : 
      [];
    
    // Create a map of user IDs to names
    const userNameMap = {};
    senderInfo.forEach(user => {
      userNameMap[user.id] = user.fullName || user.username;
    });
    
    // Format the reply data
    const formattedReplies = repliesData.map(reply => {
      return {
        id: reply.id,
        senderId: reply.senderId,
        senderName: userNameMap[reply.senderId] || 'Unknown',
        subject: reply.subject,
        content: reply.content,
        timestamp: reply.createdAt,
        createdAt: reply.createdAt,
        attachments: attachmentsByMessage[reply.id] || []
      };
    });
    
    return res.json(formattedReplies);
  } catch (error) {
    console.error('Error fetching replies:', error);
    return res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

// Reply to a message
router.post('/:id/reply', authenticateUser, upload.array('attachments'), async (req, res) => {
  try {
    const parentMessageId = parseInt(req.params.id, 10);
    const { content } = req.body;
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
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
      if (['admin', 'all', 'registered', 'badge_holders'].includes(parentMessage[0].messageType)) {
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
    } else if (messageType === 'admin') {
      // Find all admin users
      const adminUsers = await db.select()
        .from(users)
        .where(eq(users.role, 'admin'));
      
      // Add each admin as a recipient (except the sender)
      for (const admin of adminUsers) {
        if (admin.id !== currentUserId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage[0].id,
              recipientId: admin.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered'
            });
        }
      }
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
          
          // Generate URL for the attachment
          const attachmentUrl = `/uploads/attachments/${uniqueFilename}`;
          
          // Save attachment info to the database
          await db.insert(messageAttachments)
            .values({
              id: uuidv4(), // Generate unique ID
              messageId: newMessage[0].id,
              filename: file.originalname,
              storedFilename: uniqueFilename,
              size: file.size.toString(),
              contentType: file.mimetype,
              url: attachmentUrl, // Store the URL
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
    const attachments = await db.select().from(messageAttachments).where(eq(messageAttachments.messageId, newMessage[0].id));
    
    // Format response with all needed data
    const messageResponse = {
      ...newMessage[0],
      senderName,
      attachments,
      read: true // Sender has read their own message
    };

    // Send email notifications for the reply (non-blocking)
    (async () => {
      try {
        const replySubject = `Re: ${parentMessage[0].subject}`;
        // `attachments` is the DB metadata array fetched above — extract display filenames only,
        // no binary content is available here so nothing is forwarded to SendGrid as a real attachment.
        const displayFilenames = attachments.map((a: { filename: string }) => a.filename).filter(Boolean);

        if (messageType === 'user' && recipientId) {
          const recipientRows = await db.select().from(users).where(eq(users.id, recipientId)).limit(1);
          if (recipientRows.length > 0) {
            const r = recipientRows[0];
            if (r.email && r.emailNotificationsEnabled !== false) {
              const recipientDisplayName = r.fullName || r.username || undefined;
              await sendMessageEmail(r.email, replySubject, content, senderName, '', undefined, recipientDisplayName, true, displayFilenames.length > 0 ? displayFilenames : undefined);
            }
          }
        } else if (messageType === 'admin') {
          const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
          for (const admin of adminUsers) {
            if (admin.id !== currentUserId && admin.email && admin.emailNotificationsEnabled !== false) {
              const adminDisplayName = admin.fullName || admin.username || undefined;
              await sendMessageEmail(admin.email, replySubject, content, senderName, '', undefined, adminDisplayName, true, displayFilenames.length > 0 ? displayFilenames : undefined);
            }
          }
        }
        // Skip 'all', 'registered', 'badge_holders' — no mass email blast
      } catch (emailError) {
        console.error('[sendMessageEmail] Failed to send reply notification email:', emailError);
      }
    })().catch(console.error);

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
    
    return res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Create a new message
router.post('/', authenticateUser, upload.array('attachments'), async (req, res) => {
  try {
    const { recipient, subject, content } = req.body;
    const senderId = req.user?.id;
    
    if (!senderId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!subject || !content) {
      return res.status(400).json({ error: 'Subject and content are required' });
    }

    // Create a unique key for duplicate detection
    const submissionKey = `${senderId}-${subject.trim()}-${content.trim().substring(0, 100)}`;
    const now = Date.now();
    
    // Check if this exact message was submitted recently (within 30 seconds)
    if (recentSubmissions.has(submissionKey)) {
      const lastSubmission = recentSubmissions.get(submissionKey);
      if (now - lastSubmission < 30000) { // 30 seconds
        console.log(`Duplicate message submission blocked for user ${senderId}: "${subject}"`);
        return res.status(429).json({ error: 'Please wait before sending the same message again' });
      }
    }
    
    // Record this submission
    recentSubmissions.set(submissionKey, now);
    
    // Clean up old submissions (older than 5 minutes)
    for (const [key, timestamp] of recentSubmissions.entries()) {
      if (now - timestamp > 300000) { // 5 minutes
        recentSubmissions.delete(key);
      }
    }
    
    // Check if user is allowed to send to this recipient
    // Only admins can send to non-admin recipients
    let recipientId = recipient;
    let recipientType = 'user';
    
    // Handle special recipient types
    if (['all', 'registered', 'badge_holders', 'admin'].includes(recipient)) {
      recipientType = recipient;
      recipientId = null;
    } else {
      // Check if sending to a non-admin when sender is not an admin
      if (!isAdmin(req.user?.role)) {
        // For non-admin senders, only allow sending to 'admin'
        recipientType = 'admin';
        recipientId = null;
      }
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
    if (recipientType === 'admin') {
      // Find all admin users
      const adminUsers = await db.select()
        .from(users)
        .where(eq(users.role, 'admin'));
      
      // Add each admin as a recipient
      for (const admin of adminUsers) {
        await db.insert(messageRecipients)
          .values({
            messageId: newMessage.id,
            recipientId: admin.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'delivered'
          });
      }
    } else if (recipientType === 'all') {
      // Find all users
      const allUsers = await db.select()
        .from(users);
      
      // Add each user as a recipient (excluding sender)
      for (const user of allUsers) {
        if (user.id !== senderId) {
          await db.insert(messageRecipients)
            .values({
              messageId: newMessage.id,
              recipientId: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'delivered'
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
          
          // Generate URL for the attachment
          const attachmentUrl = `/uploads/attachments/${uniqueFilename}`;
          
          // Save attachment info to the database with URL
          await db.insert(messageAttachments)
            .values({
              id: uuidv4(), // Generate unique ID for attachment
              messageId: newMessage.id,
              filename: file.originalname,
              storedFilename: uniqueFilename,
              size: file.size.toString(), // Use size instead of fileSize
              contentType: file.mimetype,
              url: attachmentUrl, // Include the URL path
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
    
    // Send email notifications (non-blocking — do not delay HTTP response)
    (async () => {
      try {
        // Fetch sender display name
        const senderRows = await db.select().from(users).where(eq(users.id, senderId)).limit(1);
        const senderDisplayName = senderRows.length > 0
          ? (senderRows[0].fullName || senderRows[0].username || 'A community member')
          : 'A community member';

        // Fetch attachment filenames saved for this message (display-only in email body)
        const savedAttachments = await db.select().from(messageAttachments)
          .where(eq(messageAttachments.messageId, newMessage.id));
        const displayFilenames = savedAttachments.map(a => a.filename).filter(Boolean);

        if (recipientType === 'user' && recipientId) {
          const numericRecipientId = typeof recipientId === 'string' ? parseInt(recipientId, 10) : recipientId;
          const recipientRows = await db.select().from(users).where(eq(users.id, numericRecipientId)).limit(1);
          if (recipientRows.length > 0) {
            const r = recipientRows[0];
            if (r.email && r.emailNotificationsEnabled !== false) {
              const recipientDisplayName = r.fullName || r.username || undefined;
              await sendMessageEmail(r.email, subject, content, senderDisplayName, '', undefined, recipientDisplayName, false, displayFilenames.length > 0 ? displayFilenames : undefined);
            }
          }
        } else if (recipientType === 'admin') {
          const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
          for (const admin of adminUsers) {
            if (admin.id !== senderId && admin.email && admin.emailNotificationsEnabled !== false) {
              const adminDisplayName = admin.fullName || admin.username || undefined;
              await sendMessageEmail(admin.email, subject, content, senderDisplayName, '', undefined, adminDisplayName, false, displayFilenames.length > 0 ? displayFilenames : undefined);
            }
          }
        }
        // Skip 'all', 'registered', 'badge_holders' — no mass email blast
      } catch (emailError) {
        console.error('[sendMessageEmail] Failed to send message notification email:', emailError);
      }
    })().catch(console.error);

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
router.post('/:id/read', authenticateUser, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id;
    
    console.log(`Attempting to mark message ${messageId} as read for user ${currentUserId}`);
    
    if (!currentUserId) {
      console.log('No authenticated user found');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(messageId)) {
      console.log('Invalid message ID provided');
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    // Check if the message exists
    const message = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
      
    if (message.length === 0) {
      console.log(`Message ${messageId} not found`);
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
      console.log(`User ${currentUserId} is not a recipient of message ${messageId}`);
      return res.status(403).json({ error: 'You are not a recipient of this message' });
    }
    
    // Check if already marked as read
    if (recipient[0].readAt) {
      console.log(`Message ${messageId} already marked as read for user ${currentUserId}`);
      return res.json({ success: true, alreadyRead: true });
    }
    
    // Mark as read
    const result = await db.update(messageRecipients)
      .set({ 
        readAt: new Date(),
        status: 'read',
        updatedAt: new Date()
      })
      .where(and(
        eq(messageRecipients.messageId, messageId),
        eq(messageRecipients.recipientId, currentUserId)
      ))
      .returning();
      
    console.log(`Successfully marked message ${messageId} as read for user ${currentUserId}`);
    return res.json({ success: true, updated: result.length > 0 });
  } catch (error) {
    console.error('Error marking message as read:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Mark an entire thread as read (including all replies)
router.post('/:id/read-thread', authenticateUser, async (req, res) => {
  try {
    const parentMessageId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id;
    
    console.log(`Attempting to mark thread ${parentMessageId} as read for user ${currentUserId}`);
    
    if (!currentUserId) {
      console.log('No authenticated user found');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(parentMessageId)) {
      console.log('Invalid message ID provided');
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    // Check if the parent message exists
    const parentMessage = await db.select()
      .from(messages)
      .where(eq(messages.id, parentMessageId))
      .limit(1);
      
    if (parentMessage.length === 0) {
      console.log(`Parent message ${parentMessageId} not found`);
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Get all messages in this thread (parent + replies)
    const threadMessages = await db.select()
      .from(messages)
      .where(or(
        eq(messages.id, parentMessageId),
        eq(messages.inReplyTo, parentMessageId)
      ));
    
    const threadMessageIds = threadMessages.map(msg => msg.id);
    console.log(`Found ${threadMessageIds.length} messages in thread ${parentMessageId}:`, threadMessageIds);
    
    // Check which messages the user is a recipient of
    const userRecipients = await db.select()
      .from(messageRecipients)
      .where(and(
        inArray(messageRecipients.messageId, threadMessageIds),
        eq(messageRecipients.recipientId, currentUserId)
      ));
    
    if (userRecipients.length === 0) {
      console.log(`User ${currentUserId} is not a recipient of any messages in thread ${parentMessageId}`);
      return res.status(403).json({ error: 'You are not a recipient of this thread' });
    }
    
    // Mark all messages in the thread as read
    const unreadRecipients = userRecipients.filter(recipient => !recipient.readAt);
    
    if (unreadRecipients.length === 0) {
      console.log(`All messages in thread ${parentMessageId} already marked as read for user ${currentUserId}`);
      return res.json({ success: true, alreadyRead: true, markedCount: 0 });
    }
    
    const unreadMessageIds = unreadRecipients.map(recipient => recipient.messageId);
    
    // Update all unread messages in the thread
    const result = await db.update(messageRecipients)
      .set({ 
        readAt: new Date(),
        status: 'read',
        updatedAt: new Date()
      })
      .where(and(
        inArray(messageRecipients.messageId, unreadMessageIds),
        eq(messageRecipients.recipientId, currentUserId)
      ))
      .returning();
      
    console.log(`Successfully marked ${result.length} messages as read in thread ${parentMessageId} for user ${currentUserId}`);
    return res.json({ 
      success: true, 
      markedCount: result.length,
      threadId: parentMessageId,
      markedMessageIds: unreadMessageIds
    });
  } catch (error) {
    console.error('Error marking thread as read:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete a message
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id;
    
    console.log(`DELETE request for message ID: ${messageId} (${typeof messageId}) by user ID: ${currentUserId} (${typeof currentUserId})`);
    
    if (!currentUserId) {
      console.log('Authentication required - user ID missing');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(messageId)) {
      console.log(`Invalid message ID: ${req.params.id} is not a number`);
      return res.status(400).json({ error: 'Invalid message ID' });
    }
    
    // Check if the message exists
    const message = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
      
    if (message.length === 0) {
      console.log(`Message ID ${messageId} not found`);
      return res.status(404).json({ error: 'Message not found' });
    }
    
    console.log(`Found message to delete:`, message[0]);
    
    // Check if the user has permission to delete the message
    const isSender = message[0].senderId === currentUserId;
    const isUserAdmin = isAdmin(req.user?.role);
    
    console.log(`Permission check: isSender=${isSender}, isUserAdmin=${isUserAdmin}, senderId=${message[0].senderId}, currentUserId=${currentUserId}`);
    
    if (!isSender && !isUserAdmin) {
      console.log(`Permission denied: user ${currentUserId} is not sender or admin`);
      return res.status(403).json({ error: 'You are not allowed to delete this message' });
    }
    
    // Find all replies to this message (for deletion or notification)
    const replies = await db.select()
      .from(messages)
      .where(eq(messages.inReplyTo, messageId));
      
    console.log(`Message has ${replies.length} replies - will delete these as well`);
    
    // Get all attachment IDs from replies for later deletion
    const replyIds = replies.map(reply => reply.id);
    
    // Get all attachments for replies
    let replyAttachments = [];
    if (replyIds.length > 0) {
      replyAttachments = await db.select()
        .from(messageAttachments)
        .where(inArray(messageAttachments.messageId, replyIds));
        
      console.log(`Found ${replyAttachments.length} attachments in replies to delete`);
    }
    
    // Get attachments to delete files from filesystem
    const attachments = await db.select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, messageId));
      
    console.log(`Found ${attachments.length} attachments to delete`);
    
    try {
      // Use a transaction for all database operations
      await db.transaction(async (tx) => {
        // First delete all replies (if any)
        if (replyIds.length > 0) {
          // Delete recipients for replies
          await tx.delete(messageRecipients)
            .where(inArray(messageRecipients.messageId, replyIds));
            
          console.log(`Deleted recipients for ${replyIds.length} replies`);
          
          // Delete attachments for replies
          await tx.delete(messageAttachments)
            .where(inArray(messageAttachments.messageId, replyIds));
            
          console.log(`Deleted attachments for ${replyIds.length} replies from database`);
          
          // Delete the reply messages
          await tx.delete(messages)
            .where(inArray(messages.id, replyIds));
            
          console.log(`Deleted ${replyIds.length} replies from database`);
        }
        
        // Delete message recipients
        await tx.delete(messageRecipients)
          .where(eq(messageRecipients.messageId, messageId));
          
        console.log('Deleted message recipients');
        
        // Delete message attachments from database
        await tx.delete(messageAttachments)
          .where(eq(messageAttachments.messageId, messageId));
          
        console.log('Deleted message attachments from database');
        
        // Delete message
        await tx.delete(messages)
          .where(eq(messages.id, messageId));
          
        console.log('Deleted message from database');
      });
      
      console.log('Database transaction completed successfully');
      
      // Delete attachment files from filesystem (outside transaction)
      // Process both main message attachments and reply attachments
      const allAttachments = [...attachments, ...replyAttachments];
      console.log(`Processing ${allAttachments.length} total attachments for deletion`);
      
      for (const attachment of allAttachments) {
        try {
          console.log('Processing attachment for deletion:', attachment);
          
          if (attachment.storedFilename) {
            const filePath = path.join('uploads', 'attachments', attachment.storedFilename);
            console.log(`Checking attachment file at path: ${filePath}`);
            
            if (fs.existsSync(filePath)) {
              console.log(`Deleting attachment file: ${filePath}`);
              fs.unlinkSync(filePath);
            } else {
              console.log(`Attachment file not found at path: ${filePath}`);
            }
          } else if (attachment.filename) {
            // Try alternative field names
            const filePath = path.join('uploads', 'attachments', attachment.filename);
            console.log(`Checking alternative attachment file at path: ${filePath}`);
            
            if (fs.existsSync(filePath)) {
              console.log(`Deleting alternative attachment file: ${filePath}`);
              fs.unlinkSync(filePath);
            }
          }
        } catch (fileError) {
          console.error('Error handling attachment deletion:', fileError);
          // Continue with other attachments
        }
      }
    } catch (dbError) {
      console.error('Database error during message deletion:', dbError);
      return res.status(500).json({ 
        error: 'Failed to delete message from database',
        message: dbError.message
      });
    }
    
    console.log(`Message ID ${messageId} successfully deleted`);
    return res.json({ success: true, messageId });
  } catch (error) {
    console.error('Error deleting message:', error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message
    });
  }
});

// Get unread message counts for the current user
router.get('/unread/count', authenticateUser, async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log(`Fetching unread message count for user ${currentUserId}`);
    
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
      console.log(`User ${currentUserId} has no messages`);
      return res.json({ count: 0 });
    }
    
    console.log(`Found ${messageIdsList.length} total messages for user ${currentUserId}`);
    
    // Get read status for these messages
    const messageReadStatus = await db.select()
      .from(messageRecipients)
      .where(
        and(
          inArray(messageRecipients.messageId, messageIdsList),
          eq(messageRecipients.recipientId, currentUserId)
        )
      );
    
    // Count unread messages with more reliable logic
    let unreadCount = 0;
    
    // Create a map of message IDs to read status
    const readStatusMap = {};
    messageReadStatus.forEach(status => {
      // Consider a message read only if it has a readAt timestamp or explicitly marked as read
      readStatusMap[status.messageId] = (status.readAt !== null) || (status.status === 'read');
    });
    
    // Count messages that are not marked as read in the readStatusMap
    messageIdsList.forEach(messageId => {
      if (!readStatusMap[messageId]) {
        unreadCount++;
      }
    });
    
    console.log(`User ${currentUserId} has ${unreadCount} unread messages (validated count from /count/unread endpoint)`);
    
    // Force a numeric response
    const response = { count: Number(unreadCount) };
    console.log(`Returning response:`, response);
    
    return res.json(response);
  } catch (error) {
    console.error('Error getting unread count:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
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

// Get message count for current user
// Add a diagnostic endpoint to help identify unread message count issues
router.get('/diagnose', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || isNaN(Number(userId))) {
      return res.status(401).json({ error: 'User not authenticated or invalid ID' });
    }
    
    // Ensure userId is treated as a number
    const userIdNum = Number(userId);
    console.log(`Running message diagnostics for user ${userIdNum}`);
    
    // Get unread count from regular messages table without joins
    // This will include any orphaned messages
    const rawCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(messageRecipients)
      .where(
        and(
          eq(messageRecipients.recipientId, userIdNum),
          eq(messageRecipients.status, 'unread')
        )
      );
    
    const rawUnreadCount = rawCountResult[0]?.count || 0;
    console.log(`Raw unread count (including orphaned): ${rawUnreadCount}`);
    
    // Count with inner join (current production method)
    const validatedCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(messageRecipients)
      .innerJoin(
        messages,
        eq(messageRecipients.messageId, messages.id)
      )
      .where(
        and(
          or(
            eq(messageRecipients.recipientId, userIdNum),
            and(
              eq(messageRecipients.targetRole, 'admin'),
              sql`EXISTS (SELECT 1 FROM ${users} WHERE id = ${userIdNum} AND role = 'admin')`
            )
          ),
          eq(messageRecipients.status, 'unread')
        )
      );
    
    const validatedUnreadCount = validatedCountResult[0]?.count || 0;
    console.log(`Validated unread count (inner join): ${validatedUnreadCount}`);
    
    // Get orphaned records (recipients without messages)
    const orphanedResult = await db
      .select({
        messageId: messageRecipients.messageId,
        recipientId: messageRecipients.recipientId,
        status: messageRecipients.status,
        createdAt: messageRecipients.createdAt
      })
      .from(messageRecipients)
      .where(
        and(
          eq(messageRecipients.recipientId, userIdNum),
          eq(messageRecipients.status, 'unread'),
          sql`NOT EXISTS (SELECT 1 FROM ${messages} WHERE ${messages.id} = ${messageRecipients.messageId})`
        )
      );
    
    const orphanedCount = orphanedResult.length;
    console.log(`Orphaned unread recipients: ${orphanedCount}`);
    
    // Get the messages that are visible on the UI
    const visibleMessages = await db
      .select()
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
      
    return res.json({
      rawUnreadCount,
      validatedUnreadCount,
      orphanedCount,
      orphanedRecipients: orphanedResult,
      visibleMessagesCount: visibleMessages.length
    });
  } catch (error) {
    console.error('Error running message diagnostics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/count/unread', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || isNaN(Number(userId))) {
      return res.status(401).json({ error: 'User not authenticated or invalid ID' });
    }
    
    // Ensure userId is treated as a number
    const userIdNum = Number(userId);
    
    // IMPORTANT: This query needs to match exactly what's shown on the messages page
    // Look at the client/src/pages/messages.tsx for how the UI determines unread count
    const result = await db
      .select()
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
      .orderBy(desc(messages.createdAt));
    
    // Count all messages marked as unread for this user
    const totalUnread = result.length;
    console.log(`User ${userIdNum} has ${totalUnread} unread messages (validated count from /count/unread endpoint)`);
    
    return res.json({ count: totalUnread });
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all messages as read for the current user
router.post('/mark-all-read', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || isNaN(Number(userId))) {
      return res.status(401).json({ error: 'User not authenticated or invalid ID' });
    }
    
    // Ensure userId is treated as a number
    const userIdNum = Number(userId);
    
    // Update all unread messages for this user to 'read' status
    // Note: The system uses 'delivered' for unread messages and 'read' for read messages
    const result = await db.update(messageRecipients)
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(messageRecipients.recipientId, userIdNum),
        eq(messageRecipients.status, 'delivered')
      ))
      .returning();
    
    console.log(`Marked ${result.length} messages as read for user ${userIdNum}`);
    
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

export default router;