# Barefoot Bay Video Storage Solution

This document explains how video files are stored and served in the Barefoot Bay community platform.

## Storage Architecture

Videos are stored in Replit Object Storage in two primary locations:

1. **Primary Location**: `/DEFAULT/banner-slides/` directory
2. **Secondary Location**: `/DEFAULT/videos/` directory 

Both locations provide redundancy in case one path becomes inaccessible.

## File Naming Conventions

Videos follow these naming conventions:

- `BackgroundVideo.mp4` - Primary background video file (capitalized)
- `background-video.mp4` - Alternative background video file (lowercase with hyphen)
- `test-background-video.mp4` - Test video file

## Video Component Implementation

The background video component (`client/src/components/shared/background-video.tsx`) implements a robust fallback system:

1. First attempts to load from Object Storage URLs
2. If that fails, falls back to local filesystem paths
3. Uses fetch HEAD requests to verify accessibility before loading
4. Reports video loading status through WebSockets for monitoring

## WebSocket Integration

The platform uses WebSockets to:

- Report video loading status
- Monitor playback issues
- Send detailed error information when videos fail to load
- Track which video sources are successfully loading across clients

## Upload Process

Videos can be uploaded through:

1. **Direct Upload Script** (`scripts/direct-upload-video.js`): Uploads directly to Replit Object Storage
2. **Media Upload Middleware**: Detects video files by extension and stores in Object Storage with proper media type

## Fallback Mechanism

The component implements a sophisticated fallback system:

```javascript
const VIDEO_SOURCES = [
  // Primary Object Storage options
  "https://object-storage.replit.app/DEFAULT/banner-slides/BackgroundVideo.mp4",
  "https://object-storage.replit.app/DEFAULT/videos/BackgroundVideo.mp4",
  "https://object-storage.replit.app/DEFAULT/banner-slides/background-video.mp4",
  "https://object-storage.replit.app/DEFAULT/videos/background-video.mp4",
  "https://object-storage.replit.app/DEFAULT/banner-slides/test-background-video.mp4",
  "https://object-storage.replit.app/DEFAULT/videos/test-background-video.mp4",
  
  // Local filesystem options (fallbacks for development or backup)
  "/static/videos/BackgroundVideo.mp4",
  "/uploads/banner-slides/background-video.mp4",
  "/banner-slides/background-video.mp4",
  "/public/static/videos/test-background-video.mp4",
  "/uploads/banner-slides/test-background-video.mp4"
];
```

When a video fails to load, the component automatically tries the next source in the list.

## Client-Side Caching

The component integrates with the platform's media caching system to:

- Cache successful video loads
- Remember which sources worked previously
- Reduce repeated network requests for video files

## Checking Storage Status

Use the `scripts/check-object-storage.js` script to verify files exist in Object Storage:

```bash
node scripts/check-object-storage.js
```

This will list all files in the DEFAULT bucket and check specific video paths.

## Troubleshooting

If videos aren't loading:

1. Check WebSocket console logs for loading errors
2. Verify files exist in Object Storage using the check script
3. Clear browser cache using the built-in cache clearing mechanism
4. Re-upload videos using the direct upload script if needed