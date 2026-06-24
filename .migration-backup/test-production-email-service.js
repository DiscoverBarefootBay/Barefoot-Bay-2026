/**
 * Comprehensive test of the email service in production environment
 * This will help identify exactly where the 500 error occurs
 */

import { sendListingContactEmail } from './server/email-service.ts';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testProductionEmailService() {
  console.log('🔧 Testing Production Email Service');
  console.log('=====================================');
  
  // Test with real data from the production environment
  const testData = {
    listingId: 80,
    listingTitle: 'Test Listing for Email Service',
    toEmail: 'test@example.com', // Safe test email
    sender: {
      id: 104,
      username: 'upgradetest',
      email: 'upgradetest@gmail.com',
      fullName: 'upgradetest'
    },
    message: 'This is a test message to verify the email service functionality in production.'
  };
  
  console.log('\n1. Testing Email Service Components:');
  console.log('   Environment:', process.env.NODE_ENV);
  console.log('   Listing ID:', testData.listingId);
  console.log('   Recipient:', testData.toEmail);
  console.log('   Sender:', testData.sender.username);
  
  try {
    console.log('\n2. Calling sendListingContactEmail...');
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
      console.log('\n✅ Email service is working correctly');
      console.log('The 500 error must be occurring elsewhere in the request flow');
    } else {
      console.log('\n❌ Email service failed');
      console.log('This is the source of the 500 error in production');
    }
    
  } catch (error) {
    console.log('\n💥 Email service threw an exception');
    console.log('   Error type:', error.constructor.name);
    console.log('   Error message:', error.message);
    
    if (error.stack) {
      console.log('   Stack trace:');
      console.log(error.stack);
    }
    
    console.log('\n🔧 This exception is causing the 500 error in production');
    
    // Analyze the specific error
    if (error.message.includes('OAuth2') || error.message.includes('invalid_grant')) {
      console.log('\n📋 DIAGNOSIS: OAuth2 Authentication Issue');
      console.log('   - The Google OAuth2 refresh token may be expired');
      console.log('   - The OAuth2 credentials may be misconfigured');
      console.log('   - Network connectivity to Google APIs may be blocked');
    } else if (error.message.includes('Missing required')) {
      console.log('\n📋 DIAGNOSIS: Missing Environment Variables');
      console.log('   - Required OAuth2 environment variables are not set');
    } else {
      console.log('\n📋 DIAGNOSIS: Unknown Email Service Error');
      console.log('   - The error requires further investigation');
    }
  }
  
  console.log('\n=====================================');
  console.log('✅ Production email service test complete');
}

// Run the test
testProductionEmailService().catch(error => {
  console.error('\n💥 Unexpected error during production email test:', error);
  process.exit(1);
});