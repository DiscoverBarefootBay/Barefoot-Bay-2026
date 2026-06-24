/**
 * Object Storage Service
 * Manages interactions with Replit Object Storage for media persistence
 */

import { Client } from '@replit/object-storage';
import { createObjectStorageClient } from './lib/object-storage-client';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { db } from './db';
import { migrationService, SOURCE_TYPE, MIGRATION_STATUS } from './migration-service';
import mime from 'mime-types';

// Define storage buckets
export const BUCKETS = {
  DEFAULT: 'DEFAULT', // For general content and site-wide icons
  AVATARS: 'AVATARS', // Dedicated bucket for user avatars
  BANNER: 'BANNER', // Dedicated bucket for banner slides
  CALENDAR: 'CALENDAR', // For calendar events
  FORUM: 'FORUM', // For forum media
  VENDORS: 'VENDORS', // For vendor-related media
  SALE: 'SALE', // For real estate/for-sale items
  COMMUNITY: 'COMMUNITY', // For community-related media
  MESSAGES: 'MESSAGES' // For message attachments
} as const;

export type BucketType = typeof BUCKETS[keyof typeof BUCKETS];

/**
 * Typed error thrown by ObjectStorageService.uploadFile / uploadData when an
 * upload, verification, or bucket-resolution step fails.
 *
 * Historically these helpers swallowed every failure and returned a
 * `/api/storage-proxy/.../default-*.svg` placeholder URL. That forced every
 * caller to remember to re-check the returned URL (or run `fileExists`
 * afterwards) and most callers didn't — leaving the database pointing at
 * files that never made it into Object Storage. The helpers now throw this
 * error on failure so callers fail loudly by default.
 */
export class ObjectStorageUploadError extends Error {
  override readonly name = 'ObjectStorageUploadError';
  readonly cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.cause = options?.cause;
  }
}

// Media types to bucket mapping
const MEDIA_TYPE_TO_BUCKET: Record<string, BucketType> = {
  'avatar': BUCKETS.AVATARS,
  'banner': BUCKETS.BANNER, // Use the dedicated BANNER bucket
  'banner-slides': BUCKETS.BANNER, // Use the dedicated BANNER bucket
  'videos': BUCKETS.DEFAULT,
  'icon': BUCKETS.DEFAULT,
  'general': BUCKETS.DEFAULT,
  'calendar': BUCKETS.CALENDAR,
  'calendar-media': BUCKETS.CALENDAR,
  'event': BUCKETS.CALENDAR,
  'events': BUCKETS.CALENDAR, // Add this mapping for the events directory
  'forum': BUCKETS.FORUM,
  'forum-media': BUCKETS.FORUM,
  'forum_post': BUCKETS.FORUM,
  'forum_comment': BUCKETS.FORUM,
  'vendor': BUCKETS.VENDORS,
  'real_estate': BUCKETS.SALE,
  'real_estate_media': BUCKETS.SALE,
  'for_sale': BUCKETS.SALE,
  'community': BUCKETS.COMMUNITY,
  'attachments': BUCKETS.MESSAGES, // Add mapping for message attachments
  'messages': BUCKETS.MESSAGES,    // Add another mapping for the messages directory
  'message': BUCKETS.MESSAGES      // Add singular form for consistency
};

/**
 * Service for interacting with Replit Object Storage
 */
export class ObjectStorageService {
  client: ReturnType<typeof createObjectStorageClient>;
  private baseUrl = 'https://object-storage.replit.app';

  constructor(client?: ReturnType<typeof createObjectStorageClient>) {
    // Initialize object storage client (bucket id resolved explicitly to
    // avoid sidecar returning empty bucketId, which crashes GCS client).
    // A client may be injected to support unit testing with a mock.
    this.client = client ?? createObjectStorageClient();
  }

