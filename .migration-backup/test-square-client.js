/**
 * Script to test Square client initialization and verify if updated credentials are being used
 */

// Import required modules
import { getSquareClient } from './server/square-client.js';

async function testSquareClient() {
  try {
    console.log('Testing Square client initialization...');
    
    // Get Square client
    const squareClient = getSquareClient();
    
    // Check if client is initialized
    console.log('Square client initialized:', !!squareClient);
    
    // Check available APIs
    const apis = [
      'customersApi',
      'subscriptionsApi',
      'checkoutApi',
      'locationsApi',
      'ordersApi',
      'paymentsApi'
    ];
    
    console.log('Square client API availability:');
    for (const api of apis) {
      console.log(`- ${api}: ${!!squareClient[api]}`);
    }
    
    // Check environment
    console.log('Environment variables:');
    console.log(`- SQUARE_ACCESS_TOKEN: ${process.env.SQUARE_ACCESS_TOKEN ? 'Present (masked)' : 'Missing'}`);
    console.log(`- SQUARE_APPLICATION_ID: ${process.env.SQUARE_APPLICATION_ID ? 'Present (masked)' : 'Missing'}`);
    console.log(`- SQUARE_LOCATION_ID: ${process.env.SQUARE_LOCATION_ID ? 'Present (masked)' : 'Missing'}`);
    console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
    
    // Test API connection if possible
    if (squareClient.customersApi) {
      try {
        console.log('Testing API connection with a location request...');
        const response = await fetch('https://connect.squareup.com/v2/locations', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
            'Square-Version': '2023-09-25'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('API connection successful!');
          console.log(`Number of locations found: ${data.locations?.length || 0}`);
          
          // Print basic info about the first location
          if (data.locations && data.locations.length > 0) {
            const location = data.locations[0];
            console.log(`Location details (first location):`);
            console.log(`- ID: ${location.id}`);
            console.log(`- Name: ${location.name}`);
            console.log(`- Status: ${location.status}`);
          }
        } else {
          console.error('API connection failed:', response.status, response.statusText);
          const errorData = await response.text();
          console.error('Error details:', errorData);
        }
      } catch (error) {
        console.error('Error testing API connection:', error);
      }
    } else {
      console.log('Skip API test - Square client does not have customersApi');
    }
    
  } catch (error) {
    console.error('Error testing Square client:', error);
  }
}

// Run the test
testSquareClient();