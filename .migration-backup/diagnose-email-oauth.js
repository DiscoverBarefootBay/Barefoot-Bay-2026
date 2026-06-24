/**
 * Diagnostic script to test Google OAuth2 email configuration in production
 * This will help identify the specific issue causing 500 errors
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function diagnoseOAuthError() {
  console.log('🔍 Diagnosing Google OAuth2 Email Configuration');
  console.log('================================================');
  
  // Check if all required credentials are present
  const credentials = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    userEmail: process.env.GOOGLE_USER_EMAIL
  };
  
  console.log('\n1. Checking Environment Variables:');
  console.log('   GOOGLE_CLIENT_ID:', credentials.clientId ? '✅ Present' : '❌ Missing');
  console.log('   GOOGLE_CLIENT_SECRET:', credentials.clientSecret ? '✅ Present' : '❌ Missing');
  console.log('   GOOGLE_REFRESH_TOKEN:', credentials.refreshToken ? '✅ Present' : '❌ Missing');
  console.log('   GOOGLE_USER_EMAIL:', credentials.userEmail ? '✅ Present' : '❌ Missing');
  
  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken || !credentials.userEmail) {
    console.log('\n❌ Missing required OAuth2 credentials. Cannot proceed with diagnosis.');
    return;
  }
  
  console.log('\n2. Testing OAuth2 Client Creation:');
  try {
    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    
    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken
    });
    
    console.log('   ✅ OAuth2 client created successfully');
    
    console.log('\n3. Testing Access Token Generation:');
    try {
      const accessTokenResult = await new Promise((resolve, reject) => {
        oauth2Client.getAccessToken((err, token) => {
          if (err) {
            reject(err);
          } else {
            resolve(token);
          }
        });
      });
      
      console.log('   ✅ Access token generated successfully');
      console.log('   Token preview:', typeof accessTokenResult === 'string' ? accessTokenResult.substring(0, 20) + '...' : 'Invalid token format');
      
    } catch (tokenError) {
      console.log('   ❌ Failed to generate access token');
      console.log('   Error:', tokenError.message);
      
      if (tokenError.response && tokenError.response.data) {
        console.log('   Response data:', JSON.stringify(tokenError.response.data, null, 2));
      }
      
      // Specific error handling
      if (tokenError.message.includes('invalid_grant')) {
        console.log('\n🔧 DIAGNOSIS: Refresh token is expired or invalid');
        console.log('   SOLUTION: You need to regenerate the Google OAuth2 refresh token');
        console.log('   Steps:');
        console.log('   1. Go to https://developers.google.com/oauthplayground');
        console.log('   2. Select Gmail API v1 scope: https://mail.google.com/');
        console.log('   3. Authorize APIs and exchange authorization code for tokens');
        console.log('   4. Copy the new refresh token to GOOGLE_REFRESH_TOKEN');
      } else if (tokenError.message.includes('invalid_client')) {
        console.log('\n🔧 DIAGNOSIS: Client ID or Client Secret is invalid');
        console.log('   SOLUTION: Verify Google Cloud Console OAuth2 credentials');
      }
      
      return;
    }
    
  } catch (clientError) {
    console.log('   ❌ Failed to create OAuth2 client');
    console.log('   Error:', clientError.message);
    return;
  }
  
  console.log('\n✅ OAuth2 configuration appears to be working correctly');
  console.log('If you\'re still getting 500 errors, the issue may be in a different part of the email service.');
}

// Run the diagnosis
diagnoseOAuthError().catch(error => {
  console.error('\n💥 Unexpected error during diagnosis:', error);
  process.exit(1);
});