  /**
   * Probe whether an object exists in a bucket using the Replit Object
   * Storage client's `exists` method. Returns a structured result so callers
   * can distinguish "verified missing" from "verification call errored".
   *
   * Matches the bucket-scoped call shape used throughout this codebase
   * (`unified-storage-service.ts`, `forum-media-upload-handler.ts`,
   * `community-media-upload-handler.ts`, `vendor-media-upload-handler.ts`,
   * `main-routes.ts`): the SDK's public `.d.ts` only types one argument
   * for `exists`, but the implementation accepts a `{ bucketName, headers }`
   * options bag that routes the lookup at the correct bucket. We mirror
   * that pattern via a cast so verification is bucket-aware for non-default
   * buckets (AVATARS, BANNER, FORUM, …).
   */
  private async verifyObjectExists(
    storageKey: string,
    bucket: string
  ): Promise<{ exists: boolean; errorMessage?: string }> {
    try {
      const existsFn = (this.client as unknown as {
        exists: (
          k: string,
          opts?: { bucketName?: string; headers?: Record<string, string> }
        ) => Promise<unknown>;
      }).exists.bind(this.client);

      const existsResult = (await existsFn(storageKey, {
        bucketName: bucket,
        headers: { 'X-Obj-Bucket': bucket },
      })) as
        | { ok: true; value: boolean }
        | { ok: false; error?: { message?: string } }
        | undefined;

      if (existsResult && existsResult.ok) {
        return { exists: Boolean(existsResult.value) };
      }
      return {
        exists: false,
        errorMessage: existsResult?.error?.message,
      };
    } catch (verifyError) {
      return {
        exists: false,
        errorMessage:
          verifyError instanceof Error ? verifyError.message : String(verifyError),
      };
    }
  }
  
  /**
   * Get a token for direct uploads to Object Storage
   * This is used by the forum-media-test endpoint
   * @returns Promise<string> A token for direct uploads
   */
  async getToken(): Promise<string> {
    try {
      // Examine which methods the client actually has
      console.log('[ObjectStorage] Available client methods:', Object.keys(this.client).filter(k => typeof this.client[k] === 'function'));
      
      // Create a simple implementation using the existing client methods
      // Use a timestamp-based key for testing authorization
      const testKey = `auth-test-${Date.now()}.txt`;
      
      // Create a test file in memory
      const testBuffer = Buffer.from('test-auth');
      
      // Test authorization by writing a small file to Object Storage
      // Using upload method that's available in the client
      console.log(`[ObjectStorage] Testing authorization with key: ${testKey}`);
      
      // Create a temporary file for testing auth
      const tempFilePath = path.join(os.tmpdir(), testKey);
      fs.writeFileSync(tempFilePath, testBuffer);
      
      try {
        // Use uploadFromFilename which we know exists
        const testResult = await this.client.uploadFromFilename(testKey, tempFilePath, {
          bucketName: BUCKETS.FORUM,
          headers: {
            'X-Obj-Bucket': BUCKETS.FORUM,
            'Content-Type': 'text/plain'
          }
        });
        
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        
        if (!testResult.ok) {
          console.error('[ObjectStorage] Auth test failed:', testResult.error);
          throw new Error('Unable to validate client credentials');
        }
        
        console.log('[ObjectStorage] Auth test successful');
      } catch (uploadError) {
        // Clean up temp file in case of error
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        throw uploadError;
      }
      
      // If we can upload, we can create a token for client use
      // For security, we'll generate a time-based token that expires
      const timestamp = Date.now();
      const expiresAt = timestamp + (60 * 60 * 1000); // 1 hour
      
      // Create a simple token format with timestamp for validation
      const tokenData = {
        bucket: BUCKETS.FORUM,
        timestamp,
        expiresAt
      };
      
      // Create and return a base64 encoded token
      const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      console.log('[ObjectStorage] Generated token successfully');
      return token;
      
    } catch (error) {
      console.error('[ObjectStorage] Failed to get token:', error);
      throw error;
    }
  }
  
