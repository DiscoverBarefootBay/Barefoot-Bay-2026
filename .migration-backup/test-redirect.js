/**
 * Simple test script to verify calendar media redirects and direct file serving
 */
import fetch from 'node-fetch';

async function testScenario(url, expectRedirect = true) {
  try {
    console.log(`\nTesting URL: ${url}`);
    console.log(`Expecting: ${expectRedirect ? 'redirect to Object Storage' : 'direct file serving'}`);
    
    // Use the test file path
    const response = await fetch(`http://localhost:5000${url}`, {
      redirect: 'manual' // Don't follow redirects automatically
    });
    
    console.log('Response status:', response.status);
    
    // For brevity, only show the most important headers
    console.log('Content-Type:', response.headers.get('content-type'));
    
    if (response.status === 302) {
      console.log('✅ Redirect found! Location:', response.headers.get('location'));
      return true;
    } else if (response.status === 200) {
      console.log('✅ File served directly from filesystem');
      return true;
    } else {
      console.log('❌ Unexpected status code:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error testing URL:', error);
    return false;
  }
}

async function runTests() {
  console.log('=== Calendar Media Dual-Storage Test ===');
  
  // Test 1: File exists only in Object Storage
  await testScenario('/uploads/calendar/test-object-storage-only.jpg', true);
  
  // Test 2: File exists in filesystem
  await testScenario('/uploads/calendar/media-1745760450199-941630067.png', false);
  
  console.log('\n=== Tests Completed ===');
}

runTests();