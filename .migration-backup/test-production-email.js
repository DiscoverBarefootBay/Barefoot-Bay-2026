/**
 * Test script to verify email service works in production environment
 */

const { sendEmail } = require('./server/email-service');

async function testProductionEmail() {
  try {
    console.log('Testing email service in production...');
    
    const result = await sendEmail({
      to: 'michaelanthonygodoy@gmail.com',
      subject: 'Production Email Test - Barefoot Bay',
      text: 'This is a test email to verify that password reset emails are working correctly in production.',
      html: '<p>This is a test email to verify that password reset emails are working correctly in production.</p>'
    });
    
    console.log('Email test result:', result);
    console.log('Email service test completed successfully');
  } catch (error) {
    console.error('Email service test failed:', error);
    console.error('Error details:', error.message);
  }
}

testProductionEmail();