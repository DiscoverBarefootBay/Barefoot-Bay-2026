import { db } from '../db';
import { messages, messageRecipients } from '@workspace/db';
import { users } from '@workspace/db';
import { eq } from 'drizzle-orm';

// Template IDs to use for different inquiry types
const TEMPLATE_MAP: Record<string, string> = {
  'bug-report': 'bug_report',
  'feature-request': 'feature_request',
  'feedback': 'other_feedback'
};

/**
 * Creates a message in the messaging system from a contact form submission
 * 
 * @param inquiryType The type of inquiry (bug-report, feature-request, feedback)
 * @param userId The ID of the user submitting the inquiry (or null if not logged in)
 * @param name The name of the person submitting
 * @param email The email of the person submitting
 * @param subject The subject of the inquiry
 * @param message The message content
 * @returns The created message ID
 */
export async function createMessageFromContactForm(
  inquiryType: string,
  userId: number | null,
  name: string,
  email: string,
  subject: string,
  message: string
): Promise<number> {
  try {
    // Get template ID based on inquiry type
    const templateId = TEMPLATE_MAP[inquiryType as keyof typeof TEMPLATE_MAP] || 'other_feedback';
    
    // If user is not logged in but provided email, try to find their account
    let submitterId = userId;
    if (!submitterId && email) {
      const user = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (user.length > 0) {
        submitterId = user[0].id;
      }
    }
    
    // If we still don't have a user ID, we'll log this as a system message from "Unknown"
    if (!submitterId) {
      console.warn(`Contact form submission from non-registered user: ${email}`);
      // Could create a placeholder user here if needed, but for now we'll skip
      return -1;
    }
    
    // Prepare message content based on template
    let messageContent = '';
    let messageSubject = '';
    
    if (templateId === 'bug_report') {
      messageSubject = `Bug Report: ${subject}`;
      messageContent = `Bug Report submitted by: ${name}\n\n${message}\n\n---\nThis message was automatically generated from a Contact Us form submission.\nPlease reply directly to this message to communicate with the user about this bug report.`;
    } else if (templateId === 'feature_request') {
      messageSubject = `Feature Request: ${subject}`;
      messageContent = `Feature Request submitted by: ${name}\n\n${message}\n\n---\nThis message was automatically generated from a Contact Us form submission.\nPlease reply directly to this message to communicate with the user about this feature request.`;
    } else {
      messageSubject = `Feedback: ${subject}`;
      messageContent = `Feedback submitted by: ${name}\n\n${message}\n\n---\nThis message was automatically generated from a Contact Us form submission.\nPlease reply directly to this message to communicate with the user about their feedback.`;
    }
    
    // Create the message
    const messageResult = await db.insert(messages)
      .values({
        subject: messageSubject,
        content: messageContent,
        senderId: submitterId,
        messageType: 'admin', // Send to admin team
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    const newMessage = messageResult[0];
    
    // Find all admin users
    const adminUsers = await db.select()
      .from(users)
      .where(eq(users.role, 'admin'));
    
    // Add each admin as a recipient
    for (const admin of adminUsers) {
      // Don't add the sender as a recipient
      if (admin.id !== submitterId) {
        await db.insert(messageRecipients)
          .values({
            messageId: newMessage.id,
            recipientId: admin.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'delivered'
          });
      }
    }
    
    return newMessage.id;
  } catch (error) {
    console.error('Error creating message from contact form:', error);
    throw error;
  }
}