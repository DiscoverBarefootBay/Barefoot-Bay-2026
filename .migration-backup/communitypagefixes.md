# Community Page Media Upload Fix

## Problem Analysis

After analyzing the codebase, I've identified that media uploads on community pages are incorrectly routing to the FORUM bucket instead of the COMMUNITY bucket in Object Storage. This issue occurs specifically when using the TinyMCE editor on community pages.

### Current Behavior:
- When editing a community page (e.g., `/community/community/history`)
- Clicking "Edit page" button (as admin)
- Using the "Insert Media" button and uploading an image
- The image is uploaded to the FORUM bucket instead of the COMMUNITY bucket
- The resulting image URL has the format: `/api/storage-proxy/direct-forum/media-1746536227344-727572656.png`
- This leads to broken images on community pages

### Root Cause:
1. The TinyMCE editor configuration doesn't correctly identify the page as a "community" page
2. The existing editor context detection in `editable-content.tsx` splits the slug to determine section, but this doesn't correctly handle community pages
3. The editorContext isn't being set correctly with `section: 'community'`
4. No community-specific TinyMCE upload endpoint exists in routes.ts

### Technical Details:
1. The forum-tinymce-config.js file has logic to choose endpoints based on section:
```javascript
if (context.section === 'vendors') {
  uploadEndpoint = '/api/vendor/tinymce-upload';
} else if (context.section) {
  uploadEndpoint = `/api/${context.section}/tinymce-upload`;
} else {
  uploadEndpoint = '/api/forum/tinymce-upload'; // Default endpoint
}
```

2. Community pages are added in App.tsx as:
```jsx
<ProtectedRoute path="/community/community" component={() => <GenericContentPage />} requiredFeature="COMMUNITY" />
<ProtectedRoute path="/community/community/:page" component={GenericContentPage} requiredFeature="COMMUNITY" />
```

3. In editable-content.tsx, the WysiwygEditor component receives an editorContext:
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
   The issue is that community pages have slugs like "community-history", which results in section being "community" but the URL path shows "/community/community/history" which conflicts with the detection logic.

## Solution Plan

The solution requires several components to properly handle media uploads for community pages:

### 1. Create a Community Media Upload Handler

Create a new file `server/community-media-upload-handler.ts` following the pattern of the vendor and forum media handlers:

```typescript
/**
 * Community Media Upload Handler
 * 
 * Specialized handler for community media uploads through TinyMCE editor
 * Ensures media is stored in the COMMUNITY bucket in Object Storage and returns URLs in the format expected by TinyMCE
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Client } from '@replit/object-storage';
import { BUCKETS } from './object-storage-service';

// Configure temporary storage for community uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tmpdir = path.join(os.tmpdir(), 'community-uploads');
    fs.mkdirSync(tmpdir, { recursive: true });
    cb(null, tmpdir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'community-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const communityUpload = multer({ storage });

/**
 * Handle media uploads from TinyMCE editor for community pages
 * This function processes the uploaded file, stores it in Object Storage, and returns the URL
 */
export const handleCommunityMediaUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded',
        location: ''
      });
    }
    
    const file = req.file;
    console.log(`Processing community media upload: ${file.originalname} (${file.size} bytes)`);
    
    // Initialize Object Storage client
    const client = new Client();
    
    // Create the community media folder if it doesn't exist
    const communityMediaDir = path.join(process.cwd(), 'community-media');
    if (!fs.existsSync(communityMediaDir)) {
      fs.mkdirSync(communityMediaDir, { recursive: true });
    }
    
    // Generate a filename and path for the file
    const filename = `community-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const filePath = path.join(communityMediaDir, filename);
    
    // Copy the file from the temporary location to the community media directory
    fs.copyFileSync(file.path, filePath);
    
    try {
      // Upload to Object Storage using the COMMUNITY bucket
      const objectKey = `community/${filename}`;
      const fileContent = fs.readFileSync(file.path);
      
      await client.putObject({
        bucket: BUCKETS.COMMUNITY,
        key: objectKey,
        body: fileContent
      });
      
      console.log(`Successfully uploaded community media to Object Storage: ${objectKey}`);
      
      // Return the response for TinyMCE in the format it expects
      return res.json({
        location: `/api/storage-proxy/direct-community/${filename}`
      });
    } catch (error) {
      console.error(`Error uploading to Object Storage: ${error.message || error}`);
      
      // Fallback to filesystem URL if Object Storage upload fails
      console.log(`Using filesystem fallback for ${filename}`);
      return res.json({
        location: `/community-media/${filename}`
      });
    }
  } catch (error) {
    console.error(`Error in community media upload: ${error.message || error}`);
    return res.status(500).json({
      message: 'Server error during upload',
      location: ''
    });
  }
};
```

### 2. Add Community Media Upload Endpoint to Server Routes

Update `server/routes.ts` to add a new endpoint for community media uploads:

```typescript
// Import the community media upload handler
import { communityUpload, handleCommunityMediaUpload } from './community-media-upload-handler';

