/**
 * Calendar Media Migration Script
 * 
 * This script migrates all calendar event media from the filesystem to Replit Object Storage.
 * It performs the following steps:
 * 1. Finds all events in the database that have media URLs
 * 2. Detects URLs that use the filesystem pattern (/uploads/ or direct path)
 * 3. Uploads files to Object Storage
 * 4. Updates database records with new Object Storage proxy URLs
 * 5. Validates the migration
 */

import { db } from "./db";
import { events } from "@shared/schema";
import { eq, like, or, and, not, isNotNull } from "drizzle-orm";
import { objectStorageService } from "./object-storage-service";
import path from "path";
import fs from "fs";
import logger from "./logger";
import { MEDIA_TYPES } from "./media-path-utils";

// Constants
const CALENDAR_BUCKET = 'CALENDAR';
const CALENDAR_MEDIA_PATH = 'events';
const OBJECT_STORAGE_PREFIX = `https://object-storage.replit.app/${CALENDAR_BUCKET}/${CALENDAR_MEDIA_PATH}/`;
const STORAGE_PROXY_PREFIX = `/api/storage-proxy/${CALENDAR_BUCKET}/${CALENDAR_MEDIA_PATH}/`;
const DEFAULT_IMAGE_PATH = '/public/default-event-image.svg';

/**
 * Normalize a media URL to a standard format
 * Converts various URL formats to a consistent path structure
 */
function normalizeMediaUrl(url: string): string {
  if (!url) return '';
  
  // Already a storage proxy URL
  if (url.startsWith(STORAGE_PROXY_PREFIX)) {
    return url;
  }
  
  // Direct Object Storage URL
  if (url.startsWith(OBJECT_STORAGE_PREFIX)) {
    const filename = url.substring(OBJECT_STORAGE_PREFIX.length);
    return `${STORAGE_PROXY_PREFIX}${filename}`;
  }
  
  // Handle filesystem URLs (/uploads/calendar/file.jpg or /calendar/file.jpg)
  let filename = '';
  if (url.startsWith('/uploads/calendar/')) {
    filename = url.substring('/uploads/calendar/'.length);
  } else if (url.startsWith('/calendar/')) {
    filename = url.substring('/calendar/'.length);
  } else {
    // Unknown format, return as is with a warning
    logger.warn(`[CalendarMediaMigration] Unknown URL format: ${url}`);
    return url;
  }
  
  return `${STORAGE_PROXY_PREFIX}${filename}`;
}

/**
 * Get the filesystem path for a given URL
 */
function getFilesystemPath(url: string): string {
  try {
    let relativePath = '';
    if (url.startsWith('/uploads/calendar/')) {
      relativePath = url;
    } else if (url.startsWith('/calendar/')) {
      relativePath = '/uploads' + url;
    } else {
      logger.warn(`[CalendarMediaMigration] Cannot determine filesystem path for: ${url}`);
      return null;
    }
    
    // Convert to absolute path
    return path.join(process.cwd(), relativePath);
  } catch (error) {
    logger.error(`[CalendarMediaMigration] Error getting filesystem path for ${url}:`, error);
    return null;
  }
}

/**
 * Upload a file to Object Storage
 */
async function uploadFileToObjectStorage(
  filePath: string,
  filename: string
): Promise<string | null> {
  try {
    if (!fs.existsSync(filePath)) {
      logger.error(`[CalendarMediaMigration] File not found: ${filePath}`);
      return null;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = getMimeType(filename);
    
    logger.info(`[CalendarMediaMigration] Uploading ${filename} (${mimeType}, ${fileBuffer.length} bytes)`);
    
    const result = await objectStorageService.upload({
      bucket: CALENDAR_BUCKET,
      key: `${CALENDAR_MEDIA_PATH}/${filename}`,
      file: fileBuffer,
      contentType: mimeType
    });
    
    if (result.success) {
      // Use storage proxy format instead of direct URL
      return `${STORAGE_PROXY_PREFIX}${filename}`;
    } else {
      logger.error(`[CalendarMediaMigration] Upload failed for ${filename}:`, result.error);
      return null;
    }
  } catch (error) {
    logger.error(`[CalendarMediaMigration] Error uploading file ${filename}:`, error);
    return null;
  }
}

/**
 * Determine MIME type based on file extension
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Update an event's media URLs in the database
 */
async function updateEventMediaUrls(
  eventId: number, 
  oldUrl: string, 
  newUrl: string
): Promise<boolean> {
  try {
    // Get current event data
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));
    
    if (!event) {
      logger.error(`[CalendarMediaMigration] Event ${eventId} not found`);
      return false;
    }
    
    // Handle case where mediaUrls is a string, array, or null
    let mediaUrls: string[] = [];
    if (typeof event.mediaUrls === 'string') {
      try {
        mediaUrls = JSON.parse(event.mediaUrls);
      } catch (e) {
        mediaUrls = [event.mediaUrls];
      }
    } else if (Array.isArray(event.mediaUrls)) {
      mediaUrls = event.mediaUrls;
    }
    
    // Replace the old URL with the new one
    const updatedMediaUrls = mediaUrls.map(url => url === oldUrl ? newUrl : url);
    
    // Update the database
    await db
      .update(events)
      .set({ 
        mediaUrls: JSON.stringify(updatedMediaUrls),
        updatedAt: new Date()
      })
      .where(eq(events.id, eventId));
    
    logger.info(`[CalendarMediaMigration] Updated event ${eventId} media URLs`);
    return true;
  } catch (error) {
    logger.error(`[CalendarMediaMigration] Error updating event ${eventId}:`, error);
    return false;
  }
}

