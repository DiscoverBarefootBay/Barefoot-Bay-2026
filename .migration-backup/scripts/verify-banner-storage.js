/**
 * Script to verify banner slides storage status
 * 
 * This script:
 * 1. Retrieves all banner slides from the database
 * 2. Checks if files exist in local filesystem
 * 3. Verifies if files exist in Replit Object Storage
 * 4. Reports the status of each file
 * 
 * Usage:
 * node scripts/verify-banner-storage.js
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { db } from './db-client.js';
import { Client as ObjectStorageClient } from '@replit/object-storage';

// Initialize dotenv
dotenv.config();

// Get current file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Object Storage client
const storage = new ObjectStorageClient();
const BUCKET_NAME = 'DEFAULT';

// Base directories to check for banner slide files
const DIRECTORIES = [
  path.join(__dirname, '..', 'banner-slides'),
  path.join(__dirname, '..', 'uploads', 'banner-slides'),
];

/**
 * Get banner slides content from database
 * @returns {Promise<Object>} Banner slides content
 */
async function getBannerSlidesFromDB() {
  try {
    const result = await db.query(
      `SELECT * FROM page_contents WHERE slug = 'banner-slides'`
    );
    
    if (!result || !result.rows || result.rows.length === 0) {
      console.error('No banner slides found in database');
      return null;
    }
    
    const pageContent = result.rows[0];
    
    // The content is stored as JSON string, not an object
    if (!pageContent.content) {
      console.error('Banner slides content is missing');
      return null;
    }

    // Parse the content if it's a string
    if (typeof pageContent.content === 'string') {
      try {
        pageContent.content = { slides: JSON.parse(pageContent.content) };
        console.log('Successfully parsed banner slides content');
      } catch (parseError) {
        console.error('Failed to parse banner slides content:', parseError);
        return null;
      }
    } else if (!pageContent.content.slides && Array.isArray(pageContent.content)) {
      // If content is already an array but not in the expected structure
      pageContent.content = { slides: pageContent.content };
    }
    
    return pageContent;
  } catch (error) {
    console.error('Error getting banner slides from database:', error);
    return null;
  }
}

/**
 * Check if a file exists in any of the specified directories
 * @param {string} filename - Filename to check
 * @returns {Object} Object with exists flag and file path if found
 */
function checkFileInDirectories(filename) {
  for (const dir of DIRECTORIES) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return { exists: true, path: filePath };
    }
  }
  return { exists: false, path: null };
}

/**
 * Extract filename from a path or URL
 * @param {string} src - Source path or URL
 * @returns {string} Extracted filename
 */
function getFilenameFromPath(src) {
  if (!src) return '';
  // Handle both URL and file paths
  return src.split('/').pop();
}

/**
 * Check if a file exists in Object Storage
 * @param {string} filename - Name of the file to check
 * @returns {Promise<boolean>} True if file exists, false otherwise
 */
async function checkInObjectStorage(filename) {
  try {
    // Check if REPLIT_OBJECT_STORAGE_TOKEN is set
    if (!process.env.REPLIT_OBJECT_STORAGE_TOKEN) {
      console.warn('REPLIT_OBJECT_STORAGE_TOKEN not set, skipping Object Storage check');
      return false;
    }
    
    // Check if file exists in Object Storage
    const objStoragePath = `banner-slides/${filename}`;
    const exists = await storage.exists(BUCKET_NAME, objStoragePath);
    
    return exists;
  } catch (error) {
    console.error(`Error checking ${filename} in Object Storage:`, error);
    return false;
  }
}

/**
 * Check if a URL is accessible
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} True if URL is accessible, false otherwise
 */
async function checkUrlAccessible(url) {
  try {
    const response = await axios.head(url, { timeout: 5000 });
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    return false;
  }
}

/**
 * Main function to verify banner slides storage
 */
async function verifyBannerStorage() {
  try {
    console.log('Starting banner slides storage verification...');
    
    // Get banner slides from database
    const pageContent = await getBannerSlidesFromDB();
    if (!pageContent) {
      console.error('Could not retrieve banner slides from database');
      return;
    }
    
    // Process each slide
    const slides = pageContent.content.slides || [];
    console.log(`Found ${slides.length} slides in database`);
    
    // Results accumulator
    const results = {
      total: slides.length,
      inFilesystem: 0,
      inObjectStorage: 0,
      urlAccessible: 0,
      isLocalPath: 0,
      isObjectStorageUrl: 0,
      issues: []
    };
    
    console.log('\nVerification results:');
    console.log('--------------------');
    
    for (const [index, slide] of slides.entries()) {
      const filename = getFilenameFromPath(slide.src);
      if (!filename) {
        results.issues.push(`Slide ${index + 1}: Could not extract filename from ${slide.src}`);
        continue;
      }
      
      // Check source type
      const isObjectStorageUrl = slide.src.includes('object-storage.replit.app');
      const isLocalPath = slide.src.startsWith('/') && !slide.src.startsWith('http');
      
      if (isObjectStorageUrl) results.isObjectStorageUrl++;
      if (isLocalPath) results.isLocalPath++;
      
      // Check in filesystem
      const fileCheck = checkFileInDirectories(filename);
      if (fileCheck.exists) results.inFilesystem++;
      
      // Check in Object Storage
      const inObjectStorage = await checkInObjectStorage(filename);
      if (inObjectStorage) results.inObjectStorage++;
      
      // Check URL accessibility
      let urlAccessible = false;
      if (slide.src.startsWith('http')) {
        urlAccessible = await checkUrlAccessible(slide.src);
        if (urlAccessible) results.urlAccessible++;
      } else {
        // For local paths, check if the file exists
        if (fileCheck.exists) results.urlAccessible++;
      }
      
      // Log result
      const status = urlAccessible ? '✅' : '❌';
      console.log(`${status} Slide ${index + 1}: ${filename}`);
      console.log(`   Source: ${slide.src}`);
      console.log(`   Filesystem: ${fileCheck.exists ? 'Yes' : 'No'}`);
      console.log(`   Object Storage: ${inObjectStorage ? 'Yes' : 'No'}`);
      console.log(`   URL Accessible: ${urlAccessible ? 'Yes' : 'No'}`);
      console.log('');
      
      // Add to issues if needed
      if (!fileCheck.exists && !inObjectStorage) {
        results.issues.push(`Slide ${index + 1}: File ${filename} not found in filesystem or Object Storage`);
      } else if (!urlAccessible) {
        results.issues.push(`Slide ${index + 1}: URL ${slide.src} is not accessible`);
      }
    }
    
    // Log summary
    console.log('\nSummary:');
    console.log('--------');
    console.log(`Total slides: ${results.total}`);
    console.log(`Files in filesystem: ${results.inFilesystem}/${results.total}`);
    console.log(`Files in Object Storage: ${results.inObjectStorage}/${results.total}`);
    console.log(`Accessible URLs: ${results.urlAccessible}/${results.total}`);
    console.log(`Using local paths: ${results.isLocalPath}/${results.total}`);
    console.log(`Using Object Storage URLs: ${results.isObjectStorageUrl}/${results.total}`);
    
    if (results.issues.length > 0) {
      console.log('\nIssues:');
      console.log('-------');
      results.issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
    } else {
      console.log('\nNo issues found!');
    }
    
    console.log('\nVerification completed');
  } catch (error) {
    console.error('Error verifying banner slides storage:', error);
  } finally {
    // Ensure db connection is closed
    try {
      await db.end();
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

// Run the verification
verifyBannerStorage().catch(console.error);