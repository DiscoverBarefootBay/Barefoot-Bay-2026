# Forum Media Migration to Object Storage

This document details the process of migrating forum media from the filesystem to Replit Object Storage.

## Overview

The forum media migration accomplishes the following goals:

1. Moves existing forum media files from `/forum-media/` and `/uploads/forum-media/` directories to the `FORUM` bucket in Object Storage
2. Updates the forum media upload process to store new uploads directly in Object Storage instead of the filesystem
3. Provides fallback images for missing forum media
4. Ensures consistent URL format through URL normalization

## Migration Scripts

The migration involves several scripts:

1. `migrate-forum-media-to-object-storage.js` - Main migration script that moves files from filesystem to Object Storage
2. `upload-default-forum-image.js` - Uploads default fallback images to the FORUM bucket

## Testing

The `forum-media-test.html` page allows testing forum media uploads and displays. This is available at `/forum-media-test.html`.

## URL Format Changes

Forum media URL formats have been standardized:

1. Old URL format (filesystem): `/forum-media/{filename}` or `/uploads/forum-media/{filename}`
2. New URL format (Object Storage): `/api/storage-proxy/FORUM/forum/{filename}`

## Implementation Details

### Storage Buckets

Forum media is now stored in the `FORUM` bucket in Object Storage. The specific directory structure is:

```
FORUM/
└── forum/
    ├── {media files}
    ├── default-forum-image.svg (fallback)
    └── forum-placeholder.svg (fallback)
```

### Upload Process

The forum media upload process has been updated to:

1. Set the `mediaType` to `FORUM` on every request
2. Use the `processUploadedFile` function to properly handle the upload to Object Storage
3. Return both filesystem URLs (for backward compatibility) and Object Storage URLs

### Fallback Mechanism

Two default images are available in the FORUM bucket:
- `FORUM/forum/default-forum-image.svg` - Default image for general forum posts
- `FORUM/forum/forum-placeholder.svg` - Placeholder for forum media that fails to load

The forum media redirect middleware automatically serves these fallback images when a forum media file is not found.

## Troubleshooting

If forum media isn't displaying properly:

1. Check if URLs are in the correct format (`/api/storage-proxy/FORUM/forum/{filename}`)
2. Verify that the forum upload endpoint is setting the `mediaType` to `FORUM`
3. Check if fallback images are available in the FORUM bucket
4. Use the `forum-media-test.html` page to test uploads and URL formatting

## API Changes

The forum media upload endpoint (`/api/forum/upload-media`) now:
- Sets the media type to `FORUM` explicitly
- Returns success, URL, objectStorageUrl, and developmentUrl in the response
- Does not use the `mediaSyncMiddleware` which only works with filesystem storage

## Future Improvements

- Add forum media migration status tracking
- Enhance URL normalization for inline forum post content
- Add admin controls for managing forum media in Object Storage