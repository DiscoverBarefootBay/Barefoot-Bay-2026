import express from 'express';
import { assertMessageDeletable } from "../dmca/legal-hold";
import multer from 'multer';
import { db } from '../db';
import { users } from '@workspace/db';
import { messages, messageAttachments, messageRecipients } from '@workspace/db';
import { eq, and, or, desc, inArray, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticateUser } from '../middleware/auth';
import { isAdmin } from '../utils/role-utils';
import { assembleMessageHistory, getVisibleDescendants } from './message-history';
import { countVisibleUnreadHistory } from './message-unread';
import * as fs from 'fs';
import * as path from 'path';
import { uploadAttachmentToObjectStorage, getAttachmentUrl } from '../attachment-storage-proxy';
import { reserveMessageSend, recordCreatedMessage, enqueueMessageEmail, listSendProgress, dismissSendProgress } from "../message-email-progress";
import { DismissMessageSendProgressParams, ListMessageSendProgressResponse } from "@workspace/api-zod";

const router = express.Router();
const upload = multer({ dest: 'temp_upload/' });

router.get('/send-progress', authenticateUser, async (req, res) => {
  if (!req.user?.id) return res.sendStatus(401);
  // Sender scope is derived exclusively from authentication, never query input.
  return res.json(ListMessageSendProgressResponse.parse({ jobs: await listSendProgress(req.user.id) }));
});

router.delete('/send-progress/:id', authenticateUser, async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.sendStatus(401);
    return;
  }
  if (!isAdmin(req.user.role)) {
    res.status(403).json({ error: 'Administrator permission required' });
    return;
  }
  const params = DismissMessageSendProgressParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: 'Invalid send progress ID' });
    return;
  }
  const dismissed = await dismissSendProgress(req.user.id, params.data.id);
  if (!dismissed) {
    // Same response for missing, expired, dismissed, or another sender's job.
    res.status(404).json({ error: 'Send progress not found' });
    return;
  }
  res.sendStatus(204);
});

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
          await assertMessageDeletable(messageId);
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

    const history = await loadVisibleMessageHistory(currentUserId);
    return res.json(assembleMessageHistory(history.messages));
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function loadVisibleMessageHistory(currentUserId: number) {
  // Only fetch message rows that the caller sent or actually received. In
  // particular, being a recipient of a broadcast parent does not grant access
  // to a different participant's private reply.
  const recipientRows = await db.select()
    .from(messageRecipients)
    .where(visibleRecipientWhere(currentUserId));
  const receivedIds = [...new Set(recipientRows.map(row => row.messageId))];

  const messageQuery = db.select().from(messages);
  const visibleMessages = receivedIds.length > 0
    ? await messageQuery.where(or(
      eq(messages.senderId, currentUserId),
      and(
        inArray(messages.id, receivedIds),
        or(eq(messages.deletedBySender, false), sql`${messages.deletedBySender} IS NULL`)
      )
    )).orderBy(desc(messages.createdAt))
    : await messageQuery.where(eq(messages.senderId, currentUserId)).orderBy(desc(messages.createdAt));

  const messageIds = visibleMessages.map(message => message.id);
  const senderIds = [...new Set(visibleMessages.map(message => message.senderId))];
  const attachmentRows = messageIds.length > 0
    ? await db.select().from(messageAttachments).where(inArray(messageAttachments.messageId, messageIds))
    : [];
  const senderRows = senderIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, senderIds))
    : [];

  const attachmentsByMessage = new Map<number, typeof attachmentRows>();
  for (const attachment of attachmentRows) {
    const attachments = attachmentsByMessage.get(attachment.messageId) ?? [];
    attachments.push(attachment);
    attachmentsByMessage.set(attachment.messageId, attachments);
  }
  const senderNames = new Map(senderRows.map(user => [user.id, user.fullName || user.username]));
  const readStatus = new Map(recipientRows.map(row => [row.messageId, row.readAt !== null]));
  const messagesWithMetadata = visibleMessages.map(message => ({
    ...message,
    senderName: senderNames.get(message.senderId) || 'Unknown',
    read: message.senderId === currentUserId || readStatus.get(message.id) === true,
    attachments: attachmentsByMessage.get(message.id) || [],
  }));

  return { messages: messagesWithMetadata, recipientRows, senderNames };
}

function visibleRecipientWhere(currentUserId: number) {
  return and(
    eq(messageRecipients.recipientId, currentUserId),
    or(
      eq(messageRecipients.deletedByRecipient, false),
      sql`${messageRecipients.deletedByRecipient} IS NULL`
    ),
    isNull(messageRecipients.deletedAt)
  );
}

