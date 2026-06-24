/**
 * Calendar Media Diagnostics
 * 
 * Endpoints for diagnosing and fixing event media access issues
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from './db';
import { events } from '../shared/schema';
import { isNotNull, eq } from 'drizzle-orm';
import { objectStorageService, BUCKETS } from './object-storage-service';
import { normalizeMediaUrl } from '../shared/url-normalizer';

const router = Router();

// Configure multer for handling file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Use the imported objectStorageService
const objectStorage = objectStorageService;

/**
 * Test endpoint for uploading a media file directly to Object Storage
 * to diagnose calendar event media issues
 */
router.post('/test-event-media', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    console.log(`[EventMediaTest] Starting test upload process for file:
      - Original name: ${req.file.originalname}
      - Path: ${req.file.path}
      - Size: ${req.file.size} bytes
      - MIME type: ${req.file.mimetype}
    `);

    // Generate a unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const originalExt = path.extname(req.file.originalname);
    const filename = `test_event_${timestamp}_${randomString}${originalExt}`;

    // Upload to Object Storage using the standardized path
    const objectStorageUrl = await objectStorage.uploadFile(req.file.path, 'events', filename);
    console.log(`[EventMediaTest] Uploaded to Object Storage: ${objectStorageUrl}`);

    // Create proxy URL format
    // In our specific case, we're using /api/storage-proxy/CALENDAR/events/filename.ext format
    const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
    console.log(`[EventMediaTest] Proxy URL: ${proxyUrl}`);

    // Create normalized URL using our normalizer utility
    const normalizedUrl = normalizeMediaUrl(objectStorageUrl, 'event');
    console.log(`[EventMediaTest] Normalized URL: ${normalizedUrl}`);

    // Clean up temp file
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.warn(`[EventMediaTest] Failed to clean up temp file: ${unlinkError}`);
    }

    // Create additional diagnostic info
    const diagnostics = {
      isObjectStorageUrl: objectStorageUrl.includes('object-storage.replit.app'),
      isProxyFormat: proxyUrl.startsWith('/api/storage-proxy/'),
      shouldNormalizeToProxy: normalizedUrl === proxyUrl,
      pathComponents: {
        bucket: 'CALENDAR',
        directory: 'events',
        filename: filename
      }
    };

    // Return the result with all URL formats for testing
    return res.status(200).json({
      success: true,
      originalFilename: req.file.originalname,
      filename: filename,
      objectStorageUrl: objectStorageUrl,
      proxyUrl: proxyUrl,
      normalizedUrl: normalizedUrl,
      diagnostics: diagnostics
    });
  } catch (error) {
    console.error('[EventMediaTest] Error during test upload:', error);
    return res.status(500).json({
      message: 'Error uploading and processing file',
      error: error.message
    });
  }
});

/**
 * Check event media URLs in the database to see if they're using the correct format
 */
router.get('/check-event-media-urls', async (req: Request, res: Response) => {
  try {
    console.log('[EventMediaCheck] Checking event media URLs in database');
    
    // Get all events from the database directly
    const allEvents = await db.select().from(events).where(isNotNull(events.mediaUrls));
    console.log(`[EventMediaCheck] Retrieved ${allEvents.length} events`);
    
    // Initialize counters
    const stats = {
      totalEventsChecked: allEvents.length,
      eventsWithMedia: 0,
      noMediaCount: 0,
      proxyFormatCount: 0,
      directObjectStorageCount: 0,
      localUploadsCount: 0,
      otherFormatCount: 0,
      sampleUrls: []
    };
    
    // Check each event's media URLs
    for (const event of allEvents) {
      const mediaUrls = event.mediaUrls;
      
      if (!mediaUrls || mediaUrls.length === 0) {
        stats.noMediaCount++;
        continue;
      }
      
      stats.eventsWithMedia++;
      
      // Check the format of each URL
      for (const url of mediaUrls) {
        if (!url) continue;
        
        // Keep track of sample URLs (max 20)
        if (stats.sampleUrls.length < 20) {
          stats.sampleUrls.push(url);
        }
        
        if (url.startsWith('/api/storage-proxy/')) {
          stats.proxyFormatCount++;
        } else if (url.includes('object-storage.replit.app')) {
          stats.directObjectStorageCount++;
        } else if (url.startsWith('/uploads/')) {
          stats.localUploadsCount++;
        } else {
          stats.otherFormatCount++;
        }
      }
    }
    
    return res.status(200).json(stats);
  } catch (error) {
    console.error('[EventMediaCheck] Error checking event media URLs:', error);
    return res.status(500).json({
      message: 'Error checking event media URLs',
      error: error.message
    });
  }
});

