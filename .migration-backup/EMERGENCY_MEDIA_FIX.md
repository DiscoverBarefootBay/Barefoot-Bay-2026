# Emergency Media Path Fix for Barefoot Bay

This document outlines the emergency fixes implemented to address media path issues across the Barefoot Bay community platform, with special attention to banner slides that disappear in production.

## Root Causes Identified

1. **Path Format Inconsistency**: In production, media paths need to be in the format `/category/file.jpg` instead of `/uploads/category/file.jpg`.

2. **File Location Issues**: Files uploaded to development paths like `/uploads/banner-slides/` weren't being properly copied to production paths like `/banner-slides/`.

3. **Missing Error Handling**: When banner images were missing, the application would break with "Media content unavailable" errors.

## Implemented Solutions

### 1. Database Record Normalization

- Updated all database records to use normalized paths (removal of `/uploads/` prefix)
- Ensured all references in page_contents for banner slides use `/banner-slides/` format

### 2. Specialized Banner Slides Fix

- Created `fix-banner-slides.js` script to:
  - Copy all banner slide files from `/uploads/banner-slides/` to `/banner-slides/`
  - Fix any incorrect paths in the database
  - Detect all referenced banner images and ensure they exist

### 3. Error Handling Middleware

- Added specialized `banner-slides-error-handler.ts` middleware that:
  - Intercepts requests for missing banner images
  - Serves a placeholder image when the requested banner image doesn't exist
  - Prevents the application from breaking when banner images are missing

### 4. Deployment Process Update

- Updated `deploy.sh` to include banner slides fix in the deployment process
- Added error handling to continue deployment even if some banner images aren't found

## Usage Instructions

### Emergency Fix When Images Disappear

If banner images suddenly disappear in production:

1. Run the emergency fix script:
   ```
   node fix-banner-slides.js
   ```

2. Check the generated log file `banner-slides-fix-log.txt` for diagnostic information

### Pre-Deployment Preparation

Before deploying to production, always run:
```
./deploy.sh
```

This will automatically handle all media path normalization and ensure banner slides display correctly.

## Technical Details

### Banner Slides Error Handler

The `banner-slides-error-handler.ts` middleware detects requests for missing banner slide images and serves a placeholder image. This prevents the application from breaking when:

1. A banner slide references an image that doesn't exist
2. The banner slide database record contains an invalid image path
3. The image file was deleted or corrupted

This middleware is loaded early in the Express middleware chain to intercept all banner slide image requests.

### Banner Slides Fix Script

The `fix-banner-slides.js` script:

1. Copies all files from `/uploads/banner-slides/` to `/banner-slides/`
2. Updates database records to use the correct path format
3. Intelligent detection of all referenced banner images
4. Comprehensive logging to diagnose and fix issues

## Troubleshooting

If banner slide images are still missing after running the fix script:

1. Check `banner-slides-fix-log.txt` for errors or warnings
2. Verify that the production `/banner-slides/` directory exists and is writable
3. Ensure the database record in `page_contents` has the correct path format
4. Manually upload a replacement image if needed

## Future Improvements

1. Add monitoring to detect and auto-fix media path issues
2. Implement a content validation system to prevent invalid image references
3. Extend error handling to other media types
