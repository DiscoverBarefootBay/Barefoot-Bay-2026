# Media Path Management in Barefoot Bay

This document explains how media paths are managed in the Barefoot Bay application to ensure consistent and reliable image display across both development and production environments.

## The Problem

Media files in the Barefoot Bay application were experiencing a recurring issue where:

1. Images would work correctly in development but disappear in production
2. Files could be accessed via multiple paths (e.g., `/uploads/real-estate-media/image.jpg` or `/real-estate-media/image.jpg`)
3. Overnight maintenance tasks or CDN deployments would cause images to become unavailable without any code changes

The root cause appears to be differences in how the development and production environments handle file paths and permissions, combined with potential maintenance processes that modify the file system structure.

## Our Solution

We've implemented a multi-layered approach to ensure media files remain accessible regardless of environment:

### 1. Client-Side Enhancements

- **SmartImage Component**: A specialized React component that tries multiple path formats when loading images
  - Location: `client/src/components/shared/smart-image.tsx`
  - Features:
    - Attempts different path formats (with/without `/uploads/` prefix)
    - Falls back to alternative paths if the primary one fails
    - Adds production domain fallbacks when needed
    - Provides a placeholder for missing images

- **ForumContent Component**: Extends the SmartImage concept to rich HTML content in forum posts
  - Location: `client/src/components/forum/forum-content.tsx`
  - Features:
    - Parses HTML content and replaces standard `<img>` tags with SmartImage
    - Handles embedded media in forum posts

- **Specialized Variants**: Custom components for specific use cases
  - ListingImage: For real estate listings with appropriate dimensions
  - BannerImage: For banner slides with optimal sizing
  - AvatarImage: For user avatars with consistent proportions

### 2. Server-Side Scripts

- **fix-all-media-paths.js**: Regular maintenance script for development and production
  - Purpose: Ensures files exist in both path formats and updates database records
  - Features:
    - Syncs files between directories (`/dir` and `/uploads/dir`)
    - Updates database records to use consistent paths
    - Can be run manually or automatically via cron

- **deploy-media-fixes.js**: Production-specific deployment script
  - Purpose: Additional measures for production environment
  - Features:
    - Creates symbolic links between directories for efficiency
    - Sets appropriate file permissions (chmod 755)
    - Adds .htaccess configurations for symlinks
    - Creates client-side cache-clearing scripts

### 3. Database Consistency

All media paths in the database are normalized to use a consistent format:
- Always start with a leading slash (`/`)
- Generally use the format `/<directory>/<filename>` (e.g., `/real-estate-media/house.jpg`)
- Avoid using `/uploads/` prefix in database records
- Maintain URLs with the `http://` or `https://` prefix unchanged

### 4. Cache Management

- Client-side cache clearing script for users experiencing media issues
- Located at: `/public/clear-media-cache.js`
- Can be directly included in HTML with: `/public/include-cache-clear.js`

## Usage Guide

### For Developers

1. **Adding New Media**: When adding new media files to the application:
   - Add them to the appropriate directory (e.g., `real-estate-media/`)
   - Use the SmartImage component to display them
   - Store paths in a consistent format in the database (starting with a leading slash)

2. **Troubleshooting Missing Images**:
   - Run `node fix-all-media-paths.js --update-db` to sync directories and update database
   - Check file permissions in production (should be 755)
   - Verify that both path formats exist (with and without `/uploads/` prefix)

3. **Adding New Media Directories**:
   - Add the new directory to the `MEDIA_DIRECTORIES` array in both scripts
   - Create both versions of the directory (`/dir` and `/uploads/dir`)
   - Update any relevant components to handle the new path format

### For Production Deployment

1. **Initial Deployment**:
   - Run `node deploy-media-fixes.js` during deployment
   - Ensure server has permissions to create symbolic links and set file permissions
   - Check that the cron job is set up correctly

2. **Regular Maintenance**:
   - The cron job should run `fix-all-media-paths.js --update-db --production` every 12 hours
   - Monitor logs for any errors during execution

3. **After CMS Updates/Media Uploads**:
   - Run `node fix-all-media-paths.js --update-db --production` to ensure new media is synced
   - This is especially important after bulk uploads or content migrations

## Technical Details

### Directory Structure

Media files should exist in both formats for maximum compatibility:
```
/real-estate-media/house.jpg
/uploads/real-estate-media/house.jpg
```

In production, these are typically linked using symbolic links to save space.

### Media Directories

The application manages the following media directories:
- `real-estate-media`: For property listings
- `forum-media`: For forum post attachments
- `content-media`: For general content pages
- `vendor-media`: For vendor listings
- `calendar`: For calendar event images
- `banner-slides`: For homepage banner slides
- `avatars`: For user profile pictures

### SmartImage Path Resolution

When displaying an image, the SmartImage component tries these paths in order:
1. Original path as provided
2. Path with `/uploads/` added (if missing) or removed (if present)
3. Path with specific directory format optimizations
4. Full domain path (in production): `https://barefootbay.com/path/to/image.jpg`

This ensures that images will display correctly regardless of how they're stored.

## Troubleshooting

### Common Issues

1. **Images missing in production but not development**:
   - Check that the deploy-media-fixes.js script has been run in production
   - Verify symbolic links are working correctly
   - Ensure file permissions are set to 755

2. **Images missing in specific components**:
   - Check that the component is using SmartImage
   - Verify the database path is in the correct format

3. **New media directories not working**:
   - Ensure the directory is added to MEDIA_DIRECTORIES in both scripts
   - Check that both path formats exist
   - Verify permissions are correct

### Debug Steps

1. Inspect the network requests in browser dev tools to see which paths are being attempted
2. Check server logs for permission errors
3. Run fix-all-media-paths.js with --dry-run to see what changes would be made
4. Verify file exists in both expected locations

## Future Improvements

Potential enhancements to consider:
- Centralized media management system with consistent paths
- Content delivery network (CDN) with proper cache invalidation
- Database-driven media registry to track all file locations