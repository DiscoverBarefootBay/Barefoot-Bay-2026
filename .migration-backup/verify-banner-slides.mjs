/**
 * Verification script to check all banner slides URLs
 * 
 * This script checks all banner slides in the database and reports on their URL formats,
 * verifying that they're using the correct paths.
 * 
 * Usage:
 * node verify-banner-slides.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Initialize .env
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Video file extensions
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi'];

// Check if a file is a video based on extension
function isVideoFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

// Extract filename from a URL or path
function extractFilename(url) {
  if (!url) return null;
  
  // Handle different path formats
  if (url.includes('/')) {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }
  
  return url;
}

// Analyze banner slides
async function analyzeBannerSlides() {
  console.log('Starting banner slides analysis...');
  
  try {
    // Get banner slides from database
    const result = await pool.query(
      `SELECT id, content FROM page_contents WHERE slug = 'banner-slides'`
    );
    
    if (result.rows.length === 0) {
      console.log('No banner slides found in database.');
      return;
    }
    
    const pageContent = result.rows[0];
    console.log(`Found banner slides with ID: ${pageContent.id}`);
    
    // Parse slides content
    let slides;
    try {
      slides = JSON.parse(pageContent.content);
      console.log(`Found ${slides.length} banner slides`);
    } catch (error) {
      console.error('Error parsing banner slides JSON:', error);
      return;
    }
    
    // Analyze each slide
    console.log('\nAnalyzing banner slides:');
    console.log('-------------------------');
    
    const analysis = {
      total: slides.length,
      objectStorage: 0,
      uploads: 0,
      root: 0,
      other: 0,
      videos: 0,
      images: 0,
      missing: 0
    };
    
    for (const slide of slides) {
      const url = slide.src;
      const filename = extractFilename(url);
      const isVideo = filename ? isVideoFile(filename) : false;
      
      console.log(`\nSlide: ${filename || 'Unknown'}`);
      console.log(`URL: ${url || 'Not set'}`);
      console.log(`Type: ${isVideo ? 'Video' : 'Image'}`);
      console.log(`Media Type: ${slide.mediaType || 'Not specified'}`);
      
      if (!url) {
        analysis.missing++;
        console.log('Status: Missing URL');
        continue;
      }
      
      if (url.includes('object-storage.replit.app')) {
        analysis.objectStorage++;
        console.log('Status: Using Object Storage URL');
      } else if (url.startsWith('/uploads/')) {
        analysis.uploads++;
        console.log('Status: Using /uploads/ path');
      } else if (url.startsWith('/') && !url.startsWith('/uploads/')) {
        analysis.root++;
        console.log('Status: Using root path');
      } else {
        analysis.other++;
        console.log('Status: Other format');
      }
      
      // Count by content type
      if (isVideo) {
        analysis.videos++;
      } else {
        analysis.images++;
      }
    }
    
    // Print summary
    console.log('\nSummary:');
    console.log('--------');
    console.log(`Total slides: ${analysis.total}`);
    console.log(`Using Object Storage URLs: ${analysis.objectStorage}`);
    console.log(`Using /uploads/ paths: ${analysis.uploads}`);
    console.log(`Using root paths: ${analysis.root}`);
    console.log(`Using other formats: ${analysis.other}`);
    console.log(`Videos: ${analysis.videos}`);
    console.log(`Images: ${analysis.images}`);
    console.log(`Missing URLs: ${analysis.missing}`);
    
  } catch (error) {
    console.error('Error analyzing banner slides:', error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the script
analyzeBannerSlides();