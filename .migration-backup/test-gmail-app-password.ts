/**
 * Gmail App Password Email Test Script
 * 
 * This script tests the email service with Gmail App Password
 * Run with: npx tsx test-gmail-app-password.ts
 */

import { sendEmail } from './server/email-service';

async function testGmailAppPassword() {
  console.log('Testing Gmail App Password email service...');
  
  try {
    // Send a test email
    const result = await sendEmail({
      to: 'malgatitix@gmail.com', // Change this to your email
      subject: 'Test Email from Barefoot Bay using Gmail App Password',
      text: 'This is a test email to verify that the Gmail App Password email service is working properly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <div style="background-color: #4361ee; color: white; padding: 10px 20px; border-radius: 5px 5px 0 0; margin: -20px -20px 20px;">
            <h2>Gmail App Password Test</h2>
          </div>
          
          <p>This is a <strong>test email</strong> to verify that the Gmail App Password email service is working properly.</p>
          
          <p>If you're seeing this, it means:</p>
          <ul>
            <li>Your Gmail App Password is valid</li>
            <li>The email service is properly configured</li>
            <li>Real emails can now be sent from your application</li>
          </ul>
          
          <p>Current time: ${new Date().toLocaleString()}</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0;">Thank you for setting up Gmail for your emails!</p>
          </div>
        </div>
      `
    });
    
    console.log('Email sending result:', result);
    
    // Log Gmail credentials (presence only, not values)
    console.log('\nGmail App Password Environment Variables:');
    console.log('- GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Is set' : 'Not set');
    console.log('- GOOGLE_USER_EMAIL:', process.env.GOOGLE_USER_EMAIL ? 'Is set' : 'Not set');
  } catch (error) {
    console.error('Error testing email service:', error);
  }
}

testGmailAppPassword().catch(console.error);