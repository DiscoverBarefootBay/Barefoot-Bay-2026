/**
 * Debug script to test production email service configuration
 */

async function debugProductionEmail() {
  try {
    console.log('=== Production Email Service Debug ===');
    
    // Test the production API with detailed error logging
    const response = await fetch('https://barefootbay.com/api/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'michaelanthonygodoy@gmail.com'
      })
    });
    
    const data = await response.json();
    console.log('Production API Response:', data);
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    // Test if the production server has the latest password reset route
    const testResponse = await fetch('https://barefootbay.com/api/test-email-config', {
      method: 'GET'
    });
    
    console.log('Email config test status:', testResponse.status);
    if (testResponse.status === 404) {
      console.log('❌ Production server does not have updated email configuration endpoint');
    } else {
      const configData = await testResponse.json();
      console.log('Email config data:', configData);
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

debugProductionEmail();