/**
 * Unified Storage Service
 * 
 * A centralized service for handling all media storage in the application.
 * This service abstracts the storage mechanism and uses Replit Object Storage
 * exclusively instead of the filesystem.
 * 
 * Key features:
 * - All media uploads go directly to Object Storage (not filesystem)
 * - Consistent bucket structure with designated buckets for different media types
 * - Normalized URL format for all media references
 * - Standardized error handling and fallback mechanisms
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import mime from 'mime-types';

// Define storage buckets
export const STORAGE_BUCKETS = {
  DEFAULT: 'DEFAULT', // For general media
  CALENDAR: 'CALENDAR', // For calendar events
  FORUM: 'FORUM', // For forum media
  VENDORS: 'VENDORS', // For vendor-related media
  REAL_ESTATE: 'REAL_ESTATE', // For real estate listings
  COMMUNITY: 'COMMUNITY', // For community-related media
  AVATAR: 'AVATAR', // For user avatars
  BANNER: 'BANNER' // For banner slides
} as const;

export type StorageBucketType = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

// Define media types that map to buckets
const MEDIA_TYPE_TO_BUCKET: Record<string, StorageBucketType> = {
  // Default bucket
  'default': STORAGE_BUCKETS.DEFAULT,
  'general': STORAGE_BUCKETS.DEFAULT,
  
  // Avatar and user-related media
  'avatar': STORAGE_BUCKETS.AVATAR,
  'user': STORAGE_BUCKETS.AVATAR,
  'profile': STORAGE_BUCKETS.AVATAR,
  
  // Banner slides
  'banner': STORAGE_BUCKETS.BANNER,
  'banner-slides': STORAGE_BUCKETS.BANNER,
  'slide': STORAGE_BUCKETS.BANNER,
  
  // Calendar events
  'calendar': STORAGE_BUCKETS.CALENDAR,
  'event': STORAGE_BUCKETS.CALENDAR,
  'events': STORAGE_BUCKETS.CALENDAR,
  'calendar-media': STORAGE_BUCKETS.CALENDAR,
  
  // Forum media
  'forum': STORAGE_BUCKETS.FORUM,
  'post': STORAGE_BUCKETS.FORUM,
  'thread': STORAGE_BUCKETS.FORUM,
  'comment': STORAGE_BUCKETS.FORUM,
  
  // Vendor media
  'vendor': STORAGE_BUCKETS.VENDORS,
  'service': STORAGE_BUCKETS.VENDORS,
  'business': STORAGE_BUCKETS.VENDORS,
  
  // Real estate media
  'real-estate': STORAGE_BUCKETS.REAL_ESTATE,
  'property': STORAGE_BUCKETS.REAL_ESTATE,
  'listing': STORAGE_BUCKETS.REAL_ESTATE,
  'home': STORAGE_BUCKETS.REAL_ESTATE,
  
  // Community media
  'community': STORAGE_BUCKETS.COMMUNITY,
  'announcement': STORAGE_BUCKETS.COMMUNITY,
  'news': STORAGE_BUCKETS.COMMUNITY
};

// Define media path prefixes
const MEDIA_TYPE_TO_PATH_PREFIX: Record<string, string> = {
  'avatar': 'avatars',
  'banner': 'banners',
  'banner-slides': 'banner-slides',
  'calendar': 'events',
  'event': 'events',
  'events': 'events',
  'forum': 'forum',
  'post': 'forum/posts',
  'thread': 'forum/threads',
  'comment': 'forum/comments',
  'vendor': 'vendors',
  'real-estate': 'real-estate',
  'property': 'real-estate',
  'community': 'community'
};

/**
 * Interface for storage operations
 */
export interface IStorageResult {
  success: boolean;
  url?: string;  // The proxy URL to access the file, formatted as /api/storage-proxy/BUCKET/path/filename
  directUrl?: string; // Direct object storage URL (not for public use)
  key?: string; // The storage key used in Object Storage
  bucket?: string; // The bucket where the file is stored
  error?: string;
  statusCode?: number;
}

