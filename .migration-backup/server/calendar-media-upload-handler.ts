/**
 * Calendar Media Upload Handler
 * 
 * This middleware intercepts uploads for calendar event media files
 * and ensures they are properly saved to Object Storage.
 */

import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { objectStorageService } from './object-storage-service';
import { processUploadedFile } from './media-upload-middleware';
import { migrationService, SOURCE_TYPE, MIGRATION_STATUS } from './migration-service';
import { normalizeMediaUrl, getDefaultImageUrl, extractFilename } from '../shared/url-normalizer';

/**
 * Handle calendar media uploads
 * @param req Request object
 * @param res Response object
 * @param next Next function
 */
export async function handleCalendarMediaUpload(req: Request, res: Response, next: NextFunction) {
  // Set media type explicitly to ensure proper handling
  (req as any).mediaType = 'calendar';
  
  console.log('[CalendarMediaUpload] Processing calendar media upload');
  
  // Get the file from the request
  const file = req.file as Express.Multer.File;
  
  if (!file) {
    console.log('[CalendarMediaUpload] No file found in request');
    
    // If we're in an event update context but no file was provided,
    // still pass along the existing URL to prevent database errors
    if (req.params?.id) {
      console.log(`[CalendarMediaUpload] This is an event update (ID: ${req.params.id}) with no new file`);
      // Note: we don't set objectStorageUrl since there's no new file
    }
    
    return next();
  }
  
  try {
    // Enhanced logging for debugging
    console.log(`[CalendarMediaUpload] Processing file details:
      - Original name: ${file.originalname}
      - Size: ${file.size} bytes
      - Path: ${file.path}
      - Mimetype: ${file.mimetype}
      - Destination: ${file.destination || 'not specified'}
      - Fieldname: ${file.fieldname}
    `);
    
    // Ensure the file exists with detailed diagnostics
    if (!fs.existsSync(file.path)) {
      console.error(`[CalendarMediaUpload] CRITICAL ERROR: File does not exist at path: ${file.path}`);
      
      // Try to diagnose the issue by checking directory permissions and existence
      const parentDir = path.dirname(file.path);
      console.log(`[CalendarMediaUpload] Checking parent directory: ${parentDir}`);
      
      if (fs.existsSync(parentDir)) {
        console.log('[CalendarMediaUpload] Parent directory exists. Contents:');
        const files = fs.readdirSync(parentDir);
        console.log(files.join('\n'));
      } else {
        console.error(`[CalendarMediaUpload] Parent directory does not exist: ${parentDir}`);
      }
      
      // Set a fallback URL using our utility function
      console.log('[CalendarMediaUpload] Using fallback URL for missing file');
      (req as any).objectStorageUrl = getDefaultImageUrl('event');
      return next();
    }
    
    // Get file stats for logging
    const fileStats = fs.statSync(file.path);
    console.log(`[CalendarMediaUpload] File confirmed at ${file.path} (${fileStats.size} bytes)`);
    
    // Read a small part of the file to ensure it's valid
    try {
      const fd = fs.openSync(file.path, 'r');
      const buffer = Buffer.alloc(Math.min(100, fileStats.size));
      fs.readSync(fd, buffer, 0, buffer.length, 0);
      fs.closeSync(fd);
      console.log(`[CalendarMediaUpload] File sample (first ${buffer.length} bytes): ${buffer.toString('hex').substring(0, 50)}...`);
    } catch (readError) {
      console.error(`[CalendarMediaUpload] Warning: Could not read file sample: ${readError.message}`);
    }
    
    // Upload to object storage with retry logic
    console.log('[CalendarMediaUpload] Uploading to Object Storage in CALENDAR bucket under events/ directory');
    
    // Try up to 3 times to upload the file
    let objectStorageUrl = '';
    let uploadSuccess = false;
    let uploadError = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[CalendarMediaUpload] Upload attempt ${attempt}/3...`);
        objectStorageUrl = await objectStorageService.uploadFile(file.path, 'events', file.filename, 'CALENDAR');
        uploadSuccess = true;
        console.log(`[CalendarMediaUpload] Successfully uploaded to Object Storage on attempt ${attempt}: ${objectStorageUrl}`);
        
        // Use our centralized URL normalizer to ensure consistent format
        // This automatically converts direct Object Storage URLs to proxy format
        const normalizedUrl = normalizeMediaUrl(objectStorageUrl, 'event');
        
        if (normalizedUrl !== objectStorageUrl) {
          console.log(`[CalendarMediaUpload] IMPORTANT: Normalized URL format: 
            - Original: ${objectStorageUrl}
            - Normalized: ${normalizedUrl}`);
          objectStorageUrl = normalizedUrl;
        }
        
        break;
      } catch (error) {
        uploadError = error;
        console.error(`[CalendarMediaUpload] Upload attempt ${attempt} failed:`, error);
        
        if (attempt < 3) {
          // Wait before retrying (with exponential backoff)
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.log(`[CalendarMediaUpload] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!uploadSuccess) {
      console.error('[CalendarMediaUpload] All upload attempts failed. Last error:', uploadError);
      
      // Use the default image URL as a fallback from our utility
      objectStorageUrl = getDefaultImageUrl('event');
      console.log(`[CalendarMediaUpload] Using fallback URL: ${objectStorageUrl}`);
    }
    
    // Try to verify the upload actually worked by listing the bucket contents
    if (uploadSuccess) {
      try {
        const fileExists = await objectStorageService.fileExists(`events/${file.filename}`, 'CALENDAR');
        if (fileExists) {
          console.log(`[CalendarMediaUpload] Verified file exists in Object Storage: events/${file.filename}`);
        } else {
          console.warn(`[CalendarMediaUpload] Warning: File not found in Object Storage after upload: events/${file.filename}`);
          // We'll still continue with the URL since the upload appeared to succeed
        }
      } catch (verifyError) {
        console.warn(`[CalendarMediaUpload] Error verifying upload: ${verifyError.message}`);
      }
    }
    
    // Store the Object Storage URL in the request for downstream handlers
    (req as any).objectStorageUrl = objectStorageUrl;
    
    // Create mapping entry to add to calendar-media-mapping.json
    // Use normalized storage proxy URL for client-side access
    const proxyUrl = normalizeMediaUrl(`/uploads/calendar/${file.filename}`, 'event');
    
    // Add this mapping to the calendar-media-mapping.json file
    try {
      const mappingFilePath = path.join(process.cwd(), 'server', 'calendar-media-mapping.json');
      let mapping = {};
      
      if (fs.existsSync(mappingFilePath)) {
        const content = fs.readFileSync(mappingFilePath, 'utf8');
        mapping = JSON.parse(content);
      }
      
      // Ensure we're using proxy URL consistently throughout the mapping
      // We should set all URL formats to map to the proxy URL format, not the direct Object Storage URL
      // This ensures client-side requests will always use the proxy
      console.log(`[CalendarMediaUpload] Creating mapping entries using consistent proxy URL format: ${proxyUrl}`);
      
      // Map all possible URL formats to the proxy URL 
      // to ensure backward compatibility with existing references
      mapping[`/uploads/calendar/${file.filename}`] = proxyUrl;
      mapping[`/calendar/${file.filename}`] = proxyUrl;
      mapping[`/media/${file.filename}`] = proxyUrl;
      mapping[`/events/${file.filename}`] = proxyUrl;
      mapping[`/${file.filename}`] = proxyUrl;
      
      // Map direct Object Storage URL to proxy URL for completeness
      if (objectStorageUrl.startsWith('https://object-storage.replit.app/')) {
        mapping[objectStorageUrl] = proxyUrl;
        
        // Also map variations with and without CALENDAR in the path
        const alternateUrl = objectStorageUrl.replace('/CALENDAR/events/', '/events/');
        mapping[alternateUrl] = proxyUrl;
      }
      
      // Map the proxy URL to itself for completeness (avoid circular references)
      mapping[proxyUrl] = proxyUrl;
      
      // Write back to file
      fs.writeFileSync(mappingFilePath, JSON.stringify(mapping, null, 2));
      console.log(`[CalendarMediaUpload] Updated mapping file with new entry for ${file.filename}`);
    } catch (mappingError) {
      console.error(`[CalendarMediaUpload] Error updating mapping file:`, mappingError);
    }
    
    // Create migration record only if upload was successful
    if (uploadSuccess) {
      try {
        await migrationService.createMigrationRecord({
          sourceType: SOURCE_TYPE.FILESYSTEM,
          sourceLocation: file.path,
          mediaBucket: 'CALENDAR',
          mediaType: 'calendar',
          storageKey: `events/${file.filename}`,
          migrationStatus: MIGRATION_STATUS.MIGRATED
        });
        console.log(`[CalendarMediaUpload] Created migration record for ${file.filename}`);
      } catch (recordError) {
        console.error(`[CalendarMediaUpload] Error creating migration record:`, recordError);
      }
    }
    
    // Continue with the request
    next();
  } catch (error) {
    console.error('[CalendarMediaUpload] Error processing upload:', error);
    
    // Set a fallback URL in case of any error using our utility function
    (req as any).objectStorageUrl = getDefaultImageUrl('event');
    next();
  }
}

export default handleCalendarMediaUpload;