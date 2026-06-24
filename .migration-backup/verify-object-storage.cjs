/**
 * Script to verify Replit Object Storage accessibility
 * Tests direct HTTP access to the uploaded rocket icons
 */

const https = require('https');

const urlsToCheck = [
  'https://object-storage.replit.app/DEFAULT/icons/Asset1.svg',
  'https://object-storage.replit.app/DEFAULT/icons/Asset%201.svg',
  'https://object-storage.replit.app/DEFAULT/icons/rocket-icon.svg'
];

// Function to make an HTTP request and check response status
function checkUrl(url) {
  return new Promise((resolve, reject) => {
    console.log(`Checking URL: ${url}`);
    
    https.get(url, (res) => {
      const { statusCode, headers } = res;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${statusCode}`);
        console.log(`Content-Type: ${headers['content-type']}`);
        console.log(`Content length: ${data.length} bytes`);
        console.log('---');
        
        resolve({
          url,
          status: statusCode,
          contentType: headers['content-type'],
          length: data.length,
          success: statusCode === 200
        });
      });
    }).on('error', (err) => {
      console.error(`Error checking ${url}: ${err.message}`);
      resolve({
        url,
        success: false,
        error: err.message
      });
    });
  });
}

// Main function to check all URLs
async function verifyObjectStorage() {
  console.log('Verifying Object Storage accessibility...\n');
  
  const results = [];
  
  for (const url of urlsToCheck) {
    const result = await checkUrl(url);
    results.push(result);
  }
  
  console.log('\nSummary:');
  const successCount = results.filter(r => r.success).length;
  console.log(`${successCount}/${results.length} URLs accessible`);
  
  if (successCount < results.length) {
    console.log('\nFailed URLs:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`- ${r.url} (${r.error || 'Status: ' + r.status})`);
    });
    
    console.log('\nPossible issues:');
    console.log('1. Object Storage permissions - check bucket permissions');
    console.log('2. CORS configuration - check if cross-origin requests are allowed');
    console.log('3. File existence - verify files were actually uploaded');
  }
}

verifyObjectStorage();