/**
 * Fix all event media URLs to use the proxy format
 */
router.post('/fix-event-media-urls', async (req: Request, res: Response) => {
  try {
    console.log('[EventMediaFix] Starting to fix all event media URLs');
    
    // Get all events with media URLs directly from the database
    const allEvents = await db.select().from(events).where(isNotNull(events.mediaUrls));
    console.log(`[EventMediaFix] Retrieved ${allEvents.length} events to process`);
    
    // Initialize counters
    const stats = {
      eventsChecked: allEvents.length,
      eventsWithMedia: 0,
      eventsUpdated: 0,
      urlsNormalized: 0,
      urlsPreNormalized: 0,
      errors: 0,
      eventsWithErrors: [] as number[],
      normalizations: [] as {
        eventId: number;
        before: string[];
        after: string[];
      }[]
    };
    
    // Process each event
    for (const event of allEvents) {
      try {
        const mediaUrls = event.mediaUrls;
        
        if (!mediaUrls || mediaUrls.length === 0) {
          continue;
        }
        
        stats.eventsWithMedia++;
        
        // Normalize each URL
        const normalizedUrls = mediaUrls.map(url => {
          if (!url) return '';
          
          // Check if already in proxy format
          if (url.startsWith('/api/storage-proxy/')) {
            return url;
          }
          
          // Normalize the URL
          return normalizeMediaUrl(url, 'event');
        });
        
        // Check if any URLs were actually changed
        let wasUpdated = false;
        let normalizedCount = 0;
        
        for (let i = 0; i < mediaUrls.length; i++) {
          if (mediaUrls[i] !== normalizedUrls[i]) {
            wasUpdated = true;
            normalizedCount++;
            stats.urlsNormalized++;
          } else if (mediaUrls[i].startsWith('/api/storage-proxy/')) {
            stats.urlsPreNormalized++;
          }
        }
        
        // Only update events where URLs actually changed
        if (wasUpdated) {
          // Log the before/after for this event
          stats.normalizations.push({
            eventId: event.id,
            before: [...mediaUrls],
            after: [...normalizedUrls]
          });
          
          // Update the event directly in the database
          await db.update(events)
            .set({ 
              mediaUrls: normalizedUrls,
              updatedAt: new Date()
            })
            .where(eq(events.id, event.id));
          
          stats.eventsUpdated++;
          console.log(`[EventMediaFix] Updated event ${event.id} with ${normalizedCount} normalized URLs`);
        }
      } catch (eventError) {
        console.error(`[EventMediaFix] Error processing event ${event.id}:`, eventError);
        stats.errors++;
        stats.eventsWithErrors.push(event.id);
      }
    }
    
    return res.status(200).json({
      message: 'URL fix process completed',
      ...stats
    });
  } catch (error) {
    console.error('[EventMediaFix] Error fixing event media URLs:', error);
    return res.status(500).json({
      message: 'Error fixing event media URLs',
      error: error.message
    });
  }
});

/**
 * Upload default event image to all necessary locations in Object Storage
 */