  /**
   * Check if a file exists in Object Storage
   * @param path Path to the file in the bucket
   * @param bucket Optional bucket name, defaults to DEFAULT
   * @returns Promise<boolean> true if file exists, false otherwise
   */
  async checkFileExists(path: string, bucket: string = BUCKETS.DEFAULT): Promise<boolean> {
    try {
      console.log(`[ObjectStorage] Checking if file exists: ${bucket}/${path}`);
      
      // List objects with the prefix to see if the file exists
      const result = await this.client.listWithPrefix(path, {
        bucketName: bucket,
        maxKeys: 1,
        headers: {
          'X-Obj-Bucket': bucket
        }
      });
      
      if (!result.ok) {
        console.error(`[ObjectStorage] Error listing objects with prefix ${path} in bucket ${bucket}: ${result.error.message}`);
        return false;
      }
      
      // Check if any files match the exact path
      const filesFound = result.value.some(item => 
        item.name === path || 
        // Also check without directory for cases where the prefix isn't included
        item.name === path.split('/').pop()
      );
      
      console.log(`[ObjectStorage] File ${bucket}/${path} exists: ${filesFound}`);
      return filesFound;
    } catch (error) {
      console.error(`[ObjectStorage] Error checking if file exists ${bucket}/${path}:`, error);
      return false;
    }
  }

  /**
   * Upload a file to object storage
   * @param filePath Path to the file to upload
   * @param directory Directory within the bucket
   * @param filename Custom filename (optional)
   * @param explicitBucket Explicitly specify which bucket to use (optional)
   * @returns URL to the uploaded file
   */
  async uploadFile(filePath: string, directory: string, filename?: string, explicitBucket?: string): Promise<string> {
    try {
      // Enhanced debugging for media uploads
      console.log(`[ObjectStorage] Starting upload process for file:
        - Path: ${filePath}
        - Directory: ${directory}
        - Filename: ${filename || 'unspecified (using basename)'}
        - Explicit bucket: ${explicitBucket || 'not specified'}
        - Current working directory: ${process.cwd()}
      `);
      
      // Check if file exists with detailed error report
      if (!fs.existsSync(filePath)) {
        console.error(`[ObjectStorage] CRITICAL ERROR: File not found at path: ${filePath}`);
        console.error(`[ObjectStorage] Current directory: ${process.cwd()}`);

        const parentDir = path.dirname(filePath);
        if (fs.existsSync(parentDir)) {
          console.log(`[ObjectStorage] Parent directory exists. Contents:`);
          const files = fs.readdirSync(parentDir);
          console.log(files.join('\n'));
        } else {
          console.error(`[ObjectStorage] Parent directory does not exist: ${parentDir}`);
        }

        throw new ObjectStorageUploadError(
          `Source file not found at path: ${filePath}`
        );
      }

      // Get file info with enhanced debugging
      const stats = fs.statSync(filePath);
      console.log(`[ObjectStorage] File stats: Size=${stats.size} bytes, Created=${stats.birthtime}, Modified=${stats.mtime}`);
      
      if (!stats.isFile()) {
        throw new Error(`Not a file: ${filePath}`);
      }
      
      // Read a small sample of the file to verify it's valid
      try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(Math.min(100, stats.size));
        fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);
        console.log(`[ObjectStorage] File sample (first ${buffer.length} bytes): ${buffer.toString('hex').substring(0, 50)}...`);
      } catch (readError) {
        console.error(`[ObjectStorage] Warning: Could not read file sample: ${readError.message}`);
      }
      
      // Determine file name
      const actualFilename = filename || path.basename(filePath);
      
      // Determine bucket based on explicit specification or directory/media type
      const bucket = explicitBucket || this.getBucketForMediaType(directory);
      console.log(`[ObjectStorage] Using bucket: ${bucket} (${explicitBucket ? 'explicit' : 'from media type: ' + directory})`);
      
      // Generate storage key with standardized format for consistent paths
      let storageKey;
      
