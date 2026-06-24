/**
 * Normalize Event Media URLs
 * 
 * Utility to find and normalize calendar event media URLs in the database
 * This helps ensure consistent URL format for all event media
 */

import { db } from "./db";
import { events } from "../shared/schema";
import { like, and, isNotNull, eq } from "drizzle-orm";
import { normalizeMediaUrl } from "../shared/url-normalizer";
import logger from "./logger";

/**
 * Normalize direct Object Storage URLs to proxy format
 */
export async function normalizeDirectObjectStorageUrls() {
  try {
    logger.info("[EventMediaNormalize] Finding events with direct Object Storage URLs");
    
    // Find events with direct Object Storage URLs
    const eventsWithDirectUrls = await db
      .select({
        id: events.id,
        title: events.title,
        mediaUrls: events.mediaUrls
      })
      .from(events)
      .where(
        and(
          isNotNull(events.mediaUrls),
          like(events.mediaUrls, '%object-storage.replit.app%')
        )
      );
    
    logger.info(`[EventMediaNormalize] Found ${eventsWithDirectUrls.length} events with direct Object Storage URLs`);
    
    let updatedCount = 0;
    
    // Update each event
    for (const event of eventsWithDirectUrls) {
      // Extract media URLs
      let mediaUrls: string[] = [];
      if (typeof event.mediaUrls === 'string') {
        try {
          mediaUrls = JSON.parse(event.mediaUrls);
        } catch {
          mediaUrls = [event.mediaUrls];
        }
      } else if (Array.isArray(event.mediaUrls)) {
        mediaUrls = event.mediaUrls;
      }
      
      // Skip if no media URLs
      if (!mediaUrls || mediaUrls.length === 0) {
        continue;
      }
      
      // Normalize each URL
      const updatedMediaUrls = mediaUrls.map(url => {
        // Skip null or already normalized URLs
        if (!url || url.startsWith('/api/storage-proxy/')) {
          return url;
        }
        
        // Use the normalizeMediaUrl function
        return normalizeMediaUrl(url, 'event');
      });
      
      // Only update if URLs have changed
      if (JSON.stringify(updatedMediaUrls) !== JSON.stringify(mediaUrls)) {
        await db
          .update(events)
          .set({ 
            mediaUrls: updatedMediaUrls,
            updatedAt: new Date()
          })
          .where(eq(events.id, event.id));
        
        updatedCount++;
      }
    }
    
    logger.info(`[EventMediaNormalize] Updated ${updatedCount} events with direct Object Storage URLs`);
    
    return {
      eventsFound: eventsWithDirectUrls.length,
      eventsUpdated: updatedCount
    };
  } catch (error) {
    logger.error('[EventMediaNormalize] Error normalizing direct Object Storage URLs:', error);
    return {
      eventsFound: 0,
      eventsUpdated: 0,
      error: error.message
    };
  }
}

/**
 * Normalize legacy filesystem URLs to proxy format
 */
export async function normalizeLegacyFilesystemUrls() {
  try {
    logger.info("[EventMediaNormalize] Finding events with legacy filesystem URLs");
    
    // Find events with legacy filesystem URLs
    const eventsWithLegacyUrls = await db
      .select({
        id: events.id,
        title: events.title,
        mediaUrls: events.mediaUrls
      })
      .from(events)
      .where(
        and(
          isNotNull(events.mediaUrls),
          or(
            like(events.mediaUrls, '%/uploads/%'),
            like(events.mediaUrls, '%/calendar/%'),
            like(events.mediaUrls, '%/events/%'),
            like(events.mediaUrls, '%/media/%')
          )
        )
      );
    
    logger.info(`[EventMediaNormalize] Found ${eventsWithLegacyUrls.length} events with legacy filesystem URLs`);
    
    let updatedCount = 0;
    
    // Update each event
    for (const event of eventsWithLegacyUrls) {
      // Extract media URLs
      let mediaUrls: string[] = [];
      if (typeof event.mediaUrls === 'string') {
        try {
          mediaUrls = JSON.parse(event.mediaUrls);
        } catch {
          mediaUrls = [event.mediaUrls];
        }
      } else if (Array.isArray(event.mediaUrls)) {
        mediaUrls = event.mediaUrls;
      }
      
      // Skip if no media URLs
      if (!mediaUrls || mediaUrls.length === 0) {
        continue;
      }
      
      // Normalize each URL
      const updatedMediaUrls = mediaUrls.map(url => {
        // Skip null or already normalized URLs
        if (!url || url.startsWith('/api/storage-proxy/')) {
          return url;
        }
        
        // Use the normalizeMediaUrl function
        return normalizeMediaUrl(url, 'event');
      });
      
      // Only update if URLs have changed
      if (JSON.stringify(updatedMediaUrls) !== JSON.stringify(mediaUrls)) {
        await db
          .update(events)
          .set({ 
            mediaUrls: updatedMediaUrls,
            updatedAt: new Date()
          })
          .where(eq(events.id, event.id));
        
        updatedCount++;
      }
    }
    
    logger.info(`[EventMediaNormalize] Updated ${updatedCount} events with legacy filesystem URLs`);
    
    return {
      eventsFound: eventsWithLegacyUrls.length,
      eventsUpdated: updatedCount
    };
  } catch (error) {
    logger.error('[EventMediaNormalize] Error normalizing legacy filesystem URLs:', error);
    return {
      eventsFound: 0,
      eventsUpdated: 0,
      error: error.message
    };
  }
}

