/**
 * Banner Slides Helper Routes
 * 
 * This file contains helper endpoints for banner slides:
 * - Diagnostic page to check media status
 * - Force reload/clear cache utilities
 * - Migration status information
 */

import { Router } from 'express';
import { Client } from '@replit/object-storage';
import path from 'path';
import fs from 'fs';
import { requireAdmin, requireAuth } from '../auth';

const router = Router();
const objectStore = new Client();

const BANNER_BUCKET = 'BANNER';
const DEFAULT_BUCKET = 'DEFAULT';

// GET /api/banner-diagnostic - Shows banner media diagnostic information
router.get('/banner-diagnostic', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get banner slides from database
    const bannerSlides = await req.db.query(`
      SELECT * FROM "bannerSlides" ORDER BY "updatedAt" DESC LIMIT 10
    `);
    
    // Check if banner bucket exists
    let bannerBucketExists = false;
    let defaultBucketExists = false;
    
    try {
      const buckets = await objectStore.listBuckets();
      bannerBucketExists = buckets.includes(BANNER_BUCKET);
      defaultBucketExists = buckets.includes(DEFAULT_BUCKET);
    } catch (error) {
      console.error('Error checking buckets:', error);
    }
    
    // Get some files from file system
    const bannerDir = path.join(process.cwd(), 'uploads', 'banner-slides');
    let filesystemFiles = [];
    
    try {
      if (fs.existsSync(bannerDir)) {
        const files = fs.readdirSync(bannerDir).slice(0, 10);
        filesystemFiles = files;
      }
    } catch (error) {
      console.error('Error reading banner-slides directory:', error);
    }
    
    // Get objects from banner bucket
    let bannerObjects = [];
    
    if (bannerBucketExists) {
      try {
        const objects = await objectStore.listObjects({ bucket: BANNER_BUCKET });
        bannerObjects = objects.slice(0, 10);
      } catch (error) {
        console.error('Error listing objects in BANNER bucket:', error);
      }
    }
    
    // Get objects from default bucket with banner-slides prefix
    let defaultBannerObjects = [];
    
    if (defaultBucketExists) {
      try {
        const objects = await objectStore.listObjects({ 
          bucket: DEFAULT_BUCKET,
          prefix: 'banner-slides/'
        });
        defaultBannerObjects = objects.slice(0, 10);
      } catch (error) {
        console.error('Error listing objects in DEFAULT bucket:', error);
      }
    }
    
    res.json({
      status: 'success',
      bannerSlides: bannerSlides.rows,
      buckets: {
        banner: {
          exists: bannerBucketExists,
          objectCount: bannerObjects.length,
          recentObjects: bannerObjects
        },
        default: {
          exists: defaultBucketExists,
          bannerObjectCount: defaultBannerObjects.length,
          recentBannerObjects: defaultBannerObjects
        }
      },
      filesystem: {
        directoryExists: fs.existsSync(bannerDir),
        fileCount: filesystemFiles.length,
        recentFiles: filesystemFiles
      }
    });
  } catch (error) {
    console.error('Error in banner diagnostic endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating banner diagnostic information',
      error: error.message
    });
  }
});

