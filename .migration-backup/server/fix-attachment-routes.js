/**
 * Fix for message attachment routes 
 * This ensures proper URLs are added for message attachments
 */

import { db } from './db.js';
import { messageAttachments } from '../shared/schema-messages.js';
import { eq } from 'drizzle-orm';

// Utility function to check and update existing attachments
export async function ensureAttachmentUrls() {
  console.log('Checking for attachments without URLs...');
  
  // Find attachments with storedFilename but no URL
  const attachmentsToUpdate = await db.select()
    .from(messageAttachments)
    .where(eq(messageAttachments.url, ''));
  
  if (attachmentsToUpdate.length === 0) {
    console.log('No attachments need URL updates');
    return;
  }
  
  console.log(`Found ${attachmentsToUpdate.length} attachments that need URL updates`);
  
  // Update each attachment
  for (const attachment of attachmentsToUpdate) {
    if (attachment.storedFilename) {
      // Create proper URL for the attachment
      const url = `/uploads/attachments/${attachment.storedFilename}`;
      
      await db.update(messageAttachments)
        .set({ url })
        .where(eq(messageAttachments.id, attachment.id));
      
      console.log(`Updated attachment ${attachment.id} with URL: ${url}`);
    }
  }
  
  console.log('Attachment URL updates completed');
}

// Call the function if this script is executed directly
if (import.meta.url === import.meta.main) {
  ensureAttachmentUrls().catch(err => {
    console.error('Error updating attachment URLs:', err);
  });
}