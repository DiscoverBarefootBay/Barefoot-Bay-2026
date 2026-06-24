import { sendEmail } from './email-service';
import { storage } from './storage';

/**
 * Email diagnostics and testing utilities
 */

export interface EmailDiagnosticResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * Test basic email sending functionality
 */
export async function testEmailDelivery(toEmail: string): Promise<EmailDiagnosticResult> {
  try {
    const testSubject = `Email Test - ${new Date().toISOString()}`;
    const testMessage = `
This is a test email sent from the Barefoot Bay community platform.

Timestamp: ${new Date().toISOString()}
Test ID: ${Math.random().toString(36).substring(7)}

If you received this email, the basic email functionality is working.
`;

    const result = await sendEmail({
      to: toEmail,
      subject: testSubject,
      text: testMessage,
      html: `<p>${testMessage.replace(/\n/g, '<br>')}</p>`
    });

    return {
      success: result,
      message: result ? 'Test email sent successfully' : 'Test email failed to send',
      timestamp: new Date()
    };
  } catch (error) {
    return {
      success: false,
      message: `Test email error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
      timestamp: new Date()
    };
  }
}

/**
 * Test password reset email specifically
 */
export async function testPasswordResetEmail(email: string): Promise<EmailDiagnosticResult> {
  try {
    // Find user by email
    const user = await storage.getUserByEmailCaseInsensitive(email);
    
    if (!user) {
      return {
        success: false,
        message: 'User not found with provided email',
        timestamp: new Date()
      };
    }

    // Generate test reset token
    const testToken = 'test_' + Math.random().toString(36).substring(7);
    const testExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Use the actual password reset email function
    const { sendPasswordResetEmail } = await import('./password-reset');
    const result = await sendPasswordResetEmail(user, testToken, testExpiry);

    return {
      success: result,
      message: result ? 'Password reset test email sent successfully' : 'Password reset test email failed',
      details: {
        userId: user.id,
        email: user.email,
        testToken: testToken.substring(0, 8) + '...'
      },
      timestamp: new Date()
    };
  } catch (error) {
    return {
      success: false,
      message: `Password reset test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
      timestamp: new Date()
    };
  }
}

/**
 * Check email service configuration
 */
export async function checkEmailConfiguration(): Promise<EmailDiagnosticResult> {
  try {
    const config = {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasGoogleRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
      hasGoogleUserEmail: !!process.env.GOOGLE_USER_EMAIL,
      hasGoogleAccessToken: !!process.env.GOOGLE_ACCESS_TOKEN,
      hasGmailAppPassword: !!process.env.GMAIL_APP_PASSWORD,
      nodeEnv: process.env.NODE_ENV,
      googleUserEmail: process.env.GOOGLE_USER_EMAIL
    };

    const missingCredentials = [];
    if (!config.hasGoogleClientId) missingCredentials.push('GOOGLE_CLIENT_ID');
    if (!config.hasGoogleClientSecret) missingCredentials.push('GOOGLE_CLIENT_SECRET');
    if (!config.hasGoogleRefreshToken) missingCredentials.push('GOOGLE_REFRESH_TOKEN');
    if (!config.hasGoogleUserEmail) missingCredentials.push('GOOGLE_USER_EMAIL');

    const isConfigured = missingCredentials.length === 0;

    return {
      success: isConfigured,
      message: isConfigured 
        ? 'Email configuration appears complete' 
        : `Missing credentials: ${missingCredentials.join(', ')}`,
      details: config,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      success: false,
      message: `Configuration check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
      timestamp: new Date()
    };
  }
}

/**
 * Test email delivery to multiple providers
 */
export async function testMultipleProviders(testEmails: string[]): Promise<EmailDiagnosticResult[]> {
  const results: EmailDiagnosticResult[] = [];
  
  for (const email of testEmails) {
    const result = await testEmailDelivery(email);
    results.push({
      ...result,
      details: { ...result.details, testedEmail: email }
    });
    
    // Add small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Generate comprehensive email diagnostic report
 */
export async function generateDiagnosticReport(testEmail?: string): Promise<{
  configuration: EmailDiagnosticResult;
  basicDelivery?: EmailDiagnosticResult;
  passwordReset?: EmailDiagnosticResult;
  summary: {
    overallStatus: 'healthy' | 'warning' | 'error';
    issues: string[];
    recommendations: string[];
  };
}> {
  const configuration = await checkEmailConfiguration();
  let basicDelivery: EmailDiagnosticResult | undefined;
  let passwordReset: EmailDiagnosticResult | undefined;

  if (testEmail) {
    basicDelivery = await testEmailDelivery(testEmail);
    passwordReset = await testPasswordResetEmail(testEmail);
  }

  // Analyze results and generate summary
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!configuration.success) {
    issues.push('Email configuration incomplete');
    recommendations.push('Configure missing OAuth2 credentials');
  }

  if (basicDelivery && !basicDelivery.success) {
    issues.push('Basic email delivery failing');
    recommendations.push('Check Gmail OAuth2 tokens and API quotas');
  }

  if (passwordReset && !passwordReset.success) {
    issues.push('Password reset emails not sending');
    recommendations.push('Review password reset email template and content');
  }

  // If emails send but users don't receive them
  if (basicDelivery?.success && passwordReset?.success) {
    recommendations.push('Configure SPF/DKIM/DMARC records for domain authentication');
    recommendations.push('Review email content for spam trigger words');
    recommendations.push('Consider using dedicated email service provider');
  }

  const overallStatus = issues.length === 0 ? 'healthy' : 
                       issues.length <= 2 ? 'warning' : 'error';

  return {
    configuration,
    basicDelivery,
    passwordReset,
    summary: {
      overallStatus,
      issues,
      recommendations
    }
  };
}