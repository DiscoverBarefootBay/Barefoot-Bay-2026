/**
 * Direct test of SendGrid service to identify the root cause
 */
import { sendListingContactEmail } from './server/sendgrid-service.js';

console.log('Testing SendGrid service directly...');

// Test data matching what the contact form sends
const testData = {
  listingId: 80,
  listingTitle: "(SAMPLE AD) Apartment for Rent",
  toEmail: "m@gmail.com",
  sender: {
    username: "michael",
    email: "malgatitx@gmail.com",
    fullName: "Michael"
  },
  message: "Test message from contact form"
};

console.log('Test data:', testData);

try {
  const result = await sendListingContactEmail(
    testData.listingId,
    testData.listingTitle,
    testData.toEmail,
    testData.sender,
    testData.message
  );
  
  console.log('SendGrid test result:', result);
  if (result) {
    console.log('✅ SendGrid service is working correctly');
  } else {
    console.log('❌ SendGrid service failed');
  }
} catch (error) {
  console.error('❌ SendGrid service error:', error);
  console.error('Error stack:', error.stack);
}