// (Later in the routes section)
// Special endpoint for TinyMCE editor image uploads in community pages
app.post("/api/community/tinymce-upload", requireAuth, communityUpload.single('file'), handleCommunityMediaUpload);
```

### 3. Update the Editable Content Component

Modify the logic in `editable-content.tsx` to correctly detect community page sections:

```typescript
// In the editable-content.tsx file, update the editorContext section in the WysiwygEditor component

// Determine if this is a community page based on URL path or slug
const isCommunityPage = window.location.pathname.startsWith('/community/');
const communitySection = isCommunityPage ? 'community' : null;

<WysiwygEditor 
  editorContent={editorContent}
  setEditorContent={setEditorContent}
  editorContext={{
    // First check if it's a community page by URL path, then try slug detection
    section: communitySection || section || pageSlug?.split('-')?.[0] || 'content',
    slug: pageSlug || slug
  }}
/>
```

### 4. Enhance the TinyMCE Configuration

Make sure that the TinyMCE configuration correctly logs and handles the community section:

```javascript
// In forum-tinymce-config.js, update or add logging for community pages
if (context.section === 'community') {
  console.log('Using community media upload endpoint for TinyMCE editor');
  uploadEndpoint = '/api/community/tinymce-upload';
} else if (context.section === 'vendors') {
  console.log('Using vendor media upload endpoint for TinyMCE editor');
  uploadEndpoint = '/api/vendor/tinymce-upload';
} 
// ... rest of existing conditions
```

### 5. Add Storage Proxy Support for Community Media

Ensure the storage proxy middleware correctly handles direct-community paths:

```typescript
// In the appropriate storage proxy middleware file:
// Add explicit handling for direct-community URLs

if (requestPath.startsWith('/api/storage-proxy/direct-community/')) {
  const key = requestPath.replace('/api/storage-proxy/direct-community/', '');
  const objectPath = `community/${key}`;
  
  try {
    const data = await client.getObject({
      bucket: BUCKETS.COMMUNITY,
      key: objectPath
    });
    
    // Set content type and other headers
    // ... 
    
    return res.send(data.body);
  } catch (error) {
    console.error(`Error retrieving community media from Object Storage: ${error.message}`);
    // Attempt fallback to filesystem
    return handleFileSystemFallback(res, 'community-media', key);
  }
}
```

### 6. Create Local Fallback Directory

Create the community-media directory for local fallbacks:

```typescript
// In server startup or initialization code:
const communityMediaDir = path.join(process.cwd(), 'community-media');
if (!fs.existsSync(communityMediaDir)) {
  fs.mkdirSync(communityMediaDir, { recursive: true });
  console.log(`Created community media directory: ${communityMediaDir}`);
}
```

### 7. Update Media Type to Bucket Mapping

Ensure the community media type is properly mapped to the COMMUNITY bucket:

```typescript
// In object-storage-service.ts or appropriate file
const MEDIA_TYPE_TO_BUCKET = {
  // existing mappings...
  "community": BUCKETS.COMMUNITY,
  "community_page": BUCKETS.COMMUNITY
};
```

## Implementation Steps

1. Create the community media upload handler file
2. Update the TinyMCE configuration to explicitly handle community context
3. Add the community upload endpoint to the routes
4. Update the storage proxy to handle community media
5. Modify the editable content component to properly detect community pages
6. Create the community-media directory for filesystem fallbacks
7. Update media type mappings if needed

## Testing Plan

After implementation, test the following scenarios:

1. Upload an image through the TinyMCE editor on a community page
2. Verify the image is stored in the COMMUNITY bucket (not FORUM)
3. Check that the image URL uses the COMMUNITY bucket pattern
4. Verify the image displays correctly on the community page
5. Test both admin and regular user views of the community page with the image

## Benefits

- Community page media will be correctly stored in the COMMUNITY bucket
- Images will be properly displayed on community pages
- Clear separation between different types of media content
- Improved organization in Object Storage
- Consistent URL patterns for each content type

## Conclusion

This fix addresses the root cause of the issue by ensuring that the TinyMCE editor correctly identifies community pages and uses the appropriate upload endpoint. By implementing a specialized community media upload handler and ensuring the correct context is passed throughout the application, community page media will be correctly stored in the COMMUNITY bucket and properly displayed on community pages.