/**
 * Normalize all event media URLs to standardized format
 */
export async function normalizeAllEventMediaUrls() {
  try {
    logger.info("[EventMediaNormalize] Finding all events with media URLs");
    
    // Find all events with media URLs
    const eventsWithMedia = await db
      .select({
        id: events.id,
        title: events.title,
        mediaUrls: events.mediaUrls
      })
      .from(events)
      .where(isNotNull(events.mediaUrls));
    
    logger.info(`[EventMediaNormalize] Found ${eventsWithMedia.length} events with media URLs`);
    
    let updatedCount = 0;
    let unchangedCount = 0;
    
    // Update each event
    for (const event of eventsWithMedia) {
      // Extract media URLs
      let mediaUrls: string[] = [];
      if (typeof event.mediaUrls === 'string') {
        try {
          mediaUrls = JSON.parse(event.mediaUrls);
        } catch {
          mediaUrls = [event.mediaUrls];
        }
      } else if (Array.isArray(event.mediaUrls)) {
        mediaUrls = event.mediaUrls;
      }
      
      // Skip if no media URLs
      if (!mediaUrls || mediaUrls.length === 0) {
        continue;
      }
      
      // Normalize each URL
      const updatedMediaUrls = mediaUrls.map(url => {
        // Skip null URLs
        if (!url) {
          return url;
        }
        
        // Use the normalizeMediaUrl function
        return normalizeMediaUrl(url, 'event');
      });
      
      // Only update if URLs have changed
      if (JSON.stringify(updatedMediaUrls) !== JSON.stringify(mediaUrls)) {
        await db
          .update(events)
          .set({ 
            mediaUrls: updatedMediaUrls,
            updatedAt: new Date()
          })
          .where(eq(events.id, event.id));
        
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
    
    logger.info(`[EventMediaNormalize] Updated ${updatedCount} events, ${unchangedCount} unchanged`);
    
    return {
      eventsFound: eventsWithMedia.length,
      eventsUpdated: updatedCount,
      eventsUnchanged: unchangedCount
    };
  } catch (error) {
    logger.error('[EventMediaNormalize] Error normalizing all event media URLs:', error);
    return {
      eventsFound: 0,
      eventsUpdated: 0,
      eventsUnchanged: 0,
      error: error.message
    };
  }
}

/**
 * Run all normalization routines in sequence
 */
export async function runAllNormalizations() {
  const directUrlResults = await normalizeDirectObjectStorageUrls();
  const legacyUrlResults = await normalizeLegacyFilesystemUrls();
  const allUrlResults = await normalizeAllEventMediaUrls();
  
  return {
    directUrlsUpdated: directUrlResults.eventsUpdated,
    legacyUrlsUpdated: legacyUrlResults.eventsUpdated,
    allUrlsUpdated: allUrlResults.eventsUpdated,
    unchanged: allUrlResults.eventsUnchanged,
    total: allUrlResults.eventsFound
  };
}

// Make sure to import 'or' function that was missing in the imports
function or(...conditions: any[]) {
  return { type: 'or', conditions };
}