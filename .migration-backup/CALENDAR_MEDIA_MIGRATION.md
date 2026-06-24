# Calendar Media Migration Guide

This document explains the migration of calendar media from filesystem to Replit Object Storage while maintaining backward compatibility.

## Overview

The project implements a dual-storage approach for calendar media files:
- New uploads go to Replit Object Storage for persistence
- Existing files remain in the filesystem for compatibility
- A fallback mechanism handles requests for files that exist only in Object Storage

## Key Components

### 1. Migration Script (`migrate-calendar-direct.cjs`)

- Scans the filesystem for calendar media files
- Uploads each file to Object Storage in a `CALENDAR` bucket
- Builds a mapping between filesystem paths and Object Storage URLs
- Preserves the original files in the filesystem
- Updates the database records with the new Object Storage URLs

### 2. Media Upload Middleware (`media-upload-middleware.ts`)

- Handles new calendar media uploads
- Uploads files to Object Storage using the `CALENDAR` bucket
- Stores a copy in the filesystem to maintain backward compatibility
- Updates database records with both the filesystem path and Object Storage URL

### 3. Calendar Media Fallback Middleware (`calendar-media-fallback.ts`)

- Intercepts requests for calendar media URLs
- Checks if the requested file has a mapping to Object Storage
- For files not found on filesystem but available in Object Storage:
  - Redirects to Object Storage URL (302 status code)
- For files available in filesystem:
  - Passes the request to next middleware to serve from filesystem
- Properly handles special characters in URLs by decoding them
- Strips query parameters from URLs for proper mapping lookup
- Uses 302 redirects for better compatibility with clients

### 4. Test Endpoints (`calendar-test-endpoints.ts`)

- Provides diagnostic endpoints to verify the mapping
- Allows checking if files exist on filesystem and/or Object Storage
- Lists all calendar media files with their status in both storage locations

## Migration Verification

You can use these test endpoints to verify the migration:

1. `/api/test-media/list-calendar-media` - Lists all calendar media files in filesystem
2. `/api/test-media/check-calendar-media?path=/path/to/file.jpg` - Checks a file's status in both storage locations

## Behavior Summary

1. **Files that exist in both filesystem and Object Storage**:
   - Served directly from filesystem for performance
   - Object Storage URL available as backup

2. **Files that only exist in Object Storage**:
   - Middleware redirects to Object Storage URL
   - 302 status code used for redirection

3. **New uploads**:
   - Stored in both filesystem and Object Storage
   - Database records include both URLs
   - Filesystem path used as primary URL for performance

## Testing

### Manual Testing with API Endpoints

You can test individual files using the provided test endpoints:

```
curl http://localhost:5000/api/test-media/check-calendar-media?path=/uploads/calendar/test-object-storage-only.jpg
```

### Automated Testing

Run the automated test script to verify both storage scenarios:
```
node test-redirect.js
```

The test script verifies:
1. **Object Storage Fallback**: Files that only exist in Object Storage are properly redirected with 302 status codes
2. **Filesystem Priority**: Files that exist in filesystem are served directly for performance
3. **URL Handling**: Proper handling of URLs with special characters and query parameters

Sample test output:
```
=== Calendar Media Dual-Storage Test ===

Testing URL: /uploads/calendar/test-object-storage-only.jpg
Expecting: redirect to Object Storage
Response status: 302
Content-Type: text/plain; charset=utf-8
✅ Redirect found! Location: https://object-storage.replit.app/CALENDAR/events/media-1745428042602-450786513.jpg

Testing URL: /uploads/calendar/media-1745760450199-941630067.png
Expecting: direct file serving
Response status: 200
Content-Type: image/png
✅ File served directly from filesystem

=== Tests Completed ===
```

## Deployment and Monitoring

### Deployment Process

1. The migration can be safely deployed to production with minimal risk:
   - New files are automatically stored in both locations
   - Existing files continue to be served from filesystem
   - Only files missing from filesystem (but in the mapping) will trigger redirects

2. Pre-deployment checklist:
   - Run `node test-redirect.js` to verify redirect functionality
   - Check API endpoints to confirm mapping is working
   - Ensure Replit Object Storage is properly configured

### Monitoring

After deployment, monitor the following:
1. Server logs for "[CalendarMediaFallback]" entries to track redirects
2. Any 404 errors for calendar media that might indicate mapping issues
3. Performance impact of redirects vs. direct file serving

## Important Implementation Notes

1. The directory structure within the CALENDAR bucket must be consistent:
   - All calendar event media should be stored in the `events` directory within the CALENDAR bucket
   - This ensures URLs like `https://object-storage.replit.app/CALENDAR/events/filename.jpg`
   - Using inconsistent directories (like `calendar` instead of `events`) breaks the mapping

2. The mapping file must include entries for both path variations:
   - `/uploads/calendar/filename.jpg` 
   - `/calendar/filename.jpg`
   - This ensures media is findable regardless of which URL format is used
   
3. The bucket mapping must include entries for both the directory name and the media type:
   - Media type "calendar" and "calendar-media" map to CALENDAR bucket
   - Directory name "events" must also map to CALENDAR bucket
   - If this mapping is missing, uploads will go to DEFAULT bucket instead

## Future Considerations

1. If full migration to Object Storage becomes desirable, modify `media-upload-middleware.ts` to stop storing copies in filesystem
2. Performance optimizations could include:
   - Caching Object Storage URLs in memory/Redis
   - Using CDN for Object Storage URLs
   - Implementing a more efficient path lookup mechanism
3. Consider automating the migration process for other media types using similar patterns