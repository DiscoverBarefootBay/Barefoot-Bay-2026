/**
 * Test script for media uploads to Object Storage
 * 
 * This script tests the direct upload of media files to Object Storage
 * using the new unified storage service endpoints.
 * 
 * Usage: node scripts/test-object-storage-upload.js
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Configuration
const API_URL = 'http://localhost:5000';
const TEST_IMAGE_PATH = path.join(__dirname, '..', 'attached_assets', 'image_1746386361270.png');
const UPLOAD_ENDPOINTS = [
  {
    name: 'Main upload endpoint',
    url: `${API_URL}/api/upload`,
    formField: 'file',
    params: { section: 'calendar' }
  },
  {
    name: 'Legacy content upload',
    url: `${API_URL}/api/content/upload-media`,
    formField: 'mediaFile',
    params: {}
  }
];

// Utility to create authenticated session
async function loginAdmin() {
  const loginResponse = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'password123'
    }),
    redirect: 'manual'
  });

  // Extract cookies from the response for session management
  const cookies = loginResponse.headers.raw()['set-cookie'];
  
  console.log(`Login response status: ${loginResponse.status}`);
  if (loginResponse.status !== 200 && loginResponse.status !== 302) {
    console.error('Login failed. Please check credentials and ensure server is running.');
    return null;
  }
  
  return cookies;
}

// Test function for a single endpoint
async function testEndpoint(endpoint, sessionCookies) {
  console.log(`\nTesting ${endpoint.name}...`);
  
  try {
    // Verify the test image exists
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.error(`Test image not found at ${TEST_IMAGE_PATH}`);
      return false;
    }
    
    // Create a form with the test image
    const form = new FormData();
    form.append(endpoint.formField, fs.createReadStream(TEST_IMAGE_PATH));
    
    // Add any additional parameters
    Object.entries(endpoint.params).forEach(([key, value]) => {
      form.append(key, value);
    });
    
    // Make the upload request with session cookies
    const uploadResponse = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        ...(sessionCookies ? { Cookie: sessionCookies.join('; ') } : {}),
      },
      body: form
    });
    
    // Check the response
    const result = await uploadResponse.json();
    
    if (uploadResponse.status === 200 && result.success) {
      console.log(`✅ Upload successful to ${endpoint.name}`);
      console.log(`   URL: ${result.url}`);
      if (result.bucket) {
        console.log(`   Bucket: ${result.bucket}`);
      }
      return true;
    } else {
      console.error(`❌ Upload failed for ${endpoint.name}: ${result.message || 'Unknown error'}`);
      console.error('   Response:', result);
      return false;
    }
  } catch (error) {
    console.error(`❌ Exception during test of ${endpoint.name}:`, error);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('Starting Object Storage upload tests...');
  
  // Login to get an authenticated session
  const sessionCookies = await loginAdmin();
  if (!sessionCookies) {
    console.error('Could not authenticate. Tests will likely fail.');
  }
  
  // Run tests for each endpoint
  const results = [];
  for (const endpoint of UPLOAD_ENDPOINTS) {
    const success = await testEndpoint(endpoint, sessionCookies);
    results.push({ endpoint: endpoint.name, success });
  }
  
  // Summary
  console.log('\n========= TEST RESULTS =========');
  let passCount = 0;
  results.forEach(result => {
    console.log(`${result.success ? '✅ PASS' : '❌ FAIL'}: ${result.endpoint}`);
    if (result.success) passCount++;
  });
  
  console.log(`\nPassed ${passCount} of ${results.length} tests`);
  console.log('================================');
}

// Execute the tests
runTests().catch(error => {
  console.error('Unhandled error during tests:', error);
  process.exit(1);
});