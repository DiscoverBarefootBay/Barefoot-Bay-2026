# Vendor Pages Media Upload Fix

## Problem Analysis

After analyzing the codebase, I've identified that media uploads on vendor pages are incorrectly routing to the FORUM bucket instead of the VENDORS bucket in Object Storage. This issue occurs specifically when using the TinyMCE editor on vendor pages.

### Current Behavior:
- When editing a vendor page (e.g., `/vendors/landscaping/timber-creek-grounds`)
- Clicking "Edit page" button (as admin)
- Using the "Insert Media" button and uploading an image
- The image is uploaded to the FORUM bucket instead of the VENDORS bucket
- The resulting image URL has the format: `/api/storage-proxy/direct-forum/media-1746520355351-962241979.png`
- This leads to broken images on vendor pages

### Root Cause:
1. The TinyMCE editor is configured with a hardcoded endpoint (`/api/forum/tinymce-upload`) in `forum-tinymce-config.js`
2. This endpoint is designed specifically for forum content and always stores images in the FORUM bucket
3. The editor context (knowing it's a vendor page) is not being passed to the upload handler
4. There's no specialized TinyMCE upload handler for vendor content

## Solution Plan

The solution involves several components to properly handle media uploads for vendor pages:

### 1. Create a Context-Aware TinyMCE Configuration

Update `forum-tinymce-config.js` to accept a context parameter and use different upload endpoints based on the content type:

```javascript
export function initTinyMCEWithObjectStorage(selector, options = {}, context = {}) {
  // Default upload endpoint
  let uploadEndpoint = '/api/forum/tinymce-upload';
  
  // Determine endpoint based on context
  if (context.section === 'vendors') {
    uploadEndpoint = '/api/vendor/tinymce-upload';
  } else if (context.section) {
    uploadEndpoint = `/api/${context.section}/tinymce-upload`;
  }
  
  // Default configuration
  const defaultConfig = {
    // ... existing config ...
    
    // Configure context-aware image upload handler
    images_upload_handler: function (blobInfo, progress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        
        xhr.open('POST', uploadEndpoint);
        
        // ... rest of existing handler ...
      });
    }
  };
  
  // ... rest of existing function ...
}
```

### 2. Create a Vendor Media Upload Handler

Create a new file `server/vendor-media-upload-handler.ts` following the pattern of the forum media handler:

```typescript
/**
 * Vendor Media Upload Handler
 * 
 * Specialized handler for vendor media uploads through TinyMCE editor
 * Ensures media is stored in Object Storage and returns URLs in the format expected by TinyMCE
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Client } from '@replit/object-storage';
import { BUCKETS } from './object-storage-service';

// Configure temporary storage for vendor uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tmpdir = path.join(os.tmpdir(), 'vendor-uploads');
    fs.mkdirSync(tmpdir, { recursive: true });
    cb(null, tmpdir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'vendor-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const vendorUpload = multer({ storage });

/**
 * Handle vendor media upload from TinyMCE editor
 * This function is specifically designed to work with TinyMCE's expected response format
 */
export async function handleVendorMediaUpload(req: any, res: any) {
  try {
    console.log('[VendorUpload] Processing vendor media upload from TinyMCE editor');
    
    if (!req.file) {
      console.error('[VendorUpload] No file in request');
      return res.status(400).json({
        error: {
          message: 'No file uploaded'
        }
      });
    }
    
    const file = req.file;
    console.log(`[VendorUpload] File received: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
    
    // Create a unique key for the file in Object Storage
    const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const objectKey = `media-${timestamp}-${cleanFilename}`;
    
    console.log(`[VendorUpload] Uploading to Object Storage with key: ${objectKey} in VENDORS bucket`);
    
    // Upload to Object Storage using the client
    const client = new Client();
    
    try {
      // Upload using uploadFromFilename which is available in the client
      const uploadResult = await client.uploadFromFilename(objectKey, file.path, {
        bucketName: BUCKETS.VENDORS,
        contentType: file.mimetype || 'application/octet-stream'
      });
      
      if (!uploadResult.ok) {
        console.error(`[VendorUpload] Upload failed: ${uploadResult.error?.message}`);
        return res.status(500).json({
          error: {
            message: `Upload failed: ${uploadResult.error?.message}`
          }
        });
      }
      
      console.log(`[VendorUpload] Upload successful!`);
      
      // Clean up temporary file
      try {
        fs.unlinkSync(file.path);
        console.log(`[VendorUpload] Cleaned up temporary file: ${file.path}`);
      } catch (cleanupError) {
        console.warn(`[VendorUpload] Failed to clean up temporary file: ${cleanupError.message}`);
      }
      
      // Generate direct and proxy URLs
      const directUrl = `https://object-storage.replit.app/${BUCKETS.VENDORS}/${objectKey}`;
      const proxyUrl = `/api/storage-proxy/${BUCKETS.VENDORS}/${objectKey}`;
      const directVendorUrl = `/api/storage-proxy/direct-vendor/${objectKey}`;
      
      console.log(`[VendorUpload] Generated URLs:
        - Direct: ${directUrl}
        - Proxy: ${proxyUrl}
        - Direct Vendor: ${directVendorUrl}
      `);
      
      // Return TinyMCE-compatible response
      return res.json({
        location: proxyUrl, // TinyMCE expects 'location' property
        urls: {
          direct: directUrl,
          proxy: proxyUrl,
          directVendor: directVendorUrl
        },
        success: true,
        file: {
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        }
      });
      
    } catch (uploadError) {
      console.error('[VendorUpload] Error during upload:', uploadError);
      
      // Clean up the temporary file in case of error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      return res.status(500).json({
        error: {
          message: `Upload processing error: ${uploadError.message}`
        }
      });
    }
    
  } catch (error) {
    console.error('[VendorUpload] Unhandled error:', error);
    return res.status(500).json({
      error: {
        message: `Server error: ${error.message}`
      }
    });
  }
}
```

### 3. Add Vendor Media Upload Endpoint to Server Routes

Update `server/routes.ts` to add a new endpoint for vendor media uploads:

```typescript
// Special endpoint for TinyMCE editor image uploads in vendor pages
app.post("/api/vendor/tinymce-upload", requireAuth, vendorUpload.single('file'), handleVendorMediaUpload);
```

### 4. Update the Wysiwyg Editor Component

Modify the `editable-content.tsx` component to pass the correct context to the TinyMCE editor:

```jsx
<WysiwygEditor 
  editorContent={editorContent}
  setEditorContent={setEditorContent}
  editorContext={{
    section: section || pageSlug?.split('-')?.[0] || 'content',
    slug: pageSlug || slug
  }}
