# Media Storage Migration Guide

## Overview

This document outlines the migration of media files from filesystem storage to Replit Object Storage. All media uploads should now be directed to Object Storage instead of the local filesystem, with consistent URL formatting.

## Key Components

### 1. Unified Storage Service

The `unified-storage-service.ts` file provides a centralized service for all media storage operations:

- All media uploads go directly to Object Storage
- Consistent bucket structure with designated buckets for different media types
- Normalized URL format for all media references
- Standardized error handling and fallback mechanisms

### 2. Object Storage Upload Middleware

The `object-storage-upload-middleware.ts` file provides middleware to handle file uploads:

- Intercepts file uploads and automatically stores them in Replit Object Storage
- Replaces multer storage with memory storage and forwards to Object Storage
- Automatically determines appropriate bucket from request parameters
- Normalizes all media URLs to use proxy format
- Compatible with existing upload endpoints

### 3. URL Format

All media URLs now follow a standardized format:

```
/api/storage-proxy/BUCKET/path/filename
```

For example:
- `/api/storage-proxy/CALENDAR/events/event-image-1234.jpg`
- `/api/storage-proxy/FORUM/posts/forum-post-5678.png`

### 4. Bucket Organization

Media is organized into the following buckets:

- `CALENDAR`: Calendar event images
- `FORUM`: Forum post and comment media
- `VENDOR`: Vendor logos and images
- `REAL_ESTATE`: Real estate listing images
- `AVATARS`: User profile avatars
- `BANNER`: Banner slides and hero images
- `GENERAL`: General content media

## Migration Scripts

The following scripts are available to assist with migration:

### 1. Test Object Storage Upload (`scripts/test-object-storage-upload.js`)

Tests direct uploads to Object Storage through the new endpoints.

```
node scripts/test-object-storage-upload.js
```

### 2. Migrate Event Media (`scripts/migrate-event-media-to-object-storage.js`)

Migrates existing calendar event media from filesystem to Object Storage.

```
node scripts/migrate-event-media-to-object-storage.js
```

### 3. Check URL Format (`scripts/check-url-format.js`)

Analyzes URL patterns in the database to identify which tables still need migration.

```
node scripts/check-url-format.js
```

## Implementation Steps

1. All new uploads now automatically use Object Storage
2. Legacy media is being migrated as needed through migration scripts
3. The proxy endpoint `/api/storage-proxy/:bucket/:key` transparently serves media from Object Storage

## Testing

To test if the Object Storage integration is working correctly:

1. Upload a new file through the web interface
2. Verify the returned URL follows the new format (`/api/storage-proxy/...`)
3. Verify the image loads correctly in the browser
4. Run the URL format check script to see migration progress

## Troubleshooting

If images don't appear:

1. Check browser console for 404 errors
2. Verify the URL format matches the new standard
3. Ensure the Object Storage service is properly configured
4. Check that the bucket exists and is accessible
5. Verify that the correct access headers are being set in the proxy endpoint

## Next Steps

1. Complete migration of all legacy media types
2. Update any hardcoded URL references in the frontend code
3. Add monitoring for Object Storage usage and costs