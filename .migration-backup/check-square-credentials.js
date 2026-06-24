/**
 * Square Credentials Diagnostic Tool
 * 
 * This script checks the current Square credentials being used in the application
 * and compares them with what's expected to be in the environment variables.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('='.repeat(60));
console.log('SQUARE CREDENTIALS DIAGNOSTIC REPORT');
console.log('='.repeat(60));

console.log('\n1. ENVIRONMENT INFORMATION:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
console.log(`   Process ID: ${process.pid}`);
console.log(`   Current working directory: ${process.cwd()}`);
console.log(`   Script location: ${__dirname}`);

console.log('\n2. SQUARE ENVIRONMENT VARIABLES:');
console.log(`   SQUARE_ACCESS_TOKEN: ${process.env.SQUARE_ACCESS_TOKEN ? 
  `Present (${process.env.SQUARE_ACCESS_TOKEN.substring(0, 8)}...${process.env.SQUARE_ACCESS_TOKEN.slice(-8)})` : 
  'NOT SET'}`);
console.log(`   SQUARE_APPLICATION_ID: ${process.env.SQUARE_APPLICATION_ID || 'NOT SET'}`);
console.log(`   SQUARE_LOCATION_ID: ${process.env.SQUARE_LOCATION_ID || 'NOT SET'}`);

console.log('\n3. CREDENTIAL VALIDATION:');

// Check if credentials look like sandbox vs production
const accessToken = process.env.SQUARE_ACCESS_TOKEN;
if (accessToken) {
  const isProduction = accessToken.startsWith('EAA');
  const isSandbox = accessToken.startsWith('EAAA');
  
  console.log(`   Access Token Type: ${isProduction ? 'PRODUCTION' : isSandbox ? 'SANDBOX' : 'UNKNOWN'}`);
  console.log(`   Token Length: ${accessToken.length} characters`);
} else {
  console.log('   Access Token Type: NOT AVAILABLE');
}

const applicationId = process.env.SQUARE_APPLICATION_ID;
if (applicationId) {
  console.log(`   Application ID Length: ${applicationId.length} characters`);
  console.log(`   Application ID Format: ${applicationId.startsWith('sq') ? 'Standard Square format' : 'Non-standard format'}`);
} else {
  console.log('   Application ID: NOT AVAILABLE');
}

const locationId = process.env.SQUARE_LOCATION_ID;
if (locationId) {
  console.log(`   Location ID Length: ${locationId.length} characters`);
} else {
  console.log('   Location ID: NOT AVAILABLE');
}

console.log('\n4. TESTING SQUARE API CONNECTION:');

async function testSquareConnection() {
  if (!accessToken || !applicationId || !locationId) {
    console.log('   ❌ Cannot test - missing required credentials');
    return;
  }

  try {
    // Test Square API with current credentials
    const response = await fetch('https://connect.squareup.com/v2/locations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-12-18',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Square API connection successful');
      console.log(`   Found ${data.locations?.length || 0} locations`);
      
      if (data.locations && data.locations.length > 0) {
        const currentLocation = data.locations.find(loc => loc.id === locationId);
        if (currentLocation) {
          console.log(`   ✅ Current location ID found: ${currentLocation.name || 'Unnamed location'}`);
        } else {
          console.log(`   ⚠️ Current location ID (${locationId}) not found in account`);
          console.log(`   Available locations:`);
          data.locations.forEach(loc => {
            console.log(`     - ${loc.id}: ${loc.name || 'Unnamed'}`);
          });
        }
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`   ❌ Square API connection failed: ${response.status} ${response.statusText}`);
      console.log(`   Error details:`, errorData);
    }
  } catch (error) {
    console.log(`   ❌ Square API test failed: ${error.message}`);
  }
}

await testSquareConnection();

console.log('\n5. RECOMMENDATIONS:');
console.log('   - Verify that the credentials in your Replit Secrets match your Square Developer Dashboard');
console.log('   - Ensure you are using production credentials for barefootbay.com');
console.log('   - Check that the location ID corresponds to your actual Square business location');
console.log('   - If credentials are correct here but wrong in production, there may be a caching issue');

console.log('\n' + '='.repeat(60));