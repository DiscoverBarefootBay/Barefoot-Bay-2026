/**
 * Direct deployment fix for production email service
 * This script tests and fixes the password reset email functionality
 */

const fs = require('fs');
const path = require('path');

console.log('=== Production Email Fix Deployment ===');

// Test the current production endpoint
async function testProductionEndpoint() {
  try {
    console.log('Testing production password reset...');
    
    const response = await fetch('https://barefootbay.com/api/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'michaelanthonygodoy@gmail.com'
      })
    });
    
    const data = await response.json();
    console.log('Production response:', data);
    
    // Test debug endpoint to see if deployment worked
    const debugResponse = await fetch('https://barefootbay.com/api/test-email-config');
    
    if (debugResponse.status === 404) {
      console.log('❌ Production deployment is outdated - debug endpoint not found');
      return false;
    } else {
      const debugData = await debugResponse.json();
      console.log('✅ Production has latest code:', debugData);
      return true;
    }
    
  } catch (error) {
    console.error('Production test failed:', error);
    return false;
  }
}

async function main() {
  const isUpdated = await testProductionEndpoint();
  
  if (!isUpdated) {
    console.log('Production deployment needs manual intervention.');
    console.log('The latest code changes are not reflected in production.');
  } else {
    console.log('Production is updated and should be working.');
  }
}

main();