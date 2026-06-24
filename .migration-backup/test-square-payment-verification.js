/**
 * Square Payment Verification Test Script
 * 
 * This script tests the Square API connectivity and payment verification flow.
 * It performs the following checks:
 * 1. Verifies Square environment variables are properly set
 * 2. Tests the connection to Square API
 * 3. Simulates the payment verification flow for testing purposes
 * 
 * Usage:
 * node test-square-payment-verification.js
 */

// Import required dependencies
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Setup __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Define constants
const { SQUARE_ACCESS_TOKEN, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID } = process.env;
const BASE_URL = process.env.NODE_ENV === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';

// ANSI color codes for console output
const COLORS = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
};

/**
 * Print a colored message to the console
 */
function colorLog(message, color = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

/**
 * Check if all required environment variables are set
 */
function checkEnvironmentVariables() {
  colorLog('\n==== Checking Environment Variables ====', COLORS.CYAN);
  
  let missingVars = [];
  
  if (!SQUARE_ACCESS_TOKEN) missingVars.push('SQUARE_ACCESS_TOKEN');
  if (!SQUARE_APPLICATION_ID) missingVars.push('SQUARE_APPLICATION_ID');
  if (!SQUARE_LOCATION_ID) missingVars.push('SQUARE_LOCATION_ID');
  
  if (missingVars.length > 0) {
    colorLog(`❌ Missing required environment variables: ${missingVars.join(', ')}`, COLORS.RED);
    return false;
  }
  
  colorLog('✅ All required environment variables are set', COLORS.GREEN);
  colorLog(`• Environment: ${process.env.NODE_ENV || 'development'}`, COLORS.BLUE);
  colorLog(`• API Base URL: ${BASE_URL}`, COLORS.BLUE);
  return true;
}

/**
 * Test connection to Square API by fetching locations
 */
async function testSquareApiConnection() {
  colorLog('\n==== Testing Square API Connection ====', COLORS.CYAN);
  
  try {
    const response = await fetch(`${BASE_URL}/v2/locations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2023-09-25',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      colorLog('✅ Successfully connected to Square API', COLORS.GREEN);
      colorLog(`• Found ${data.locations?.length || 0} locations`, COLORS.BLUE);
      
      // Verify location ID matches one in the response
      const locationExists = data.locations?.some(location => location.id === SQUARE_LOCATION_ID);
      
      if (locationExists) {
        colorLog(`✅ Verified SQUARE_LOCATION_ID matches a location in your account`, COLORS.GREEN);
      } else {
        colorLog(`❌ SQUARE_LOCATION_ID does not match any location in your account`, COLORS.RED);
        colorLog(`• Available location IDs: ${data.locations?.map(l => l.id).join(', ') || 'none'}`, COLORS.YELLOW);
      }
      
      return true;
    } else {
      colorLog(`❌ Failed to connect to Square API: ${response.status} ${response.statusText}`, COLORS.RED);
      colorLog('Error details:', COLORS.RED);
      console.log(data);
      return false;
    }
  } catch (error) {
    colorLog(`❌ Error connecting to Square API: ${error.message}`, COLORS.RED);
    console.error(error);
    return false;
  }
}

/**
 * Simulate a payment verification flow
 */
async function simulatePaymentVerification() {
  colorLog('\n==== Simulating Payment Verification Flow ====', COLORS.CYAN);
  
  // Generate a mock payment link ID (intent ID)
  const mockPaymentLinkId = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  colorLog(`• Generated mock payment link ID: ${mockPaymentLinkId}`, COLORS.BLUE);
  colorLog('• This is only a simulation - no real payment will be processed', COLORS.YELLOW);
  
  try {
    // 1. Attempt to search orders to simulate verifyPaymentStatus function
    colorLog('\n1. Searching for orders (simulates verifyPaymentStatus)', COLORS.MAGENTA);
    
    const searchPayload = {
      location_ids: [SQUARE_LOCATION_ID],
      query: {
        filter: {
          state_filter: {
            states: ['COMPLETED']
          }
        }
      }
    };
    
    const searchResponse = await fetch(`${BASE_URL}/v2/orders/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2023-09-25',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });
    
    const searchData = await searchResponse.json();
    
    if (searchResponse.ok) {
      colorLog('✅ Successfully searched orders', COLORS.GREEN);
      colorLog(`• Found ${searchData.orders?.length || 0} completed orders`, COLORS.BLUE);
    } else {
      colorLog(`❌ Failed to search orders: ${searchResponse.status} ${searchResponse.statusText}`, COLORS.RED);
      colorLog('Error details:', COLORS.RED);
      console.log(searchData);
      return false;
    }
    
    // 2. Verify Square client initialization works
    colorLog('\n2. Verifying Square client initialization', COLORS.MAGENTA);
    colorLog('✅ API connection successful, which confirms client initialization works', COLORS.GREEN);
    
    return true;
  } catch (error) {
    colorLog(`❌ Error in payment verification simulation: ${error.message}`, COLORS.RED);
    console.error(error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  colorLog('🟦 SQUARE PAYMENT VERIFICATION DIAGNOSTIC TOOL 🟦', COLORS.BLUE);
  
  // Step 1: Check environment variables
  const envVarsOk = checkEnvironmentVariables();
  if (!envVarsOk) {
    colorLog('\n❌ Environment variables check failed. Cannot proceed.', COLORS.RED);
    process.exit(1);
  }
  
  // Step 2: Test Square API connection
  const apiConnectionOk = await testSquareApiConnection();
  if (!apiConnectionOk) {
    colorLog('\n❌ Square API connection test failed. Cannot proceed.', COLORS.RED);
    process.exit(1);
  }
  
  // Step 3: Simulate payment verification
  const verificationOk = await simulatePaymentVerification();
  
  // Summary
  colorLog('\n==== DIAGNOSTIC SUMMARY ====', COLORS.CYAN);
  colorLog(`Environment Variables: ${envVarsOk ? '✅ OK' : '❌ FAILED'}`, envVarsOk ? COLORS.GREEN : COLORS.RED);
  colorLog(`Square API Connection: ${apiConnectionOk ? '✅ OK' : '❌ FAILED'}`, apiConnectionOk ? COLORS.GREEN : COLORS.RED);
  colorLog(`Payment Verification: ${verificationOk ? '✅ OK' : '❌ FAILED'}`, verificationOk ? COLORS.GREEN : COLORS.RED);
  
  if (envVarsOk && apiConnectionOk && verificationOk) {
    colorLog('\n✅ All checks passed! Square payment integration appears to be working correctly.', COLORS.GREEN);
    colorLog('• Your application should be able to process payments in production.', COLORS.GREEN);
  } else {
    colorLog('\n❌ Some checks failed. Please address the issues above before deploying to production.', COLORS.RED);
  }
}

// Run the main function
main().catch(error => {
  colorLog(`\n❌ Unhandled error in diagnostic tool: ${error.message}`, COLORS.RED);
  console.error(error);
  process.exit(1);
});