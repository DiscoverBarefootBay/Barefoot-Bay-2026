/**
 * Object Storage Video Upload
 * 
 * This script uploads the background video to Replit Object Storage using
 * the native Replit Object Storage Client API.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@replit/object-storage';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const VIDEO_PATH = path.join(__dirname, '../client/public/static/videos/BackgroundVideo.mp4');
const BUCKET = 'DEFAULT';
const STORAGE_KEY = 'banner/BackgroundVideo.mp4';
const CONTENT_TYPE = 'video/mp4';
const BASE_URL = 'https://object-storage.replit.app';

/**
 * Simple class to upload a video to Replit Object Storage
 */
class VideoUploader {
  constructor() {
    // Initialize the client
    this.client = new Client();
    console.log('Initialized Replit Object Storage client');
  }

  /**
   * Upload a file to Replit Object Storage
   */
  async uploadFile(filePath, bucket, storageKey, contentType) {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read file
      console.log(`Reading file: ${filePath}`);
      const fileBuffer = fs.readFileSync(filePath);
      const fileSize = fileBuffer.length;
      console.log(`File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

      // Upload to object storage using the native API
      console.log(`Uploading to bucket: ${bucket}, key: ${storageKey}`);

      const key = `${storageKey}`;
      // For Replit Object Storage, we use the bucket in the URL, not in the key
      
      const metadata = {
        uploadDate: new Date().toISOString(),
        fileSize: String(fileSize),
        bucket: bucket
      };

      console.log('Starting upload with client...');

      // The client API uses put() method instead of putObject()
      await this.client.put(key, fileBuffer, {
        contentType: contentType,
        metadata: metadata
      });

      console.log('Upload successful!');
      
      // Generate the URL
      const url = `${BASE_URL}/${bucket}/${key}`;
      console.log(`File available at: ${url}`);

      // Save reference for convenience
      const referenceFilePath = path.join(__dirname, '../video-storage-url.txt');
      fs.writeFileSync(referenceFilePath, url);
      console.log(`URL saved to: ${referenceFilePath}`);

      return url;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }
}

/**
 * Main function to execute the upload
 */
async function main() {
  try {
    console.log('Starting video upload to Object Storage...');
    const uploader = new VideoUploader();
    const url = await uploader.uploadFile(
      VIDEO_PATH,
      BUCKET,
      STORAGE_KEY,
      CONTENT_TYPE
    );
    console.log('Upload complete!');
    console.log(`Video available at: ${url}`);
    return url;
  } catch (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
}

// Execute the script
main()
  .then(() => {
    console.log('Script completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });