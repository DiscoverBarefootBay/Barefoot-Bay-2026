# Media Persistence in Barefoot Bay

This document describes how media files are preserved during deployments in the Barefoot Bay community platform.

## Overview

When deploying the application, user-uploaded media files (like banner slides, forum images, and profile avatars) are not automatically included in the deployment. This is because Replit deployments focus on code, not user-generated content.

This solution implements a system that:

1. Backs up all media files to the PostgreSQL database before deployment
2. Restores them after deployment completes
3. Verifies and fixes any path references in the database

## How It Works

### Media Backup Process (Pre-Deployment)

1. The `pre-deploy.mjs` script is executed via the `preDeploy()` hook in `deploy-hooks.mjs`
2. The script:
   - Creates a `media_files` table in PostgreSQL if it doesn't exist
   - Scans all media directories for files
   - For each file, saves its binary data, path, size, and MIME type to the database
   - Skips files that haven't changed since the last backup

### Media Restore Process (Post-Deployment)

1. The `post-deploy.mjs` script is executed via the `postDeploy()` hook in `deploy-hooks.mjs`
2. The script:
   - Restores all media files from the database to their original locations
   - Verifies banner slide references and fixes any mismatches
   - Verifies forum media references and fixes any mismatches
   - Verifies avatar URLs and fixes any mismatches

### Path Verification

The system handles two types of paths for each media category:
- `/media-type/filename.ext` (e.g., `/banner-slides/slide1.jpg`)
- `/uploads/media-type/filename.ext` (e.g., `/uploads/banner-slides/slide1.jpg`)

During verification, if a file is referenced but doesn't exist at the expected path, the system:
1. Checks if it exists at the alternative path
2. Copies the file to the missing location if found
3. Updates the database references if needed

## Implementation Details

### Core Components

1. **DatabaseStorage Class** (`server/storage.ts`)
   - Contains methods for backing up, restoring, and verifying media
   - Implements the `IStorage` interface

2. **Deployment Scripts**
   - `deploy-scripts/pre-deploy.mjs`: Backs up media before deployment
   - `deploy-scripts/post-deploy.mjs`: Restores media after deployment

3. **Deployment Hooks** (`deploy-hooks.mjs`)
   - Exports `preDeploy()` and `postDeploy()` functions
   - Called automatically during the deployment process

### Key Methods

- `backupMediaFilesToDatabase()`: Backs up all media files to PostgreSQL
- `restoreMediaFilesFromDatabase()`: Restores media files from PostgreSQL
- `verifyBannerSlidePaths()`: Checks and fixes banner slide references
- `verifyForumMediaPaths()`: Checks and fixes forum media references
- `verifyAvatarPaths()`: Checks and fixes avatar URL references

## Testing

### Manual Testing Process

To test the media persistence functionality:

1. **Test Media Backup:**
   ```bash
   node deploy-scripts/pre-deploy.mjs
   ```
   This will back up all media files to the database.

2. **Simulate Deployment by Removing Files:**
   ```bash
   # Don't actually run this in production!
   mv banner-slides banner-slides-backup
   mv uploads/banner-slides uploads/banner-slides-backup
   ```

3. **Test Media Restore:**
   ```bash
   node deploy-scripts/post-deploy.mjs
   ```
   This will restore all files and verify references.

4. **Verify File Integrity:**
   ```bash
   # Check file sizes match
   ls -la banner-slides
   ls -la banner-slides-backup
   ```

### Expected Results

- All files should be restored to their original locations
- File sizes should match the originals
- Media should display correctly in the application

## Troubleshooting

### Common Issues

1. **Database Connection Errors:**
   - Ensure `DATABASE_URL` environment variable is set correctly
   - Check if PostgreSQL is running and accessible

2. **File Permission Issues:**
   - Ensure the application has write access to media directories
   - Check directory permissions with `ls -la`

3. **Missing Files After Restore:**
   - Check database records: `SELECT COUNT(*) FROM media_files;`
   - Verify restoration error logs in the console output

### Diagnostic Commands

```sql
-- Check media files table
SELECT COUNT(*) FROM media_files;

-- Check file sizes
SELECT SUM(file_size) FROM media_files;

-- Check specific media types
SELECT directory, COUNT(*), SUM(file_size) FROM media_files GROUP BY directory;
```

## Professional Alternatives

In a production environment, consider these alternatives:

1. **Object Storage Solutions:**
   - AWS S3
   - Google Cloud Storage
   - Azure Blob Storage

2. **Content Delivery Networks (CDNs):**
   - Cloudflare
   - Akamai
   - Fastly

3. **Persistent Volumes:**
   - Kubernetes PersistentVolumes
   - Docker volumes

These solutions provide better scalability and reliability for media storage but require additional setup and potentially cost more to implement.

## Conclusion

This media persistence solution ensures that user-uploaded files are preserved across deployments, maintaining a consistent user experience without manual intervention.