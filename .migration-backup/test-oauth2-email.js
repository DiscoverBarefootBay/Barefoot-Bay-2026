/**
 * Test OAuth2 email functionality specifically
 * This tests the same OAuth2 method used in production
 */

import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testOAuth2Email() {
  console.log('=== OAuth2 Email Test Script ===');
  
  // Check for required OAuth2 environment variables
  console.log('\nChecking OAuth2 environment variables:');
  const requiredOAuthVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_USER_EMAIL'];
  const missingVars = [];
  
  for (const varName of requiredOAuthVars) {
    if (process.env[varName]) {
      console.log(`✓ ${varName}: Available`);
    } else {
      console.log(`✗ ${varName}: Missing`);
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.error('\nMissing required OAuth2 environment variables:', missingVars.join(', '));
    return;
  }
  
  try {
    console.log('\nSetting up Google OAuth2 client...');
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const userEmail = process.env.GOOGLE_USER_EMAIL;
    
    console.log('Client ID:', clientId.substring(0, 10) + '...');
    console.log('User Email:', userEmail);
    
    // Create OAuth2 client
    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    console.log('\nGetting access token from refresh token...');
    
    // Get access token
    const accessTokenResult = await new Promise((resolve, reject) => {
      oauth2Client.getAccessToken((err, token) => {
        if (err) {
          console.error('Error getting access token:', err);
          reject(err);
        } else if (!token) {
          console.error('No access token returned');
          reject(new Error('No access token returned'));
        } else {
          console.log('✓ Access token obtained successfully');
          resolve(token);
        }
      });
    });
    
    console.log('\nCreating OAuth2 transporter...');
    
    // Create transporter using OAuth2
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: userEmail,
        clientId: clientId,
        clientSecret: clientSecret,
        refreshToken: refreshToken,
        accessToken: accessTokenResult
      }
    });
    
    const testEmail = userEmail; // Send to the same authenticated email
    console.log(`\nSending test email to: ${testEmail}`);
    
    const mailOptions = {
      from: `"Barefoot Bay Test" <${userEmail}>`,
      to: testEmail,
      subject: 'OAuth2 Email Test - Password Reset Functionality',
      text: 'This is a test email to verify that OAuth2 email functionality is working correctly for password reset emails.',
      html: `
        <h1>OAuth2 Email Test</h1>
        <p>This is a test email to verify that OAuth2 email functionality is working correctly for password reset emails.</p>
        <p>If you receive this email, the OAuth2 authentication is working properly.</p>
        <p>Test performed at: ${new Date().toISOString()}</p>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('\n✓ OAuth2 email sent successfully!');
    console.log(`Message ID: ${info.messageId}`);
    console.log('\nOAuth2 email test completed successfully.');
    
    return true;
    
  } catch (error) {
    console.error('\n✗ OAuth2 email test failed:');
    console.error(error);
    
    // More detailed error analysis
    if (error.code === 'EAUTH') {
      console.error('\nOAuth2 authentication error. Check your credentials.');
    } else if (error.response && error.response.data) {
      console.error('Error response data:', error.response.data);
    }
    
    return false;
  }
}

// Run the test
testOAuth2Email().then(success => {
  if (success) {
    console.log('\n🎉 OAuth2 email test passed! Password reset emails should work.');
  } else {
    console.log('\n❌ OAuth2 email test failed. Password reset emails will not work.');
  }
}).catch(error => {
  console.error('Test script error:', error);
});