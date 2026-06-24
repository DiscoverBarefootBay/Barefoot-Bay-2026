# Banner Slides Migration to Object Storage

This document explains the migration of banner slides from filesystem storage to Replit Object Storage.

## Background

Banner slides were previously stored in the local filesystem, which caused them to be lost during deployments or container restarts. Moving them to Object Storage ensures persistence across deployments.

## Migration Process

The migration process includes several components:

1. **Migration Script**: `scripts/migrate-banner-slides-to-object-storage.js`
   - Uploads existing banner slide images from filesystem to Object Storage
   - Updates database records to include Object Storage URLs
   - Maintains backward compatibility with filesystem paths

2. **BannerImage Component Updates**:
   - Enhanced with fallback mechanisms to check multiple sources
   - First tries Object Storage URLs 
   - Falls back to filesystem paths if needed
   - Provides clear error states when images cannot be loaded

3. **BannerVideo Component Updates**:
   - Similar enhancements for video content
   - Format validation to ensure proper media type
   - Fallback mechanisms for reliable loading

## Directory Structure

Banner slides are now stored in multiple locations for backward compatibility:

- **Object Storage**: Primary storage in the dedicated `BANNER` bucket
- **Filesystem**: Secondary storage in `/uploads/banner-slides/` and `/banner-slides/`

## Upload Process

New banner uploads now:
1. Save to the filesystem for backward compatibility
2. Also upload directly to Object Storage 
3. Store Object Storage URLs in the database for future use

## Cache Management

A cache-clearing mechanism has been implemented to help users refresh banner media:

- `public/clear-banner-cache.js` provides a client-side cache clearing function
- The BannerImage and BannerVideo components have built-in cache management

## Troubleshooting

If banner slides are not displaying correctly:

1. Clear your browser cache or use the application's cache clearing function
2. Check the browser console for any error messages
3. Try accessing the content through the Banner Diagnostic tool (admin users only)
4. Run the migration script again if needed: `node scripts/migrate-banner-slides-to-object-storage.js`

## Technical Details

- Object Storage paths use format: `https://object-storage.replit.app/BANNER/banner-slides/{filename}`
- Local filesystem paths use format: `/uploads/banner-slides/{filename}`
- The system will automatically try both paths when loading media