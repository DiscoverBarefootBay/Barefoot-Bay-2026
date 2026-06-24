/**
 * Test the Printful API connection
 * This script helps troubleshoot issues with the Printful API key and connectivity
 * 
 * Run with: node test-printful-connection.js
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Initialize dotenv
config();

// Utility to format response
function formatResponse(obj) {
  return JSON.stringify(obj, null, 2);
}

// Test Printful API connection
async function testConnection() {
  try {
    console.log('\n🔍 Testing Printful API connection...\n');
    
    // Make sure we have an API key
    const apiKey = process.env.PRINTFUL_API_KEY;
    if (!apiKey) {
      console.error('❌ Error: PRINTFUL_API_KEY not found in environment variables');
      console.log('Please make sure you have set the API key in your .env file');
      return;
    }
    
    console.log('✓ PRINTFUL_API_KEY found in environment variables');
    
    // Check if store ID is set (optional)
    const storeId = process.env.PRINTFUL_STORE_ID;
    if (storeId) {
      console.log(`✓ PRINTFUL_STORE_ID found: ${storeId}`);
    } else {
      console.log('ℹ️ No PRINTFUL_STORE_ID found in environment variables (optional)');
    }
    
    // Test API connection
    console.log('\n📡 Testing API connectivity...');
    
    const baseUrl = 'https://api.printful.com';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
    
    // Test stores endpoint (doesn't require store_id)
    const storesResponse = await fetch(`${baseUrl}/stores`, {
      method: 'GET',
      headers
    });
    
    const storesData = await storesResponse.json();
    
    if (storesResponse.ok) {
      console.log(`✓ Successfully connected to Printful API (HTTP ${storesResponse.status})`);
      
      const storeCount = storesData.result ? storesData.result.length : 0;
      console.log(`✓ Found ${storeCount} store(s) in your Printful account`);
      
      if (storeCount > 0) {
        console.log('\n📊 Your Printful stores:');
        storesData.result.forEach((store, index) => {
          console.log(`\n  Store #${index + 1}:`);
          console.log(`  • ID: ${store.id}`);
          console.log(`  • Name: ${store.name}`);
          console.log(`  • Type: ${store.type}`);
          
          if (store.website) {
            console.log(`  • Website: ${store.website}`);
          }
          
          // If we have a store ID set, check if it matches any of the found stores
          if (storeId && store.id.toString() === storeId) {
            console.log(`  ✓ This store matches your PRINTFUL_STORE_ID environment variable`);
          }
        });
      } else {
        console.log('\n⚠️ No stores found in your Printful account');
        console.log('Please create a store in your Printful account first (see PRINTFUL_SETUP_GUIDE.md)');
      }
    } else {
      console.error(`❌ Error connecting to Printful API: HTTP ${storesResponse.status}`);
      console.error(`Message: ${storesData.error?.message || 'Unknown error'}`);
      return;
    }
    
    // Test catalog endpoint (doesn't require store_id)
    console.log('\n📦 Testing product catalog endpoint...');
    
    const catalogResponse = await fetch(`${baseUrl}/products`, {
      method: 'GET',
      headers
    });
    
    const catalogData = await catalogResponse.json();
    
    if (catalogResponse.ok) {
      const productCount = catalogData.result ? catalogData.result.length : 0;
      console.log(`✓ Successfully accessed product catalog (${productCount} products available)`);
    } else {
      console.error(`❌ Error accessing product catalog: HTTP ${catalogResponse.status}`);
      console.error(`Message: ${catalogData.error?.message || 'Unknown error'}`);
    }
    
    console.log('\n✅ Connection test completed successfully');
    console.log('For more information, check the PRINTFUL_SETUP_GUIDE.md file');
    
  } catch (error) {
    console.error('\n❌ Error testing Printful connection:');
    console.error(error);
  }
}

// Run the test
testConnection();