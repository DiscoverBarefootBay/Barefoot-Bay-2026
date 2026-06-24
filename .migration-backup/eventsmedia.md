# Calendar Event Media Loading Issue Analysis and Solution

## Problem Statement

Calendar event media stored in Replit Object Storage is not displaying correctly on event pages. The current implementation appears to store direct Object Storage URLs in the database (`https://object-storage.replit.app/CALENDAR/events/...`), but the application expects to serve these through a proxy endpoint (`/api/storage-proxy/CALENDAR/events/...`). Despite proxy routes being implemented, the event images are not appearing as shown in the attached screenshot.

## Files and Components Involved

### Core Files:

1. **Server-side Files:**
   - `server/object-storage-service.ts` - Core service for interacting with Replit Object Storage
   - `server/object-storage-proxy.ts` - Proxy endpoint to serve files from Object Storage
   - `server/calendar-media-upload-handler.ts` - Handles calendar event media uploads
   - `server/routes.ts` - Contains route definitions for media handling
   - `server/calendar-media-fallback.ts` - Fallback mechanisms for calendar media

2. **Client-side Files:**
   - `client/src/lib/media-helper.ts` - Utilities for handling media URLs and errors
   - `client/src/components/calendar/event-media-gallery.tsx` - Component that displays event media

3. **Database Schema:**
   - `shared/schema.ts` - Contains the database model for events including `media_urls` field

## Root Causes Analysis

After detailed investigation, I've identified several potential root causes for this issue:

1. **URL Format Mismatch**:
   - Database entries contain direct Object Storage URLs (`https://object-storage.replit.app/CALENDAR/events/...`)
   - Application expects proxy URLs (`/api/storage-proxy/CALENDAR/events/...`)
   - Current client-side URL conversion is not working properly

2. **Media Upload Process**:
   - When media is uploaded, the URL saved in the database might not be in the expected format
   - The `uploadFile` method in `object-storage-service.ts` may be returning direct URLs instead of proxy URLs

3. **URL Interception Issues**:
   - Routes added to intercept direct Object Storage URLs may not be catching all patterns or may have incorrect redirect logic

4. **Local File System vs Object Storage Confusion**:
   - The application may be looking for files in the local filesystem when they only exist in Object Storage
   - Path resolution logic may be incorrect when retrieving files

5. **CORS and Security Restrictions**:
   - Direct Object Storage URLs might be blocked by CORS policies
   - The browser might be preventing cross-origin requests to Object Storage

## Solution Plan

Based on the identified causes, here's a comprehensive plan to fix the issues:

### 1. Fix URL Format Handling

1. **Update Database Entries**:
   - Create a migration script to convert all direct Object Storage URLs in the database to proxy URLs
   - Script would update the `media_urls` array for all events in the database

```typescript
// Example SQL query to update URLs
UPDATE events 
SET media_urls = array_replace(
  media_urls, 
  'https://object-storage.replit.app/CALENDAR/events/', 
  '/api/storage-proxy/CALENDAR/events/'
)
WHERE media_urls::text LIKE '%object-storage.replit.app%';
```

2. **Update Media Upload Process**:
   - Modify `uploadFile` in `object-storage-service.ts` to always return proxy URLs
   - Ensure all new uploads store the correct proxy URL format

```typescript
// Ensure uploadFile returns proxy URLs instead of direct URLs
async uploadFile(filePath: string, directory: string, filename?: string): Promise<string> {
  // Existing upload logic...
  
  // Return proxy URL instead of direct URL
  return `/api/storage-proxy/${bucket}/${finalKey}`;
}
```

### 2. Improve URL Translation Logic

1. **Enhance Client-Side Media Helper**:
   - Improve URL detection and conversion in `getMediaUrl` function
   - Add more robust error handling for different URL formats

```typescript
// More robust URL detection
if (url && typeof url === 'string') {
  if (url.includes('object-storage.replit.app')) {
    // Parse URL and convert to proxy format
    try {
      const objectStorageUrl = new URL(url);
      const pathParts = objectStorageUrl.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        const bucket = pathParts[0];
        const restOfPath = pathParts.slice(1).join('/');
        return `/api/storage-proxy/${bucket}/${restOfPath}`;
      }
    } catch (e) {
      console.error('Failed to parse Object Storage URL:', e);
    }
  }
}
```

2. **Update Error Handling**:
   - Improve the fallback chain in `handleImageError` to try multiple URL formats
   - Add logging to track which fallback is being used

### 3. Fix Route Handling

1. **Improve Server-Side Route Handling**:
   - Add more specific routes to handle various URL patterns
   - Ensure all routes are properly redirecting to the storage proxy

```typescript
// Add specific route for direct Object Storage URLs with query parameters
app.get("/object-storage.replit.app/:bucket/:path(*)", (req, res) => {
  const { bucket, path } = req.params;
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  console.log(`Redirecting direct Object Storage URL: ${bucket}/${path}${queryString}`);
  res.redirect(`/api/storage-proxy/${bucket}/${path}${queryString}`);
});

// Add catch-all route for calendar event media
app.get(["/calendar/:filename", "/uploads/calendar/:filename", "/events/:filename"], (req, res) => {
  const { filename } = req.params;
  console.log(`Redirecting calendar media request: ${filename}`);
  res.redirect(`/api/storage-proxy/CALENDAR/events/${filename}`);
});
```

