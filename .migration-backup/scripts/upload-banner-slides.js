/**
 * Simple script to upload banner slides to Object Storage
 * Works around issues with complex Object Storage client implementation
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';
import pg from 'pg';

// Load environment variables
dotenv.config();

// Constants
const OBJECT_STORAGE_TOKEN = process.env.REPLIT_OBJECT_STORAGE_TOKEN;
const API_URL = 'https://object-storage.replit.app';
const DEFAULT_BUCKET = 'DEFAULT';
const BANNER_SLIDES_PREFIX = 'banner-slides/';
const BANNER_SLIDES_FILESYSTEM_PATH = './uploads/banner-slides';
const BANNER_SLIDES_ROOT_FILESYSTEM_PATH = './banner-slides';
const BANNER_SLIDES_SLUG = 'banner-slides';

// Initialize database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    console.log('Starting banner slides upload...');
    
    // Check if token is available
    if (!OBJECT_STORAGE_TOKEN) {
      throw new Error('REPLIT_OBJECT_STORAGE_TOKEN is not set');
    }
    
    // Ensure directories exist
    ensureDirectoriesExist();
    
    // 1. Get banner slides from database
    console.log('Fetching banner slides from database...');
    const slides = await getBannerSlidesFromDB();
    console.log(`Found ${slides.length} banner slides in database.`);
    
    // 2. Get files from filesystem
    console.log('Scanning filesystem for banner slides...');
    const filesystemFiles = {
      uploads: scanDirectory(BANNER_SLIDES_FILESYSTEM_PATH),
      root: scanDirectory(BANNER_SLIDES_ROOT_FILESYSTEM_PATH),
    };
    
    console.log(`Found ${filesystemFiles.uploads.length} files in /uploads/banner-slides`);
    console.log(`Found ${filesystemFiles.root.length} files in /banner-slides`);
    
    // 3. Upload files to Object Storage
    console.log('Uploading files to Object Storage...');
    const uploadResults = await uploadFilesToObjectStorage(filesystemFiles);
    
    console.log(`Successfully uploaded ${uploadResults.success} files`);
    if (uploadResults.failed > 0) {
      console.log(`Failed to upload ${uploadResults.failed} files`);
    }
    
    // 4. Update database to use Object Storage URLs
    if (slides.length > 0) {
      console.log('Updating database to use Object Storage URLs...');
      const updateResults = await updateDatabaseUrls(slides);
      console.log(`Updated ${updateResults.updated} slides in database`);
    }
    
    console.log('Banner slides upload completed!');
    
    return {
      slidesFound: slides.length,
      filesFound: filesystemFiles.uploads.length + filesystemFiles.root.length,
      uploaded: uploadResults.success,
      failed: uploadResults.failed,
    };
  } catch (error) {
    console.error('Error during banner slides upload:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Ensure required directories exist
 */
