# Event Media Object Storage Integration Analysis

## Summary of the Problem

Images uploaded to event pages (e.g., `/events/4839`) are not being properly stored in or retrieved from Replit Object Storage. Specifically:

1. When uploading an image to an event, the image appears to upload but doesn't display in the "PHOTOS & VIDEOS" section
2. Console logs show errors: 
   ```
   Image failed to load: https://object-storage.replit.app/CALENDAR/events/media-1746252493046-611692162.png
   Media service failed for media-1746252493046-611692162.png, trying default image
   ```
3. The system is attempting to display the default image, but the uploaded image is not being properly retrieved or stored.

## Root Causes Identified

After detailed code analysis, I've identified several potential issues:

### 1. Upload Handler Issues

- The `calendar-media-upload-handler.ts` correctly uploads to Object Storage, but there might be inconsistencies in how the URL is saved to the event record
- The upload handler creates mapping entries, but these may not be correctly referenced when retrieving the images

### 2. Event Data Structure Problems

- The `mediaUrls` field in the event database record may not be properly updated with the Object Storage URL
- There might be inconsistency between what URL is stored in the database and what URL the frontend is trying to access

### 3. Media Path Resolution Issues

- The `calendar-media-fallback.ts` service might not be correctly resolving the media paths
- The path being checked (/media/media-1746252493046-611692162.png) is different from what's in the error (CALENDAR/events/media-1746252493046-611692162.png)

### 4. Client-Side Media Helper Problems

- The client-side code in `media-helper.ts` might not be correctly forming or handling the Object Storage URLs
- The event media gallery components might not be correctly using the URLs returned from the upload process

## Code Investigation Findings

### Event Update API Analysis

When an event is updated with new media:

1. The frontend uploads the image via `/api/upload` with section=calendar
2. Our specialized handler `handleCalendarMediaUpload` correctly uploads to Object Storage
3. The handler returns an Object Storage URL to the client
4. The frontend then updates the event with the new mediaUrls array
5. **Key Issue #1:** The event update API might not be correctly saving the Object Storage URL in the database

### Media URL Path Analysis

Tracing how media URLs are processed:

1. The upload returns an Object Storage URL format: `https://object-storage.replit.app/CALENDAR/events/media-timestamp.png`
2. This URL is mapped in `calendar-media-mapping.json`
3. **Key Issue #2:** The URL saved in the database might be a filesystem path, not the Object Storage URL
4. When retrieving, the system looks for `/media/media-timestamp.png` instead of the Object Storage path

### Client-Side Rendering Analysis

Looking at how the frontend handles media URLs:

1. The event-media-gallery components attempt to display images from mediaUrls
2. The media-helper.ts tries to resolve the URL using the fallback mechanism
3. **Key Issue #3:** The media helper might not be correctly resolving Object Storage URLs
4. The client may be using incorrect URL formats when trying to display images

## Comprehensive Fix Plan

### 1. Complete Event Update API Fix

```typescript
// Modify event update endpoint in routes.ts to ensure mediaUrls are stored as Object Storage URLs
app.put("/api/events/:id", upload.array('media'), async (req, res) => {
  try {
    // Existing code...
    
    // If we received new media files from the upload
    if (req.files && req.files.length > 0) {
      // Process each file through our calendar media handler
      for (const file of req.files) {
        const singleFileReq = {...req, file} as any;
        await handleCalendarMediaUpload(singleFileReq, res, () => {});
        
        // Use the object storage URL directly from our handler
        if (singleFileReq.objectStorageUrl) {
          currentMediaUrls.push(singleFileReq.objectStorageUrl);
        }
      }
    }
    
    // Update event with the Object Storage URLs
    const updatedEvent = await storage.updateEvent(eventId, {
      ...eventData,
      mediaUrls: currentMediaUrls
    });
    
    // Existing code...
  } catch (error) {
    // Error handling...
  }
});
```

### 2. Fix URL Format Consistency

Create a utility function to ensure URL format consistency for event media:

```typescript
// Add this to server/media-path-utils.ts
export function normalizeEventMediaUrl(url: string): string {
  // If it's already an Object Storage URL, return it
  if (url.startsWith('https://object-storage.replit.app/')) {
    return url;
  }
  
  // Extract the filename from various possible URL formats
  let filename = '';
  if (url.includes('/media/')) {
    filename = url.split('/media/')[1];
  } else if (url.includes('/calendar/')) {
    filename = url.split('/calendar/')[1];
  } else if (url.includes('/uploads/calendar/')) {
    filename = url.split('/uploads/calendar/')[1];
  } else {
    // If we can't identify the pattern, return as is
    return url;
  }
  
  // Return the canonical Object Storage URL format
  return `https://object-storage.replit.app/CALENDAR/events/${filename}`;
}
```

### 3. Improve Calendar Media Fallback Service

Update calendar-media-fallback.ts to better handle path resolution:

```typescript
// In calendar-media-fallback.ts, modify the checkMedia function
export async function checkMedia(url: string): Promise<string> {
  console.log(`[CalendarMediaFallback] Checking URL: ${url}`);
  
  // Normalize the URL first to ensure consistent format
  const normalizedUrl = normalizeEventMediaUrl(url);
  
  // Try Object Storage URL first as the authoritative source
  try {
    // Check if we can access the media at the Object Storage URL
    const response = await fetch(normalizedUrl, { method: 'HEAD' });
    if (response.ok) {
      return normalizedUrl;
    }
  } catch (error) {
    console.log(`[CalendarMediaFallback] Object Storage check failed for ${normalizedUrl}: ${error.message}`);
  }
  
  // If we reach here, fall back to checking mapping and filesystem
  // (Existing fallback code)
  
  // As last resort, return default image
  return 'https://object-storage.replit.app/CALENDAR/events/default-event-image.svg';
}
```

### 4. Update Media Helper in Client

Modify client/src/lib/media-helper.ts to better handle Object Storage URLs:

```typescript
// In client/src/lib/media-helper.ts
export function getMediaUrl(url: string, context = 'event'): string {
  // If no URL provided, return appropriate default
  if (!url) {
    return context === 'event' 
      ? 'https://object-storage.replit.app/CALENDAR/events/default-event-image.svg'
      : '/public/media-placeholder.png';
  }
  
  // If it's already an Object Storage URL, use it directly
  if (url.startsWith('https://object-storage.replit.app/')) {
    return url;
  }
  
  // For event media, prioritize the Object Storage path
  if (context === 'event') {
    // Extract the filename from various path formats
    let filename = '';
    if (url.includes('/media/')) {
      filename = url.split('/media/')[1];
    } else if (url.includes('/calendar/')) {
      filename = url.split('/calendar/')[1];
    } else if (url.includes('/uploads/calendar/')) {
      filename = url.split('/uploads/calendar/')[1];
    } else {
      // If filename extraction fails, return as is
      return url;
    }
    
    // Return the canonical Object Storage URL
    return `https://object-storage.replit.app/CALENDAR/events/${filename}`;
  }
  
  // For other contexts, use existing logic
  // (Existing path resolution logic)
  
  return url;
}
```

### 5. Create Database Update Script

To fix existing event media entries in the database:

```typescript
// Create fix-event-media-urls.js script
import { storage } from './server/storage.js';
import { normalizeEventMediaUrl } from './server/media-path-utils.js';

async function updateEventMediaUrls() {
  console.log('Updating event media URLs to use Object Storage format...');
  
  // Get all events
  const events = await storage.getEvents();
  console.log(`Found ${events.length} events to check`);
  
  let updatedCount = 0;
  
  // Process each event
  for (const event of events) {
    if (event.mediaUrls && event.mediaUrls.length > 0) {
      const originalUrls = [...event.mediaUrls];
      
      // Normalize each URL to use Object Storage format
      const updatedUrls = event.mediaUrls.map(url => normalizeEventMediaUrl(url));
      
      // Check if any URLs were updated
      const hasChanges = updatedUrls.some((url, i) => url !== originalUrls[i]);
      
      // If URLs were updated, save the event
      if (hasChanges) {
        await storage.updateEvent(event.id, { ...event, mediaUrls: updatedUrls });
        updatedCount++;
        console.log(`Updated event ID ${event.id} with new mediaUrls`);
      }
    }
  }
  
  console.log(`Completed! Updated ${updatedCount} events with normalized Object Storage URLs`);
}

updateEventMediaUrls().catch(console.error);
```

## Implementation Strategy

1. **Deploy Fix #1:** Update the event update API to ensure Object Storage URLs are saved
2. **Deploy Fix #2:** Implement the URL normalization functions 
3. **Deploy Fix #3:** Improve the calendar media fallback service
4. **Deploy Fix #4:** Update the client-side media helper
5. **Deploy Fix #5:** Run the database update script to fix existing events

## Verifying the Solution

After implementing these fixes:

1. Upload a new image to an event page
2. Verify in the server logs that the image is uploaded to Object Storage
3. Check the database to ensure the mediaUrls field contains the proper Object Storage URL
4. Reload the event page and verify the image appears in the "PHOTOS & VIDEOS" section
5. Inspect the network tab to confirm the image is loaded from Object Storage

## Conclusion

The issue stems from inconsistencies in how media URLs are handled through the upload, storage, and retrieval process. The solution focuses on standardizing URL formats throughout the application, ensuring Object Storage is used as the primary source of truth, and implementing better fallback mechanisms.

This comprehensive approach addresses both the immediate issue of images not displaying and the underlying architectural issues that caused the problem in the first place.