// POST /api/banner-force-migration - Force migration of banner slides to Object Storage
router.post('/banner-force-migration', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    
    // If ID is provided, migrate just that slide
    if (id) {
      const slide = await req.db.query(
        `SELECT * FROM "bannerSlides" WHERE id = $1`,
        [id]
      );
      
      if (slide.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: `Banner slide with ID ${id} not found`
        });
      }
      
      const { mediaUrl } = slide.rows[0];
      
      if (!mediaUrl) {
        return res.status(400).json({
          status: 'error',
          message: 'Banner slide has no media URL'
        });
      }
      
      // Extract filename from mediaUrl
      const filename = path.basename(mediaUrl);
      
      // Check if file exists locally
      const localPath = path.join(process.cwd(), 'uploads', 'banner-slides', filename);
      const alternativePath = path.join(process.cwd(), mediaUrl.startsWith('/') ? mediaUrl.substring(1) : mediaUrl);
      
      const filePath = fs.existsSync(localPath) ? localPath : 
                      fs.existsSync(alternativePath) ? alternativePath : null;
      
      if (!filePath) {
        return res.status(404).json({
          status: 'error',
          message: `File not found at ${localPath} or ${alternativePath}`
        });
      }
      
      // Upload to Object Storage
      const fileContent = fs.readFileSync(filePath);
      const objectKey = `banner-slides/${filename}`;
      
      // Determine content type
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.mp4') contentType = 'video/mp4';
      else if (ext === '.webm') contentType = 'video/webm';
      else if (ext === '.mov') contentType = 'video/quicktime';
      else if (ext === '.m4v') contentType = 'video/mp4';
      
      // Ensure BANNER bucket exists
      try {
        const buckets = await objectStore.listBuckets();
        if (!buckets.includes(BANNER_BUCKET)) {
          await objectStore.createBucket(BANNER_BUCKET);
        }
      } catch (error) {
        console.error('Error ensuring BANNER bucket exists:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to ensure BANNER bucket exists',
          error: error.message
        });
      }
      
      // Upload to Object Storage
      try {
        await objectStore.putObject({
          bucket: BANNER_BUCKET,
          key: objectKey,
          body: fileContent,
          contentType
        });
      } catch (error) {
        console.error('Error uploading to Object Storage:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to upload to Object Storage',
          error: error.message
        });
      }
      
      // Update database with Object Storage URL
      const objectStorageUrl = `https://object-storage.replit.app/${BANNER_BUCKET}/${objectKey}`;
      
      try {
        await req.db.query(
          `UPDATE "bannerSlides" SET "objectStorageUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [objectStorageUrl, id]
        );
      } catch (error) {
        console.error('Error updating database:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to update database',
          error: error.message
        });
      }
      
      return res.json({
        status: 'success',
        message: `Successfully migrated banner slide with ID ${id}`,
        objectStorageUrl
      });
    } else {
      // Queue a background job to migrate all slides
      res.json({
        status: 'success',
        message: 'Background migration of all banner slides has been queued',
        note: 'This will happen asynchronously. Check banner diagnostic endpoint for status.'
      });
      
      // Start the migration asynchronously
      setTimeout(async () => {
        try {
          const slides = await req.db.query(
            `SELECT * FROM "bannerSlides" WHERE "objectStorageUrl" IS NULL OR "objectStorageUrl" = ''`
          );
          
          console.log(`Starting migration of ${slides.rows.length} banner slides without Object Storage URLs`);
          
          // Process in smaller batches to avoid timeouts
          for (const slide of slides.rows) {
            try {
              const { id, mediaUrl } = slide;
              
              if (!mediaUrl) {
                console.log(`Slide ${id} has no media URL, skipping`);
                continue;
              }
              
              // Extract filename from mediaUrl
              const filename = path.basename(mediaUrl);
              
              // Check if file exists locally
              const localPath = path.join(process.cwd(), 'uploads', 'banner-slides', filename);
              const alternativePath = path.join(process.cwd(), mediaUrl.startsWith('/') ? mediaUrl.substring(1) : mediaUrl);
              
              const filePath = fs.existsSync(localPath) ? localPath : 
                              fs.existsSync(alternativePath) ? alternativePath : null;
              
              if (!filePath) {
                console.log(`File not found for slide ${id} at ${localPath} or ${alternativePath}`);
                continue;
              }
              
              // Determine content type
              const ext = path.extname(filename).toLowerCase();
              let contentType = 'application/octet-stream';
              
              if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
              else if (ext === '.png') contentType = 'image/png';
              else if (ext === '.gif') contentType = 'image/gif';
              else if (ext === '.webp') contentType = 'image/webp';
              else if (ext === '.svg') contentType = 'image/svg+xml';
              else if (ext === '.mp4') contentType = 'video/mp4';
              else if (ext === '.webm') contentType = 'video/webm';
              else if (ext === '.mov') contentType = 'video/quicktime';
              else if (ext === '.m4v') contentType = 'video/mp4';
              
              // Upload to Object Storage
              const fileContent = fs.readFileSync(filePath);
              const objectKey = `banner-slides/${filename}`;
              
              // Ensure BANNER bucket exists
              try {
                const buckets = await objectStore.listBuckets();
                if (!buckets.includes(BANNER_BUCKET)) {
                  await objectStore.createBucket(BANNER_BUCKET);
                }
              } catch (error) {
                console.error(`Error ensuring BANNER bucket exists for slide ${id}:`, error);
                continue;
              }
              
              // Upload to Object Storage
              try {
                await objectStore.putObject({
                  bucket: BANNER_BUCKET,
                  key: objectKey,
                  body: fileContent,
                  contentType
                });
              } catch (error) {
                console.error(`Error uploading to Object Storage for slide ${id}:`, error);
                continue;
              }
              
              // Update database with Object Storage URL
              const objectStorageUrl = `https://object-storage.replit.app/${BANNER_BUCKET}/${objectKey}`;
              
              try {
                await req.db.query(
                  `UPDATE "bannerSlides" SET "objectStorageUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
                  [objectStorageUrl, id]
                );
                console.log(`Successfully migrated banner slide with ID ${id}`);
              } catch (error) {
                console.error(`Error updating database for slide ${id}:`, error);
                continue;
              }
            } catch (error) {
              console.error(`Error processing slide ${slide.id}:`, error);
              continue;
            }
          }
          
          console.log('Background migration of banner slides completed');
        } catch (error) {
          console.error('Error in background migration:', error);
        }
      }, 0);
    }
  } catch (error) {
    console.error('Error in banner force migration endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error forcing banner slide migration',
      error: error.message
    });
  }
});

// GET /api/banner-reload-media - Force reload of banner media
router.get('/banner-reload-media', (req, res) => {
  try {
    // Return a script to execute in the browser to clear cache
    const script = `
      <script>
        // Clear localStorage cache for media
        function clearMediaCache() {
          console.log("Running media cache clearing script...");
          const clearedItems = [];
          
          if (window.localStorage) {
            // Find all cache entries related to media
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (
                  key.includes('banner-slides') || 
                  key.includes('bannerImage') ||
                  key.includes('media-cache:/')
                )) {
                keysToRemove.push(key);
              }
            }
            
            // Remove all found keys
            keysToRemove.forEach(key => {
              localStorage.removeItem(key);
              clearedItems.push(key);
              console.log(\`Cleared cached item: \${key}\`);
            });
          }
          
          // Set a flag to force reloading of banners
          window.__forceReloadBanners = true;
          window.__lastCacheClear = new Date().toISOString();
          
          console.log(\`Cleared \${clearedItems.length} cached items from localStorage\`);
          console.log("Cache clearing complete!");
          
          const message = document.createElement('div');
          message.style.position = 'fixed';
          message.style.top = '50%';
          message.style.left = '50%';
          message.style.transform = 'translate(-50%, -50%)';
          message.style.background = 'rgba(0, 150, 0, 0.9)';
          message.style.color = 'white';
          message.style.padding = '20px';
          message.style.borderRadius = '10px';
          message.style.zIndex = '9999';
          message.style.fontSize = '16px';
          message.style.textAlign = 'center';
          message.innerHTML = \`
            <h3>Cache Cleared!</h3>
            <p>\${clearedItems.length} items removed from cache.</p>
            <p>Reloading page in 2 seconds...</p>
          \`;
          document.body.appendChild(message);
          
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          
          return clearedItems.length;
        }
        
        clearMediaCache();
      </script>
    `;
    
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Banner Media Cache Cleared</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              text-align: center;
            }
            h1 {
              color: #4a5568;
            }
            .info {
              background-color: #e2e8f0;
              padding: 20px;
              border-radius: 10px;
              margin: 20px 0;
            }
            .status {
              font-size: 18px;
              margin: 20px 0;
            }
            .redirect {
              margin-top: 30px;
            }
          </style>
        </head>
        <body>
          <h1>Banner Media Cache Utility</h1>
          <div class="info">
            <h2>Cache Clearing In Progress</h2>
            <p>This utility clears cached banner images and media files from your browser.</p>
            <p>After clearing the cache, the page will automatically reload.</p>
          </div>
          <div class="status">
            <p>Status: <span id="status">Working...</span></p>
          </div>
          <div class="redirect">
            <p>If you are not redirected automatically, <a href="/">click here</a> to go to the home page.</p>
          </div>
          ${script}
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in banner reload media endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating cache clear script',
      error: error.message
    });
  }
});

export default router;