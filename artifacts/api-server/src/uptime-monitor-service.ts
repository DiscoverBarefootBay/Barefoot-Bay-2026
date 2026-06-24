import { sendEmail, FROM_EMAIL } from './sendgrid-service';
import { storage } from './storage';

interface UptimeRobotAlert {
  monitorID?: string;
  monitorURL?: string;
  monitorFriendlyName?: string;
  alertType?: string;
  alertTypeFriendlyName?: string;
  alertDetails?: string;
  alertDateTime?: string;
  alertDuration?: string;
  sslExpiryDate?: string;
  sslExpiryDaysLeft?: string;
}

export async function sendDowntimeAlertToAdmins(alertData: UptimeRobotAlert): Promise<{ success: boolean; emailsSent: number; errors: string[] }> {
  const errors: string[] = [];
  let emailsSent = 0;

  try {
    const allUsers = await storage.getUsers();
    
    const adminUsers = allUsers.filter(
      (user: any) => user.email && 
              !user.isBlocked && 
              user.role === 'admin' && 
              user.emailNotificationsEnabled !== false
    );

    if (adminUsers.length === 0) {
      console.log('[UptimeMonitor] No admin users found to notify');
      return { success: true, emailsSent: 0, errors: ['No admin users found with email notifications enabled'] };
    }

    console.log(`[UptimeMonitor] Sending downtime alert to ${adminUsers.length} admin(s)`);

    const alertTypeMessage = getAlertTypeMessage(alertData.alertType);
    const isDown = alertData.alertType === '1' || alertData.alertTypeFriendlyName?.toLowerCase().includes('down');
    
    const subject = isDown 
      ? `🚨 URGENT: Website Down - ${alertData.monitorFriendlyName || 'barefootbay.com'}`
      : `✅ Website Recovered - ${alertData.monitorFriendlyName || 'barefootbay.com'}`;

    const statusColor = isDown ? '#dc2626' : '#16a34a';
    const statusIcon = isDown ? '🔴' : '🟢';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="background-color: ${statusColor}; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">${statusIcon} ${isDown ? 'Website Down' : 'Website Recovered'}</h1>
    </div>
    <div style="padding: 30px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Monitor:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${alertData.monitorFriendlyName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">URL:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${alertData.monitorURL || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Status:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: ${statusColor}; font-weight: bold;">${alertTypeMessage}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Time:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${alertData.alertDateTime || new Date().toISOString()}</td>
        </tr>
        ${alertData.alertDuration ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Duration:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${alertData.alertDuration}</td>
        </tr>
        ` : ''}
        ${alertData.alertDetails ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Details:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${alertData.alertDetails}</td>
        </tr>
        ` : ''}
      </table>
      
      ${isDown ? `
      <div style="margin-top: 20px; padding: 15px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
        <p style="margin: 0; color: #991b1b; font-weight: bold;">Action Required</p>
        <p style="margin: 10px 0 0 0; color: #7f1d1d;">Please check the server status and logs immediately. Common causes include:</p>
        <ul style="margin: 10px 0 0 0; color: #7f1d1d; padding-left: 20px;">
          <li>Server overload or resource exhaustion</li>
          <li>Database connection issues</li>
          <li>Deployment or configuration errors</li>
          <li>Network or DNS problems</li>
        </ul>
      </div>
      ` : `
      <div style="margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px;">
        <p style="margin: 0; color: #166534; font-weight: bold;">All Systems Operational</p>
        <p style="margin: 10px 0 0 0; color: #15803d;">The website is back online and functioning normally.</p>
      </div>
      `}
      
      <div style="margin-top: 20px; text-align: center;">
        <a href="https://stats.uptimerobot.com/xBed4SaZMY" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Live Status Page</a>
        <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">Check real-time status even if barefootbay.com is down</p>
      </div>
    </div>
    <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">This is an automated alert from UptimeRobot monitoring service.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
${isDown ? '🚨 WEBSITE DOWN ALERT' : '✅ WEBSITE RECOVERED'}

Monitor: ${alertData.monitorFriendlyName || 'N/A'}
URL: ${alertData.monitorURL || 'N/A'}
Status: ${alertTypeMessage}
Time: ${alertData.alertDateTime || new Date().toISOString()}
${alertData.alertDuration ? `Duration: ${alertData.alertDuration}` : ''}
${alertData.alertDetails ? `Details: ${alertData.alertDetails}` : ''}

${isDown ? 'ACTION REQUIRED: Please check the server status and logs immediately.' : 'The website is back online and functioning normally.'}

View Live Status Page: https://stats.uptimerobot.com/xBed4SaZMY
(Check real-time status even if barefootbay.com is down)

This is an automated alert from UptimeRobot monitoring service.
    `.trim();

    // Normalize to lowercase and dedupe so two admins sharing a mailbox
    // (e.g. a couple registered with the same email) only get one copy.
    const adminEmails = Array.from(
      new Set(
        adminUsers
          .map((u: any) => (typeof u.email === 'string' ? u.email.trim().toLowerCase() : ''))
          .filter(e => e.length > 0)
      )
    );
    if (adminEmails.length !== adminUsers.length) {
      console.log(`[UptimeMonitor] 🧹 Removed ${adminUsers.length - adminEmails.length} duplicate admin recipient email(s); ${adminEmails.length} unique mailbox(es) will be emailed`);
    }

    for (const adminEmail of adminEmails) {
      try {
        const sent = await sendEmail({
          to: adminEmail,
          from: FROM_EMAIL,
          subject,
          text: textContent,
          html: htmlContent
        });

        if (sent) {
          emailsSent++;
          console.log(`[UptimeMonitor] ✅ Alert sent to ${adminEmail}`);
        } else {
          errors.push(`Failed to send email to ${adminEmail}`);
          console.error(`[UptimeMonitor] ❌ Failed to send alert to ${adminEmail}`);
        }
      } catch (error: any) {
        errors.push(`Error sending to ${adminEmail}: ${error.message}`);
        console.error(`[UptimeMonitor] ❌ Error sending alert to ${adminEmail}:`, error.message);
      }
    }

    console.log(`[UptimeMonitor] Alert processing complete: ${emailsSent}/${adminEmails.length} emails sent`);
    
    return { 
      success: emailsSent > 0, 
      emailsSent, 
      errors 
    };

  } catch (error: any) {
    console.error('[UptimeMonitor] ❌ Critical error sending downtime alerts:', error);
    return { 
      success: false, 
      emailsSent: 0, 
      errors: [`Critical error: ${error.message}`] 
    };
  }
}

function getAlertTypeMessage(alertType?: string): string {
  switch (alertType) {
    case '1':
      return 'Down';
    case '2':
      return 'Up (Recovered)';
    case '3':
      return 'SSL Certificate Expiry Warning';
    default:
      return alertType || 'Unknown';
  }
}

export function parseUptimeRobotWebhook(body: any): UptimeRobotAlert {
  return {
    monitorID: body.monitorID || body.monitor_id,
    monitorURL: body.monitorURL || body.monitor_url,
    monitorFriendlyName: body.monitorFriendlyName || body.monitor_friendly_name || body.monitorName,
    alertType: body.alertType || body.alert_type,
    alertTypeFriendlyName: body.alertTypeFriendlyName || body.alert_type_friendly_name,
    alertDetails: body.alertDetails || body.alert_details,
    alertDateTime: body.alertDateTime || body.alert_date_time || new Date().toISOString(),
    alertDuration: body.alertDuration || body.alert_duration,
    sslExpiryDate: body.sslExpiryDate || body.ssl_expiry_date,
    sslExpiryDaysLeft: body.sslExpiryDaysLeft || body.ssl_expiry_days_left
  };
}
