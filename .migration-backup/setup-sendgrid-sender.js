/**
 * Script to help set up SendGrid sender verification
 * 
 * This script helps you verify your sender identity in SendGrid,
 * which is required before you can send emails.
 */

// SendGrid setup guide - no imports needed

async function checkSenderVerification() {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    console.log('❌ SENDGRID_API_KEY not found in environment variables');
    return;
  }

  console.log('=== SendGrid Sender Verification Guide ===\n');
  
  console.log('To fix the contact form, you need to verify your sender identity in SendGrid:');
  console.log('');
  console.log('1. Go to: https://app.sendgrid.com/settings/sender_auth');
  console.log('2. Click "Verify a Single Sender"');
  console.log('3. Enter your email: malgatitx@gmail.com');
  console.log('4. Fill out the required information (name, address, etc.)');
  console.log('5. Check your email for verification link from SendGrid');
  console.log('6. Click the verification link');
  console.log('');
  console.log('Alternative: Authenticate Your Domain');
  console.log('1. Go to: https://app.sendgrid.com/settings/sender_auth');
  console.log('2. Click "Authenticate Your Domain"');
  console.log('3. Enter: barefootbay.com (if you own this domain)');
  console.log('4. Follow DNS record setup instructions');
  console.log('');
  console.log('Current API Key Status:');
  console.log(`- Key exists: ✅`);
  console.log(`- Key format: ${apiKey.startsWith('SG.') ? '✅' : '❌'}`);
  console.log(`- Key length: ${apiKey.length} characters`);
  console.log('');
  console.log('Once sender verification is complete, the contact form will work without 500 errors.');
}

checkSenderVerification();