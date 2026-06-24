# Media Migration to Replit Object Storage

This document outlines the migration strategy and process for transitioning the Barefoot Bay community platform's media storage from the filesystem to Replit Object Storage.

## Background

The current media storage approach uses the filesystem, which presents several challenges:

1. Media files don't persist across deployments
2. Storage space is limited on Replit instances
3. Limited scalability for growing media needs
4. Lack of organization and separation between different content types

## Migration Strategy

We are implementing a phased migration approach with multi-bucket storage organization:

### Storage Buckets

Media files are organized into specific buckets by section:

| Bucket | Purpose | Content Types |
|--------|---------|--------------|
| DEFAULT | General assets | User avatars, homepage banner slides, site-wide icons |
| CALENDAR | Calendar section | Event images, calendar media |
| FORUM | Forum section | Forum post and comment images |
| VENDORS | Vendors section | Vendor logos and media |
| SALE | Real estate section | Property images, for-sale item media |
| COMMUNITY | Community section | Community-related media |

### Phased Migration

The migration follows these phases:

1. **Preparation Phase**
   - Schema updates for migration tracking
   - Multi-bucket infrastructure setup
   - Migration script development

2. **Dual Operation Phase**
   - Both storage systems active simultaneously
   - New uploads go to both systems
   - Migration of existing content in batches

3. **Cutover Phase**
   - Verification of migrated content
   - Switch to only using Object Storage
   - Legacy filesystem storage becomes read-only backup

4. **Cleanup Phase**
   - Remove filesystem storage code
   - Optimize for Object Storage-only operation

## Migration Components

### 1. Database Schema

The `migration_records` table tracks the status of each migrated file:

```sql
CREATE TABLE migration_records (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,     -- 'filesystem' or 'postgresql'
  source_location TEXT NOT NULL, -- Original file path or database reference
  media_bucket TEXT NOT NULL,    -- Target bucket in object storage
  media_type TEXT NOT NULL,      -- Media type (calendar, forum, etc.)
  storage_key TEXT NOT NULL,     -- Object storage key
  migration_status TEXT NOT NULL, -- 'pending', 'migrated', 'failed'
  error_message TEXT,            -- Error message if failed
  migrated_at TIMESTAMP,         -- When the file was migrated
  verification_status BOOLEAN DEFAULT FALSE, -- Whether file was verified in storage
  verified_at TIMESTAMP,         -- When the file was verified
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 2. Migration Services

Key services for the migration process:

- **Object Storage Service** (`server/object-storage-service.ts`)
  - Handles interactions with Replit Object Storage
  - Manages bucket selection and file operations
  - Provides APIs for uploading, retrieving, and verifying files

- **Migration Service** (`server/migration-service.ts`)
  - Tracks migration status
  - Manages migration records in the database
  - Provides tools for verifying migrated content

- **Media Upload Middleware** (`server/media-upload-middleware.ts`)
  - Handles new file uploads
  - Writes to both filesystem and Object Storage during transition
  - Selects appropriate bucket based on content type

- **Base64 Image Processor** (`server/base64-image-processor.ts`)
  - Extracts Base64 images from page content
  - Converts Base64 data to image files
  - Uploads to appropriate Object Storage bucket
  - Updates content with proper URLs
  - See [BASE64_IMAGE_HANDLING.md](./BASE64_IMAGE_HANDLING.md) for details

### 3. Migration Scripts

Specialized scripts for different content types:

- **Default Assets Migration** (`migrate-default-assets.js`)
  - Migrates avatars, banner slides, and site-wide icons
  - Prioritized first as these are most critical for site appearance

- **Section Media Migration** (`migrate-section-media.js`)
  - Handles section-specific content (Calendar, Forum, Vendors, etc.)
  - Can target specific sections or run for all

## Migration Execution

### Prerequisites

- Ensure PostgreSQL database is running
- Replit Object Storage must be enabled
- Commander package for CLI arguments

### Running Migrations

1. **Default Assets Migration**

   ```bash
   # Migrate all default assets (avatars, banner slides, icons)
   node migrate-default-assets.js
   
   # Dry run to see what would be migrated without making changes
   node migrate-default-assets.js --dry-run
   
   # Verify previously migrated files
   node migrate-default-assets.js --verify
   
   # Control batch size to manage memory usage
   node migrate-default-assets.js --batch-size=25
   ```

2. **Section-Specific Migration**

   ```bash
   # Migrate all sections
   node migrate-section-media.js
   
   # Migrate only calendar section
   node migrate-section-media.js --section=calendar
   
   # Verify migrations for vendors section
   node migrate-section-media.js --section=vendors --verify
   
   # Dry run for forum section
   node migrate-section-media.js --section=forum --dry-run
   ```

## Verification Process

Each migrated file has a verification step to ensure content integrity:

1. **Initial Migration**: File is uploaded and marked as `MIGRATED`
2. **Verification**: The system checks if the file exists and is accessible in Object Storage
3. **Verification Status**: Once verified, `verification_status` is set to `true`
4. **Reporting**: Migration statistics show total, migrated, failed, and verified counts

## Rollback Plan

If issues arise during migration:

1. Keep the filesystem storage enabled
2. Fix any identified issues with Object Storage
3. Re-run migrations with the `--verify` flag
4. If necessary, continue using filesystem storage until all issues are resolved

## Post-Migration Maintenance

After successful migration:

1. Implement a cleanup script to remove files from filesystem that are verified in Object Storage
2. Update code to prioritize Object Storage URLs over filesystem URLs
3. Monitor storage usage and implement lifecycle policies if needed
4. Consider implementing automated verification periodic checks

## Troubleshooting

Common issues and solutions:

- **Failed Migrations**: Check the `error_message` in migration records
- **Missing Files**: Run verification to identify any files not properly migrated
- **Performance Issues**: Adjust batch sizes to balance speed and resource usage
- **URL Updates**: Ensure all parts of the application use the correct media URLs

## Conclusion

This phased migration approach ensures a smooth transition to Replit Object Storage with minimal disruption to the platform. By organizing content into purpose-specific buckets, we improve organization, scalability, and maintainability of the media storage system.