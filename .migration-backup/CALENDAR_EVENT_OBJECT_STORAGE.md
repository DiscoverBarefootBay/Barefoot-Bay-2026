# Calendar Event Media Object Storage

This document describes the implementation of Replit Object Storage as the exclusive storage solution for calendar event media uploads in the Barefoot Bay community platform.

## Overview

Calendar event media files (images, documents, etc.) are now stored exclusively in Replit Object Storage rather than on the filesystem. This provides several benefits:

1. **Persistent Storage**: Media files are preserved across code deployments
2. **Improved Performance**: Faster access and reduced disk usage on the Replit instance
3. **CORS-Compatible**: Files are served through a server proxy to avoid CORS issues
4. **Consistent URLs**: URLs are normalized to ensure consistent access across environments

## Architecture

### Media Upload Flow

When calendar event media is uploaded:

1. The file is temporarily stored in the filesystem by Multer
2. The `handleCalendarMediaUpload` middleware processes the file
3. The file is uploaded to Replit Object Storage in the `CALENDAR` bucket under the `events/` directory
4. The Object Storage URL is recorded in `calendar-media-mapping.json` for future reference
5. The temporary file is eventually removed from the filesystem

### Media Access Flow

When calendar event media is accessed:

1. The client requests the media using a URL like `/api/storage-proxy/CALENDAR/events/filename.png`
2. The storage proxy routes the request to Replit Object Storage
3. If the file exists, it's served directly from Object Storage
4. If the file doesn't exist, a default image is served to prevent broken images

### URL Normalization

To handle legacy URLs, the system normalizes various URL formats:

- `/uploads/calendar/filename.jpg` → `/api/storage-proxy/CALENDAR/events/filename.jpg`
- `/calendar/filename.jpg` → `/api/storage-proxy/CALENDAR/events/filename.jpg`
- `/media/filename.jpg` → `/api/storage-proxy/CALENDAR/events/filename.jpg`
- `/events/filename.jpg` → `/api/storage-proxy/CALENDAR/events/filename.jpg`

## Default Image

A default event image is provided for cases where a requested file doesn't exist:

```
/api/storage-proxy/CALENDAR/events/default-event-image.svg
```

This SVG placeholder is stored in Object Storage and used whenever:
1. A requested file doesn't exist in Object Storage
2. The URL is malformed and doesn't contain a valid filename
3. A null or empty URL is encountered

## Key Components

1. **object-storage-service.ts**: Handles interactions with Replit Object Storage
2. **object-storage-proxy.ts**: Routes requests to Object Storage through our server
3. **calendar-media-upload-handler.ts**: Processes uploaded files and stores them in Object Storage
4. **calendar-media-fallback.ts**: Handles requests for files that might use legacy URL formats
5. **media-path-utils.ts**: Provides utilities for normalizing and processing media URLs
6. **client/src/lib/media-helper.ts**: Client-side utilities for handling media URLs

## Notes

- All access to Object Storage is routed through a server-side proxy to avoid CORS issues
- The system exclusively uses Object Storage with no fallbacks to filesystem storage
- URL normalization ensures backward compatibility with existing references
- Default images are provided to prevent broken image placeholders