/**
 * Test script to verify calendar event image access through Object Storage
 * This script tests accessing event images through the storage proxy
 */

import fetch from 'node-fetch';

async function testEventImageAccess() {
  try {
    console.log('Testing event image access through storage proxy...');
    
    // Test URLs to check
    const urlsToTest = [
      // Default event image (should always work)
      '/api/storage-proxy/CALENDAR/events/default-event-image.svg',
      // Regular event image with CALENDAR prefix in path
      '/api/storage-proxy/CALENDAR/events/media-1745760684447-85712982.png',
      // A known existing image in events/ format
      '/api/storage-proxy/CALENDAR/events/media-1746340048271-543677258.png',
      // Missing image that should fallback to default
      '/api/storage-proxy/CALENDAR/events/missing-image-test.png',
      // Direct events access format
      '/api/storage-proxy/direct-events/media-1746340048271-543677258.png',
      // Event format without CALENDAR prefix
      '/api/storage-proxy/events/media-1746340048271-543677258.png'
    ];

    // Test each URL
    for (const url of urlsToTest) {
      console.log(`\nTesting: ${url}`);
      
      try {
        // Make the request to our own server
        const baseUrl = 'http://localhost:5000';
        const response = await fetch(`${baseUrl}${url}`);
        
        // Log the result
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        
        // Check for success
        if (response.ok) {
          console.log('✅ Success! Image is accessible');
          
          // Check if it's using the default image fallback
          if (response.headers.get('x-default-event-image')) {
            console.log('ℹ️ Using default image fallback');
          }
        } else {
          console.log('❌ Failed to access image');
        }
      } catch (error) {
        console.error(`❌ Error accessing ${url}:`, error.message);
      }
    }
    
    console.log('\nTest complete!');
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

testEventImageAccess();