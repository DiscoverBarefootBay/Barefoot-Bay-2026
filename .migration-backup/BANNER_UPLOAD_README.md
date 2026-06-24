# Banner Slide Upload Guidelines

This document explains how banner slide uploads work in the Barefoot Bay community platform and provides information about recent improvements made to the system.

## Banner Upload Functionality

The platform allows administrators to upload image and video files as banner slides for the homepage carousel. These banners appear at the top of the homepage and provide important visual content to site visitors.

### Supported File Types

- **Images**: JPG, JPEG, PNG, WebP, GIF
- **Videos**: MP4, WebM

## Technical Implementation

Banner uploads use dedicated endpoints (`/api/direct-banner-upload` and `/api/banner-slides/upload`) that handle both images and videos efficiently. When a banner is uploaded:

1. The file is saved to two locations for compatibility:
   - `/banner-slides/[filename]` (production path)
   - `/uploads/banner-slides/[filename]` (development path)

2. Unique filenames are generated using timestamps and random values to prevent conflicts.

3. Both paths are returned to the client, with consistent URL formats to ensure proper display.

## Recent Improvements (April 2025)

### Enhanced File Verification and Synchronization

The upload system has been significantly enhanced with improved reliability:

1. **Dual Storage Verification**: Files are now verified to exist in both locations before confirming a successful upload.
2. **Automatic Synchronization**: If a file is missing from one location, the system automatically copies it from the other.
3. **Size Verification**: The system checks file sizes to ensure integrity, using the larger file if discrepancies exist.
4. **Background Repair**: Each upload operation also checks existing banner slides and repairs any inconsistencies.

### Buffer Handling Fix

The upload system properly handles different file types and sizes:

- **Small Files**: Typically stored in memory (req.file.buffer)
- **Large Files**: Temporarily stored on disk (req.file.path)

The system correctly detects which storage method is being used, ensuring even large video files upload correctly.

### Content Security Policy (CSP) Updates

The Content Security Policy allows blob URLs for media content, which is essential for video playback. Key CSP directives include:

```
default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;
img-src * data: blob: 'unsafe-inline';
media-src * data: blob:;
```

This ensures that video content can be properly previewed and played in both admin and public-facing interfaces.

## Repair Tool

A maintenance tool is available to repair any existing banner slides:

```
node fix-banner-slides.js
```

This script:
1. Scans both directories for banner slides
2. Ensures each file exists in both locations
3. Verifies file sizes match
4. Repairs any inconsistencies automatically
5. Provides a summary report of actions taken

Recommended to run after major system updates or if media issues are observed.

## Troubleshooting

If you encounter issues with banner uploads:

1. **Upload Fails with 500 Error**: Check server logs for detailed error information.
2. **Banners Not Appearing**: Run the repair tool to fix potential file location issues.
3. **Videos Don't Play**: May be related to Content Security Policy issues. Contact the development team.
4. **Files Too Large**: There is a 100MB size limit on uploads.

## Production vs. Development URLs

The system maintains two URLs for each uploaded banner:

1. **Production URL**: `/banner-slides/[filename]`
2. **Development URL**: `/uploads/banner-slides/[filename]`

Both URLs point to the same content, ensuring compatibility across environments.