async function markVisibleThreadRead(
  currentUserId: number,
  history: Awaited<ReturnType<typeof loadVisibleMessageHistory>>,
  messageIds: number[],
): Promise<{ markedCount: number; markedMessageIds: number[] }> {
  const requestedIds = new Set(messageIds);
  const unreadIds = [...new Set(history.recipientRows
    .filter(row => requestedIds.has(row.messageId) && row.readAt === null)
    .map(row => row.messageId))];
  if (unreadIds.length === 0) return { markedCount: 0, markedMessageIds: [] };

  const readAt = new Date();
  const updatedRows = await db.update(messageRecipients)
    .set({ readAt, status: 'read', updatedAt: readAt })
    .where(and(
      visibleRecipientWhere(currentUserId),
      inArray(messageRecipients.messageId, unreadIds)
    ))
    .returning({ messageId: messageRecipients.messageId });

  const markedMessageIds = updatedRows.map(row => row.messageId);
  const unread = new Set(markedMessageIds);
  history.messages.forEach(message => {
    if (unread.has(message.id)) message.read = true;
  });
  return { markedCount: markedMessageIds.length, markedMessageIds };
}

// Get a specific message
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id;
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!Number.isInteger(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const history = await loadVisibleMessageHistory(currentUserId);
    const userIsAdmin = isAdmin(req.user?.role);
    let message = history.messages.find(item => item.id === messageId);
    if (!message && userIsAdmin) {
      // Preserve administrator access to an individual message without
      // loading its invisible ancestors or unrelated conversation contents.
      const requested = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
      if (requested[0]) {
        const attachments = await db.select().from(messageAttachments)
          .where(eq(messageAttachments.messageId, messageId));
        message = { ...requested[0], senderName: 'Unknown', read: true, attachments };
      }
    }
    if (!message) {
      return res.status(userIsAdmin ? 404 : 403).json({ error: userIsAdmin ? 'Message not found' : 'Access denied' });
    }

    const descendants = getVisibleDescendants(history.messages, messageId);
    await markVisibleThreadRead(currentUserId, history, [messageId, ...descendants.map(reply => reply.id)]);

    const presentationMessages = history.messages.some(item => item.id === messageId)
      ? history.messages
      : [...history.messages, message];
    const presentationHistory = assembleMessageHistory(presentationMessages);
    const containingThread = presentationHistory.find(thread =>
      thread.id === messageId || thread.replies.some(reply => reply.id === messageId)
    );
    const targetPresentation = containingThread?.id === messageId
      ? containingThread
      : containingThread?.replies.find(reply => reply.id === messageId);
    const fallbackPresentation = {
      ...message,
      threadRoot: true as const,
      displayRootId: message.id,
      orphanedReply: message.inReplyTo != null && !history.messages.some(item => item.id === message.inReplyTo),
    };
    const displayedMessage = targetPresentation ?? fallbackPresentation;
    const displayRootId = targetPresentation?.displayRootId ?? message.id;
    const attachments = message.attachments || [];
    let senderName = history.senderNames.get(message.senderId);
    if (!senderName) {
      const sender = await db.select().from(users).where(eq(users.id, message.senderId)).limit(1);
      senderName = sender.length > 0 ? sender[0].fullName || sender[0].username : 'Unknown';
    }

    let recipientInfo: Record<string, unknown> = { name: 'Unknown' };
    if (message.messageType === 'user') {
      const recipients = await db.select().from(messageRecipients)
        .where(eq(messageRecipients.messageId, messageId)).limit(1);
      if (recipients.length > 0) {
        const recipient = await db.select().from(users)
          .where(eq(users.id, recipients[0].recipientId)).limit(1);
        if (recipient.length > 0) {
          recipientInfo = {
            id: recipient[0].id,
            name: recipient[0].fullName || recipient[0].username,
          };
        }
      }
    } else if (message.messageType === 'admin' || message.messageType === 'admins') {
      recipientInfo = { name: 'Admin Team' };
    } else if (message.messageType === 'all') {
      recipientInfo = { name: 'All Users' };
    } else if (message.messageType === 'registered') {
      recipientInfo = { name: 'All Registered Users' };
    } else if (message.messageType === 'badge_holders') {
      recipientInfo = { name: 'All Badge Holders' };
    }

    return res.json({
      ...displayedMessage,
      senderName,
      attachments,
      sender: { id: message.senderId, name: senderName },
      recipient: recipientInfo,
      replies: descendants.map(reply => ({
        ...reply,
        threadRoot: false as const,
        displayRootId,
        timestamp: reply.createdAt,
        in_reply_to: reply.inReplyTo,
        inReplyTo: reply.inReplyTo,
      })),
      in_reply_to: message.inReplyTo,
      inReplyTo: message.inReplyTo,
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reply to a message
router.post('/:id/reply', authenticateUser, upload.array('attachments'), reserveMessageSend, async (req, res) => {
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
    
    await recordCreatedMessage(res.locals.sendRequest, newMessage[0].id);
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
      await enqueueMessageEmail(res.locals.sendRequest, newMessage[0].id, currentUserId, Array.isArray(req.files) ? req.files.length : 0);
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
router.post('/', authenticateUser, upload.array('attachments'), reserveMessageSend, async (req, res) => {
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
    await recordCreatedMessage(res.locals.sendRequest, newMessage.id);
    
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
    
    // The request only enqueues; the durable worker records provider outcomes.
    if (sendEmail === 'true') {
      await enqueueMessageEmail(res.locals.sendRequest, newMessage.id, senderId, Array.isArray(req.files) ? req.files.length : 0);
    }
    return res.status(201).json({ message: newMessage, data: newMessage, success: true });
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

// Mark only this caller-visible thread (including nested descendants) as read.
router.post('/:id/read-thread', authenticateUser, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!Number.isInteger(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const history = await loadVisibleMessageHistory(currentUserId);
    if (!history.messages.some(message => message.id === messageId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const descendants = getVisibleDescendants(history.messages, messageId);
    const result = await markVisibleThreadRead(
      currentUserId,
      history,
      [messageId, ...descendants.map(message => message.id)]
    );
    return res.json({
      success: true,
      threadId: messageId,
      markedCount: result.markedCount,
      markedMessageIds: result.markedMessageIds,
    });
  } catch (error) {
    console.error('Error marking visible message thread as read:', error);
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
    if (!Number.isInteger(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const history = await loadVisibleMessageHistory(currentUserId);
    const userIsAdmin = isAdmin(req.user?.role);
    let message = history.messages.find(item => item.id === messageId);
    if (!message && userIsAdmin) {
      const requested = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
      if (requested[0]) {
        message = { ...requested[0], senderName: 'Unknown', read: true, attachments: [] };
      }
    }
    if (!message) {
      return res.status(userIsAdmin ? 404 : 403).json({ error: userIsAdmin ? 'Message not found' : 'Access denied' });
    }

    const descendants = getVisibleDescendants(history.messages, messageId);
    await markVisibleThreadRead(currentUserId, history, descendants.map(reply => reply.id));
    const containingThread = assembleMessageHistory(history.messages).find(thread =>
      thread.id === messageId || thread.replies.some(reply => reply.id === messageId)
    );
    const displayRootId = containingThread?.displayRootId ?? messageId;
    return res.json(descendants.map(reply => ({
      ...reply,
      threadRoot: false as const,
      displayRootId,
      timestamp: reply.createdAt,
      in_reply_to: reply.inReplyTo,
      inReplyTo: reply.inReplyTo,
    })));
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
        
        // Legal hold: refuse before deleting anything.
        await assertMessageDeletable(messageId, tx);
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
    
    // Fetch only IDs, parent links and read timestamps; never message bodies,
    // users or attachments. Keep visibility identical to the mailbox loader.
    const recipientRows = await db.select({
      messageId: messageRecipients.messageId,
      readAt: messageRecipients.readAt,
    }).from(messageRecipients).where(visibleRecipientWhere(currentUserId));
    const receivedIds = [...new Set(recipientRows.map(row => row.messageId))];
    const messageQuery = db.select({
      id: messages.id,
      inReplyTo: messages.inReplyTo,
      senderId: messages.senderId,
    }).from(messages);
    const visibleMessages = await messageQuery.where(receivedIds.length > 0
      ? or(
        eq(messages.senderId, currentUserId),
        and(
          inArray(messages.id, receivedIds),
          or(eq(messages.deletedBySender, false), sql`${messages.deletedBySender} IS NULL`)
        )
      )
      : eq(messages.senderId, currentUserId));

    res.setHeader('Cache-Control', 'no-store');
    return res.json(countVisibleUnreadHistory(visibleMessages, recipientRows, currentUserId));
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