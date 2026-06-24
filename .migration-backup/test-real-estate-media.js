/**
 * Test script for verifying real estate media access in Object Storage
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Test URLs - using actual filenames from the database
const testUrls = [
  // Direct proxy URL format (full path)
  '/api/storage-proxy/REAL_ESTATE/real-estate-media/1746420065050-969149381.png',
  '/api/storage-proxy/REAL_ESTATE/real-estate-media/1745824270395-146223667.jpg',
  '/api/storage-proxy/REAL_ESTATE/real-estate-media/1745824302556-70251163.jpg',
  
  // Short format (without real-estate-media/ prefix)
  '/api/storage-proxy/REAL_ESTATE/1746420065050-969149381.png',
  '/api/storage-proxy/REAL_ESTATE/1745824270395-146223667.jpg',
  '/api/storage-proxy/REAL_ESTATE/1745824302556-70251163.jpg',
  
  // Direct real estate endpoint
  '/api/storage-proxy/direct-realestate/1746420065050-969149381.png',
  '/api/storage-proxy/direct-realestate/1745824270395-146223667.jpg',
  '/api/storage-proxy/direct-realestate/1745824302556-70251163.jpg',
  
  // Original database format (should render HTML page but not 404)
  '/real-estate-media/1746420065050-969149381.png'
];

// Base URL for local testing
const baseUrl = 'http://localhost:5000';

async function testMediaAccess() {
  console.log('Testing Real Estate Media Access through Object Storage Proxy');
  console.log('===========================================================');
  
  for (const url of testUrls) {
    try {
      console.log(`\nTesting URL: ${url}`);
      const response = await fetch(`${baseUrl}${url}`);
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        // Get response headers
        const headers = response.headers;
        console.log(`Content-Type: ${headers.get('content-type')}`);
        console.log(`Content-Length: ${headers.get('content-length')} bytes`);
        
        // Check for special headers we set in our proxy
        const specialHeaders = [
          'x-standard-realestate-format',
          'x-direct-realestate-access',
          'x-storage-path',
          'x-found-at-alternate-path'
        ];
        
        for (const header of specialHeaders) {
          const value = headers.get(header);
          if (value) {
            console.log(`${header}: ${value}`);
          }
        }
        
        // Get the beginning of the response for binary files
        const buffer = await response.buffer();
        console.log(`Received ${buffer.length} bytes`);
        
        // Basic file signature check - just the first few bytes
        const signature = buffer.slice(0, 4).toString('hex');
        console.log(`File signature: ${signature}`);
        
        // Simple validation
        let fileType = 'unknown';
        if (signature.startsWith('89504e47')) {
          fileType = 'PNG image';
        } else if (signature.startsWith('ffd8ff')) {
          fileType = 'JPEG image';
        }
        console.log(`Detected file type: ${fileType}`);
        
        console.log('✓ Success: File retrieved successfully');
      } else {
        console.log(`✗ Failed: ${response.status} ${response.statusText}`);
        
        // Check if we got redirected
        if (response.redirected) {
          console.log(`Redirected to: ${response.url}`);
        }
        
        // Try to get error message
        try {
          const text = await response.text();
          console.log(`Response body: ${text.substring(0, 200)}...`);
        } catch (e) {
          console.log(`Could not read response body: ${e.message}`);
        }
      }
    } catch (error) {
      console.error(`✗ Error accessing ${url}: ${error.message}`);
    }
  }
}

// Run the test
testMediaAccess().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});