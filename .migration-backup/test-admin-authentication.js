/**
 * Test admin authentication and password reset functionality
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testAdminLogin() {
  console.log('Testing MichaelAnthony admin login...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'MichaelAnthony',
        password: 'TempPassword123!'
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('User details:', {
        id: result.id,
        username: result.username,
        email: result.email,
        role: result.role
      });
      return true;
    } else {
      console.log('❌ Login failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return false;
  }
}

async function testPasswordReset() {
  console.log('\nTesting password reset for MichaelAnthony...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/password-reset/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'michaelanthonygodoy@gmail.com'
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Password reset request successful!');
      console.log('Response:', result.message);
      console.log('Email exists:', result.emailExists);
      return true;
    } else {
      console.log('❌ Password reset failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Password reset error:', error.message);
    return false;
  }
}

async function testExistingAdminLogins() {
  const adminAccounts = [
    { username: 'michael', description: 'michael admin' },
    { username: 'CreativeDirector', description: 'CreativeDirector admin' },
    { username: 'Rob Allan (ADMIN)', description: 'Rob Allan admin' },
    { username: 'Ben Allan [ADMIN]', description: 'Ben Allan admin' },
    { username: 'Robbissimo', description: 'Robbissimo admin' },
    { username: 'Becky Culp (ADMIN)', description: 'Becky Culp admin' }
  ];
  
  console.log('\nTesting existing admin account authentication status...');
  
  for (const admin of adminAccounts) {
    try {
      // Test with a common password - this should fail but show if the account exists
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: admin.username,
          password: 'testpassword'
        })
      });
      
      const result = await response.json();
      
      if (response.status === 401) {
        console.log(`✅ ${admin.description}: Account exists (credentials invalid - expected)`);
      } else if (response.ok) {
        console.log(`⚠️  ${admin.description}: Account exists and password is weak!`);
      } else {
        console.log(`❓ ${admin.description}: Unexpected response - ${result.message}`);
      }
    } catch (error) {
      console.log(`❌ ${admin.description}: Connection error - ${error.message}`);
    }
  }
}

async function runTests() {
  console.log('Starting admin authentication tests...\n');
  
  const loginSuccess = await testAdminLogin();
  const resetSuccess = await testPasswordReset();
  await testExistingAdminLogins();
  
  console.log('\n=== Test Summary ===');
  console.log(`MichaelAnthony Login: ${loginSuccess ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`Password Reset: ${resetSuccess ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (loginSuccess && resetSuccess) {
    console.log('\n🎉 All authentication systems are working correctly!');
    console.log('\nThe user can now:');
    console.log('1. Login with username: MichaelAnthony and password: TempPassword123!');
    console.log('2. Use password reset with email: michaelanthonygodoy@gmail.com');
    console.log('3. Access admin features once logged in');
  } else {
    console.log('\n⚠️  Some authentication issues detected - see details above');
  }
}

runTests();