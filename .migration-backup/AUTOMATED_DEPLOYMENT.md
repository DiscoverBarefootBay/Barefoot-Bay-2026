# Barefoot Bay Automated Deployment Guide

This document explains the automated deployment process that ensures all media files display correctly in both development and production environments.

## Media Path Normalization

Barefoot Bay uses different path structures between development and production:

- **Development**: Media files are served from `/uploads/category/file.ext`
- **Production**: Media files are served from `/category/file.ext`

This difference was causing broken images in production, especially for:

- Calendar event images
- Banner slide images
- Forum post images
- Vendor page images
- User profile avatars

## Automated Deployment Solution

We've implemented a comprehensive solution with multiple components:

### 1. Pre-Deployment Media Fix Script

The `pre-deployment-media-fix.js` script runs before each deployment and:

- Normalizes all media paths in the database (removing `/uploads/` prefix)
- Ensures all media files exist in both locations (with and without `/uploads/` prefix)
- Creates all necessary directories for media files
- Handles errors gracefully with detailed logging

This script processes the following database tables:
- `events` (mediaUrls)
- `forum_posts` (mediaUrls)
- `forum_comments` (mediaUrls)
- `page_content` (content)
- `content` (content)
- `real_estate_listings` (mediaUrls)
- `users` (avatar_url) - Special handling for avatar files ensures they're stored correctly

### 2. Media Redirect Middleware

The `server/media-redirect-middleware.ts` file provides:

- Real-time path normalization for all API responses
- Intelligent file discovery to serve media from either location
- Special handling for different media types (banners, avatars, etc.)
- Detailed logging for troubleshooting
- Performance optimization with caching headers

### 3. Automated Deployment Script

The `deploy.sh` script orchestrates the deployment process:

1. Verifies database connection
2. Runs the pre-deployment media fix script
3. Builds the application for production
4. Deploys the application

## How to Deploy

Just run the deployment script:

```bash
chmod +x deploy.sh  # Make the script executable (first time only)
./deploy.sh         # Run the deployment
```

## Troubleshooting

If you encounter image loading issues:

1. **Check the database records**: Make sure paths are normalized (without `/uploads/` prefix)
2. **Verify file existence**: Ensure the files exist in both locations
3. **Check server logs**: Look for "Media file not found" errors
4. **Run the fix script manually**: `node pre-deployment-media-fix.cjs`

## Maintenance

When adding new media upload functionality:

1. Ensure the upload directory structure matches existing patterns
2. Update the `pre-deployment-media-fix.cjs` script if needed
3. Test media uploads in both development and production environments

## Technical Details

### Media Path Categories

The system automatically handles these media path patterns:

- `/uploads/calendar/` → `/calendar/`
- `/uploads/banner-slides/` → `/banner-slides/`
- `/uploads/content-media/` → `/content-media/`
- `/uploads/forum-media/` → `/forum-media/`
- `/uploads/vendor-media/` → `/vendor-media/`
- `/uploads/community-media/` → `/community-media/`
- `/uploads/Real Estate/` → `/Real Estate/`
- `/uploads/avatars/` → `/avatars/`

### Security Considerations

- All media paths are validated before processing
- The system only processes known media extensions
- External URLs are preserved as-is
- Error responses exclude sensitive path information