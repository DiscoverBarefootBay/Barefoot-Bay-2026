/**
 * Direct test to trigger the contact form crash and identify the root cause
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

async function testContactFormCrash() {
  console.log('Testing Contact Form Crash - Direct API Call');
  console.log('===============================================');
  
  const baseUrl = 'http://localhost:5000';
  const listingId = 80;
  
  try {
    // First, simulate login to get session cookies
    console.log('\n1. Attempting to simulate authenticated request...');
    
    const contactData = {
      message: 'Test message to trigger the crash'
    };
    
    console.log('2. Sending contact form request...');
    console.log('Request URL:', `${baseUrl}/api/listings/${listingId}/contact`);
    console.log('Request data:', contactData);
    
    const response = await fetch(`${baseUrl}/api/listings/${listingId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test)',
        'Accept': 'application/json'
      },
      body: JSON.stringify(contactData)
    });
    
    console.log('\n3. Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.status === 500) {
      console.log('\n❌ 500 ERROR REPRODUCED');
      console.log('This confirms the server crash issue');
    } else if (response.status === 401) {
      console.log('\n⚠️ Authentication required - expected behavior');
    } else {
      console.log('\n✅ Unexpected response - investigating further');
    }
    
  } catch (error) {
    console.log('\n❌ FETCH ERROR:', error.message);
    console.log('This could indicate server crash or network issue');
    console.log('Stack:', error.stack);
  }
}

// Also test without authentication to see if it's an auth issue
async function testWithoutAuth() {
  console.log('\n\nTesting Without Authentication');
  console.log('=============================');
  
  const baseUrl = 'http://localhost:5000';
  const listingId = 80;
  
  try {
    const response = await fetch(`${baseUrl}/api/listings/${listingId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Test message without auth'
      })
    });
    
    console.log('Status without auth:', response.status);
    const responseText = await response.text();
    console.log('Response without auth:', responseText);
    
  } catch (error) {
    console.log('Error without auth:', error.message);
  }
}

testContactFormCrash()
  .then(() => testWithoutAuth())
  .catch(console.error);