import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const PRINTFUL_API_URL = 'https://api.printful.com';

// Read config file to get API key and store ID
function getConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'print-service.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        apiKey: config.apiKey || process.env.PRINTFUL_API_KEY,
        storeId: config.storeId || process.env.PRINTFUL_STORE_ID || "15683048"
      };
    }
  } catch (err) {
    console.error('Error reading config:', err);
  }
  
  return {
    apiKey: process.env.PRINTFUL_API_KEY,
    storeId: process.env.PRINTFUL_STORE_ID || "15683048"
  };
}

const config = getConfig();
const PRINTFUL_API_KEY = config.apiKey;
const PRINTFUL_STORE_ID = config.storeId;

async function testAPI() {
  try {
    console.log("PRINTFUL_API_KEY available:", !!PRINTFUL_API_KEY);
    console.log("PRINTFUL_STORE_ID being used:", PRINTFUL_STORE_ID);
    
    // Test 1: Get store info (requires store ID)
    console.log("\n--- Test 1: Get Store Info ---");
    const storeResponse = await fetch(`${PRINTFUL_API_URL}/store?store_id=${PRINTFUL_STORE_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`
      }
    });
    
    console.log('Store API Response status:', storeResponse.status);
    
    if (storeResponse.ok) {
      const storeData = await storeResponse.json();
      console.log('Store data:', JSON.stringify(storeData.result, null, 2));
    } else {
      const errorText = await storeResponse.text();
      console.error('Store API Error:', errorText);
    }
    
    // Test 2: Get synced products (requires store ID)
    console.log("\n--- Test 2: Get Synced Products ---");
    const syncResponse = await fetch(`${PRINTFUL_API_URL}/sync/products?store_id=${PRINTFUL_STORE_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`
      }
    });
    
    console.log('Sync API Response status:', syncResponse.status);
    
    if (syncResponse.ok) {
      const syncData = await syncResponse.json();
      console.log(`Found ${syncData.result ? syncData.result.length : 0} synced products`);
      
      if (syncData.result && syncData.result.length > 0) {
        console.log('First product:', JSON.stringify(syncData.result[0], null, 2));
      }
    } else {
      const errorText = await syncResponse.text();
      console.error('Sync API Error:', errorText);
    }
    
    // Test 3: Get store products (explicitly requires store_id parameter)
    console.log("\n--- Test 3: Get Store Products (with explicit store_id) ---");
    const productsResponse = await fetch(`${PRINTFUL_API_URL}/store/products?store_id=${PRINTFUL_STORE_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`
      }
    });
    
    console.log('Products API Response status:', productsResponse.status);
    
    if (productsResponse.ok) {
      const productsData = await productsResponse.json();
      console.log(`Found ${productsData.result ? productsData.result.length : 0} store products`);
      
      if (productsData.result && productsData.result.length > 0) {
        console.log('First product:', JSON.stringify(productsData.result[0], null, 2));
      }
    } else {
      const errorText = await productsResponse.text();
      console.error('Products API Error:', errorText);
    }
    
  } catch (err) {
    console.error('Error testing API:', err);
  }
}

testAPI();