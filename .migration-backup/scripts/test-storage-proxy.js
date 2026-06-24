/**
 * Test script for the storage proxy functionality
 * This script verifies that the storage proxy endpoint can retrieve files from Object Storage
 * 
 * Usage:
 * node scripts/test-storage-proxy.js
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;
const PROXY_ENDPOINT = '/api/storage-proxy';
const BUCKET = 'DEFAULT';
const TEST_DIR = 'banner-slides';

async function main() {
  try {
    console.log('Testing Storage Proxy Functionality');
    console.log('---------------------------------');
    
    // Test 1: Verify direct access to proxy endpoint
    console.log('\nTest 1: Direct proxy access test');
    
    try {
      const testUrl = `${BASE_URL}${PROXY_ENDPOINT}/${BUCKET}/test`;
      console.log(`Testing endpoint existence: ${testUrl}`);
      
      const response = await fetch(testUrl);
      if (response.ok || response.status === 404) {
        console.log(`✓ Proxy endpoint is accessible (Status: ${response.status})`);
      } else {
        console.log(`✗ Proxy endpoint returned unexpected status: ${response.status}`);
      }
    } catch (error) {
      console.error(`✗ Failed to access proxy endpoint: ${error.message}`);
    }
    
    // Test 2: List files in banner-slides
    console.log('\nTest 2: Finding test files');
    let testFiles = [];
    
    try {
      // Try to list files in the banner-slides directory
      const localDir = path.join(process.cwd(), TEST_DIR);
      console.log(`Looking for test files in: ${localDir}`);
      
      try {
        const files = await fs.readdir(localDir);
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
        
        if (imageFiles.length > 0) {
          testFiles = imageFiles.slice(0, 3); // Take up to 3 image files
          console.log(`✓ Found ${testFiles.length} test image files in ${TEST_DIR}`);
        } else {
          console.log(`✗ No image files found in ${TEST_DIR}`);
        }
      } catch (err) {
        console.log(`Could not read ${TEST_DIR} directory: ${err.message}`);
      }
      
      // If we couldn't find files locally, check the uploads directory
      if (testFiles.length === 0) {
        const uploadsDir = path.join(process.cwd(), 'uploads', TEST_DIR);
        console.log(`Looking for test files in: ${uploadsDir}`);
        
        try {
          const files = await fs.readdir(uploadsDir);
          const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
          
          if (imageFiles.length > 0) {
            testFiles = imageFiles.slice(0, 3); // Take up to 3 image files
            console.log(`✓ Found ${testFiles.length} test image files in uploads/${TEST_DIR}`);
          } else {
            console.log(`✗ No image files found in uploads/${TEST_DIR}`);
          }
        } catch (err) {
          console.log(`Could not read uploads/${TEST_DIR} directory: ${err.message}`);
        }
      }
    } catch (error) {
      console.error(`✗ Error finding test files: ${error.message}`);
    }
    
    // Test 3: Test proxy with real files
    if (testFiles.length > 0) {
      console.log('\nTest 3: Testing proxy with real files');
      
      for (const file of testFiles) {
        const proxyUrl = `${BASE_URL}${PROXY_ENDPOINT}/${BUCKET}/${TEST_DIR}/${file}`;
        console.log(`Testing file: ${file}`);
        console.log(`Proxy URL: ${proxyUrl}`);
        
        try {
          const response = await fetch(proxyUrl);
          
          if (response.ok) {
            const buffer = await response.buffer();
            const size = buffer.length;
            console.log(`✓ Successfully retrieved file: ${file} (${size} bytes)`);
          } else {
            console.log(`✗ Failed to retrieve file: ${file} - Status: ${response.status}`);
            const text = await response.text();
            console.log(`  Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
          }
        } catch (error) {
          console.error(`✗ Error accessing file through proxy: ${error.message}`);
        }
      }
    } else {
      console.log('\nSkipping Test 3: No test files found');
    }
    
    console.log('\nStorage Proxy Test Completed');
  } catch (error) {
    console.error('Test script error:', error);
  }
}

// Run the main function
main().catch(console.error);