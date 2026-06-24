/**
 * Test script to verify Google Maps API key configuration
 * 
 * This script tests the Google Maps Static API to verify the key is working correctly
 * Usage: node test-google-map-key.mjs
 */

import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();

// Get API key from environment
const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Display key status (masked for security)
console.log(`API Key configured: ${mapsApiKey ? 'YES (masked)' : 'NO'}`);
console.log(`API Key source: ${
  process.env.GOOGLE_MAPS_API_KEY ? 'GOOGLE_MAPS_API_KEY' :
  process.env.VITE_GOOGLE_MAPS_API_KEY ? 'VITE_GOOGLE_MAPS_API_KEY' :
  'NONE'
}`);

// Define a test location
const testLocation = '625 Barefoot Blvd, Barefoot Bay, FL 32976';

async function testGoogleMapsAPI() {
  console.log(`Testing Google Maps Static API with location: "${testLocation}"`);
  
  try {
    // Create Static Map URL
    const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
    url.searchParams.set('center', testLocation);
    url.searchParams.set('zoom', '15');
    url.searchParams.set('size', '600x300');
    url.searchParams.set('markers', `color:red|${testLocation}`);
    url.searchParams.set('key', mapsApiKey);
    
    // Make the request with a Referer header matching your site
    const response = await fetch(url.toString(), {
      headers: {
        'Referer': 'https://barefootbay.com/',
        'User-Agent': 'Mozilla/5.0 (Barefoot Bay Community Platform Test Script)'
      }
    });
    
    console.log(`API Response Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      const contentType = response.headers.get('content-type');
      console.log(`Content-Type: ${contentType}`);
      console.log(`✅ Static Maps API test SUCCESSFUL`);
    } else if (response.status === 403) {
      console.error(`❌ ERROR 403 FORBIDDEN - Likely issues:`);
      console.error(`  1. API key is incorrect or invalid`);
      console.error(`  2. API key restrictions do not allow the request`);
      console.error(`  3. Static Maps API might not be enabled for this key`);
      console.error(`\nFull URL (key masked): ${url.toString().replace(/key=([^&]*)/, 'key=MASKED')}`);
    } else {
      console.error(`❌ Error testing Google Maps API: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error making request to Google Maps API:', error);
  }
}

// Run the test
testGoogleMapsAPI();