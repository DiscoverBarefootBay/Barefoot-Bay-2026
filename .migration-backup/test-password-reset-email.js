/**
 * Test the actual password reset email functionality
 * This uses the same function that the production system uses
 */

import { sendPasswordResetEmail } from './server/password-reset.js';
import dotenv from 'dotenv';

dotenv.config();

async function testPasswordResetEmail() {
  console.log('=== Password Reset Email Test ===');
  
  // Create a test user object (matching the structure from your database)
  const testUser = {
    id: 6,
    username: 'michael',
    email: 'michaelanthonygodoy@gmail.com',
    fullName: 'Michael Anthony'
  };
  
  // Generate a test reset token
  const resetToken = 'test_reset_token_' + Date.now();
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  
  console.log(`Testing password reset email for: ${testUser.email}`);
  console.log(`Reset token: ${resetToken}`);
  console.log(`Token expires: ${resetTokenExpires.toISOString()}`);
  
  try {
    console.log('\nSending password reset email...');
    const result = await sendPasswordResetEmail(testUser, resetToken, resetTokenExpires);
    
    if (result) {
      console.log('✓ Password reset email sent successfully!');
      console.log('\nThe email should arrive at:', testUser.email);
      
      // Check if there's a global variable with the reset link (from the password-reset.ts file)
      if (global.lastPasswordResetLink) {
        console.log('\nLast reset link generated:');
        console.log('Email:', global.lastPasswordResetLink.email);
        console.log('Token:', global.lastPasswordResetLink.token);
        console.log('Expires:', global.lastPasswordResetLink.expiresAt.toISOString());
      }
      
      return true;
    } else {
      console.log('✗ Password reset email failed to send');
      return false;
    }
  } catch (error) {
    console.error('✗ Error sending password reset email:', error);
    return false;
  }
}

// Run the test
testPasswordResetEmail().then(success => {
  if (success) {
    console.log('\n🎉 Password reset email test passed!');
  } else {
    console.log('\n❌ Password reset email test failed.');
  }
}).catch(error => {
  console.error('Test script error:', error);
});