/**
 * Test script to reproduce the exact production contact form issue
 * This will help identify the root cause of the 500 error
 */

import https from 'https';
import http from 'http';

async function testProductionContactForm() {
  console.log('🔍 Testing Production Contact Form Issue');
  console.log('=======================================\n');
  
  // Test 1: Check if the production site is accessible
  console.log('1. Testing production site accessibility...');
  try {
    const response = await makeRequest('https://barefootbay.com/for-sale/80', 'GET');
    console.log(`✅ Production site accessible: ${response.statusCode}`);
  } catch (error) {
    console.log(`❌ Production site error: ${error.message}`);
    return;
  }
  
  // Test 2: Test contact form endpoint without authentication
  console.log('\n2. Testing contact form endpoint (unauthenticated)...');
  try {
    const response = await makeRequest('https://barefootbay.com/api/listings/80/contact', 'POST', {
      'Content-Type': 'application/json'
    }, JSON.stringify({ message: 'Test message' }));
    console.log(`Response: ${response.statusCode} - ${response.data}`);
  } catch (error) {
    console.log(`Contact form error: ${error.message}`);
  }
  
  // Test 3: Check if there are differences in the deployed API structure
  console.log('\n3. Testing API availability on production...');
  const endpoints = [
    '/api/auth/check',
    '/api/listings/80',
    '/api/listings/80/contact'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`https://barefootbay.com${endpoint}`, 'GET');
      console.log(`${endpoint}: ${response.statusCode}`);
    } catch (error) {
      console.log(`${endpoint}: ERROR - ${error.message}`);
    }
  }
  
  // Test 4: Compare with our development environment
  console.log('\n4. Comparing with development environment...');
  try {
    const devResponse = await makeRequest('http://localhost:5000/api/listings/80', 'GET');
    console.log(`Dev environment listing endpoint: ${devResponse.statusCode}`);
  } catch (error) {
    console.log(`Dev environment error: ${error.message}`);
  }
}

function makeRequest(url, method, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const lib = isHttps ? https : http;
    
    const options = {
      method,
      headers: {
        'User-Agent': 'Contact-Form-Debug/1.0',
        ...headers
      }
    };
    
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data.substring(0, 500) // Limit response data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Request timeout')));
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

// Run the test
testProductionContactForm().catch(console.error);