/**
 * Test script to verify OAuth2 email sending is working correctly
 * 
 * This script attempts to send an email using the OAuth2 method configured in email-service.ts
 * 
 * Usage:
 *  npx tsx test-oauth-email.ts
 */

import dotenv from 'dotenv';
import { sendEmail } from './server/email-service';

// Load environment variables
dotenv.config();

// Log environment variables (with masking for sensitive data)
console.log('=== Environment Variables ===');
console.log('GOOGLE_USER_EMAIL:', process.env.GOOGLE_USER_EMAIL);
console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '(set - first 4 chars): ' + process.env.GMAIL_APP_PASSWORD.substring(0, 4) + '***' : 'Not set');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '(set - full value): ' + process.env.GOOGLE_CLIENT_ID : 'Not set');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '(set - first 8 chars): ' + process.env.GOOGLE_CLIENT_SECRET.substring(0, 8) + '***' : 'Not set');
console.log('GOOGLE_REFRESH_TOKEN:', process.env.GOOGLE_REFRESH_TOKEN ? '(set - first 8 chars): ' + process.env.GOOGLE_REFRESH_TOKEN.substring(0, 8) + '***' : 'Not set');
console.log('GOOGLE_ACCESS_TOKEN:', process.env.GOOGLE_ACCESS_TOKEN ? '(set - exists)' : 'Not set');

async function testOAuthEmail() {
  console.log('\n=== Testing OAuth2 Email Sending ===');
  console.log('Attempting to send test email...');
  
  try {
    const result = await sendEmail({
      to: 'malgatitix@gmail.com', // Replace with your test email address
      subject: 'OAuth2 Test Email from Barefoot Bay',
      text: 'This is a test email sent using OAuth2 authentication to verify that email sending is working properly.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #4361ee;">OAuth2 Test Email from Barefoot Bay</h2>
          <p>This is a <strong>test email</strong> sent using OAuth2 authentication to verify that email sending is working properly.</p>
          <p>If you're seeing this, the OAuth2 email configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `
    });
    
    if (result) {
      console.log('✅ Email sent successfully!');
    } else {
      console.log('❌ Email sending failed. Check server logs for details.');
    }
  } catch (error) {
    console.error('Error sending test email:', error);
  }
}

testOAuthEmail().catch(console.error);