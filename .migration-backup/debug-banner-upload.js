/**
 * Debug script for testing banner image uploads
 * 
 * This script helps diagnose issues with banner uploads by testing the direct upload endpoint
 * Run with: node debug-banner-upload.js
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Configuration
const API_URL = 'http://localhost:5000';
const IMAGE_PATH = path.join(__dirname, 'BBLogo.png'); // Use an existing image in the project
const ENDPOINT = '/api/direct-banner-upload';

// Login credentials (admin account required)
const USERNAME = 'admin';
const PASSWORD = 'barefoot2024'; // Replace with actual admin password

async function testBannerUpload() {
  console.log('Starting banner upload test...');
  console.log(`Using image: ${IMAGE_PATH}`);
  
  if (!fs.existsSync(IMAGE_PATH)) {
    console.error(`ERROR: Test image not found at path: ${IMAGE_PATH}`);
    return;
  }
  
  // Step 1: Login to get session cookie
  console.log('Step 1: Logging in to get session cookie...');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    redirect: 'manual'
  });
  
  if (!loginResponse.ok) {
    console.error(`Login failed with status: ${loginResponse.status}`);
    const errorText = await loginResponse.text();
    console.error(`Error: ${errorText}`);
    return;
  }
  
  const cookies = loginResponse.headers.get('set-cookie');
  console.log('Login successful, received cookies');
  
  // Step 2: Upload the banner image
  console.log('Step 2: Uploading banner image...');
  const formData = new FormData();
  formData.append('bannerImage', fs.createReadStream(IMAGE_PATH));
  
  const uploadResponse = await fetch(`${API_URL}${ENDPOINT}`, {
    method: 'POST',
    headers: { Cookie: cookies },
    body: formData
  });
  
  if (!uploadResponse.ok) {
    console.error(`Upload failed with status: ${uploadResponse.status}`);
    try {
      const errorData = await uploadResponse.json();
      console.error('Error response:', JSON.stringify(errorData, null, 2));
    } catch (e) {
      const errorText = await uploadResponse.text();
      console.error(`Error text: ${errorText}`);
    }
    return;
  }
  
  const responseData = await uploadResponse.json();
  console.log('Upload successful!');
  console.log('Response:', JSON.stringify(responseData, null, 2));
  
  // Verify the uploaded files exist
  console.log('Step 3: Verifying uploaded files...');
  const prodPath = path.join(__dirname, responseData.url.slice(1)); // Remove leading slash
  const devPath = path.join(__dirname, responseData.developmentUrl.slice(1)); // Remove leading slash
  
  console.log(`Checking production path: ${prodPath}`);
  if (fs.existsSync(prodPath)) {
    console.log('✅ Production file exists');
    const stats = fs.statSync(prodPath);
    console.log(`File size: ${stats.size} bytes`);
  } else {
    console.error('❌ Production file MISSING');
  }
  
  console.log(`Checking development path: ${devPath}`);
  if (fs.existsSync(devPath)) {
    console.log('✅ Development file exists');
    const stats = fs.statSync(devPath);
    console.log(`File size: ${stats.size} bytes`);
  } else {
    console.error('❌ Development file MISSING');
  }
  
  console.log('Banner upload test completed');
}

// Run the test
testBannerUpload().catch(error => {
  console.error('Unexpected error during test:', error);
});