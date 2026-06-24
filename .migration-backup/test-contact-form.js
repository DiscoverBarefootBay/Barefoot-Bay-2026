/**
 * Test the SendGrid contact form implementation
 */

const https = require('https');

async function testContactForm() {
  console.log('Testing SendGrid Contact Form Implementation');
  console.log('==========================================');
  
  // Test data for the contact form
  const testData = JSON.stringify({
    message: 'This is a test message to verify the SendGrid email service is working properly for contact forms. The implementation should now use SendGrid instead of Gmail OAuth.'
  });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/listings/80/contact',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': testData.length,
      'Cookie': 'connect.sid=test' // Mock session for testing
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', data);
        
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: response
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request Error:', error);
      reject(error);
    });
    
    req.write(testData);
    req.end();
  });
}

// Run the test
testContactForm()
  .then(result => {
    console.log('\nTest Result:');
    console.log('Status Code:', result.status);
    console.log('Response:', result.data);
    
    if (result.status === 200) {
      console.log('\n✅ SendGrid Contact Form Test: SUCCESS');
    } else if (result.status === 401) {
      console.log('\n⚠️  Authentication required - this is expected behavior');
    } else {
      console.log('\n❌ SendGrid Contact Form Test: FAILED');
    }
  })
  .catch(error => {
    console.error('\n❌ Test Failed:', error.message);
  });