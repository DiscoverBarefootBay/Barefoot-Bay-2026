/**
 * Debug SendGrid service to identify the exact issue
 */

import { sendListingContactEmail } from './server/sendgrid-service.js';

console.log('=== SendGrid Debug Test ===');

// Test with the exact data from the failed request
const testData = {
  listingId: 75,
  listingTitle: "Test Listing",
  toEmail: "test@example.com",
  sender: {
    username: "michael",
    email: "malgatitx@gmail.com", 
    fullName: "Michael"
  },
  message: "Test message for debugging the contact form issue"
};

console.log('Testing with data:', JSON.stringify(testData, null, 2));

try {
  console.log('Calling sendListingContactEmail...');
  const result = await sendListingContactEmail(
    testData.listingId,
    testData.listingTitle,
    testData.toEmail,
    testData.sender,
    testData.message
  );
  
  console.log('SendGrid test result:', result);
  if (result) {
    console.log('✅ SendGrid service working correctly');
  } else {
    console.log('❌ SendGrid service returned false');
  }
} catch (error) {
  console.error('❌ SendGrid service error:');
  console.error('Error message:', error.message);
  console.error('Error type:', error.constructor.name);
  console.error('Error stack:', error.stack);
  
  // Check for specific SendGrid errors
  if (error.message.includes('setApiKey')) {
    console.error('Import issue detected - SendGrid module not properly imported');
  } else if (error.message.includes('unauthorized')) {
    console.error('API key issue detected - check SENDGRID_API_KEY');
  } else if (error.message.includes('Mail Send Error')) {
    console.error('SendGrid service error - check API configuration');
  }
}