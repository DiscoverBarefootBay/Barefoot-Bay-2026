# Banner Media System Documentation

This document explains the banner media system architecture and the fixes implemented to ensure reliable banner image/video display.

## System Architecture

The banner media system uses a dual-path approach to ensure files are accessible in both development and production environments:

1. **Development path**: `/uploads/banner-slides/` - Used during development and file uploads
2. **Production path**: `/banner-slides/` - Used in production environment

The system is designed to look for media in both locations, with fallbacks to ensure reliable display.

## Common Issues and Solutions

### 1. Media File Corruption

Some banner image files became corrupted (tiny files with incorrect headers). Symptoms:
- Images displaying as broken icons
- Error logs showing file load failures
- Files with .jpg extension but PNG headers

**Solution:**
- Created `/public/banner-placeholder.jpg` as a reliable fallback
- Added script `fix-banner-media.js` to identify and repair corrupted files
- Updated components to validate file formats before attempting to use them

### 2. Path Format Inconsistency

Files were sometimes only available in one location but not the other, causing inconsistent display.

**Solution:**
- Modified `fix-banner-media.js` to ensure all files exist in both locations
- Updated the BannerImage and BannerVideo components to try alternative paths automatically
- Added explicit static routes for all media directories in server/index.ts

### 3. File Format Detection

Videos were sometimes misidentified as images and vice versa.

**Solution:**
- Added file format validation in the BannerVideo component
- Extended the file repair script to check file headers against extensions
- Added error states that show appropriate messages rather than broken media

## Implementation Details

### Banner Components

Both BannerImage and BannerVideo components now implement:

1. **Format validation**: Checks file extensions to ensure media type matches component
2. **Path normalization**: Handles both `/uploads/banner-slides/` and `/banner-slides/` formats
3. **Fallback strategy**:
   - Try alternative path if primary fails
   - Display placeholder with message if both fail
   - Use consistent `/public/banner-placeholder.jpg` for all fallbacks

### Path Handling

The system now uses a consistent approach to media paths:

1. Store paths in the database using the development format (`/uploads/banner-slides/`)
2. Copy files to production location on upload (`/banner-slides/`)
3. Try alternative paths when media fails to load
4. Ensure reliable static file serving for all directories

### Fix Script

The `fix-banner-media.js` script provides automated repair for the banner media system:

1. Scan all banner media files in both locations
2. Identify corrupted files (too small or incorrect headers)
3. Replace corrupted files with the placeholder image
4. Create copies to ensure files exist in both locations

### Cache Management

A persistent issue was browsers caching outdated or corrupted media files. To address this:

1. Added a CacheClearer component that helps users clear cached media
2. Implemented localStorage-based caching with proper invalidation
3. Added cache debugging tools in the diagnostic panel

### Diagnostic Tools

The banner-diagnostic.tsx page provides:

1. Comprehensive visual inspection of all banner slides
2. Path accessibility testing for all media paths
3. Cache management tools
4. Detailed technical information for administrators

## Usage Instructions

### For Administrators

1. Access the banner diagnostic page at `/banner-diagnostic`
2. Run diagnostics to check all media paths
3. Review and fix any inaccessible slides
4. Use the cache management tools if needed
5. Consider running the `fix-banner-media.js` script if multiple slides are broken

### For Users

If banner media is not displaying correctly:

1. Try refreshing the page
2. Use the "Clear Media Cache" button on the banner diagnostic page
3. Report persistent issues to administrators

## WebSocket Integration

The application uses WebSockets for real-time updates when banner slides are modified:

1. The WebSocket server is set up in server/routes.ts
2. When a banner slide is updated, a 'banner-update' event is broadcast
3. Connected clients receive the update and refresh their carousel without a full page reload

## Technical Reference

### Component Structure

- **community-showcase.tsx**: Main container component for banner slides carousel
- **banner-image.tsx**: Specialized component for image display with error handling
- **banner-video.tsx**: Specialized component for video display with format validation
- **cache-clearer.tsx**: Utility for clearing cached media files

### Media Paths

The following paths are used for media files:

- `/uploads/banner-slides/`: Primary development path
- `/banner-slides/`: Production path
- `/public/banner-placeholder.jpg`: Fallback placeholder

### API Endpoints

- `GET /api/pages/banner-slides`: Retrieves all banner slides
- `POST /api/pages/banner-slides`: Updates banner slides configuration
- `DELETE /api/pages/banner-slides`: Removes a specific slide

## Troubleshooting

### Images Not Displaying

1. Check browser console for path errors
2. Run diagnostics to verify path accessibility
3. Clear browser cache
4. Verify file exists in both locations

### Videos Not Playing

1. Confirm format is compatible (MP4, WebM, etc.)
2. Check that autoplay is enabled
3. Verify file exists in both locations
4. Clear browser cache

### Placeholder Images Showing Instead of Content

1. Run diagnostics to check if original files are accessible
2. Check for format mismatches (video format for image component)
3. Verify file size is not 0 bytes

## Future Improvements

1. Implement more robust media type detection based on file headers
2. Add server-side image optimization
3. Enhance WebSocket notifications for real-time updates
4. Add automated media repair tools accessible to administrators