/>
```

### 5. Vendor-Specific Storage Proxy Routes

Add vendor-specific routes to the storage proxy to handle direct vendor media access:

```typescript
// Direct access to vendor media files
router.get('/direct-vendor/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    console.log(`[DirectVendorAccess] Requested: ${filename}`);
    
    if (!filename) {
      console.error('[DirectVendorAccess] No filename provided');
      return res.status(400).send('Filename required');
    }
    
    // Access file from Replit Object Storage
    const client = new Client();
    const key = filename;
    
    console.log(`[DirectVendorAccess] Accessing from Object Storage: ${BUCKETS.VENDORS}/${key}`);
    
    const { data } = await client.get(key, {
      bucketName: BUCKETS.VENDORS
    });
    
    if (!data) {
      console.error(`[DirectVendorAccess] File not found in Object Storage: ${key}`);
      return res.status(404).send('Vendor media file not found');
    }
    
    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    
    res.setHeader('Content-Type', contentType);
    res.send(data);
    
  } catch (error) {
    console.error(`[DirectVendorAccess] Unhandled error: ${error.message}`);
    return res.status(500).send('Internal server error');
  }
});
```

### 6. Update the Media Uploader Component

Ensure the `media-uploader.tsx` component correctly detects and sets the section for vendor pages:

```typescript
// If editor context provides a section, use that
if (editorContext?.section) {
  section = editorContext.section;
} 
// Otherwise determine from URL path
else {
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  if (pathSegments.length > 0) {
    const firstSegment = pathSegments[0].toLowerCase();
    // Map common URL paths to section names
    if (firstSegment === 'forum') section = 'forum';
    else if (firstSegment === 'calendar' || firstSegment === 'events') section = 'calendar';
    else if (firstSegment === 'vendors') section = 'vendors';
    else if (firstSegment === 'real-estate' || firstSegment === 'for-sale') section = 'real-estate';
    else if (firstSegment === 'community') section = 'community';
  }
}

// Use specialized upload endpoints based on section
if (section === 'forum') {
  endpoint = '/api/forum/tinymce-upload';
} else if (section === 'vendors') {
  endpoint = '/api/vendor/tinymce-upload';
} else {
  endpoint = '/api/upload';
}
```

### 7. Import and Configure New Components

Update import statements in relevant files:

```typescript
// In server/routes.ts
import { vendorUpload, handleVendorMediaUpload } from './vendor-media-upload-handler';

// In client/src/components/shared/wysiwyg-editor-direct.tsx
// Update to accept and use context parameter
```

## Implementation Steps

1. Create the vendor media upload handler file
2. Update the TinyMCE configuration to be context-aware
3. Add the vendor upload endpoint to the routes
4. Update the storage proxy to handle vendor media
5. Modify the editable content component to pass the correct context
6. Update the media uploader to use the correct endpoint based on context

## Testing Plan

After implementation, test the following scenarios:

1. Upload an image through the TinyMCE editor on a vendor page
2. Verify the image is stored in the VENDORS bucket (not FORUM)
3. Check that the image URL uses the vendors bucket pattern
4. Verify the image displays correctly on the vendor page
5. Test both admin and regular user views of the vendor page with the image

## Benefits

- Vendor page media will be correctly stored in the VENDORS bucket
- Images will be properly displayed on vendor pages
- Clear separation between different types of media content
- Improved organization in Object Storage
- Consistent URL patterns for each content type

## Conclusion

This fix addresses the root cause of the issue by ensuring that the TinyMCE editor uses the correct upload endpoint based on the content context. By implementing a specialized vendor media upload handler and ensuring the correct context is passed throughout the application, vendor page media will be correctly stored in the VENDORS bucket and properly displayed on vendor pages.