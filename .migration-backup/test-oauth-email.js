/**
 * Test script to verify OAuth2 email sending functionality
 * 
 * This script tests the email service using the OAuth2 configuration,
 * without requiring a password reset flow.
 * 
 * Usage:
 * node test-oauth-email.js test@example.com
 */

require('dotenv').config();
const { sendEmail } = require('./server/email-service');

async function testEmailSending() {
  // Get recipient email from command line arguments
  const recipientEmail = process.argv[2] || 'test@example.com';
  
  console.log(`Testing email sending to: ${recipientEmail}`);
  console.log('Using OAuth2 configuration:');
  console.log(`- GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '(set)' : 'missing'}`);
  console.log(`- GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '(set)' : 'missing'}`);
  console.log(`- GOOGLE_REFRESH_TOKEN: ${process.env.GOOGLE_REFRESH_TOKEN ? '(set)' : 'missing'}`);
  console.log(`- GOOGLE_USER_EMAIL: ${process.env.GOOGLE_USER_EMAIL || 'missing'}`);
  
  try {
    const result = await sendEmail({
      to: recipientEmail,
      subject: 'Test Email from Barefoot Bay',
      text: 'This is a test email sent using the updated OAuth2 configuration.\n\nIf you are seeing this, the email service is working correctly!'
    });
    
    console.log(`Email sending result: ${result ? 'Success!' : 'Failed'}`);
  } catch (error) {
    console.error('Error sending test email:', error);
  }
}

// Run the test
testEmailSending().catch(console.error);