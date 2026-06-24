/**
 * Test script to diagnose email service issues
 */

import { sendListingContactEmail } from './server/email-service.ts';

async function testEmailService() {
  console.log('Testing email service initialization...');
  
  try {
    // Try to send a test email to trigger the OAuth2 authentication
    const result = await sendListingContactEmail(
      80, // listing ID
      'Test Listing',
      'test@example.com', // recipient email
      { id: 104, username: 'testuser', email: 'sender@example.com', fullName: 'Test User' }, // sender
      'Test message from email service diagnostic'
    );
    
    console.log('Email service test result:', result);
  } catch (error) {
    console.error('Email service test failed:', error);
    console.error('Error stack:', error.stack);
  }
}

testEmailService();