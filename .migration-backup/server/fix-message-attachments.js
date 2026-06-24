/**
 * Script to fix message attachments by adding proper URL paths
 * This script scans for attachments without URL properties and corrects them
 */

// Using CommonJS for compatibility
const { db } = require('./db.js');
const { messageAttachments } = require('../shared/schema-messages');
const { eq, isNull } = require('drizzle-orm');

async function fixAttachmentUrls() {
  console.log('Starting attachment URL fixes...');
  
  try {
    // First, find all attachments that have a storedFilename but might be missing a URL
    const allAttachments = await db.select().from(messageAttachments);
    
    console.log(`Found ${allAttachments.length} attachments total`);
    
    // Filter to find attachments with missing URLs but with stored filenames
    const attachmentsToFix = allAttachments.filter(attachment => {
      return attachment.storedFilename && (!attachment.url || attachment.url === '');
    });
    
    console.log(`Found ${attachmentsToFix.length} attachments that need URL fixes`);
    
    // Fix each attachment that needs it
    let fixedCount = 0;
    
    for (const attachment of attachmentsToFix) {
      try {
        // Generate the proper URL path
        const newUrl = `/uploads/attachments/${attachment.storedFilename}`;
        
        // Update the record in the database
        await db.update(messageAttachments)
          .set({ url: newUrl })
          .where(eq(messageAttachments.id, attachment.id));
        
        fixedCount++;
        console.log(`Fixed attachment ${attachment.id} - Set URL to ${newUrl}`);
      } catch (updateError) {
        console.error(`Error updating attachment ${attachment.id}:`, updateError);
      }
    }
    
    console.log(`Fixed ${fixedCount} attachments`);
    return fixedCount;
  } catch (error) {
    console.error('Error in attachment fix process:', error);
    throw error;
  }
}

// Export the function for direct usage
module.exports = { fixAttachmentUrls };

// Run the function if this script is executed directly
if (require.main === module) {
  fixAttachmentUrls()
    .then(count => {
      console.log(`Process complete. Fixed ${count} attachments.`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Process failed:', error);
      process.exit(1);
    });
}