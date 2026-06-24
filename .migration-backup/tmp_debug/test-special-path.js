/**
 * Direct test for the new specialized endpoint
 */
import fetch from 'node-fetch';
import { Client } from '@replit/object-storage';

// Create a test file with the current timestamp as part of the name
async function createTestFile() {
  const timestamp = Date.now();
  const filename = `special-forum-test-${timestamp}.txt`;
  const content = `This is a special test file for forum path testing. ${timestamp}`;
  
  try {
    const client = new Client();
    console.log(`Creating test file: FORUM/forum/${filename}`);
    
    // Upload to FORUM bucket with forum/ prefix
    const result = await client.uploadFromText(
      `forum/${filename}`,
      content,
      {
        bucketName: 'FORUM',
        contentType: 'text/plain',
        headers: { 'X-Obj-Bucket': 'FORUM' }
      }
    );
    
    if (!result.ok) {
      throw new Error(`Upload failed: ${result.error?.message}`);
    }
    
    console.log('✅ Test file created successfully!');
    return { filename, content };
  } catch (error) {
    console.error('Error creating test file:', error);
    throw error;
  }
}

// Test various URL formats to see which ones work
async function testUrls(testInfo) {
  const baseUrl = 'http://localhost:5000';
  
  const urls = [
    // The standard format we're having trouble with
    `/api/storage-proxy/FORUM/forum/${testInfo.filename}`,
    
    // Direct URL to our specialized handler 
    `/api/storage-proxy/FORUM/forum/${testInfo.filename}?debug=true`,
    
    // A working format for comparison
    `/api/storage-proxy/direct-forum/${testInfo.filename}`
  ];
  
  console.log('\nTesting URL formats:');
  
  for (const url of urls) {
    try {
      console.log(`\nTesting: ${url}`);
      const fullUrl = `${baseUrl}${url}`;
      
      const response = await fetch(fullUrl, {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'SpecialPathTest/1.0',
          'X-Debug-Test': 'true'
        }
      });
      
      console.log(`Status: ${response.status}`);
      console.log(`Headers: ${JSON.stringify({
        'content-type': response.headers.get('content-type'),
        'x-standard-forum-format': response.headers.get('x-standard-forum-format'),
        'x-forum-special-case': response.headers.get('x-forum-special-case'),
        'x-default-forum-image': response.headers.get('x-default-forum-image')
      }, null, 2)}`);
      
      const content = await response.text();
      console.log(`Content preview: ${content.substring(0, 50)}...`);
      
      const success = content === testInfo.content;
      if (success) {
        console.log('✅ SUCCESS: Content matches expected value');
      } else {
        console.log('❌ FAILURE: Content does not match');
        console.log(`Expected: ${testInfo.content}`);
        console.log(`Actual length: ${content.length} chars`);
        
        if (content.startsWith('<svg')) {
          console.log('Content is the default SVG image instead of the actual file');
        }
      }
    } catch (error) {
      console.error(`Error testing URL ${url}:`, error);
    }
  }
}

// Clean up after testing
async function cleanup(filename) {
  try {
    const client = new Client();
    await client.delete(`forum/${filename}`, {
      bucketName: 'FORUM',
      headers: { 'X-Obj-Bucket': 'FORUM' }
    });
    console.log(`\nTest file cleaned up: FORUM/forum/${filename}`);
  } catch (error) {
    console.error('Error cleaning up test file:', error);
  }
}

// Main function
async function main() {
  console.log('=== TESTING SPECIAL FORUM PATH HANDLING ===');
  
  try {
    const testInfo = await createTestFile();
    await testUrls(testInfo);
    await cleanup(testInfo.filename);
    console.log('\nTest completed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the main function
main();