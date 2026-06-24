// Test script to diagnose vendor page update issues
const fetch = require('node-fetch');

async function testVendorUpdate() {
  try {
    // First need to login
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'michael',
        password: 'password123' // This is a placeholder, will need to be replaced with actual password
      }),
      credentials: 'include'
    });
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login response status:', loginResponse.status);
    
    if (loginResponse.status !== 200) {
      console.error('Login failed. Please update the credentials in the script.');
      return;
    }
    
    // Now try to update the vendor page with minimal content
    const updateResponse = await fetch('http://localhost:5000/api/pages/271', {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: cookies
      },
      body: JSON.stringify({
        title: 'Timber Creek Grounds',
        content: '<p>Test content with image</p><img src="/vendor-media/test-image.jpg" alt="Test Image" />',
        slug: 'vendors-landscaping timber-creek-grounds'
      }),
      credentials: 'include'
    });
    
    const responseText = await updateResponse.text();
    console.log('Update response status:', updateResponse.status);
    console.log('Response body:', responseText);
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

testVendorUpdate();
