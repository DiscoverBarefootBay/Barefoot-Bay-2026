/**
 * Test SendGrid contact form implementation
 */

import { sendListingContactEmail } from './server/sendgrid-service.ts';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSendGridContactForm() {
  console.log('🔧 Testing SendGrid Contact Form Implementation');
  console.log('=============================================');
  
  // Check if SendGrid API key is available
  console.log('\n1. Environment Check:');
  console.log('   SendGrid API Key:', process.env.SENDGRID_API_KEY ? 'Present' : 'Missing');
  
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY is missing');
    return;
  }
  
  // Test data matching the expected function signature
  const testData = {
    listingId: 80,
    listingTitle: 'Test Listing - SendGrid Implementation',
    toEmail: 'test@example.com', // Safe test email
    sender: {
      username: 'testuser',
      email: 'testuser@example.com',
      fullName: 'Test User'
    },
    message: 'This is a test message to verify the SendGrid email service functionality. The contact form should now work reliably in production without OAuth issues.'
  };
  
  console.log('\n2. Test Parameters:');
  console.log('   Listing ID:', testData.listingId);
  console.log('   Recipient:', testData.toEmail);
  console.log('   Sender:', testData.sender.username);
  console.log('   Message Length:', testData.message.length);
  
  try {
    console.log('\n3. Calling sendListingContactEmail with SendGrid...');
    const startTime = Date.now();
    
    const result = await sendListingContactEmail(
      testData.listingId,
      testData.listingTitle,
      testData.toEmail,
      testData.sender,
      testData.message
    );
    
    const endTime = Date.now();
    console.log(`   Email service completed in ${endTime - startTime}ms`);
    console.log('   Result:', result ? '✅ SUCCESS' : '❌ FAILED');
    
    if (result) {
      console.log('\n✅ SendGrid Email Service Test: PASSED');
      console.log('The contact form should now work properly in production');
      console.log('No more OAuth refresh token issues!');
    } else {
      console.log('\n❌ SendGrid Email Service Test: FAILED');
      console.log('Check SendGrid API key and configuration');
    }
    
  } catch (error) {
    console.error('\n❌ SendGrid Email Service Test: ERROR');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSendGridContactForm().catch(console.error);