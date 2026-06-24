/**
 * Enhanced Media Upload Middleware
 * 
 * This middleware provides a unified approach to handling media uploads,
 * supporting both the original filesystem approach and the new Replit Object Storage.
 * It works as a drop-in replacement for the existing upload handling.
 * 
 * Upgraded to support multi-bucket storage for different content types:
 * - DEFAULT bucket: User avatars, homepage banner slides, site-wide icons
 * - CALENDAR bucket: Calendar events and related media
 * - FORUM bucket: Forum posts and comment media
 * - VENDORS bucket: Vendor-related media
 * - SALE bucket: Real estate listings and for-sale items
 * - COMMUNITY bucket: Community-related media
 */

import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { objectStorageService, BUCKETS } from './object-storage-service';
import { MEDIA_TYPES, ensureDirectoryExists } from './media-path-utils';
import { migrationService, SOURCE_TYPE, MIGRATION_STATUS } from './migration-service';

// Configuration flag to enable/disable object storage
// Always prioritize Object Storage for all media, especially calendar events
const USE_OBJECT_STORAGE = true;
const USE_FILESYSTEM = false; // Disable filesystem storage for new uploads
const CREATE_MIGRATION_RECORDS = true; // Track migration status for uploads

// All buckets will use Object Storage as the primary storage solution
// URLs from these buckets will use Object Storage URLs as the primary URL
const OBJECT_STORAGE_PRIMARY_BUCKETS = Object.values(BUCKETS);

// Valid sections for media upload path detection
export const VALID_SECTIONS = {
  DEFAULT: 'default',
  AVATARS: 'avatars',
  BANNER_SLIDES: 'banner-slides',
  CALENDAR: 'calendar',
  EVENTS: 'events',
  FORUM: 'forum',
  VENDORS: 'vendors',
  REAL_ESTATE: 'real-estate',
  COMMUNITY: 'community'
};

/**
 * Detect the appropriate section and bucket for an upload based on path or explicit media type
 * @param mediaType The specified media type
 * @param filePath The file path (used as fallback if media type doesn't map clearly)
 * @returns The detected section and appropriate bucket
 */
export function detectSectionAndBucket(mediaType: string, filePath: string): { 
  section: string, 
  bucket: string 
} {
  // Normalize the media type
  const normalizedType = mediaType.toLowerCase();
  
  // Check if path contains specific section indicators
  const lowerPath = filePath.toLowerCase();
  
  // Check for video files specifically
  const isVideo = (
    lowerPath.endsWith('.mp4') || 
    lowerPath.endsWith('.mov') || 
    lowerPath.endsWith('.webm') || 
    lowerPath.endsWith('.ogg') ||
    lowerPath.includes('video')
  );
  
  // Special handling for videos in banner slides
  if (isVideo && (normalizedType.includes('banner') || lowerPath.includes('/banner-slides/'))) {
    console.log(`[MediaUpload] Detected video for banner slides, using DEFAULT bucket`);
    return { section: VALID_SECTIONS.BANNER_SLIDES, bucket: BUCKETS.DEFAULT };
  }
  
  // Default mapping based on media type
  if (normalizedType.includes('avatar')) {
    return { section: VALID_SECTIONS.AVATARS, bucket: BUCKETS.DEFAULT };
  }
  
  if (normalizedType.includes('banner') || normalizedType.includes('slide')) {
    return { section: VALID_SECTIONS.BANNER_SLIDES, bucket: BUCKETS.DEFAULT };
  }
  
  if (normalizedType.includes('calendar') || normalizedType.includes('event')) {
    return { section: VALID_SECTIONS.CALENDAR, bucket: BUCKETS.CALENDAR };
  }
  
  if (normalizedType.includes('forum')) {
    return { section: VALID_SECTIONS.FORUM, bucket: BUCKETS.FORUM };
  }
  
  if (normalizedType.includes('vendor')) {
    return { section: VALID_SECTIONS.VENDORS, bucket: BUCKETS.VENDORS };
  }
  
  if (normalizedType.includes('real_estate') || normalizedType.includes('for_sale')) {
    return { section: VALID_SECTIONS.REAL_ESTATE, bucket: BUCKETS.SALE };
  }
  
  if (normalizedType.includes('community')) {
    return { section: VALID_SECTIONS.COMMUNITY, bucket: BUCKETS.COMMUNITY };
  }
  
  // Fallback to path-based detection
  if (lowerPath.includes('/avatars/')) {
    return { section: VALID_SECTIONS.AVATARS, bucket: BUCKETS.DEFAULT };
  }
  
  if (lowerPath.includes('/banner-slides/')) {
    return { section: VALID_SECTIONS.BANNER_SLIDES, bucket: BUCKETS.DEFAULT };
  }
  
  if (lowerPath.includes('/calendar/') || lowerPath.includes('/events/')) {
    return { section: VALID_SECTIONS.CALENDAR, bucket: BUCKETS.CALENDAR };
  }
  
  if (lowerPath.includes('/forum/')) {
    return { section: VALID_SECTIONS.FORUM, bucket: BUCKETS.FORUM };
  }
  
  if (lowerPath.includes('/vendors/')) {
    return { section: VALID_SECTIONS.VENDORS, bucket: BUCKETS.VENDORS };
  }
  
  if (lowerPath.includes('/real-estate/') || lowerPath.includes('/for-sale/')) {
    return { section: VALID_SECTIONS.REAL_ESTATE, bucket: BUCKETS.SALE };
  }
  
  if (lowerPath.includes('/community/')) {
    return { section: VALID_SECTIONS.COMMUNITY, bucket: BUCKETS.COMMUNITY };
  }
  
  // Special handling for any videos - place them in DEFAULT bucket with videos path
  if (isVideo) {
    console.log(`[MediaUpload] Detected generic video file, using DEFAULT bucket with videos section`);
    return { section: 'videos', bucket: BUCKETS.DEFAULT };
  }
  
  // Default fallback
  return { section: VALID_SECTIONS.DEFAULT, bucket: BUCKETS.DEFAULT };
}