/**
 * Upload options for storage operations
 */
export interface IStorageUploadOptions {
  generateUniqueName?: boolean; // Whether to generate a unique name for the file (default: true)
  contentType?: string; // Optional content type override
  bucket?: StorageBucketType; // Optional explicit bucket override
  makePublic?: boolean; // Whether the file should be publicly accessible (default: true)
  metadata?: Record<string, string>; // Optional metadata to store with the file
}

/**
 * Unified Storage Service for handling all media
 */
export class UnifiedStorageService {
  private client: Client;
  private baseProxyUrl: string = '/api/storage-proxy';
  
  constructor() {
    // Initialize Object Storage client
    this.client = new Client();
    console.log('[UnifiedStorage] Initialized with Replit Object Storage client');
  }
  
  /**
   * Upload a file buffer directly to Object Storage
   * @param buffer File data as buffer
   * @param filename Original filename
   * @param mediaType Type of media (avatar, event, forum, etc.)
   * @param options Upload options
   * @returns Storage result with proxy URL
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    mediaType: string,
    options: IStorageUploadOptions = {}
  ): Promise<IStorageResult> {
    try {
      // Validate input
      if (!buffer || buffer.length === 0) {
        return {
          success: false,
          error: 'Empty buffer provided',
          statusCode: 400
        };
      }
      
      if (!filename) {
        filename = `file-${Date.now()}`;
      }
      
      // Generate a safe filename (timestamp + uuid for uniqueness)
      const safeFilename = this.getSafeFilename(filename, options.generateUniqueName !== false);
      
      // Determine bucket based on media type
      const bucket = options.bucket || this.getBucketForMediaType(mediaType);
      
      // Determine path prefix based on media type
      const pathPrefix = this.getPathPrefix(mediaType);
      
      // Create the storage key (path within the bucket)
      const storageKey = `${pathPrefix}/${safeFilename}`;
      
      console.log(`[UnifiedStorage] Uploading ${filename} to ${bucket}/${storageKey}`);
      
      // Create a temporary file
      const tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}-${uuidv4()}`);
      fs.writeFileSync(tempFilePath, buffer);
      
      // Determine content type
      const contentType = options.contentType || 
                          mime.lookup(filename) || 
                          'application/octet-stream';
      
      // Upload to object storage
      const uploadOptions = {
        contentType,
        bucketName: bucket,
        headers: {
          'X-Obj-Bucket': bucket
        }
      };
      
      let result;
      
      try {
        // CRITICAL CHANGE: First try using raw buffer upload which is more reliable
        const fileContent = fs.readFileSync(tempFilePath);
        console.log(`[UnifiedStorage] Using direct buffer upload instead of uploadFromFilename, buffer size: ${fileContent.length} bytes`);
        
        result = await this.client.uploadBytes(storageKey, fileContent, uploadOptions);
        console.log(`[UnifiedStorage] Direct buffer upload result: ${result.ok ? 'SUCCESS' : 'FAILED'}`);
        
        if (!result.ok) {
          // Fall back to uploadFromFilename only if direct buffer upload fails
          console.log(`[UnifiedStorage] Falling back to uploadFromFilename due to buffer upload failure: ${result.error?.message}`);
          result = await this.client.uploadFromFilename(storageKey, tempFilePath, uploadOptions);
          console.log(`[UnifiedStorage] Fallback upload result: ${result.ok ? 'SUCCESS' : 'FAILED'}`);
        }
      } catch (uploadError) {
        console.error(`[UnifiedStorage] Critical upload error:`, uploadError);
        
        // Last resort: Try uploadFromFilename if we haven't tried it yet
        try {
          result = await this.client.uploadFromFilename(storageKey, tempFilePath, uploadOptions);
          console.log(`[UnifiedStorage] Last resort upload result: ${result.ok ? 'SUCCESS' : 'FAILED'}`);
        } catch (finalError) {
          console.error(`[UnifiedStorage] Final upload attempt failed:`, finalError);
        }
      } finally {
        // Remove temp file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
      
      // Handle result
      if (!result || !result.ok) {
        return {
          success: false,
          error: result ? `Upload failed: ${result.error?.message}` : 'Upload failed with no result',
          statusCode: 500
        };
      }
      
      // Verify file was actually uploaded by checking it exists
      try {
        console.log(`[UnifiedStorage] Verifying upload exists: ${bucket}/${storageKey}`);
        const existsResult = await this.client.exists(storageKey, {
          bucketName: bucket,
          headers: {
            'X-Obj-Bucket': bucket
          }
        });
        
        if (!existsResult.ok || !existsResult.value) {
          console.error(`[UnifiedStorage] WARNING: Upload verification failed. File may not exist despite successful upload: ${bucket}/${storageKey}`);
        } else {
          console.log(`[UnifiedStorage] Upload verified successfully. File exists: ${bucket}/${storageKey}`);
        }
      } catch (verifyError) {
        console.error(`[UnifiedStorage] Error verifying upload:`, verifyError);
        // Don't fail due to verification error
      }
      
      // Construct the proxy URL for the client to use
      const proxyUrl = `${this.baseProxyUrl}/${bucket}/${storageKey}`;
      
      // Construct the direct URL (for debugging)
      const directUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
      
      // Log complete upload result for debugging
      console.log(`[UnifiedStorage] Upload successful:
        - Bucket: ${bucket}
        - Storage key: ${storageKey}
        - Proxy URL: ${proxyUrl}
        - Direct URL: ${directUrl}
      `);
      
      return {
        success: true,
        url: proxyUrl,
        directUrl,
        key: storageKey,
        bucket
      };
    } catch (error) {
      console.error('[UnifiedStorage] Error uploading buffer:', error);
      return {
        success: false,
        error: error.message || 'Unknown error during upload',
        statusCode: 500
      };
    }
  }
  
  /**
   * Upload a file from a local path to Object Storage
   * @param filePath Path to the file on local filesystem
   * @param mediaType Type of media
   * @param options Upload options
   * @returns Storage result with proxy URL
   */
  async uploadFile(
    filePath: string,
    mediaType: string,
    options: IStorageUploadOptions = {}
  ): Promise<IStorageResult> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          statusCode: 404
        };
      }
      
      // Get file information without loading into memory
      const stats = fs.statSync(filePath);
      const originalFilename = path.basename(filePath);
      
      console.log(`[UnifiedStorage] Uploading file ${originalFilename} (${Math.round(stats.size / 1024 / 1024)}MB) from disk using stream`);
      
      // Generate a safe filename (timestamp + uuid for uniqueness)
      const safeFilename = this.getSafeFilename(originalFilename, options.generateUniqueName !== false);
      
      // Determine bucket based on media type
      const bucket = options.bucket || this.getBucketForMediaType(mediaType);
      
      // Determine path prefix based on media type
      const pathPrefix = this.getPathPrefix(mediaType);
      
      // Create the storage key (path within the bucket)
      const storageKey = `${pathPrefix}/${safeFilename}`;
      
      console.log(`[UnifiedStorage] Uploading to ${bucket}/${storageKey}`);
      
      // Determine content type
      const contentType = options.contentType || 
                        mime.lookup(originalFilename) || 
                        'application/octet-stream';
      
      // Create a readable stream from the file
      const fileStream = fs.createReadStream(filePath);
      
      // Upload to object storage using the stream
      const uploadOptions = {
        contentType,
        bucketName: bucket,
        headers: {
          'X-Obj-Bucket': bucket,
          'Content-Length': stats.size.toString()
        }
      };
      
      // Upload the file using stream to avoid memory issues with large files
      console.log(`[UnifiedStorage] Starting stream upload of ${Math.round(stats.size / 1024 / 1024)}MB file`);
      
      let result;
      try {
        result = await this.client.upload(storageKey, fileStream, uploadOptions);
        console.log(`[UnifiedStorage] Stream upload result: ${result.ok ? 'SUCCESS' : 'FAILED'}`);
      } catch (streamError) {
        console.error(`[UnifiedStorage] Stream upload failed:`, streamError);
        
        // Fallback to uploadFromFilename if stream upload fails
        console.log(`[UnifiedStorage] Falling back to uploadFromFilename`);
        result = await this.client.uploadFromFilename(storageKey, filePath, uploadOptions);
        console.log(`[UnifiedStorage] Fallback upload result: ${result.ok ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Handle result
      if (!result || !result.ok) {
        return {
          success: false,
          error: result ? `Upload failed: ${result.error?.message}` : 'Upload failed with no result',
          statusCode: 500
        };
      }
      
      // Build the proxy URL for accessing the file
      const proxyUrl = `${this.baseProxyUrl}/${bucket}/${storageKey}`;
      
      // Build direct URL for debugging
      const directUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
      
      // Log success
      console.log(`[UnifiedStorage] File upload successful:
        - Size: ${Math.round(stats.size / 1024 / 1024)}MB
        - Bucket: ${bucket}
        - Key: ${storageKey}
        - URL: ${proxyUrl}
      `);
      
      // Return success result
      return {
        success: true,
        url: proxyUrl,
        directUrl,
        key: storageKey,
        bucket
      };
    } catch (error) {
      console.error('[UnifiedStorage] Error uploading file:', error);
      return {
        success: false,
        error: error.message || 'Unknown error during file upload',
        statusCode: 500
      };
    } finally {
      // Clean up - delete the temporary file after upload
      try {
        if (fs.existsSync(filePath)) {
          // Only delete if it's in the temp directory to be safe
          if (filePath.includes('/tmp/') || filePath.includes(os.tmpdir())) {
            fs.unlinkSync(filePath);
            console.log(`[UnifiedStorage] Cleaned up temporary file: ${filePath}`);
          }
        }
      } catch (cleanupError) {
        console.error('[UnifiedStorage] Error cleaning up temporary file:', cleanupError);
        // Don't fail the operation if cleanup fails
      }
    }
  }
  
  /**
   * Download a file from Object Storage
   * @param storageKey Key of the file in storage
   * @param bucket Bucket where the file is stored
   * @returns Buffer of the file contents or null if not found
   */
  async downloadFile(storageKey: string, bucket: StorageBucketType): Promise<Buffer | null> {
    try {
      // Download the file
      const result = await this.client.downloadAsBytes(storageKey, {
        bucketName: bucket,
        headers: {
          'X-Obj-Bucket': bucket
        }
      });
      
      if (!result.ok) {
        console.error(`[UnifiedStorage] Download failed: ${result.error.message}`);
        return null;
      }
      
      return result.value;
    } catch (error) {
      console.error('[UnifiedStorage] Error downloading file:', error);
      return null;
    }
  }
  
  /**
   * Check if a file exists in Object Storage
   * @param storageKey Key of the file in storage
   * @param bucket Bucket where the file is stored
   * @returns Boolean indicating if the file exists
   */
  async fileExists(storageKey: string, bucket: StorageBucketType): Promise<boolean> {
    try {
      // Use the exists method
      const result = await this.client.exists(storageKey, {
        bucketName: bucket,
        headers: {
          'X-Obj-Bucket': bucket
        }
      });
      
      if (!result.ok) {
        console.error(`[UnifiedStorage] Exists check failed: ${result.error.message}`);
        return false;
      }
      
      return result.value;
    } catch (error) {
      console.error('[UnifiedStorage] Error checking if file exists:', error);
      return false;
    }
  }
  
  /**
   * Delete a file from Object Storage
   * @param storageKey Key of the file in storage
   * @param bucket Bucket where the file is stored
   * @returns Boolean indicating success
   */
  async deleteFile(storageKey: string, bucket: StorageBucketType): Promise<boolean> {
    try {
      // Delete the file
      const result = await this.client.delete(storageKey, {
        bucketName: bucket,
        headers: {
          'X-Obj-Bucket': bucket
        }
      });
      
      if (!result.ok) {
        console.error(`[UnifiedStorage] Delete failed: ${result.error.message}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[UnifiedStorage] Error deleting file:', error);
      return false;
    }
  }
  
  /**
   * List files in a bucket with a prefix
   * @param prefix Prefix to filter by
   * @param bucket Bucket to list files from
   * @returns Array of file keys
   */
  async listFiles(prefix: string, bucket: StorageBucketType): Promise<string[]> {
    try {
      // List files
      const result = await this.client.list({
        prefix,
        bucketName: bucket,
        headers: {
          'X-Obj-Bucket': bucket
        }
      });
      
      if (!result.ok) {
        console.error(`[UnifiedStorage] List failed: ${result.error.message}`);
        return [];
      }
      
      return result.value.map(obj => obj.name);
    } catch (error) {
      console.error('[UnifiedStorage] Error listing files:', error);
      return [];
    }
  }
  
  /**
   * Create a proxy URL for a file in Object Storage
   * @param storageKey Key of the file in storage
   * @param bucket Bucket where the file is stored
   * @returns Proxy URL for the file
   */
  getProxyUrl(storageKey: string, bucket: StorageBucketType): string {
    return `${this.baseProxyUrl}/${bucket}/${storageKey}`;
  }
  
  /**
   * Parse a proxy URL to get the storage key and bucket
   * @param proxyUrl Proxy URL to parse
   * @returns Object with storage key and bucket
   */
  parseProxyUrl(proxyUrl: string): { storageKey: string, bucket: string } | null {
    try {
      // Remove the base proxy URL
      if (!proxyUrl.startsWith(this.baseProxyUrl)) {
        return null;
      }
      
      const relativePath = proxyUrl.substring(this.baseProxyUrl.length + 1);
      const parts = relativePath.split('/');
      
      if (parts.length < 2) {
        return null;
      }
      
      const bucket = parts[0];
      const storageKey = parts.slice(1).join('/');
      
      return { storageKey, bucket };
    } catch (error) {
      console.error('[UnifiedStorage] Error parsing proxy URL:', error);
      return null;
    }
  }
  
  /**
   * Generate a safe filename with optional uniqueness
   * @param originalFilename Original filename
   * @param makeUnique Whether to make the filename unique
   * @returns Safe filename
   */
  private getSafeFilename(originalFilename: string, makeUnique: boolean = true): string {
    // Extract file extension
    const ext = path.extname(originalFilename);
    
    // Create base filename without extension
    const baseFilename = path.basename(originalFilename, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace invalid chars with dash
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .toLowerCase();
    
    if (makeUnique) {
      // Add timestamp and unique ID
      const timestamp = Date.now();
      const uniqueId = Math.floor(Math.random() * 1000000000);
      return `media-${timestamp}-${uniqueId}${ext}`;
    } else {
      return `${baseFilename}${ext}`;
    }
  }
  
  /**
   * Determine which bucket to use based on media type
   * @param mediaType Type of media
   * @returns Bucket to use
   */
  private getBucketForMediaType(mediaType: string): StorageBucketType {
    const normalizedType = mediaType.toLowerCase();
    return MEDIA_TYPE_TO_BUCKET[normalizedType] || STORAGE_BUCKETS.DEFAULT;
  }
  
  /**
   * Get the path prefix for a media type
   * @param mediaType Type of media
   * @returns Path prefix
   */
  private getPathPrefix(mediaType: string): string {
    const normalizedType = mediaType.toLowerCase();
    return MEDIA_TYPE_TO_PATH_PREFIX[normalizedType] || normalizedType;
  }
}

// Export singleton instance
export const unifiedStorageService = new UnifiedStorageService();