2. **Update Storage Proxy Routes**:
   - Enhance the storage proxy to better handle partial paths and edge cases
   - Add more detailed logging for debugging purposes

### 4. Add Debugging and Monitoring

1. **Enhanced Logging**:
   - Add detailed logging in both client and server for media URL processing
   - Log all URL transformations and access attempts

```typescript
// Client-side logging helper
function logMediaUrl(stage: string, originalUrl: string, transformedUrl: string) {
  console.log(`[MediaHelper][${stage}] ${originalUrl} -> ${transformedUrl}`);
}

// Server-side logging middleware
app.use((req, res, next) => {
  if (req.path.includes('/api/storage-proxy/') || req.path.includes('/object-storage.replit.app/')) {
    console.log(`[StorageProxy] ${req.method} ${req.path} from ${req.get('Referer') || 'unknown'}`);
  }
  next();
});
```

2. **Add Testing Endpoint**:
   - Create a diagnostic endpoint to test Object Storage access
   - Allow manual testing of various URL formats

```typescript
app.get("/api/test/object-storage/:bucket/:key(*)", async (req, res) => {
  try {
    const { bucket, key } = req.params;
    const storageKey = `${bucket}/${key}`;
    console.log(`Testing Object Storage access: ${storageKey}`);
    
    // Test direct Object Storage access
    const directUrl = `https://object-storage.replit.app/${storageKey}`;
    const proxyUrl = `/api/storage-proxy/${bucket}/${key}`;
    
    // Report results
    res.json({
      requestedKey: storageKey,
      directUrl,
      proxyUrl,
      checkDirectUrl: `curl -I "${directUrl}"`,
      checkProxyUrl: `curl -I "${req.protocol}://${req.get('host')}${proxyUrl}"`
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});
```

### 5. Database Synchronization

1. **Mass Update Script**:
   - Create a script to update all existing event records
   - Convert all direct URLs to proxy URLs

```typescript
// Function to normalize all event media URLs in the database
async function normalizeEventMediaUrls() {
  try {
    // Get all events with media URLs
    const events = await db.select().from(schema.events).where(sql`array_length(media_urls, 1) > 0`);
    
    let updatedCount = 0;
    
    for (const event of events) {
      if (!event.mediaUrls || !Array.isArray(event.mediaUrls)) continue;
      
      // Normalize each URL in the array
      const normalizedUrls = event.mediaUrls.map(url => {
        if (typeof url !== 'string') return url;
        
        // Check if it's a direct Object Storage URL
        if (url.includes('object-storage.replit.app')) {
          try {
            const objectStorageUrl = new URL(url);
            const pathParts = objectStorageUrl.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2) {
              const bucket = pathParts[0];
              const restOfPath = pathParts.slice(1).join('/');
              return `/api/storage-proxy/${bucket}/${restOfPath}`;
            }
          } catch (e) {
            console.error('Failed to parse URL:', url, e);
          }
        }
        return url;
      });
      
      // Check if URLs were actually changed
      if (JSON.stringify(normalizedUrls) !== JSON.stringify(event.mediaUrls)) {
        // Update the event with normalized URLs
        await db.update(schema.events)
          .set({ mediaUrls: normalizedUrls, updatedAt: new Date() })
          .where(eq(schema.events.id, event.id));
        
        updatedCount++;
      }
    }
    
    console.log(`Updated media URLs for ${updatedCount} events`);
    return updatedCount;
  } catch (error) {
    console.error('Error normalizing event media URLs:', error);
    throw error;
  }
}
```

2. **Add Admin Interface**:
   - Create an admin page to trigger URL normalization
   - Show progress and results of the normalization process

## Implementation Order

To minimize disruption and ensure successful resolution, I recommend implementing these changes in the following order:

1. Start with enhanced logging to better understand the current flow
2. Implement the improved client-side URL handling
3. Update the server-side routes to better handle redirects
4. Fix the media upload process to ensure new uploads use the correct format
5. Create and run the database update script to normalize existing URLs
6. Add the testing and admin tools to verify and monitor the solution

## Conclusion

The core issue appears to be a mismatch between how URLs are stored in the database versus how they're expected to be accessed by the application. By implementing a comprehensive solution that addresses both the storage format and access mechanisms, we should be able to fully migrate to Replit Object Storage for calendar event media while ensuring proper display throughout the application.

This approach ensures:
1. All new uploads will be stored correctly
2. Existing media will be accessible through the corrected URL format
3. Error handling will provide graceful fallbacks
4. The entire solution aligns with the requirement to use Replit Object Storage exclusively

Once these changes are implemented, the calendar event media should display correctly across all event pages without relying on filesystem storage.