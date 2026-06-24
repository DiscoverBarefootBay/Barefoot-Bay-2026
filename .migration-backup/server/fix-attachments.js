/**
 * Script to fix attachment URLs in the message_attachments table
 * 
 * This script updates all attachments that have a storedFilename but missing URL
 * by constructing the proper URL from the stored filename.
 */

import { db } from './db';
import { messageAttachments } from '../shared/schema-messages';
import { eq } from 'drizzle-orm';

async function fixAttachmentUrls() {
  console.log('Starting attachment URL fix process...');
  
  try {
    // Find all attachments from the table
    const attachments = await db.select().from(messageAttachments);
    console.log(`Found ${attachments.length} total attachments in database`);
    
    // Count and filter attachments that need fixing (no URL but have stored filename)
    const attachmentsToFix = attachments.filter(att => 
      (att.storedFilename && (!att.url || att.url === ''))
    );
    
    console.log(`${attachmentsToFix.length} attachments need URL fixes`);
    
    // Fix each attachment
    let fixed = 0;
    for (const attachment of attachmentsToFix) {
      // Generate the correct URL from stored filename
      const url = `/uploads/attachments/${attachment.storedFilename}`;
      
      try {
        // Update the attachment with proper URL
        await db.update(messageAttachments)
          .set({ url })
          .where(eq(messageAttachments.id, attachment.id));
        
        fixed++;
        console.log(`Fixed attachment ID ${attachment.id}: set URL to ${url}`);
      } catch (updateError) {
        console.error(`Failed to update attachment ${attachment.id}:`, updateError);
      }
    }
    
    console.log(`Fixed ${fixed} out of ${attachmentsToFix.length} attachments`);
  } catch (error) {
    console.error('Error in fix process:', error);
  }
}

// Run the fix
fixAttachmentUrls().catch(err => {
  console.error('Error running fix script:', err);
});