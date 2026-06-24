/**
 * Vendor Media Upload Handler
 * 
 * Specialized handler for vendor media uploads through TinyMCE editor
 * Ensures media is stored in the VENDORS bucket in Object Storage and returns URLs in the format expected by TinyMCE
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Client } from '@replit/object-storage';
import { BUCKETS } from './object-storage-service';

// Configure temporary storage for vendor uploads
const tempStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    // Create temporary directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'vendor-uploads');
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
export const vendorUpload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit for vendor images
  },
  fileFilter: (_req, file, cb) => {
    // Allow images and specific document formats for vendor uploads
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/svg+xml', 'application/pdf'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`[VendorUpload] Rejected file with mimetype: ${file.mimetype}`);
      cb(new Error('Only image files and PDFs are allowed for vendor content'));
    }
  }
});

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
    // Use only the original filename plus timestamp to keep it clean
    const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    // Use a clean key structure - avoid nesting 'vendors/' since the VENDORS bucket is already scoped
    const objectKey = `media-${timestamp}-${cleanFilename}`;
    
    console.log(`[VendorUpload] Uploading to Object Storage with key: ${objectKey} in VENDORS bucket`);
    
    // Upload to Object Storage using the client
    const client = new Client();
    
    try {
      // Upload using uploadFromFilename which is available in the client
      const uploadResult = await client.uploadFromFilename(objectKey, file.path, {
        bucketName: BUCKETS.VENDORS,
        contentType: file.mimetype
        // Note: 'headers' property isn't supported in UploadOptions type
      });
      
      // Clean up the temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`[VendorUpload] Temporary file removed: ${file.path}`);
      }
      
      if (!uploadResult.ok) {
        console.error(`[VendorUpload] Upload failed: ${uploadResult.error.message}`);
        return res.status(500).json({
          error: {
            message: `Upload to storage failed: ${uploadResult.error.message}`
          }
        });
      }
      
      // Generate URLs for the uploaded file
      // TinyMCE expects a specific response format with a 'location' property
      const directUrl = `https://object-storage.replit.app/${BUCKETS.VENDORS}/${objectKey}`;
      // Use direct access to Replit Object Storage (with the vendor bucket prefix)
      const proxyUrl = `/api/storage-proxy/direct-vendors/${objectKey}`;
      // Fallback URL uses the same pattern
      const directVendorUrl = `/api/storage-proxy/direct-vendors/${objectKey}`;
      
      console.log(`[VendorUpload] Upload successful. URLs:
        - direct: ${directUrl}
        - proxy: ${proxyUrl}
        - directVendor: ${directVendorUrl}
      `);
      
      // TinyMCE expects a specific response format
      return res.status(200).json({
        location: proxyUrl, // Primary URL used by TinyMCE
        url: proxyUrl,      // Alternative URL property
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