/**
 * Configure multer storage with enhanced path handling
 */
const storage = multer.diskStorage({
  destination: function (req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    // Get media type from request or use default
    const mediaType = req.mediaType || req.query.mediaType || req.body.mediaType || MEDIA_TYPES.CALENDAR;
    
    // Store the media type on the request for later use
    req.mediaType = mediaType;
    
    // Create upload directory paths for both formats
    const uploadsDir = path.join(process.cwd(), 'uploads', mediaType);
    const prodDir = path.join(process.cwd(), mediaType);
    
    // Ensure directories exist
    ensureDirectoryExists(uploadsDir);
    ensureDirectoryExists(prodDir);
    
    console.log(`[MediaUpload] Using directory: ${uploadsDir} for type: ${mediaType}`);
    
    // Use the uploads directory as the initial destination
    cb(null, uploadsDir);
  },
  filename: function (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    // Generate a unique filename to prevent collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalExtension = path.extname(file.originalname);
    const safeFilename = file.fieldname + '-' + uniqueSuffix + originalExtension;
    
    // Store the generated filename for later access
    req.generatedFilename = safeFilename;
    
    cb(null, safeFilename);
  }
});

/**
 * Process uploaded files to handle both filesystem and object storage
 * @param req Request object with file and mediaType
 * @param file Uploaded file details
 * @returns Processing result with URL
 */
