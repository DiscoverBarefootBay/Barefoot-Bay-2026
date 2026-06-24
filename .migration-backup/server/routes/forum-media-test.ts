/**
 * Forum Media Test Endpoint
 * 
 * Specialized diagnostic endpoints for testing forum media uploads and URL formats.
 * This provides detailed logging and verification for all aspects of forum media handling.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { objectStorageService, BUCKETS } from '../object-storage-service';
import { unifiedStorageService } from '../unified-storage-service';
import { processUploadedFiles } from '../media-upload-middleware';
import { ensureDirectoryExists } from '../media-path-utils';
import { db } from '../db';
import { forumPosts } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Create express router
const router = Router();

// Configure storage for diagnostics
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    const uploadDir = path.join(__dirname, '../../tmp_debug');
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'test-forum-' + uniqueSuffix + ext);
  }
});

// Configure upload middleware
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Endpoint to test basic upload functionality
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    console.log('[ForumMediaTest] Starting diagnostic upload test');
    
    if (!req.file) {
      console.log('[ForumMediaTest] No file uploaded');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const file = req.file;
    console.log(`[ForumMediaTest] File received: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
    console.log(`[ForumMediaTest] Temporary file location: ${file.path}`);
    
    // Read the file
    const fileBuffer = fs.readFileSync(file.path);
    
    // TEST 1: Upload directly to Object Storage
    console.log('[ForumMediaTest] TEST 1: Direct Object Storage upload');
    const storageKey = `forum/${path.basename(file.path)}`;
    
    try {
      await objectStorageService.putFile(storageKey, fileBuffer, BUCKETS.FORUM);
      console.log(`[ForumMediaTest] Successfully uploaded to Object Storage: ${storageKey} in bucket ${BUCKETS.FORUM}`);
    } catch (error) {
      console.error(`[ForumMediaTest] Object Storage upload failed: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Object Storage upload failed',
        error: error.message
      });
    }
    
    // TEST 2: Retrieve from Object Storage
    console.log('[ForumMediaTest] TEST 2: Retrieving from Object Storage');
    try {
      const retrievedBuffer = await objectStorageService.getFile(storageKey, BUCKETS.FORUM);
      console.log(`[ForumMediaTest] Successfully retrieved from Object Storage: ${storageKey} (${retrievedBuffer.length} bytes)`);
    } catch (error) {
      console.error(`[ForumMediaTest] Object Storage retrieval failed: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Object Storage retrieval failed',
        error: error.message
      });
    }
    
    // TEST 3: Test all URL formats
    console.log('[ForumMediaTest] TEST 3: Testing URL formats');
    const filename = path.basename(file.path);
    const urlFormats = [
      { name: 'Standard Format', url: `/api/storage-proxy/FORUM/forum/${filename}` },
      { name: 'Direct Forum', url: `/api/storage-proxy/direct-forum/${filename}` },
      { name: 'FORUM bucket only', url: `/api/storage-proxy/FORUM/${filename}` },
      { name: 'Legacy format', url: `/uploads/forum-media/${filename}` },
      { name: 'Direct forum-media', url: `/forum-media/${filename}` },
    ];
    
    // Prepare results object
    const results = {
      success: true,
      file: {
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        storagePath: storageKey,
        bucket: BUCKETS.FORUM
      },
      objectStorage: {
        success: true,
        uploadKey: storageKey,
        bucket: BUCKETS.FORUM
      },
      urlFormats,
      diagnostics: {
        timestamp: new Date().toISOString(),
        serverVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      }
    };
    
    // Clean up temporary file
    try {
      fs.unlinkSync(file.path);
      console.log(`[ForumMediaTest] Cleaned up temporary file: ${file.path}`);
    } catch (cleanError) {
      console.warn(`[ForumMediaTest] Failed to clean up temporary file: ${cleanError.message}`);
    }
    
    console.log('[ForumMediaTest] All tests completed successfully');
    res.json(results);
    
  } catch (error) {
    console.error(`[ForumMediaTest] Unexpected error in diagnostic test: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Diagnostic test failed',
      error: error.message
    });
  }
});

// Endpoint to test all URL formats for a given filename
router.get('/test-formats/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  console.log(`[ForumMediaTest] Testing URL formats for file: ${filename}`);
  
  // Create an array of all possible URL formats
  const urlFormats = [
    { name: 'Standard Format', url: `/api/storage-proxy/FORUM/forum/${filename}` },
    { name: 'Direct Forum', url: `/api/storage-proxy/direct-forum/${filename}` },
    { name: 'FORUM bucket only', url: `/api/storage-proxy/FORUM/${filename}` },
    { name: 'Legacy format', url: `/uploads/forum-media/${filename}` },
    { name: 'Direct forum-media', url: `/forum-media/${filename}` },
    { name: 'Double forum path', url: `/api/storage-proxy/FORUM/forum/forum/${filename}` }
  ];
  
  // Test if the file exists in Object Storage
  try {
    const storageKey = `forum/${filename}`;
    const exists = await objectStorageService.fileExists(storageKey, BUCKETS.FORUM);
    
    res.json({
      success: true,
      filename,
      exists,
      urlFormats,
      message: exists ? 
        `File "${filename}" exists in Object Storage at ${storageKey}` : 
        `File "${filename}" does not exist in Object Storage at ${storageKey}`
    });
  } catch (error) {
    console.error(`[ForumMediaTest] Error checking file existence: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error checking file existence',
      error: error.message
    });
  }
});

// Endpoint to simulate forum post editor uploads
router.post('/editor-upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const file = req.file;
    const postId = req.body.postId || '0';
    
    console.log(`[ForumMediaTest] Editor upload test for post ID: ${postId}`);
    console.log(`[ForumMediaTest] File received: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
    
    // Create a mock req object with necessary fields
    const mockReq: any = {
      mediaType: 'forum',
      body: { 
        ...req.body,
        postId 
      },
      file: file,
      originalUrl: `/forum/edit-post/${postId}`
    };
    
    // Process the file with the media upload middleware
    const processingResult = await processUploadedFiles(mockReq, [file]);
    
    if (!processingResult.success) {
      console.error(`[ForumMediaTest] Editor upload processing failed: ${processingResult.message}`);
      return res.status(500).json({
        success: false,
        message: 'Media processing failed',
        error: processingResult.message
      });
    }
    
    // Build detailed diagnostics
    const results = {
      success: true,
      file: {
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
      processingResult,
      editorContext: {
        postId,
        uploadPath: processingResult.urls[0] || null
      },
      diagnostics: {
        timestamp: new Date().toISOString(),
        mockRequest: {
          mediaType: mockReq.mediaType,
          originalUrl: mockReq.originalUrl
        }
      }
    };
    
    // Clean up temporary file
    try {
      fs.unlinkSync(file.path);
    } catch (cleanError) {
      console.warn(`[ForumMediaTest] Failed to clean up temporary file: ${cleanError.message}`);
    }
    
    res.json(results);
    
  } catch (error) {
    console.error(`[ForumMediaTest] Error in editor upload test: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Editor upload test failed',
      error: error.message
    });
  }
});

// Endpoint to get system information and environment
router.get('/system-info', (req: Request, res: Response) => {
  // Gather system info
  const info = {
    timestamp: new Date().toISOString(),
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage()
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 'default'
    },
    storage: {
      objectStorageAvailable: !!objectStorageService,
      unifiedStorageAvailable: !!unifiedStorageService,
      supportedBuckets: Object.keys(BUCKETS)
    },
    auth: {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      user: req.isAuthenticated && req.isAuthenticated() ? {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role
      } : null
    }
  };
  
  res.json(info);
});

// Direct upload authorization for Object Storage
router.get('/direct-upload-auth', async (req: Request, res: Response) => {
  try {
    // Don't require filename in the query, just provide a token
    // This allows the frontend to handle the filename directly
    console.log(`[ForumMediaTest] Processing direct upload auth request`);
    
    // Get an upload token from Object Storage service
    const token = await objectStorageService.getToken();
    
    if (!token) {
      throw new Error('Failed to get Object Storage token');
    }
    
    // Create the response with token only
    const result = {
      success: true,
      token,
      bucket: BUCKETS.FORUM
    };
    
    res.json(result);
    
  } catch (error) {
    console.error(`[ForumMediaTest] Direct upload auth error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to authorize direct upload',
      error: error.message
    });
  }
});

// Add specialized debugging routes for forum URL formats
router.get('/debug/:format/:filename', async (req: Request, res: Response) => {
  const { format, filename } = req.params;
  console.log(`[ForumMediaTest] Debug request for format: ${format}, file: ${filename}`);
  
  let url = '';
  
  // Map format to URL pattern
  switch (format) {
    case 'standard':
      url = `/api/storage-proxy/FORUM/forum/${filename}`;
      break;
    case 'direct':
      url = `/api/storage-proxy/direct-forum/${filename}`;
      break;
    case 'bucket':
      url = `/api/storage-proxy/FORUM/${filename}`;
      break;
    case 'legacy':
      url = `/uploads/forum-media/${filename}`;
      break;
    case 'direct-media':
      url = `/forum-media/${filename}`;
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid format specified',
        validFormats: ['standard', 'direct', 'bucket', 'legacy', 'direct-media']
      });
  }
  
  // Construct protocol-relative URL
  const fullUrl = `${req.protocol}://${req.get('host')}${url}`;
  
  // Return debug info
  res.json({
    success: true,
    format,
    filename,
    url,
    fullUrl,
    instructions: 'Use this URL to test access to the file'
  });
});

// Add a specialized endpoint to check media URLs in a specific forum post
router.get('/post-media/:postId', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const postIdNumber = parseInt(postId);
    
    if (isNaN(postIdNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID'
      });
    }
    
    console.log(`[ForumMediaTest] Checking media for post ID: ${postIdNumber}`);
    
    // Query to get post data from the database
    // This example assumes a database table structure, modify as needed
    try {
      // Get post data from database
      const [post] = await db.select().from(forumPosts).where(eq(forumPosts.id, postIdNumber));
      
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }
      
      console.log(`[ForumMediaTest] Found post: ${post.title}`);
      
      // Extract media URLs from post content
      const mediaUrls = extractMediaUrls(post.content);
      
      // Check URL formats and accessibility
      const mediaChecks = await Promise.all(mediaUrls.map(async (url) => {
        try {
          // Check if URL is accessible
          const accessible = await checkUrlAccessible(url);
          
          // Determine URL format
          const format = determineUrlFormat(url);
          
          return {
            url,
            format,
            accessible,
            correctedUrl: correctUrlFormat(url)
          };
        } catch (error) {
          return {
            url,
            error: error.message,
            accessible: false,
            format: 'unknown'
          };
        }
      }));
      
      return res.json({
        success: true,
        postId: post.id,
        title: post.title,
        mediaCount: mediaUrls.length,
        mediaUrls: mediaChecks,
        content: post.content.substring(0, 500) + (post.content.length > 500 ? '...' : '')
      });
      
    } catch (dbError) {
      console.error(`[ForumMediaTest] Database error: ${dbError.message}`);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: dbError.message
      });
    }
  } catch (error) {
    console.error(`[ForumMediaTest] Error checking post media: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error checking post media',
      error: error.message
    });
  }
});

// Helper functions for post media checks
function extractMediaUrls(content: string): string[] {
  const urls: string[] = [];
  
  // Regular expression to match image tags in HTML content
  const imgRegex = /<img[^>]+src\s*=\s*['"]([^'"]+)['"]/g;
  let match;
  
  while (match = imgRegex.exec(content)) {
    urls.push(match[1]);
  }
  
  return urls;
}

function determineUrlFormat(url: string): string {
  if (url.startsWith('/api/storage-proxy/FORUM/forum/')) {
    return 'standard-format';
  } else if (url.startsWith('/api/storage-proxy/direct-forum/')) {
    return 'direct-forum';
  } else if (url.startsWith('/api/storage-proxy/FORUM/')) {
    return 'bucket-only';
  } else if (url.startsWith('/uploads/forum-media/')) {
    return 'legacy-format';
  } else if (url.startsWith('/forum-media/')) {
    return 'direct-media';
  } else if (url.includes('object-storage.replit.app')) {
    return 'direct-object-storage';
  }
  
  return 'unknown';
}

function correctUrlFormat(url: string): string {
  // Extract filename from various URL formats
  let filename = '';
  
  if (url.startsWith('/api/storage-proxy/')) {
    // Extract from proxy URL formats
    const match = url.match(/\/api\/storage-proxy\/(?:FORUM\/forum\/|direct-forum\/|FORUM\/)([^/]+)$/);
    if (match) filename = match[1];
  } else if (url.startsWith('/uploads/forum-media/')) {
    // Extract from legacy format
    const match = url.match(/\/uploads\/forum-media\/([^/]+)$/);
    if (match) filename = match[1];
  } else if (url.startsWith('/forum-media/')) {
    // Extract from direct media format
    const match = url.match(/\/forum-media\/([^/]+)$/);
    if (match) filename = match[1];
  } else if (url.includes('object-storage.replit.app')) {
    // Extract from direct Object Storage URL
    const match = url.match(/\/([^/]+)$/);
    if (match) filename = match[1];
  }
  
  // If filename was extracted, return the correct standard format
  if (filename) {
    return `/api/storage-proxy/FORUM/forum/${filename}`;
  }
  
  // If no filename could be extracted, return original URL
  return url;
}

async function checkUrlAccessible(url: string): Promise<boolean> {
  try {
    // For direct Object Storage URLs, we'll use a different approach
    if (url.includes('object-storage.replit.app')) {
      // This would require token authentication, so we'll return false
      return false;
    }
    
    // For relative URLs, we need the full URL with hostname
    const fullUrl = url.startsWith('http') 
      ? url 
      : `${process.env.SITE_URL || 'http://localhost:5000'}${url.startsWith('/') ? '' : '/'}${url}`;
    
    const response = await fetch(fullUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error(`[ForumMediaTest] Error checking URL: ${url}`, error.message);
    return false;
  }
}

export default router;