/**
 * Find events with filesystem media URLs
 */
async function findEventsWithFilesystemMedia(): Promise<any[]> {
  try {
    // Find events with mediaUrls that contain filesystem paths
    const eventsWithMedia = await db
      .select()
      .from(events)
      .where(
        and(
          isNotNull(events.mediaUrls),
          or(
            like(events.mediaUrls, '%/uploads/calendar/%'),
            like(events.mediaUrls, '%/calendar/%')
          )
        )
      );
    
    logger.info(`[CalendarMediaMigration] Found ${eventsWithMedia.length} events with filesystem media`);
    return eventsWithMedia;
  } catch (error) {
    logger.error(`[CalendarMediaMigration] Error finding events with filesystem media:`, error);
    return [];
  }
}

/**
 * Find events with direct Object Storage URLs that need to be converted to proxy URLs
 */
async function findEventsWithDirectObjectStorageUrls(): Promise<any[]> {
  try {
    // Find events with mediaUrls that contain direct Object Storage URLs
    const eventsWithDirectUrls = await db
      .select()
      .from(events)
      .where(
        and(
          isNotNull(events.mediaUrls),
          like(events.mediaUrls, '%object-storage.replit.app%')
        )
      );
    
    logger.info(`[CalendarMediaMigration] Found ${eventsWithDirectUrls.length} events with direct Object Storage URLs`);
    return eventsWithDirectUrls;
  } catch (error) {
    logger.error(`[CalendarMediaMigration] Error finding events with direct Object Storage URLs:`, error);
    return [];
  }
}

/**
 * Process an event to migrate its media to Object Storage
 */
async function processEvent(event: any): Promise<void> {
  try {
    // Extract media URLs
    let mediaUrls: string[] = [];
    if (typeof event.mediaUrls === 'string') {
      try {
        mediaUrls = JSON.parse(event.mediaUrls);
      } catch (e) {
        mediaUrls = [event.mediaUrls];
      }
    } else if (Array.isArray(event.mediaUrls)) {
      mediaUrls = event.mediaUrls;
    }
    
    if (mediaUrls.length === 0) {
      logger.info(`[CalendarMediaMigration] Event ${event.id} has no media URLs to process`);
      return;
    }
    
    // Process each media URL
    for (const url of mediaUrls) {
      // Skip if already using storage proxy format
      if (url.startsWith(STORAGE_PROXY_PREFIX)) {
        continue;
      }
      
      // For direct Object Storage URLs, just update the format
      if (url.startsWith(OBJECT_STORAGE_PREFIX)) {
        const newUrl = normalizeMediaUrl(url);
        await updateEventMediaUrls(event.id, url, newUrl);
        continue;
      }
      
      // Handle filesystem URLs
      const filePath = getFilesystemPath(url);
      if (!filePath) {
        logger.warn(`[CalendarMediaMigration] Could not determine path for URL: ${url}`);
        continue;
      }
      
      const filename = path.basename(filePath);
      
      // Upload the file to Object Storage
      const newUrl = await uploadFileToObjectStorage(filePath, filename);
      if (newUrl) {
        // Update the database with the new URL
        await updateEventMediaUrls(event.id, url, newUrl);
      }
    }
  } catch (error) {
    logger.error(`[CalendarMediaMigration] Error processing event ${event.id}:`, error);
  }
}

/**
 * Convert all direct Object Storage URLs to proxy URLs
 */
async function convertDirectUrlsToProxyUrls(): Promise<void> {
  try {
    const eventsWithDirectUrls = await findEventsWithDirectObjectStorageUrls();
    logger.info(`[CalendarMediaMigration] Converting ${eventsWithDirectUrls.length} events with direct Object Storage URLs`);
    
    for (const event of eventsWithDirectUrls) {
      await processEvent(event);
    }
    
    logger.info(`[CalendarMediaMigration] Completed converting direct URLs to proxy URLs`);
  } catch (error) {
    logger.error(`[CalendarMediaMigration] Error converting direct URLs to proxy URLs:`, error);
  }
}

/**
 * Migrate all filesystem media to Object Storage
 */
async function migrateFilesystemMediaToObjectStorage(): Promise<void> {
  try {
    const eventsWithFilesystemMedia = await findEventsWithFilesystemMedia();
    logger.info(`[CalendarMediaMigration] Migrating ${eventsWithFilesystemMedia.length} events with filesystem media`);
    
    for (const event of eventsWithFilesystemMedia) {
      await processEvent(event);
    }
    
    logger.info(`[CalendarMediaMigration] Completed migrating filesystem media to Object Storage`);
  } catch (error) {
    logger.error(`[CalendarMediaMigration] Error migrating filesystem media to Object Storage:`, error);
  }
}

/**
 * Main migration function
 */
export async function migrateCalendarMedia(): Promise<void> {
  logger.info('[CalendarMediaMigration] Starting calendar media migration');
  
  // Step 1: Convert direct Object Storage URLs to proxy URLs
  await convertDirectUrlsToProxyUrls();
  
  // Step 2: Migrate filesystem media to Object Storage
  await migrateFilesystemMediaToObjectStorage();
  
  logger.info('[CalendarMediaMigration] Calendar media migration completed');
}

// Export for use in API endpoints
export default {
  migrateCalendarMedia,
  normalizeMediaUrl,
  findEventsWithFilesystemMedia,
  findEventsWithDirectObjectStorageUrls
};