export async function processUploadedFile(req: any, file: Express.Multer.File): Promise<{
  success: boolean;
  message?: string;
  url?: string;
  developmentUrl?: string;
  objectStorageUrl?: string;
}> {
  try {
    if (!file) {
      return { success: false, message: 'No file provided' };
    }
    
    const mediaType = req.mediaType || MEDIA_TYPES.CALENDAR;
    console.log(`[MediaUpload] Processing uploaded file for media type: ${mediaType}`);
    
    // Detect section and bucket
    const { section, bucket } = detectSectionAndBucket(mediaType, file.path);
    console.log(`[MediaUpload] Detected section: ${section}, bucket: ${bucket}`);
    
    // File paths for different environments
    const developmentUrl = `/uploads/${mediaType}/${file.filename}`;
    const productionUrl = `/${mediaType}/${file.filename}`;
    let objectStorageUrl: string | undefined = undefined;
    let migrationRecordId: number | undefined = undefined;
    
    // Create migration record if enabled
    if (CREATE_MIGRATION_RECORDS && USE_OBJECT_STORAGE) {
      try {
        const sourceLocation = file.path;
        const storageKey = `${mediaType}/${file.filename}`;
        
        const migrationRecord = await migrationService.createMigrationRecord({
          sourceType: SOURCE_TYPE.FILESYSTEM,
          sourceLocation,
          mediaBucket: bucket,
          mediaType,
          storageKey,
          migrationStatus: MIGRATION_STATUS.PENDING
        });
        
        migrationRecordId = migrationRecord.id;
        console.log(`[MediaUpload] Created migration record: ${migrationRecordId}`);
      } catch (error) {
        console.error(`[MediaUpload] Error creating migration record:`, error);
        // Continue even if migration record creation fails
      }
    }
    
    // Step 1: Handle filesystem storage if enabled
    if (USE_FILESYSTEM) {
      // Copy file to production location
      const sourcePath = file.path;
      const targetPath = path.join(process.cwd(), productionUrl);
      
      // Ensure target directory exists
      ensureDirectoryExists(path.dirname(targetPath));
      
      try {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`[MediaUpload] Copied file from ${sourcePath} to ${targetPath}`);
      } catch (error) {
        console.error(`[MediaUpload] Error copying file to production path:`, error);
        // Continue even if copy fails - we'll rely on object storage
      }
    }
    
    // Step 2: Upload to object storage if enabled
    if (USE_OBJECT_STORAGE) {
      try {
        // Verify file exists before attempting upload
        if (!fs.existsSync(file.path)) {
          throw new Error(`File not found at path: ${file.path}`);
        }
        
        // Get file stats for logging
        const fileStats = fs.statSync(file.path);
        console.log(`[MediaUpload] File exists at ${file.path} (${fileStats.size} bytes)`);
        
        // Enhanced logging with more details
        console.log(`[MediaUpload] Uploading file to object storage:
          - Bucket: ${bucket}
          - Media Type: ${mediaType}
          - Filename: ${file.filename}
          - File Path: ${file.path}
          - File Size: ${fileStats.size} bytes
        `);
        
        // Determine the correct directory for each media type
        let objectStorageDirectory;
        
        // Special case for calendar/events
        if (mediaType === 'calendar' || mediaType === 'calendar-media') {
          objectStorageDirectory = 'events';
        } 
        // Special case for forum media
        else if (mediaType === 'forum' || mediaType === 'forum_post' || mediaType === 'forum_comment' || 
                mediaType === 'forum-media') {
          objectStorageDirectory = 'forum';
          console.log(`[MediaUpload] Using 'forum' directory for forum media in ${bucket} bucket`);
          
          // Create a direct buffer upload to handle forum media more reliably
          try {
            if (fs.existsSync(file.path)) {
              const fileContent = fs.readFileSync(file.path);
              const directObjectStorageUrl = await objectStorageService.uploadData(
                fileContent, 
                'forum',
                file.filename,
                mime.lookup(file.filename) || 'application/octet-stream',
                bucket
              );
              
              // If direct upload succeeded, use that URL
              if (directObjectStorageUrl && !directObjectStorageUrl.includes('default-forum-image')) {
                console.log(`[MediaUpload] Forum media direct buffer upload succeeded: ${directObjectStorageUrl}`);
                objectStorageUrl = directObjectStorageUrl;
                return; // Exit this block to continue with the rest of the function
              } else {
                console.warn(`[MediaUpload] Forum media direct buffer upload returned default image URL, falling back to regular upload`);
              }
            } else {
              console.error(`[MediaUpload] File doesn't exist for direct buffer upload: ${file.path}`);
            }
          } catch (directUploadError) {
            console.error(`[MediaUpload] Error during forum direct buffer upload: ${directUploadError.message}`);
            // Continue with normal upload as fallback
          }
        }
        // Default case
        else {
          objectStorageDirectory = mediaType;
        }
        
        console.log(`[MediaUpload] Using directory '${objectStorageDirectory}' in bucket '${bucket}'`);
        objectStorageUrl = await objectStorageService.uploadFile(file.path, objectStorageDirectory, file.filename, bucket);
        
        // Verify the URL is returned correctly
        if (!objectStorageUrl) {
          throw new Error('Object Storage URL was not returned after upload');
        }
        
        console.log(`[MediaUpload] File successfully uploaded to object storage: ${objectStorageUrl}`);
        
        // Verify the file exists in object storage (optional but helpful for debugging)
        try {
          // Use a dummy fetch to check if the URL is accessible
          console.log(`[MediaUpload] Verifying object storage URL is accessible: ${objectStorageUrl}`);
          // Verification could be added here if needed
        } catch (verifyError) {
          console.warn(`[MediaUpload] Verification warning: ${verifyError.message}`);
          // Don't throw error here, just log a warning
        }
        
        // Update migration record if created
        if (migrationRecordId) {
          await migrationService.updateMigrationStatus(
            migrationRecordId,
            MIGRATION_STATUS.MIGRATED
          );
          console.log(`[MediaUpload] Updated migration record ${migrationRecordId} status to MIGRATED`);
        }
      } catch (error) {
        console.error(`[MediaUpload] Error uploading to object storage:`, error);
        console.error(`[MediaUpload] Error details: ${error instanceof Error ? error.stack : 'No stack trace'}`);
        
        // Update migration record if created
        if (migrationRecordId) {
          await migrationService.updateMigrationStatus(
            migrationRecordId,
            MIGRATION_STATUS.FAILED,
            error instanceof Error ? error.message : 'Unknown error'
          );
          console.log(`[MediaUpload] Updated migration record ${migrationRecordId} status to FAILED`);
        }
        
        // Continue even if object storage upload fails - filesystem copy still exists
      }
    }
    
    // Always use Object Storage URL as the primary URL when available
    let primaryUrl;
    
    // If uploaded to Object Storage successfully, always use that URL
    if (objectStorageUrl) {
      primaryUrl = objectStorageUrl;
      console.log(`[MediaUpload] Using Object Storage URL as primary: ${primaryUrl}`);
    } else {
      // Fallback to filesystem URL only if Object Storage upload failed
      primaryUrl = productionUrl;
      console.log(`[MediaUpload] WARNING: Using filesystem URL as fallback: ${primaryUrl}`);
    }
    
    // Return the results
    return {
      success: true,
      url: primaryUrl, // Use the appropriate URL as primary
      developmentUrl,
      objectStorageUrl
    };
  } catch (error) {
    console.error(`[MediaUpload] Error processing uploaded file:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error processing file'
    };
  }
}

/**
 * Process multiple uploaded files
 * @param req Request object
 * @param files Array of uploaded files
 * @returns Processing results
 */
export async function processUploadedFiles(req: any, files: Express.Multer.File[]): Promise<{
  success: boolean;
  message?: string;
  urls?: string[];
  developmentUrls?: string[];
  objectStorageUrls?: string[];
}> {
  try {
    if (!files || files.length === 0) {
      return { success: false, message: 'No files provided' };
    }
    
    // Process all files in parallel
    const results = await Promise.all(files.map(file => processUploadedFile(req, file)));
    const allSuccessful = results.every(result => result.success);
    
    if (!allSuccessful) {
      // Find the first error message
      const errorMessage = results.find(r => !r.success)?.message || 'Some files failed to process';
      return { success: false, message: errorMessage };
    }
    
    // Extract URLs
    const urls = results.map(result => result.url).filter(Boolean) as string[];
    const developmentUrls = results.map(result => result.developmentUrl).filter(Boolean) as string[];
    const objectStorageUrls = results.map(result => result.objectStorageUrl).filter(Boolean) as string[];
    
    return {
      success: true,
      urls,
      developmentUrls,
      objectStorageUrls
    };
  } catch (error) {
    console.error(`[MediaUpload] Error processing multiple files:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error processing files'
    };
  }
}

/**
 * Create configurable multer middleware
 * @param options Multer options to override defaults
 * @returns Configured multer middleware
 */
export function createUploadMiddleware(options?: multer.Options) {
  const config: multer.Options = {
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB default limit
      ...options?.limits,
    },
    fileFilter: (req, file, cb) => {
      // Default allowed file types
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
        'text/csv'
      ];
      
      // Use provided filter or default
      if (options?.fileFilter) {
        return options.fileFilter(req, file, cb);
      }
      
      // Default filter
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        console.log(`[MediaUpload] Rejected file with mimetype: ${file.mimetype}`);
        cb(new Error('Invalid file type'));
      }
    }
  };
  
  return multer(config);
}

// Export a pre-configured middleware
export const upload = createUploadMiddleware();