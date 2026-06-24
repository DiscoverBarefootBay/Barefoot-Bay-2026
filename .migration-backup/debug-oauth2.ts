/**
 * OAuth2 Debug Script
 * This script helps diagnose OAuth2 authentication issues
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

async function debugOAuth2() {
  console.log('=== OAuth2 Debug Information ===');
  
  // Check if all required environment variables are present
  const requiredVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_USER_EMAIL'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    return;
  }
  
  console.log('✅ All required environment variables are present');
  console.log('📧 Email account:', process.env.GOOGLE_USER_EMAIL);
  console.log('🔑 Client ID:', process.env.GOOGLE_CLIENT_ID);
  console.log('🔐 Client Secret:', process.env.GOOGLE_CLIENT_SECRET?.substring(0, 12) + '...');
  console.log('🔄 Refresh Token:', process.env.GOOGLE_REFRESH_TOKEN?.substring(0, 15) + '...');
  
  // Test OAuth2 setup
  console.log('\n=== Testing OAuth2 Setup ===');
  
  try {
    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    console.log('🔄 Attempting to generate new access token...');
    
    // Try to get access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (credentials.access_token) {
      console.log('✅ Successfully generated new access token');
      console.log('🔑 New access token:', credentials.access_token.substring(0, 20) + '...');
      
      // Test Gmail API access
      console.log('\n=== Testing Gmail API Access ===');
      
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      try {
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.log('✅ Successfully accessed Gmail API');
        console.log('📧 Email address confirmed:', profile.data.emailAddress);
        console.log('💌 Total messages:', profile.data.messagesTotal);
        
        // Check if send scope is available
        console.log('\n=== Testing Send Permission ===');
        
        // Try to get a draft (this tests send permission without actually sending)
        try {
          await gmail.users.drafts.list({ userId: 'me', maxResults: 1 });
          console.log('✅ Send permission appears to be working');
        } catch (draftError) {
          console.log('⚠️ Send permission test failed:', draftError.message);
        }
        
      } catch (gmailError) {
        console.error('❌ Gmail API access failed:', gmailError.message);
      }
      
    } else {
      console.error('❌ No access token received');
    }
    
  } catch (error) {
    console.error('❌ OAuth2 setup failed:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 Suggestion: Your refresh token may have expired. Try generating a new one.');
    } else if (error.message.includes('invalid_client')) {
      console.log('\n💡 Suggestion: Check your Client ID and Client Secret.');
    }
  }
}

debugOAuth2().catch(console.error);