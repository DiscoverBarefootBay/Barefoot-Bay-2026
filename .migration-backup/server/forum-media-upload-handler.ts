/**
 * Forum Media Upload Handler
 * 
 * Specialized handler for forum media uploads through TinyMCE editor
 * Ensures media is stored in Object Storage and returns URLs in the format expected by TinyMCE
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Client } from '@replit/object-storage';
import { BUCKETS } from './object-storage-service';

// Configure temporary storage for forum uploads
const tempStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    // Create temporary directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'forum-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Create multer upload instance
export const forumUpload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 350 * 1024 * 1024 // 350MB limit for forum media (increased from 20MB)
  },
  fileFilter: (_req, file, cb) => {
    // Allow images, videos, and audio for forum uploads
    const allowedTypes = [
      // Image types
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Video types
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv',
      // Audio types
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`[ForumUpload] Rejected file with mimetype: ${file.mimetype}`);
      cb(new Error('Only image, video, and audio files are allowed for forum posts'));
    }
  }
});

/**
 * Handle forum media upload from TinyMCE editor
 * This function is specifically designed to work with TinyMCE's expected response format
 */
export async function handleForumMediaUpload(req: any, res: any) {
  try {
    console.log('[ForumUpload] Processing forum media upload from TinyMCE editor');
    
    if (!req.file) {
      console.error('[ForumUpload] No file in request');
      return res.status(400).json({
        error: {
          message: 'No file uploaded'
        }
      });
    }
    
    const file = req.file;
    console.log(`[ForumUpload] File received: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
    
    // Create a unique key for the file in Object Storage
    // Use only the original filename plus timestamp to keep it clean
    const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    // Important: Don't use nested "forum/" in the key since the FORUM bucket already
    // indicates that it's forum content. This prevents the "forum/forum/" nesting issue.
    const objectKey = `media-${timestamp}-${cleanFilename}`;
    
    console.log(`[ForumUpload] Uploading to Object Storage with key: ${objectKey} in FORUM bucket`);
    
    // Upload to Object Storage using the client
    const client = new Client();
    
    try {
      // Upload using uploadFromFilename which is available in the client
      const uploadResult = await client.uploadFromFilename(objectKey, file.path, {
        bucketName: BUCKETS.FORUM,
        contentType: file.mimetype,
        headers: {
          'X-Obj-Bucket': BUCKETS.FORUM,
          'Content-Type': file.mimetype
        }
      });
      
      // Clean up the temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`[ForumUpload] Temporary file removed: ${file.path}`);
      }
      
      if (!uploadResult.ok) {
        console.error(`[ForumUpload] Upload failed: ${uploadResult.error.message}`);
        return res.status(500).json({
          error: {
            message: `Upload to storage failed: ${uploadResult.error.message}`
          }
        });
      }
      
      // Generate URLs for the uploaded file
      // TinyMCE expects a specific response format with a 'location' property
      const directUrl = `https://object-storage.replit.app/${BUCKETS.FORUM}/${objectKey}`;
      // Use direct access to Replit Object Storage (no nested forum/ prefix)
      const proxyUrl = `/api/storage-proxy/direct-forum/${objectKey}`;
      // Fallback URL uses the same pattern
      const directForumUrl = `/api/storage-proxy/direct-forum/${objectKey}`;
      
      console.log(`[ForumUpload] Upload successful. URLs:
        - direct: ${directUrl}
        - proxy: ${proxyUrl}
        - directForum: ${directForumUrl}
      `);
      
      // TinyMCE expects a specific response format
      return res.status(200).json({
        location: proxyUrl, // Primary URL used by TinyMCE
        url: proxyUrl,      // Alternative URL property
        urls: {
          direct: directUrl,
          proxy: proxyUrl,
          directForum: directForumUrl
        },
        success: true,
        file: {
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        }
      });
      
    } catch (uploadError) {
      console.error('[ForumUpload] Error during upload:', uploadError);
      
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
    console.error('[ForumUpload] Unhandled error:', error);
    return res.status(500).json({
      error: {
        message: `Server error: ${error.message}`
      }
    });
  }
}

/**
 * Handle multiple forum media uploads
 * This function is designed to work with the enhanced media gallery feature
 */
export async function handleMultipleForumMediaUpload(req: any, res: any) {
  try {
    console.log('[ForumUpload] Processing multiple forum media uploads');
    
    if (!req.files || req.files.length === 0) {
      console.error('[ForumUpload] No files in request');
      return res.status(400).json({
        error: {
          message: 'No files uploaded'
        }
      });
    }
    
    console.log(`[ForumUpload] ${req.files.length} files received`);
    
    // Upload to Object Storage using the client
    const client = new Client();
    const uploadResults = [];
    
    // Process each file sequentially
    for (const file of req.files) {
      try {
        console.log(`[ForumUpload] Processing file: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
        
        // Create a unique key for the file in Object Storage
        const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        const randomId = Math.round(Math.random() * 1000000);
        const objectKey = `media-${timestamp}-${randomId}-${cleanFilename}`;
        
        console.log(`[ForumUpload] Uploading to Object Storage with key: ${objectKey} in FORUM bucket`);
        
        // Determine media type based on mimetype
        let mediaType = 'image'; // default
        if (file.mimetype.startsWith('video/')) {
          mediaType = 'video';
        } else if (file.mimetype.startsWith('audio/')) {
          mediaType = 'audio';
        }
        
        // Upload using uploadFromFilename
        const uploadResult = await client.uploadFromFilename(objectKey, file.path, {
          bucketName: BUCKETS.FORUM,
          contentType: file.mimetype,
          headers: {
            'X-Obj-Bucket': BUCKETS.FORUM,
            'Content-Type': file.mimetype
          }
        });
        
        // Clean up the temporary file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log(`[ForumUpload] Temporary file removed: ${file.path}`);
        }
        
        if (!uploadResult.ok) {
          console.error(`[ForumUpload] Upload failed for ${file.originalname}: ${uploadResult.error.message}`);
          uploadResults.push({
            success: false,
            originalName: file.originalname,
            error: uploadResult.error.message
          });
          continue;
        }
        
        // Generate URLs for the uploaded file
        const directUrl = `https://object-storage.replit.app/${BUCKETS.FORUM}/${objectKey}`;
        const proxyUrl = `/api/storage-proxy/direct-forum/${objectKey}`;
        
        console.log(`[ForumUpload] Upload successful for ${file.originalname}. URL: ${proxyUrl}`);
        
        uploadResults.push({
          success: true,
          originalName: file.originalname,
          url: proxyUrl,
          directUrl: directUrl,
          mediaType: mediaType,
          size: file.size
        });
        
      } catch (fileError) {
        console.error(`[ForumUpload] Error processing file ${file.originalname}:`, fileError);
        
        // Clean up the temporary file in case of error
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        
        uploadResults.push({
          success: false,
          originalName: file.originalname,
          error: fileError.message
        });
      }
    }
    
    // Return the results
    const successfulUploads = uploadResults.filter(result => result.success);
    
    if (successfulUploads.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload any files',
        errors: uploadResults.filter(r => !r.success).map(r => r.error)
      });
    }
    
    return res.status(200).json({
      success: true,
      files: uploadResults,
      totalFiles: req.files.length,
      successfulUploads: successfulUploads.length,
      failedUploads: req.files.length - successfulUploads.length
    });
    
  } catch (error) {
    console.error('[ForumUpload] Unhandled error in multiple upload:', error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
}