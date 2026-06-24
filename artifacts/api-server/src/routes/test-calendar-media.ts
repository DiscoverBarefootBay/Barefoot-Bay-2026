/**
 * Test routes for calendar media
 * These endpoints help to debug calendar media issues
 */

import { Router, Request, Response } from 'express';
import { objectStorageService } from '../object-storage-service';
import fetch from 'node-fetch';

const router = Router();

// Test endpoint to check if we can access calendar media 
router.get('/test-calendar-media-access', async (req: Request, res: Response) => {
  try {
    const bucket = 'CALENDAR';
    const mediaUrl = req.query.url as string || '/api/storage-proxy/CALENDAR/events/default-event-image.svg';
    
    console.log(`[TestCalendarMedia] Testing access to ${mediaUrl}`);
    
    // Extract the filename from the URL
    const urlParts = mediaUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Try multiple possible paths
    const paths = [
      `CALENDAR/events/${filename}`,
      `events/${filename}`,
      `${filename}`
    ];
    
    const results = [];
    
    // Test direct access to Object Storage
    for (const path of paths) {
      try {
        const objectStorageUrl = `https://object-storage.replit.app/${bucket}/${path}`;
        console.log(`[TestCalendarMedia] Testing path: ${objectStorageUrl}`);
        
        const response = await fetch(objectStorageUrl, { method: 'HEAD' });
        results.push({
          path,
          exists: response.ok,
          status: response.status,
          statusText: response.statusText
        });
      } catch (error) {
        results.push({
          path,
          exists: false,
          error: error.message
        });
      }
    }
    
    // Additional test with storage proxy
    try {
      const proxyUrl = mediaUrl;
      const proxyResponse = await fetch(proxyUrl, { method: 'HEAD' });
      results.push({
        path: `Storage Proxy: ${proxyUrl}`,
        exists: proxyResponse.ok,
        status: proxyResponse.status,
        statusText: proxyResponse.statusText
      });
    } catch (proxyError) {
      results.push({
        path: `Storage Proxy: ${mediaUrl}`,
        exists: false,
        error: proxyError.message
      });
    }
    
    // Return the test results
    return res.json({
      mediaUrl,
      filename,
      results,
      paths
    });
  } catch (error) {
    console.error('[TestCalendarMedia] Error testing calendar media access:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Test endpoint to list all files in the events directory
router.get('/list-event-media', async (req: Request, res: Response) => {
  try {
    const paths = [
      'events/',
      'CALENDAR/events/'
    ];
    
    const results = {};
    
    for (const path of paths) {
      try {
        console.log(`[TestCalendarMedia] Listing files in ${path}`);
        const files = await objectStorageService.listFiles(path);
        results[path] = files;
      } catch (error) {
        results[path] = { error: error.message };
      }
    }
    
    return res.json(results);
  } catch (error) {
    console.error('[TestCalendarMedia] Error listing event media:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;