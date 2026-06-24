/**
 * Check the SendGrid API key format and environment
 */

console.log('=== SendGrid API Key Diagnostic ===');

const apiKey = process.env.SENDGRID_API_KEY;

console.log('Environment check:');
console.log('- Has SENDGRID_API_KEY:', !!apiKey);
console.log('- Key length:', apiKey ? apiKey.length : 0);
console.log('- Starts with SG.:', apiKey ? apiKey.startsWith('SG.') : false);
console.log('- First 10 chars:', apiKey ? apiKey.substring(0, 10) : 'N/A');

if (!apiKey) {
  console.log('❌ No SendGrid API key found in environment');
} else if (!apiKey.startsWith('SG.')) {
  console.log('❌ Invalid SendGrid API key format - should start with "SG."');
  console.log('Current format appears to be:', apiKey.substring(0, 20) + '...');
} else if (apiKey.length < 50) {
  console.log('❌ SendGrid API key appears too short');
} else {
  console.log('✅ SendGrid API key format looks correct');
}

console.log('\nValid SendGrid API key should:');
console.log('- Start with "SG."');
console.log('- Be approximately 69 characters long');
console.log('- Look like: SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');