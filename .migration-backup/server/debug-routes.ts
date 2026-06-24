/**
 * Debug routes for testing and diagnostics
 * These routes are only available in development
 */

import { Router, Request, Response } from 'express';
import { Client } from '@replit/object-storage';
import { objectStorageService, BUCKETS } from './object-storage-service';

const debugRouter = Router();

/**
 * List files in Object Storage for debugging
 */
debugRouter.get('/storage-list', async (req: Request, res: Response) => {
  try {
    console.log('[Debug] Getting Object Storage listing');
    
    const client = new Client();
    const results = {
      calendarEvents: [] as any[],
      eventsDir: [] as any[],
      calendarDir: [] as any[]
    };
    
    // List files in CALENDAR/events/
    try {
      const calendarEventsResult = await client.list({
        bucketName: BUCKETS.CALENDAR,
        prefix: 'CALENDAR/events/',
        maxKeys: 20
      });
      
      if (calendarEventsResult.ok) {
        results.calendarEvents = calendarEventsResult.value;
        console.log(`[Debug] Found ${calendarEventsResult.value.length} files in CALENDAR/events/`);
      } else {
        console.error('[Debug] Error listing CALENDAR/events/:', calendarEventsResult.error);
      }
    } catch (calendarError) {
      console.error('[Debug] Exception listing CALENDAR/events/:', calendarError);
    }
    
    // List files in events/
    try {
      const eventsResult = await client.list({
        bucketName: BUCKETS.CALENDAR,
        prefix: 'events/',
        maxKeys: 20
      });
      
      if (eventsResult.ok) {
        results.eventsDir = eventsResult.value;
        console.log(`[Debug] Found ${eventsResult.value.length} files in events/`);
      } else {
        console.error('[Debug] Error listing events/:', eventsResult.error);
      }
    } catch (eventsError) {
      console.error('[Debug] Exception listing events/:', eventsError);
    }
    
    // List files in calendar/
    try {
      const calendarResult = await client.list({
        bucketName: BUCKETS.CALENDAR,
        prefix: 'calendar/',
        maxKeys: 20
      });
      
      if (calendarResult.ok) {
        results.calendarDir = calendarResult.value;
        console.log(`[Debug] Found ${calendarResult.value.length} files in calendar/`);
      } else {
        console.error('[Debug] Error listing calendar/:', calendarResult.error);
      }
    } catch (calendarError) {
      console.error('[Debug] Exception listing calendar/:', calendarError);
    }
    
    return res.json({
      success: true,
      message: 'Object Storage listing retrieved',
      data: results
    });
  } catch (error) {
    console.error('[Debug] Error getting Object Storage listing:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get Object Storage listing',
      error: String(error)
    });
  }
});

export default debugRouter;