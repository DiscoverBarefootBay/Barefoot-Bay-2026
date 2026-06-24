/**
 * Quick email test script for production environment
 * This script tests the email functionality directly without going through the web interface
 * 
 * Usage:
 * node test-email-production.js
 */

import { testEmailDelivery, checkEmailConfiguration, generateDiagnosticReport } from './server/email-diagnostics.ts';
import dotenv from 'dotenv';

dotenv.config();

async function testEmailInProduction() {
  console.log('🔧 Testing Email Functionality in Production');
  console.log('============================================');
  
  // Test email configuration
  console.log('\n1. Checking Email Configuration...');
  const configResult = await checkEmailConfiguration();
  console.log('Configuration Status:', configResult.success ? '✅ PASS' : '❌ FAIL');
  console.log('Details:', configResult.message);
  if (configResult.details) {
    console.log('Environment Details:', JSON.stringify(configResult.details, null, 2));
  }
  
  // Test basic email delivery
  const testEmail = 'michaelanthonygodoy@gmail.com'; // Using the email from logs
  console.log(`\n2. Testing Basic Email Delivery to: ${testEmail}`);
  const deliveryResult = await testEmailDelivery(testEmail);
  console.log('Delivery Status:', deliveryResult.success ? '✅ PASS' : '❌ FAIL');
  console.log('Message:', deliveryResult.message);
  
  // Generate full diagnostic report
  console.log('\n3. Generating Full Diagnostic Report...');
  const diagnosticReport = await generateDiagnosticReport(testEmail);
  console.log('Overall Status:', diagnosticReport.summary.overallStatus);
  console.log('Issues Found:', diagnosticReport.summary.issues);
  console.log('Recommendations:', diagnosticReport.summary.recommendations);
  
  console.log('\n============================================');
  console.log('✅ Email testing complete');
  
  // Exit the process
  process.exit(0);
}

// Handle errors gracefully
testEmailInProduction().catch(error => {
  console.error('❌ Email test failed:', error);
  process.exit(1);
});