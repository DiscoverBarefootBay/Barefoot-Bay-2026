/**
 * Check and debug banner storage paths
 * 
 * This script fetches the banner slides data and checks the media URLs for storage paths
 * Use this to verify if banner slides are using Object Storage URLs and test the fallbacks
 * 
 * Usage:
 * node scripts/check-banner-storage-paths.js
 */

import fetch from 'node-fetch';

// Configuration
const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;
const API_ENDPOINT = '/api/page-contents/banner-slides';
const STORAGE_URL_PATTERN = /object-storage\.replit\.app/;
const MAX_PARALLEL_REQUESTS = 5;

// Login credentials (admin user)
const USERNAME = 'michael';
const PASSWORD = 'password'; // You may need to adjust this if different

/**
 * Login to get a session cookie
 * @returns {Promise<string>} - Cookie string for authenticated requests
 */
async function login() {
  console.log(`Logging in as ${USERNAME}...`);
  
  const loginResponse = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: USERNAME,
      password: PASSWORD
    })
  });
  
  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
  }
  
  // Get the session cookie
  const cookieHeader = loginResponse.headers.get('set-cookie');
  if (!cookieHeader) {
    throw new Error('No session cookie received');
  }
  
  console.log('Login successful');
  return cookieHeader;
}

async function main() {
  try {
    console.log('Banner Storage Paths Check');
    console.log('-------------------------');
    
    // Login first to get a session cookie
    const cookie = await login();
    
    // Fetch banner slides data with the session cookie
    console.log(`\nFetching banner slides data from: ${BASE_URL}${API_ENDPOINT}`);
    const response = await fetch(`${BASE_URL}${API_ENDPOINT}`, {
      headers: {
        'Cookie': cookie
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch banner slides: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.content || !Array.isArray(data.content)) {
      console.log('No banner slides found or invalid format');
      return;
    }
    
    console.log(`Found ${data.content.length} banner slides`);
    
    // Get all media URLs
    const imagesAndVideos = [];
    
    data.content.forEach((slide, index) => {
      if (slide.imageUrl) {
        imagesAndVideos.push({
          type: 'image',
          url: slide.imageUrl,
          index,
          slide
        });
      }
      
      if (slide.videoUrl) {
        imagesAndVideos.push({
          type: 'video',
          url: slide.videoUrl,
          index,
          slide
        });
      }
    });
    
    console.log(`Total media items: ${imagesAndVideos.length} (${imagesAndVideos.filter(m => m.type === 'image').length} images, ${imagesAndVideos.filter(m => m.type === 'video').length} videos)`);
    
    // Group by storage type
    const objectStorageUrls = imagesAndVideos.filter(m => STORAGE_URL_PATTERN.test(m.url));
    const localUrls = imagesAndVideos.filter(m => !STORAGE_URL_PATTERN.test(m.url));
    
    console.log(`\nStorage distribution:`);
    console.log(`- Object Storage URLs: ${objectStorageUrls.length}`);
    console.log(`- Local filesystem URLs: ${localUrls.length}`);
    
    // Report on object storage URLs
    if (objectStorageUrls.length > 0) {
      console.log(`\nObject Storage URLs:`);
      objectStorageUrls.forEach((item, i) => {
        console.log(`${i+1}. [${item.type}] ${item.url}`);
      });
      
      // Test Object Storage URLs through proxy
      console.log(`\nTesting Object Storage URLs through proxy...`);
      
      // Process in batches to avoid too many parallel requests
      for (let i = 0; i < objectStorageUrls.length; i += MAX_PARALLEL_REQUESTS) {
        const batch = objectStorageUrls.slice(i, i + MAX_PARALLEL_REQUESTS);
        
        // Create proxy URLs
        const proxyTests = batch.map(item => {
          const urlParts = item.url.split('object-storage.replit.app/');
          if (urlParts.length <= 1) return null;
          
          const parts = urlParts[1].split('/');
          if (parts.length < 2) return null;
          
          const bucket = parts[0];
          const path = parts.slice(1).join('/');
          
          return {
            original: item.url,
            type: item.type,
            proxy: `${BASE_URL}/api/storage-proxy/${bucket}/${path}`
          };
        }).filter(Boolean);
        
        // Test each proxy URL
        await Promise.all(proxyTests.map(async test => {
          try {
            console.log(`Testing ${test.type}: ${test.proxy}`);
            const response = await fetch(test.proxy);
            
            if (response.ok) {
              const contentType = response.headers.get('content-type') || 'unknown';
              const contentLength = response.headers.get('content-length') || 'unknown';
              console.log(`✓ Success: ${contentType}, ${contentLength} bytes`);
            } else {
              console.log(`✗ Failed: ${response.status} ${response.statusText}`);
            }
          } catch (error) {
            console.log(`✗ Error: ${error.message}`);
          }
        }));
      }
    }
    
    // Report on local URLs
    if (localUrls.length > 0) {
      console.log(`\nLocal filesystem URLs:`);
      localUrls.forEach((item, i) => {
        console.log(`${i+1}. [${item.type}] ${item.url}`);
      });
    }
    
    console.log('\nCheck completed');
  } catch (error) {
    console.error(`Error checking banner storage paths: ${error.message}`);
  }
}

// Run the script
main().catch(console.error);