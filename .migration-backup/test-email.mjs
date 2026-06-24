import { sendEmail } from './server/email-service.js';

async function testEmailService() {
  console.log('Testing email service...');
  
  const result = await sendEmail({
    to: 'malgatitix@gmail.com',
    subject: 'Test Email from Barefoot Bay',
    text: 'This is a test email to verify that the email service is working properly.',
    html: '<p>This is a <strong>test email</strong> to verify that the email service is working properly.</p>'
  });
  
  console.log('Email sending result:', result);
  
  // Log SMTP settings
  console.log('SMTP Environment Variables:');
  console.log('- SMTP_HOST:', process.env.SMTP_HOST || 'Not set');
  console.log('- SMTP_PORT:', process.env.SMTP_PORT || 'Not set');
  console.log('- SMTP_SECURE:', process.env.SMTP_SECURE || 'Not set');
  console.log('- SMTP_USER:', process.env.SMTP_USER ? 'Is set' : 'Not set');
  console.log('- SMTP_PASS:', process.env.SMTP_PASS ? 'Is set' : 'Not set');
  console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || 'Not set (using default)');
}

testEmailService().catch(console.error);
