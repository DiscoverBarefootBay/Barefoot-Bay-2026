/**
 * Create membership products using the setup-memberships API endpoint
 * 
 * This script calls the special setup-memberships endpoint to create
 * a memberships category and add monthly/annual membership products.
 * 
 * No authentication is required as the endpoint uses a special key.
 */

import fetch from 'node-fetch';

async function createMembershipProducts() {
  try {
    console.log("Setting up membership products via API...");
    
    // Define the base URL
    const baseUrl = 'https://10d91268-aa00-4bbf-8cbc-902453f7f73d-00-y43hx7t2mc3m.janeway.replit.dev';
    
    // Call the setup-memberships endpoint with the special key
    const response = await fetch(`${baseUrl}/api/setup-memberships?key=setup-barefoot-memberships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create membership products. Status: ${response.status}`);
      console.error(`Error: ${errorText}`);
      return;
    }
    
    // Parse and log the response
    const result = await response.json();
    console.log("Membership setup result:", JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log("✅ Successfully set up membership products!");
      console.log(`Category created: ${result.categoryCreated ? 'Yes' : 'No (already existed)'}`);
      console.log(`Monthly membership created: ${result.monthlyCreated ? 'Yes' : 'No (already existed)'}`);
      console.log(`Annual membership created: ${result.annualCreated ? 'Yes' : 'No (already existed)'}`);
    } else {
      console.log("❌ Membership setup completed with errors:", result.message);
      if (result.errors && result.errors.length > 0) {
        console.log("Errors:", result.errors.join(", "));
      }
    }
  } catch (error) {
    console.error("Error creating membership products:", error);
  }
}

// Execute the main function
createMembershipProducts().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});