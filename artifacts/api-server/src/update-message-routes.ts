/**
 * Updates to message routes to fix attachment handling
 * Import and execute this in server/index.ts to enable proper URL path handling for attachments
 */

import express from 'express';
import { db } from './db';
import { messageAttachments } from '../shared/schema-messages';
import { eq, isNull } from 'drizzle-orm';

/**
 * Middleware to fix attachment URL paths in requests
 * This ensures that all attachment URLs include the proper path prefix
 */
export function attachmentUrlFixMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Check if the request includes file uploads and fix the URL paths
  if (req.files && Array.isArray(req.files)) {
    // For multipart form uploads
    req.files.forEach((file: any) => {
      if (file.storedFilename && !file.url) {
        file.url = `/uploads/attachments/${file.storedFilename}`;
        console.log(`Fixed attachment URL in request: ${file.url}`);
      }
    });
  } else if (req.body && req.body.attachments) {
    // For JSON body with attachments array
    if (Array.isArray(req.body.attachments)) {
      req.body.attachments.forEach((attachment: any) => {
        if (attachment.storedFilename && !attachment.url) {
          attachment.url = `/uploads/attachments/${attachment.storedFilename}`;
          console.log(`Fixed attachment URL in request body: ${attachment.url}`);
        }
      });
    }
  }
  
  // Continue to the next middleware or route handler
  next();
}

/**
 * Fix existing attachments in the database that don't have proper URLs
 */
export async function fixExistingAttachments() {
  console.log('Checking for attachments that need URL fixes...');
  
  try {
    // Find all attachments that have a storedFilename but no URL
    const attachmentsToFix = await db.select()
      .from(messageAttachments)
      .where(
        eq(messageAttachments.url, '')
      );
    
    console.log(`Found ${attachmentsToFix.length} attachments needing URL fixes`);
    
    // Fix each attachment
    let fixed = 0;
    for (const attachment of attachmentsToFix) {
      if (attachment.storedFilename) {
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
    }
    
    console.log(`Fixed ${fixed} out of ${attachmentsToFix.length} attachments`);
  } catch (error) {
    console.error('Error fixing attachments:', error);
    throw error;
  }
}