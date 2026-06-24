/**
 * Square Credentials Issue Resolver
 * 
 * This script helps diagnose and fix the Square credentials discrepancy between
 * development and production environments.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('='.repeat(70));
console.log('SQUARE CREDENTIALS ISSUE DIAGNOSIS AND RESOLUTION');
console.log('='.repeat(70));

async function diagnoseSquareCredentialsIssue() {
  console.log('\n1. ENVIRONMENT ANALYSIS:');
  console.log(`   Current NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   Process running on: ${process.platform}`);
  console.log(`   Working directory: ${process.cwd()}`);

  console.log('\n2. CURRENT CREDENTIALS IN MEMORY:');
  const currentCreds = {
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    applicationId: process.env.SQUARE_APPLICATION_ID,
    locationId: process.env.SQUARE_LOCATION_ID
  };

  if (currentCreds.accessToken) {
    console.log(`   Access Token: ${currentCreds.accessToken.substring(0, 8)}...${currentCreds.accessToken.slice(-8)}`);
    console.log(`   Token Type: ${currentCreds.accessToken.startsWith('EAA') ? 'PRODUCTION' : 'SANDBOX/UNKNOWN'}`);
  } else {
    console.log('   Access Token: NOT SET');
  }

  console.log(`   Application ID: ${currentCreds.applicationId || 'NOT SET'}`);
  console.log(`   Location ID: ${currentCreds.locationId || 'NOT SET'}`);

  console.log('\n3. TESTING SQUARE API WITH CURRENT CREDENTIALS:');
  
  if (!currentCreds.accessToken) {
    console.log('   ❌ Cannot test - no access token');
    return;
  }

  try {
    const response = await fetch('https://connect.squareup.com/v2/locations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentCreds.accessToken}`,
        'Square-Version': '2024-12-18',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ API connection successful');
      console.log(`   Account has ${data.locations?.length || 0} locations`);
      
      if (data.locations && data.locations.length > 0) {
        console.log('   Available locations:');
        data.locations.forEach(loc => {
          const isCurrent = loc.id === currentCreds.locationId;
          console.log(`     ${isCurrent ? '✓' : ' '} ${loc.id}: ${loc.name || 'Unnamed'} (${loc.status || 'Unknown status'})`);
        });

        const currentLocationExists = data.locations.find(loc => loc.id === currentCreds.locationId);
        if (!currentLocationExists && currentCreds.locationId) {
          console.log('   ⚠️ ISSUE: Current location ID not found in account!');
          console.log('   This may cause checkout links to fail');
        }
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`   ❌ API connection failed: ${response.status} ${response.statusText}`);
      console.log(`   Error:`, errorData);
    }
  } catch (error) {
    console.log(`   ❌ API test failed: ${error.message}`);
  }

  console.log('\n4. CHECKING FOR POTENTIAL ISSUES:');
  
  // Check for common issues
  const issues = [];
  
  if (!currentCreds.accessToken) {
    issues.push('Missing SQUARE_ACCESS_TOKEN environment variable');
  } else if (!currentCreds.accessToken.startsWith('EAA')) {
    issues.push('Access token appears to be sandbox token, not production');
  }
  
  if (!currentCreds.applicationId) {
    issues.push('Missing SQUARE_APPLICATION_ID environment variable');
  }
  
  if (!currentCreds.locationId) {
    issues.push('Missing SQUARE_LOCATION_ID environment variable');
  }

  if (issues.length > 0) {
    console.log('   Issues found:');
    issues.forEach(issue => console.log(`   ❌ ${issue}`));
  } else {
    console.log('   ✅ All required credentials are present and properly formatted');
  }

  console.log('\n5. TESTING CHECKOUT LINK CREATION:');
  
  if (currentCreds.accessToken && currentCreds.locationId) {
    try {
      const testPayload = {
        idempotency_key: `test_${Date.now()}`,
        quick_pay: {
          name: 'Test Payment',
          price_money: {
            amount: 100, // $1.00
            currency: 'USD'
          },
          location_id: currentCreds.locationId
        },
        checkout_options: {
          redirect_url: 'https://example.com/success'
        }
      };

      const response = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentCreds.accessToken}`,
          'Square-Version': '2024-12-18'
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Test checkout link created successfully');
        console.log(`   Test URL: ${data.payment_link?.url || 'No URL returned'}`);
        
        // Extract merchant ID from the URL to verify it matches expectations
        if (data.payment_link?.url) {
          const urlMatch = data.payment_link.url.match(/\/pay\/([^\/]+)/);
          if (urlMatch) {
            const merchantIdFromUrl = urlMatch[1];
            console.log(`   Merchant ID in URL: ${merchantIdFromUrl}`);
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log(`   ❌ Test checkout creation failed: ${response.status} ${response.statusText}`);
        console.log(`   Error:`, errorData);
      }
    } catch (error) {
      console.log(`   ❌ Test checkout creation failed: ${error.message}`);
    }
  } else {
    console.log('   ⏭️ Skipping checkout test - missing required credentials');
  }

  console.log('\n6. RECOMMENDATIONS:');
  console.log('   To resolve credential issues:');
  console.log('   1. Verify Replit Secrets contain the correct production Square credentials');
  console.log('   2. Ensure you have admin access when trying to update credentials');
  console.log('   3. Check that the location ID corresponds to an active Square location');
  console.log('   4. Restart the server after updating environment variables');
  console.log('   5. Clear any cached Square client instances');

  if (process.env.NODE_ENV === 'production') {
    console.log('\n   PRODUCTION ENVIRONMENT DETECTED:');
    console.log('   - Double-check that production credentials are correctly set in Replit Secrets');
    console.log('   - Verify the Square application is in production mode');
    console.log('   - Ensure webhook URLs point to the production domain');
  }
}

// Test connection to our own API endpoints
async function testApiEndpoints() {
  console.log('\n7. TESTING INTERNAL API ENDPOINTS:');
  
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://barefootbay.com' 
    : 'http://localhost:5000';
    
  console.log(`   Testing against: ${baseUrl}`);
  
  try {
    // Test the square-env GET endpoint (this will require admin auth)
    const response = await fetch(`${baseUrl}/api/payments/square-env`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   GET /api/payments/square-env: ${response.status} ${response.statusText}`);
    
    if (response.status === 403) {
      console.log('   ✅ Expected 403 - endpoint requires admin authentication');
    } else if (response.status === 200) {
      console.log('   ⚠️ Unexpected 200 - endpoint should require authentication');
    } else {
      console.log(`   ❓ Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ API endpoint test failed: ${error.message}`);
  }
}

// Run all diagnostics
await diagnoseSquareCredentialsIssue();
await testApiEndpoints();

console.log('\n' + '='.repeat(70));
console.log('DIAGNOSIS COMPLETE');
console.log('='.repeat(70));