/**
 * Script to test the Square payment integration with proper email
 * This will simulate a payment creation request with an email
 */
import fetch from 'node-fetch';

async function testSquarePayment() {
  try {
    // Step 1: Login to get a session cookie
    console.log('Logging in...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'Bob the Builder',
        password: 'test1234' // Replace with actual password if needed
      }),
      redirect: 'manual'
    });
    
    if (!loginResponse.ok) {
      console.error('Login failed:', await loginResponse.text());
      return;
    }
    
    // Get the session cookie from the response
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    const sessionCookie = setCookieHeader ? setCookieHeader.split(';')[0] : null;
    
    if (!sessionCookie) {
      console.error('Failed to get session cookie');
      return;
    }
    
    console.log('Logged in successfully');
    
    // Step 2: Create a payment link
    console.log('Creating payment link...');
    const paymentResponse = await fetch('http://localhost:5000/api/payments/create-listing-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        discountCode: 'HALF2025' // Use discount code to reduce amount for testing
      })
    });
    
    if (!paymentResponse.ok) {
      console.error('Payment link creation failed:', await paymentResponse.text());
      return;
    }
    
    const paymentData = await paymentResponse.json();
    console.log('Payment link created successfully:');
    console.log(JSON.stringify(paymentData, null, 2));
    
    console.log('Payment URL:', paymentData.paymentLinkUrl);
    
    // Note: You can now open the payment URL in a browser to test the full flow
    console.log('Test complete - checkout the logs above for any potential issues');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testSquarePayment();