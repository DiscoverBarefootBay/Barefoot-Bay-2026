/**
 * Simple test script to check if email sending is working
 * 
 * Usage:
 *  node test-email.js
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmail() {
  console.log('=== Email Test Script ===');
  
  // Check for required environment variables
  console.log('\nChecking environment variables:');
  const requiredVars = ['GMAIL_APP_PASSWORD', 'GOOGLE_USER_EMAIL'];
  const missingVars = [];
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`✓ ${varName}: Available`);
    } else {
      console.log(`✗ ${varName}: Missing`);
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.error('\nMissing required environment variables:', missingVars.join(', '));
    console.error('Please set these variables in .env file and try again.');
    return;
  }
  
  console.log('\nCreating email transporter with Gmail...');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GOOGLE_USER_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  
  const recipient = process.env.TEST_EMAIL || process.env.GOOGLE_USER_EMAIL;
  console.log(`\nSending test email to: ${recipient}`);
  
  const mailOptions = {
    from: `"Barefoot Bay Test" <${process.env.GOOGLE_USER_EMAIL}>`,
    to: recipient,
    subject: 'Password Reset Email Test',
    text: 'This is a test email to verify that the password reset functionality is working correctly.',
    html: `
      <h1>Password Reset Email Test</h1>
      <p>This is a test email to verify that the password reset functionality is working correctly.</p>
      <p>This would normally contain a reset link like:</p>
      <p><a href="https://example.com/reset-password?token=abcdef123456&email=test@example.com">Reset Your Password</a></p>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('\n✓ Email sent successfully!');
    console.log(`Message ID: ${info.messageId}`);
    
    // For development/testing only
    if (info.preview) {
      console.log(`Preview URL: ${info.preview}`);
    }
    
    console.log('\nTest completed successfully.');
  } catch (error) {
    console.error('\n✗ Failed to send email:');
    console.error(error);
    
    // More detailed error analysis
    if (error.code === 'EAUTH') {
      console.error('\nAuthentication error. Check your username and password.');
      console.error('For Gmail, make sure you\'re using an App Password if 2FA is enabled.');
      console.error('Create an App Password at: https://myaccount.google.com/apppasswords');
    } else if (error.code === 'ESOCKET') {
      console.error('\nNetwork error. Check your internet connection.');
    }
  }
}

testEmail().catch(console.error);