router.post('/upload-default-event-image', async (req: Request, res: Response) => {
  try {
    // SVG data for default event image
    const defaultEventImageSVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="400" height="300" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#E5E7EB"/>
  <path d="M200 150C179.033 150 162 167.033 162 188C162 208.967 179.033 226 200 226C220.967 226 238 208.967 238 188C238 167.033 220.967 150 200 150ZM200 214C185.663 214 174 202.337 174 188C174 173.663 185.663 162 200 162C214.337 162 226 173.663 226 188C226 202.337 214.337 214 200 214Z" fill="#9CA3AF"/>
  <path d="M200 138C206.627 138 212 132.627 212 126C212 119.373 206.627 114 200 114C193.373 114 188 119.373 188 126C188 132.627 193.373 138 200 138Z" fill="#9CA3AF"/>
  <path d="M244 126C250.627 126 256 120.627 256 114C256 107.373 250.627 102 244 102C237.373 102 232 107.373 232 114C232 120.627 237.373 126 244 126Z" fill="#9CA3AF"/>
  <path d="M156 126C162.627 126 168 120.627 168 114C168 107.373 162.627 102 156 102C149.373 102 144 107.373 144 114C144 120.627 149.373 126 156 126Z" fill="#9CA3AF"/>
  <path d="M244 174C250.627 174 256 168.627 256 162C256 155.373 250.627 150 244 150C237.373 150 232 155.373 232 162C232 168.627 237.373 174 244 174Z" fill="#9CA3AF"/>
  <path d="M156 174C162.627 174 168 168.627 168 162C168 155.373 162.627 150 156 150C149.373 150 144 155.373 144 162C144 168.627 149.373 174 156 174Z" fill="#9CA3AF"/>
  <text x="200" y="260" font-family="Arial" font-size="16" fill="#4B5563" text-anchor="middle">Event Image Not Available</text>
</svg>`;
    
    // Save to a temporary file
    const tempFilePath = path.join(process.cwd(), 'temp-default-event.svg');
    fs.writeFileSync(tempFilePath, defaultEventImageSVG);
    
    // Locations to upload the default image to
    const targetLocations = [
      { bucket: BUCKETS.CALENDAR, path: 'events/default-event-image.svg' },
      { bucket: BUCKETS.DEFAULT, path: 'events/default-event-image.svg' },
      { bucket: BUCKETS.CALENDAR, path: 'default-event-image.svg' }
    ];
    
    const results = [];
    
    // Upload to each location
    for (const target of targetLocations) {
      try {
        console.log(`[DefaultEventImage] Uploading to ${target.bucket}/${target.path}`);
        
        // Use the uploadFile method which wraps the client properly
        const objectStorageUrl = await objectStorage.uploadFile(
          tempFilePath, 
          target.path, 
          path.basename(target.path)
        );
        
        // Add result to the results array
        results.push({
          bucket: target.bucket,
          path: target.path,
          success: true,
          url: objectStorageUrl
        });
      } catch (uploadError) {
        results.push({
          bucket: target.bucket,
          path: target.path,
          success: false,
          error: uploadError.message
        });
      }
    }
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    
    // Also save to public directory
    const publicPath = path.join(process.cwd(), 'public', 'default-event-image.svg');
    fs.writeFileSync(publicPath, defaultEventImageSVG);
    
    // Generate the proxy URL for the default image
    const defaultImageUrl = '/api/storage-proxy/CALENDAR/events/default-event-image.svg';
    
    return res.status(200).json({
      success: true,
      message: 'Default event image uploaded to all locations',
      defaultImageUrl,
      locations: results
    });
  } catch (error) {
    console.error('[DefaultEventImage] Error uploading default image:', error);
    return res.status(500).json({
      message: 'Error uploading default event image',
      error: error.message
    });
  }
});

/**
 * Test endpoint for full event creation with media
 * This simpler version bypasses auth to help isolate media handling issues
 */
router.post('/test-create-event', upload.single('media'), async (req: Request, res: Response) => {
  console.log('[TestCreateEvent] Request received:', {
    hasEventData: !!req.body.eventData,
    hasMedia: !!req.file,
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body)
  });

  try {
    let eventData;
    // Parse the event data from the request
    try {
      eventData = JSON.parse(req.body.eventData);
      console.log('[TestCreateEvent] Parsed event data:', eventData);
    } catch (parseError) {
      console.error('[TestCreateEvent] Error parsing event data:', parseError);
      return res.status(400).json({
        message: 'Invalid event data format. Expected valid JSON string in eventData field.',
        error: parseError.message
      });
    }

    // Verify required fields
    const requiredFields = ['title', 'description', 'startDate', 'endDate', 'location', 'category'];
    const missingFields = requiredFields.filter(field => !eventData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        missingFields
      });
    }

    // Initialize mediaUrls array to store the uploaded media URL(s)
    let mediaUrls = [];

    // Handle the media file upload
    if (req.file) {
      console.log(`[TestCreateEvent] Processing uploaded media:
        - Original name: ${req.file.originalname}
        - Path: ${req.file.path}
        - Size: ${req.file.size} bytes
        - MIME type: ${req.file.mimetype}
      `);

      // Generate a unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const originalExt = path.extname(req.file.originalname);
      const filename = `event_${timestamp}_${randomString}${originalExt}`;

      // Upload to Object Storage using the standardized path
      try {
        const objectStorageUrl = await objectStorage.uploadFile(req.file.path, 'events', filename);
        console.log(`[TestCreateEvent] Uploaded to Object Storage: ${objectStorageUrl}`);

        // Create the proper proxy URL format
        const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
        console.log(`[TestCreateEvent] Proxy URL: ${proxyUrl}`);

        // Add to mediaUrls array
        mediaUrls.push(proxyUrl);

        // Clean up temp file
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.warn(`[TestCreateEvent] Failed to clean up temp file: ${unlinkError}`);
        }
      } catch (uploadError) {
        console.error('[TestCreateEvent] Error uploading media:', uploadError);
        return res.status(500).json({
          message: 'Error uploading media file',
          error: uploadError.message
        });
      }
    }

    // Create a new event in the database
    try {
      const newEvent = await db.insert(events).values({
        ...eventData,
        mediaUrls,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      console.log(`[TestCreateEvent] Created new event with ID ${newEvent[0].id}`);

      // Return the created event with media URLs
      return res.status(201).json({
        success: true,
        id: newEvent[0].id,
        mediaUrls,
        event: newEvent[0]
      });
    } catch (dbError) {
      console.error('[TestCreateEvent] Database error creating event:', dbError);
      return res.status(500).json({
        message: 'Error creating event in database',
        error: dbError.message
      });
    }
  } catch (error) {
    console.error('[TestCreateEvent] Unexpected error:', error);
    return res.status(500).json({
      message: 'Unexpected error processing request',
      error: error.message
    });
  }
});

/**
 * Test endpoint used by test-event-api.html for event creation with media
 * This is the endpoint our test interface is trying to access
 */
router.post('/test-event', upload.single('media'), async (req: Request, res: Response) => {
  console.log('[TestEvent] Request received:', {
    hasEventData: !!req.body.eventData,
    hasMedia: !!req.file,
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body)
  });

  try {
    let eventData;
    // Parse the event data from the request
    try {
      eventData = JSON.parse(req.body.eventData);
      console.log('[TestEvent] Parsed event data:', eventData);
    } catch (parseError: any) {
      console.error('[TestEvent] Error parsing event data:', parseError);
      return res.status(400).json({
        message: 'Invalid event data format. Expected valid JSON string in eventData field.',
        error: parseError.message
      });
    }

    // Verify required fields
    const requiredFields = ['title', 'description', 'startDate', 'endDate', 'location', 'category'];
    const missingFields = requiredFields.filter(field => !eventData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        missingFields
      });
    }

    // Initialize mediaUrls array to store the uploaded media URL(s)
    let mediaUrls: string[] = [];

    // Handle the media file upload
    if (req.file) {
      console.log(`[TestEvent] Processing uploaded media:
        - Original name: ${req.file.originalname}
        - Path: ${req.file.path}
        - Size: ${req.file.size} bytes
        - MIME type: ${req.file.mimetype}
      `);

      // Generate a unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const originalExt = path.extname(req.file.originalname);
      const filename = `media-${timestamp}-${randomString}${originalExt}`;

      // Upload to Object Storage using the standardized path
      try {
        // Explicitly set bucket to CALENDAR and add more debug info
        console.log(`[TestEvent] Starting upload process to Object Storage:`);
        console.log(`[TestEvent] File path: ${req.file.path}`);
        console.log(`[TestEvent] Directory: 'events'`);
        console.log(`[TestEvent] Filename: ${filename}`);
        console.log(`[TestEvent] Bucket: 'CALENDAR'`);
        
        // Verify file exists before upload
        try {
          const fileStats = fs.statSync(req.file.path);
          console.log(`[TestEvent] File size before upload: ${fileStats.size} bytes`);
        } catch (statErr) {
          console.error(`[TestEvent] ERROR: File does not exist or cannot be read: ${req.file.path}`);
          console.error(`[TestEvent] Error details: ${statErr.message}`);
        }
        
        // Perform upload with explicit bucket parameter
        const objectStorageUrl = await objectStorage.uploadFile(
          req.file.path, 
          'events', 
          filename, 
          'CALENDAR' // Specify the bucket explicitly
        );
        console.log(`[TestEvent] Uploaded to Object Storage: ${objectStorageUrl}`);
        
        // Verify upload success by checking if file exists in Object Storage
        const fileExists = await objectStorage.fileExists(`events/${filename}`, 'CALENDAR');
        console.log(`[TestEvent] File exists check result: ${fileExists ? 'SUCCESS' : 'FAILED'}`);
        
        // If upload verification failed, try again with different path
        if (!fileExists) {
          console.log(`[TestEvent] First verification failed. Trying alternate paths...`);
          const alternateExists = await objectStorage.fileExists(filename, 'CALENDAR');
          console.log(`[TestEvent] Alternate path check (filename only): ${alternateExists ? 'EXISTS' : 'NOT FOUND'}`);
        }

        // Create the proper proxy URL format - direct endpoint for events
        // This is critical as we need to use the format that matches how files are actually stored
        const proxyUrl = `/api/storage-proxy/direct-events/${filename}`;
        console.log(`[TestEvent] Proxy URL (using direct endpoint): ${proxyUrl}`);

        // Add to mediaUrls array
        mediaUrls.push(proxyUrl);

        // Clean up temp file
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.warn(`[TestEvent] Failed to clean up temp file: ${unlinkError}`);
        }
      } catch (uploadError: any) {
        console.error('[TestEvent] Error uploading media:', uploadError);
        return res.status(500).json({
          message: 'Error uploading media file',
          error: uploadError.message
        });
      }
    }

    // For test purposes, we'll create a simulated event response instead of saving to database
    const newEvent = {
      id: Date.now(),
      ...eventData,
      mediaUrls,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`[TestEvent] Created test event with ID ${newEvent.id}`);

    // Return the created event with media URLs
    return res.status(201).json({
      success: true,
      id: newEvent.id,
      mediaUrls,
      event: newEvent
    });
  } catch (error: any) {
    console.error('[TestEvent] Unexpected error:', error);
    return res.status(500).json({
      message: 'Unexpected error processing request',
      error: error.message
    });
  }
});

// Special endpoint for direct URL access, redirects to the HTML interface
router.get('/test-event', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'test-event-api.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Test event API page not found');
  }
});

export default router;