      // Special handling for calendar events to ensure consistent prefix
      if (directory === 'events' || directory === 'calendar' || directory === 'calendar-media' || 
          directory === 'event' || directory === 'CALENDAR') {
        // Always use events/filename format for event media (without CALENDAR prefix in storage key)
        storageKey = `events/${actualFilename}`;
        console.log(`[ObjectStorage] Using standardized path for calendar event: ${storageKey}`);
        
        // BUGFIX: Also preserve a backup copy in the local filesystem
        try {
          const localEventsDir = path.join(process.cwd(), 'uploads', 'events');
          if (!fs.existsSync(localEventsDir)) {
            fs.mkdirSync(localEventsDir, { recursive: true });
          }
          const localEventFilePath = path.join(localEventsDir, actualFilename);
          fs.copyFileSync(filePath, localEventFilePath);
          console.log(`[ObjectStorage] Created backup copy at ${localEventFilePath}`);
        } catch (backupErr) {
          console.error(`[ObjectStorage] Failed to create backup copy: ${backupErr}`);
        }
      } else {
        // For other media types, use directory/filename format
        storageKey = directory ? `${directory}/${actualFilename}` : actualFilename;
      }
      
      // Get content type based on file extension
      const contentType = mime.lookup(actualFilename) || 'application/octet-stream';
      console.log(`[ObjectStorage] Content type determined: ${contentType}`);
      
      // Upload to object storage using uploadFromFilename method with bucket option
      console.log(`[ObjectStorage] Uploading file to ${bucket}/${storageKey}...`);
      console.log(`[ObjectStorage] CRITICAL DEBUG INFO for upload:
        - File path: ${filePath}
        - Storage key: ${storageKey}
        - Bucket: ${bucket}
        - Content type: ${contentType}
        - File exists: ${fs.existsSync(filePath) ? 'YES' : 'NO'}
        - File size: ${fs.existsSync(filePath) ? fs.statSync(filePath).size : 'N/A'} bytes
        - Working directory: ${process.cwd()}
      `);
      
