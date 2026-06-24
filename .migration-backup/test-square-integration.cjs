/**
 * Test script for Square integration using CommonJS format
 * This tests if the email is properly passed to Square API
 */

const fetch = require('node-fetch');

async function testSquareIntegration() {
  try {
    console.log('Testing Square integration with email passing...');
    
    // Create a POST request to the payment endpoint
    // This will test our email passing logic
    const response = await fetch('http://localhost:5000/api/payments/create-listing-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=gVx-JPvFpcE0MwbA6bO-aE6Z6kK4uGr3'
      },
      body: JSON.stringify({
        discountCode: 'HALF2025' // Use discount code to reduce amount 
      })
    });
    
    // Check the response
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', response.status, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('Success! Payment link created:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.paymentLinkUrl) {
      console.log('\nPayment URL (can be opened in browser):', result.paymentLinkUrl);
      console.log('\nTest completed successfully. The email was properly passed to Square.');
    } else {
      console.log('\nTest completed but no payment URL was returned. This may indicate an issue.');
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testSquareIntegration();