function ensureDirectoriesExist() {
  const directories = [
    BANNER_SLIDES_FILESYSTEM_PATH,
    BANNER_SLIDES_ROOT_FILESYSTEM_PATH
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Get banner slides from database
 */
async function getBannerSlidesFromDB() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, slug, content FROM page_contents WHERE slug = $1`,
      [BANNER_SLIDES_SLUG]
    );
    
    let slides = [];
    
    if (result.rows.length > 0) {
      const pageContent = result.rows[0];
      
      // Parse content
      const content = typeof pageContent.content === 'string' 
        ? JSON.parse(pageContent.content) 
        : pageContent.content;
      
      // Extract slides array
      if (Array.isArray(content.slides)) {
        slides = content.slides;
        
        // Log each slide for debugging
        slides.forEach((slide, index) => {
          console.log(`Slide ${index + 1}:`);
          console.log(`- Title: ${slide.title || 'No title'}`);
          console.log(`- Background: ${slide.background || 'No background'}`);
          console.log(`- Background Type: ${slide.backgroundType || 'No background type'}`);
        });
      }
    }
    
    return slides;
  } finally {
    client.release();
  }
}

/**
 * Scan a directory for files
 */
function scanDirectory(directoryPath) {
  try {
    if (!fs.existsSync(directoryPath)) {
      console.warn(`Directory does not exist: ${directoryPath}`);
      return [];
    }
    
    const files = fs.readdirSync(directoryPath);
    
    return files
      .filter(file => {
        const filePath = path.join(directoryPath, file);
        return fs.statSync(filePath).isFile();
      })
      .map(file => {
        const filePath = path.join(directoryPath, file);
        const stats = fs.statSync(filePath);
        
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          mtime: stats.mtime,
        };
      });
  } catch (error) {
    console.error(`Error scanning directory ${directoryPath}:`, error);
    return [];
  }
}

/**
 * Upload files to Object Storage using direct API
 */
async function uploadFilesToObjectStorage(filesystemFiles) {
  let success = 0;
  let failed = 0;
  
  // Combine files from both directories
  const allFiles = [
    ...filesystemFiles.uploads,
    ...filesystemFiles.root,
  ];
  
  // Remove duplicates based on filename
  const uniqueFiles = [];
  const processedFilenames = new Set();
  
  for (const file of allFiles) {
    if (!processedFilenames.has(file.filename)) {
      uniqueFiles.push(file);
      processedFilenames.add(file.filename);
    }
  }
  
  console.log(`Found ${uniqueFiles.length} unique files to upload`);
  
  // Upload each file
  for (const file of uniqueFiles) {
    try {
      console.log(`Uploading ${file.filename}...`);
      
      // Check if file exists
      if (!fs.existsSync(file.path)) {
        console.warn(`File does not exist: ${file.path}`);
        failed++;
        continue;
      }
      
      // Get file content
      const fileContent = fs.readFileSync(file.path);
      
      // Determine content type
      const contentType = getContentType(path.extname(file.filename));
      
      // Create key
      const key = `${BANNER_SLIDES_PREFIX}${file.filename}`;
      
      // Upload using direct API
      const response = await fetch(`${API_URL}/${DEFAULT_BUCKET}/${key}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${OBJECT_STORAGE_TOKEN}`,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000', // 1 year cache
          'x-amz-acl': 'public-read',
        },
        body: fileContent,
      });
      
      if (response.ok) {
        console.log(`Successfully uploaded ${file.filename}`);
        success++;
      } else {
        console.error(`Failed to upload ${file.filename}: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(`Error details: ${errorText}`);
        failed++;
      }
    } catch (error) {
      console.error(`Error uploading ${file.filename}:`, error);
      failed++;
    }
  }
  
  return { success, failed };
}

/**
 * Update database with Object Storage URLs
 */
async function updateDatabaseUrls(slides) {
  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');
    
    let updated = 0;
    
    // Get current content from database
    const result = await client.query(
      `SELECT id, content FROM page_contents WHERE slug = $1`,
      [BANNER_SLIDES_SLUG]
    );
    
    if (result.rows.length === 0) {
      return { updated: 0 };
    }
    
    const pageContent = result.rows[0];
    const content = typeof pageContent.content === 'string' 
      ? JSON.parse(pageContent.content) 
      : pageContent.content;
    
    // Update slide URLs
    const updatedSlides = content.slides.map(slide => {
      if (!slide.background || slide.background.includes('object-storage.replit.app')) {
        return slide;
      }
      
      try {
        // Extract filename from background path
        let filename;
        
        if (slide.background.startsWith('/')) {
          filename = slide.background.split('/').pop();
        } else {
          filename = slide.background;
        }
        
        if (!filename) {
          return slide;
        }
        
        // Create Object Storage URL
        const objectStorageUrl = `https://object-storage.replit.app/${DEFAULT_BUCKET}/${BANNER_SLIDES_PREFIX}${filename}`;
        
        // Update background
        console.log(`Updating slide background: ${slide.background} -> ${objectStorageUrl}`);
        slide.background = objectStorageUrl;
        updated++;
        
        return slide;
      } catch (error) {
        console.error(`Error updating slide:`, error);
        return slide;
      }
    });
    
    // Update content
    content.slides = updatedSlides;
    
    // Update in database
    await client.query(
      `UPDATE page_contents SET content = $1 WHERE id = $2`,
      [JSON.stringify(content), pageContent.id]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    return { updated };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error updating database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(ext) {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  
  return types[ext.toLowerCase()] || 'application/octet-stream';
}

// Run the script
main()
  .then((results) => {
    console.log('Upload complete with results:', results);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Upload failed:', error);
    process.exit(1);
  });