      // Add retry logic for uploads
      let uploadError = null;
      let result = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[ObjectStorage] Upload attempt ${attempt}/3...`);
          
          // Read file content to validate it's readable
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath);
            console.log(`[ObjectStorage] Read file content successfully, size: ${fileContent.length} bytes`);
          }
          
          // Construct upload options with explicit bucket name AND header
          const uploadOptions = {
            contentType,
            bucketName: bucket,
            headers: {
              'X-Obj-Bucket': bucket
            }
          };
          console.log(`[ObjectStorage] Upload options: ${JSON.stringify(uploadOptions)}`);
          
          // Perform the actual upload
          console.log(`[ObjectStorage] Calling uploadFromFilename with key=${storageKey}, path=${filePath}`);
          result = await this.client.uploadFromFilename(storageKey, filePath, uploadOptions);
          
          if (result.ok) {
            console.log(`[ObjectStorage] Upload successful on attempt ${attempt}`);
            break;
          } else {
            uploadError = new Error(`Failed to upload file on attempt ${attempt}: ${result.error.message}`);
            console.error(`[ObjectStorage] Upload failed on attempt ${attempt}:`, result.error);
            
            if (attempt < 3) {
              // Wait before retrying (with exponential backoff)
              const delay = 1000 * Math.pow(2, attempt - 1);
              console.log(`[ObjectStorage] Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (attemptError) {
          uploadError = attemptError;
          console.error(`[ObjectStorage] Exception during upload attempt ${attempt}:`, attemptError);
          
          if (attempt < 3) {
            // Wait before retrying (with exponential backoff)
            const delay = 1000 * Math.pow(2, attempt - 1);
            console.log(`[ObjectStorage] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (!result || !result.ok) {
        throw new ObjectStorageUploadError(
          `Failed to upload file after multiple attempts: ${uploadError?.message ?? 'unknown error'}`,
          { cause: uploadError }
        );
      }

      const objectStorageUrl = `${this.baseUrl}/${bucket}/${storageKey}`;
      console.log(`[ObjectStorage] Successfully uploaded to: ${objectStorageUrl}`);
      
      // Verify the upload actually landed in the bucket. If verification
      // fails — either because the existence probe errored or because the
      // object isn't there — surface that as an ObjectStorageUploadError
      // so callers don't persist a URL pointing at a missing object.
      const verification = await this.verifyObjectExists(storageKey, bucket);
      if (!verification.exists) {
        throw new ObjectStorageUploadError(
          `Upload of ${storageKey} to ${bucket} reported success but post-upload verification did not find the object${verification.errorMessage ? `: ${verification.errorMessage}` : ''}`
        );
      }
      console.log(`[ObjectStorage] Verified upload exists at ${bucket}/${storageKey}`);

      // Return the URL
      return objectStorageUrl;
    } catch (error) {
      console.error(`[ObjectStorage] CRITICAL ERROR uploading file ${filePath}:`, error);
      if (error instanceof Error && error.stack) {
        console.error(`[ObjectStorage] Stack trace:`, error.stack);
      }

      // Surface the failure to the caller instead of silently returning a
      // placeholder proxy URL. Callers that genuinely want a default must
      // catch this error and choose one explicitly.
      if (error instanceof ObjectStorageUploadError) {
        throw error;
      }
      throw new ObjectStorageUploadError(
        `Failed to upload file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  /**
   * Upload file data directly to object storage
   * @param data File data (buffer, string, etc.)
   * @param mediaType Media type category
   * @param filename Filename to use in storage
   * @param contentType MIME type
   * @param explicitBucket Explicitly specify which bucket to use (optional)
   * @returns URL to the uploaded file
   */
  async uploadData(data: Buffer | string, mediaType: string, filename: string, contentType?: string, explicitBucket?: string): Promise<string> {
    try {
      // Enhanced debugging
      console.log(`[ObjectStorage] Starting uploadData for ${filename} in ${mediaType}`);
      console.log(`[ObjectStorage] Working directory: ${process.cwd()}`);
      
      // Validation
      if (!data) {
        throw new ObjectStorageUploadError(
          `No data provided for upload of ${filename} in ${mediaType}`
        );
      }

      // Convert string to buffer if needed
      const fileBuffer = typeof data === 'string' ? Buffer.from(data) : data;

      // Verify buffer is not empty
      if (fileBuffer.length === 0) {
        throw new ObjectStorageUploadError(
          `Empty buffer provided for upload of ${filename} in ${mediaType}`
        );
      }
      
      // Log the buffer size for debugging
      console.log(`[ObjectStorage] Buffer size: ${fileBuffer.length} bytes`);
      console.log(`[ObjectStorage] Buffer sample: ${fileBuffer.slice(0, Math.min(20, fileBuffer.length)).toString('hex')}`);
      
      
      // Create a temporary file to use with uploadFromFilename
      const tempFilePath = `/tmp/${Date.now()}-${filename}`;
      
      // Determine bucket based on explicit specification or media type
      const bucket = explicitBucket || this.getBucketForMediaType(mediaType);
      console.log(`[ObjectStorage] Using bucket: ${bucket} (${explicitBucket ? 'explicit' : 'from media type: ' + mediaType})`);
      
      // Generate storage key with safeguards for empty/undefined values
      const safeMediaType = mediaType || 'default';
      const safeFilename = filename || `file-${Date.now()}.bin`;
      
      // Standardize storage key for consistent paths
      let storageKey;
      
      // Special handling for calendar events to ensure consistent prefix
      if (safeMediaType === 'events' || safeMediaType === 'calendar' || safeMediaType === 'calendar-media' ||
          safeMediaType === 'event' || safeMediaType === 'CALENDAR') {
        // Always use events/filename format for event media (without CALENDAR prefix in storage key)
        storageKey = `events/${safeFilename}`;
        console.log(`[ObjectStorage] Using standardized path for calendar event data: ${storageKey}`);
      } else {
        // For other media types, use mediaType/filename format
        storageKey = `${safeMediaType}/${safeFilename}`;
      }
      
      // Additional logging for debugging
      console.log(`[ObjectStorage] Uploading file: ${safeFilename} (${fileBuffer.length} bytes)`);
      console.log(`[ObjectStorage] Media type: ${safeMediaType}, Bucket: ${bucket}`);
      
      // Write the buffer to a temporary file
      fs.writeFileSync(tempFilePath, fileBuffer);
      
      // Upload to object storage with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let lastError;
      
      while (attempts < maxAttempts) {
        try {
          // Upload to object storage using uploadFromFilename with bucket option and headers
          const result = await this.client.uploadFromFilename(storageKey, tempFilePath, {
            contentType: contentType || 'application/octet-stream',
            bucketName: bucket,
            headers: {
              'X-Obj-Bucket': bucket
            }
          });
          
          if (!result.ok) {
            throw new Error(`Upload failed: ${result.error.message}`);
          }

          // Upload successful, return the URL
          const url = `${this.baseUrl}/${bucket}/${storageKey}`;
          console.log(`[ObjectStorage] Successfully uploaded to ${url}`);

          // Verify the object is actually retrievable from the bucket before
          // we hand back a URL. Treat verification failure as an upload
          // failure so callers can't accidentally persist a URL pointing at
          // a missing object.
          const verification = await this.verifyObjectExists(storageKey, bucket);

          // Clean up the temporary file regardless of verification outcome
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }

          if (!verification.exists) {
            throw new ObjectStorageUploadError(
              `Upload of ${storageKey} to ${bucket} reported success but post-upload verification did not find the object${verification.errorMessage ? `: ${verification.errorMessage}` : ''}`
            );
          }

          return url;
        } catch (uploadError) {
          lastError = uploadError;
          attempts++;
          console.error(`[ObjectStorage] Upload attempt ${attempts}/${maxAttempts} failed:`, uploadError);
          
          if (attempts < maxAttempts) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
      
      // All attempts failed
      console.error(`[ObjectStorage] All ${maxAttempts} upload attempts failed for ${safeFilename}`);
      if (lastError) console.error('[ObjectStorage] Last error:', lastError);

      // Clean up the temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      throw new ObjectStorageUploadError(
        `Failed to upload ${safeFilename} to ${bucket} after ${maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
        { cause: lastError }
      );
    } catch (error) {
      console.error(`[ObjectStorage] Error uploading data for ${filename}:`, error);
      if (error instanceof ObjectStorageUploadError) {
        throw error;
      }
      throw new ObjectStorageUploadError(
        `Failed to upload data for ${filename}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  /**
   * Check if a file exists in object storage
   * @param key Storage key of the file
   * @param bucket Optional bucket name to check in
   * @returns Boolean indicating if the file exists
   */
  async fileExists(key: string, bucket?: string): Promise<boolean> {
    try {
      console.log(`[ObjectStorage] Checking if file exists: ${key} in bucket ${bucket || 'DEFAULT'}`);
      
      // First try a direct getFile - this is most reliable
      try {
        await this.getFile(key, bucket);
        console.log(`[ObjectStorage] File exists (direct check): ${bucket || 'DEFAULT'}/${key}`);
        return true;
      } catch (error) {
        // If direct getFile fails, file likely doesn't exist, but we'll try another approach
        console.log(`[ObjectStorage] Direct check failed for ${bucket || 'DEFAULT'}/${key}: ${error.message}`);
      }
      
      // Try to use list with the directory prefix
      try {
        // Extract directory part from key to use as prefix
        const keyParts = key.split('/');
        const filename = keyParts[keyParts.length - 1];
        const prefix = keyParts.length > 1 ? keyParts.slice(0, -1).join('/') : '';
        
        console.log(`[ObjectStorage] Trying list operation with prefix: '${prefix || '*'}', looking for: '${filename}'`);
        
        // Set up options with bucket
        const options = {
          ...(bucket ? { bucketName: bucket } : {})
        };
        
        // Use list method with or without prefix depending on key structure
        const result = prefix 
          ? await this.client.list({ prefix, ...options })
          : await this.client.list(options);
        
        // Check the results
        if (result && result.objects && result.objects.length > 0) {
          console.log(`[ObjectStorage] Found ${result.objects.length} objects in bucket`);
          
          // Check if the file exists in the result
          const exists = result.objects.some(obj => 
            obj.key === key || // Exact match
            obj.key === filename || // Just filename
            obj.key.endsWith('/' + filename) // Path ending with filename
          );
          
          console.log(`[ObjectStorage] File ${exists ? 'EXISTS' : 'NOT FOUND'}`);
          return exists;
        } else {
          console.log(`[ObjectStorage] No objects found in bucket ${bucket || 'DEFAULT'} with prefix ${prefix || '*'}`);
          return false;
        }
      } catch (listError) {
        console.error(`[ObjectStorage] Error listing objects in bucket ${bucket || 'DEFAULT'}:`, listError);
        return false;
      }
    } catch (error) {
      console.error(`[ObjectStorage] Error checking if file exists ${key} in bucket ${bucket || 'DEFAULT'}:`, error);
      return false;
    }
  }

  /**
   * Get a file from object storage
   * @param key Storage key of the file
   * @returns File data as a buffer
   */
  async getFile(key: string, bucket?: string): Promise<Buffer> {
    try {
      // Default to DEFAULT bucket if not specified
      const bucketToUse = bucket || BUCKETS.DEFAULT;
      
      // Always include the bucket header for consistent behavior
      const options = {
        bucketName: bucketToUse,
        headers: {
          'X-Obj-Bucket': bucketToUse
        }
      };
      
      console.log(`[ObjectStorage] Getting file: ${key} from bucket ${bucket || 'default'}`);
      
      // Use downloadAsBytes method which returns a Result with a Buffer array
      const result = await this.client.downloadAsBytes(key, options);
      
      if (!result.ok) {
        throw new Error(`Failed to download file: ${result.error.message}`);
      }
      
      // downloadAsBytes returns an array with one Buffer element
      return result.value[0];
    } catch (error) {
      console.error(`Error getting file ${key} from bucket ${bucket || 'default'}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file from object storage
   * @param key Storage key of the file
   * @returns Boolean indicating success
   */
  async deleteFile(key: string, bucket?: string): Promise<boolean> {
    try {
      // Default to DEFAULT bucket if not specified
      const bucketToUse = bucket || BUCKETS.DEFAULT;
      
      // Always include the bucket header for consistent behavior
      const options = {
        bucketName: bucketToUse,
        headers: {
          'X-Obj-Bucket': bucketToUse
        }
      };
      
      console.log(`[ObjectStorage] Deleting file: ${key} from bucket ${bucket || 'default'}`);
      
      const result = await this.client.delete(key, options);
      
      if (!result.ok) {
        throw new Error(`Failed to delete file: ${result.error.message}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting file ${key} from bucket ${bucket || 'default'}:`, error);
      return false;
    }
  }

  /**
   * List files in object storage with a prefix
   * @param prefix Prefix to list files under
   * @returns Array of file keys
   */
  async listFiles(prefix: string, bucketName?: string): Promise<string[]> {
    try {
      // Default to DEFAULT bucket if not specified
      const bucketToUse = bucketName || BUCKETS.DEFAULT;
      
      // Always include the bucket with headers
      const options = { 
        prefix,
        bucketName: bucketToUse,
        headers: {
          'X-Obj-Bucket': bucketToUse
        }
      };
      
      console.log(`[ObjectStorage] Listing files with prefix ${prefix} in bucket ${bucketName || 'default'}`);
      
      const result = await this.client.list(options);
      
      if (!result.ok) {
        throw new Error(`Failed to list files: ${result.error.message}`);
      }
      
      return result.value.map(obj => obj.name);
    } catch (error) {
      console.error(`Error listing files with prefix ${prefix} in bucket ${bucketName || 'default'}:`, error);
      return [];
    }
  }

  /**
   * Determine which bucket to use for a media type
   * @param mediaType The type of media
   * @returns The appropriate bucket
   */
  getBucketForMediaType(mediaType: string): BucketType {
    const normalizedType = mediaType.toLowerCase();
    return MEDIA_TYPE_TO_BUCKET[normalizedType] || BUCKETS.DEFAULT;
  }

  /**
   * Migrate a file from PostgreSQL to object storage
   * @param dbId ID of the record in the database
   * @param table Database table name
   * @param column Column containing the file data
   * @param mediaType Type of media being migrated
   * @param filenameColumn Column containing the filename
   * @returns Migration record
   */
  async migrateFromPostgreSQL(
    dbId: number,
    table: string,
    column: string,
    mediaType: string,
    filenameColumn?: string
  ) {
    try {
      // Get the file data from the database
      const query = `SELECT ${column}${filenameColumn ? `, ${filenameColumn}` : ''} 
                    FROM ${table} WHERE id = $1`;
      const result = await db.query(query, [dbId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Record not found: ${table} with ID ${dbId}`);
      }
      
      const fileData = result.rows[0][column];
      
      if (!fileData) {
        throw new Error(`No file data found in ${table}.${column} for ID ${dbId}`);
      }
      
      // Determine filename
      let filename;
      if (filenameColumn && result.rows[0][filenameColumn]) {
        filename = result.rows[0][filenameColumn];
      } else {
        // Generate a filename based on the table, column, and ID
        const extension = this.getExtensionFromBuffer(fileData);
        filename = `${table}-${column}-${dbId}${extension}`;
      }
      
      // Create migration record
      const sourceLocation = `${table}.${column}.${dbId}`;
      
      // Standardize storage key for consistent paths
      let storageKey;
      if (mediaType === 'events' || mediaType === 'calendar' || mediaType === 'calendar-media' ||
          mediaType === 'event' || mediaType === 'CALENDAR') {
        // Always use events/filename format for event media (without CALENDAR prefix in storage key)
        storageKey = `events/${filename}`;
        console.log(`[ObjectStorage] Migration: Using standardized path for calendar event: ${storageKey}`);
      } else {
        // For other media types, use regular format
        storageKey = `${mediaType}/${filename}`;
      }
      
      const bucket = this.getBucketForMediaType(mediaType);
      
      const migrationRecord = await migrationService.createMigrationRecord({
        sourceType: SOURCE_TYPE.POSTGRESQL,
        sourceLocation,
        mediaBucket: bucket,
        mediaType,
        storageKey,
        migrationStatus: MIGRATION_STATUS.PENDING
      });
      
      // Upload to object storage
      const contentType = mime.lookup(filename) || 'application/octet-stream';
      const url = await this.uploadData(fileData, mediaType, filename, contentType);
      
      // Update migration record
      const updatedRecord = await migrationService.updateMigrationStatus(
        migrationRecord.id,
        MIGRATION_STATUS.MIGRATED
      );
      
      return { record: updatedRecord, url };
    } catch (error) {
      console.error(`Error migrating from PostgreSQL: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Try to determine file extension from a Buffer
   * @param buffer File data buffer
   * @returns File extension with dot
   */
  private getExtensionFromBuffer(buffer: Buffer): string {
    // Simple signature check for common file types
    if (buffer.length < 4) return '.bin';
    
    const header = buffer.subarray(0, 4).toString('hex');
    
    // Check for common file signatures
    if (header.startsWith('89504e47')) return '.png';
    if (header.startsWith('ffd8ff')) return '.jpg';
    if (header.startsWith('47494638')) return '.gif';
    if (header.startsWith('52494646')) return '.webp'; // RIFF header, check for WEBP
    if (header.startsWith('504b0304')) return '.zip';
    if (header.startsWith('25504446')) return '.pdf';
    
    // Default
    return '.bin';
  }
}

// Export a singleton instance
export const objectStorageService = new ObjectStorageService();