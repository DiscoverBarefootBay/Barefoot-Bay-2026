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
import { createObjectStorageClient } from './lib/object-storage-client';
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
    // Log the request information
    console.log('=== COMMUNITY MEDIA UPLOAD REQUEST RECEIVED ===');
    console.log(`Path: ${req.path}`);
    console.log(`Method: ${req.method}`);
    console.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
    console.log(`Body: ${JSON.stringify(req.body || {}, null, 2)}`);
    console.log(`Query: ${JSON.stringify(req.query || {}, null, 2)}`);
    console.log(`File: ${req.file ? 'Present' : 'Missing'}`);
    
    if (!req.file) {
      console.log('ERROR: No file was included in the upload request!');
      return res.status(400).json({
        message: 'No file uploaded',
        location: ''
      });
    }
    
    const file = req.file;
    console.log(`Processing community media upload: ${file.originalname} (${file.size} bytes)`);
    
    // Generate a unique filename for the file
    const filename = `community-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    
    try {
      // Initialize Object Storage client
      const client = createObjectStorageClient();
      
      // Upload to Object Storage using the COMMUNITY bucket
      const objectKey = `community/${filename}`;
      const fileContent = fs.readFileSync(file.path);
      
      console.log(`Uploading community media to Object Storage: ${objectKey} in bucket ${BUCKETS.COMMUNITY}`);
      
      const uploadResult = await client.uploadFromFilename(objectKey, file.path, {
        bucketName: BUCKETS.COMMUNITY,
        headers: {
          'X-Obj-Bucket': BUCKETS.COMMUNITY
        }
      });
      
      if (!uploadResult.ok) {
        throw new Error(`Upload failed: ${uploadResult.error?.message || 'Unknown error'}`);
      }

      // Verify the file actually exists in the bucket before returning a URL
      // the editor will embed in DB content (task #103).
      const existsResult = await client.exists(objectKey, {
        bucketName: BUCKETS.COMMUNITY,
        headers: { 'X-Obj-Bucket': BUCKETS.COMMUNITY }
      });
      if (!existsResult.ok || !existsResult.value) {
        throw new Error(`Verification failed: ${objectKey} not found in COMMUNITY bucket after upload`);
      }

      console.log(`Successfully uploaded community media to Object Storage: ${objectKey}`);
      
      // Clean up temporary file
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        const cleanupMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        console.warn(`Failed to clean up temp file: ${cleanupMsg}`);
      }
      
      // Return the response for TinyMCE in the format it expects
      const responseUrl = `/api/storage-proxy/direct-community/${filename}`;
      console.log(`Community media upload successful, returning URL: ${responseUrl}`);
      
      return res.json({
        location: responseUrl,
        url: responseUrl
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error uploading to Object Storage: ${msg}`);
      
      // Clean up temporary file in case of error
      try {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupError) {
        const cleanupMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        console.warn(`Failed to clean up temp file after error: ${cleanupMsg}`);
      }
      
      // Return error response
      return res.status(500).json({
        message: 'Failed to upload media to storage',
        location: '',
        url: ''
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error in community media upload: ${msg}`);
    return res.status(500).json({
      message: 'Server error during upload',
      location: '',
      url: ''  // Include empty url property for consistency
    });
  }
};