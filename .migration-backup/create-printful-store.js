/**
 * Script to create a Printful store via API
 * This will help us get a store_id to use with the Printful API
 */

import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_API_URL = "https://api.printful.com";

console.log("Creating a Printful store...");
console.log(`API Key available: ${!!PRINTFUL_API_KEY}`);

// Headers for all Printful API requests
const getHeaders = () => {
  return {
    "Authorization": `Bearer ${PRINTFUL_API_KEY}`,
    "Content-Type": "application/json",
    "X-PF-API-Version": "1"
  };
};

// Create a new store
async function createStore() {
  try {
    console.log("Creating new Printful store...");
    
    // Store data
    const storeData = {
      name: "Barefoot Bay Store",
      website: "https://barefootbay.org",
      type: "api",
      webhook_url: null // Optional webhook URL
    };
    
    const response = await fetch(`${PRINTFUL_API_URL}/stores`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(storeData)
    });
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const textResponse = await response.text();
      console.error("Response:", textResponse);
      return null;
    }
    
    const data = await response.json();
    console.log("Store created successfully!");
    console.log("Store ID:", data.result.id);
    console.log("Full response data:", JSON.stringify(data, null, 2));
    
    // Display instructions for adding to .env
    console.log("\n=====================================================");
    console.log("IMPORTANT: Add the following line to your .env file:");
    console.log(`PRINTFUL_STORE_ID=${data.result.id}`);
    console.log("=====================================================\n");
    
    return data.result.id;
  } catch (error) {
    console.error("Failed to create store:", error);
    return null;
  }
}

// Run the function
createStore();