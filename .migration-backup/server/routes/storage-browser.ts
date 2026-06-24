/**
 * Object Storage Browser API endpoint
 * 
 * This endpoint provides information about objects in Replit Object Storage
 * for diagnostic purposes related to the banner slide media migration.
 */

import { Router } from 'express';
import { Client } from '@replit/object-storage';
import { requireAuth, requireAdmin } from '../auth';

const router = Router();
const objectStore = new Client();

/**
 * GET /api/storage-browser
 * 
 * Returns a list of buckets and objects in Replit Object Storage.
 * Requires admin authentication for security.
 */
router.get('/storage-browser', requireAuth, requireAdmin, async (req, res) => {
  try {
    // List all buckets
    const buckets = await objectStore.listBuckets();
    
    // Get objects from each bucket
    const allObjects = [];
    
    for (const bucket of buckets) {
      try {
        const objects = await objectStore.listObjects({ bucket });
        
        // Get details for each object
        for (const obj of objects) {
          try {
            const metadata = await objectStore.headObject({
              bucket,
              key: obj.key
            });
            
            allObjects.push({
              bucket,
              key: obj.key,
              lastModified: obj.lastModified,
              size: obj.size,
              etag: obj.etag,
              contentType: metadata.contentType,
              metadata: metadata.metadata
            });
          } catch (error) {
            console.error(`Error getting metadata for ${bucket}/${obj.key}:`, error);
            allObjects.push({
              bucket,
              key: obj.key,
              lastModified: obj.lastModified,
              size: obj.size,
              etag: obj.etag,
              error: 'Error getting metadata'
            });
          }
        }
      } catch (error) {
        console.error(`Error listing objects in bucket ${bucket}:`, error);
      }
    }
    
    // Sort by most recently modified
    allObjects.sort((a, b) => {
      const dateA = new Date(a.lastModified);
      const dateB = new Date(b.lastModified);
      return dateB.getTime() - dateA.getTime();
    });
    
    res.json({
      buckets,
      objects: allObjects
    });
  } catch (error) {
    console.error('Error browsing Object Storage:', error);
    res.status(500).json({ error: 'Error browsing Object Storage' });
  }
});

export default router;