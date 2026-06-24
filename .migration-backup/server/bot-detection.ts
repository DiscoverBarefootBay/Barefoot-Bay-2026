import { sendEmail } from "./sendgrid-service";
import { storage } from "./storage";

export function isSuspiciousUsername(username: string, fullName: string): boolean {
  // Helper: Check if string has abnormally low vowel ratio (bots often have few vowels)
  const hasLowVowelRatio = (str: string): boolean => {
    if (!str || str.length < 8) return false;
    const letters = str.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 8) return false;
    const vowels = letters.replace(/[^aeiouAEIOU]/g, '').length;
    const ratio = vowels / letters.length;
    // Real names typically have 30-50% vowels. Below 15% is suspicious.
    return ratio < 0.15;
  };
  
  // Helper: Check for long consonant clusters (5+ consonants in a row is unnatural)
  const hasLongConsonantCluster = (str: string): boolean => {
    return /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(str);
  };
  
  // Helper: Check if string looks like random characters (mixed case chaos)
  const hasRandomCaseMixing = (str: string): boolean => {
    // Counts transitions between upper and lower case
    let transitions = 0;
    for (let i = 1; i < str.length; i++) {
      const prevIsUpper = /[A-Z]/.test(str[i - 1]);
      const currIsUpper = /[A-Z]/.test(str[i]);
      const prevIsLetter = /[a-zA-Z]/.test(str[i - 1]);
      const currIsLetter = /[a-zA-Z]/.test(str[i]);
      if (prevIsLetter && currIsLetter && prevIsUpper !== currIsUpper) {
        transitions++;
      }
    }
    // More than 5 case transitions in a string is suspicious (e.g., "neFgJTvNeRmgMJxoKTl")
    return transitions >= 5;
  };
  
  // All-caps full name 10+ characters (obvious bot pattern like "QPBLGFMJWZKEGIBMRM")
  if (/^[A-Z]{10,}$/.test(fullName)) {
    console.log(`[Bot Detection] All-caps full name detected: "${fullName}"`);
    return true;
  }
  
  // Check for very long strings (15+ chars) with additional bot signals
  const checkForBotPattern = (str: string, label: string): boolean => {
    if (!str || str.length < 12) return false;
    
    const isLong = str.length >= 15;
    const hasNoSpaces = !str.includes(' ');
    const lowVowels = hasLowVowelRatio(str);
    const longConsonants = hasLongConsonantCluster(str);
    const randomCase = hasRandomCaseMixing(str);
    const isAllAlpha = /^[A-Za-z]+$/.test(str);
    const alphaWithNumbers = /^[A-Za-z]{10,}[0-9]+$/.test(str);
    
    // Score-based approach: need multiple suspicious signals
    let suspicionScore = 0;
    if (isLong && hasNoSpaces && isAllAlpha) suspicionScore += 1;
    if (lowVowels) suspicionScore += 2;  // Strong signal
    if (longConsonants) suspicionScore += 2;  // Strong signal
    if (randomCase) suspicionScore += 2;  // Strong signal
    
    // For letters+numbers pattern (like "michaelanthony25"), only flag if OTHER suspicious signals exist
    if (alphaWithNumbers) {
      if (lowVowels || longConsonants || randomCase) {
        console.log(`[Bot Detection] ${label} matches letters+numbers with additional bot signals: "${str}"`);
        return true;
      }
      // Otherwise, this is likely a legitimate name with a number (birth year, etc.)
      return false;
    }
    
    // Require score of 3+ to flag (ensures multiple suspicious characteristics)
    if (suspicionScore >= 3) {
      console.log(`[Bot Detection] ${label} has suspicious pattern (score=${suspicionScore}): "${str}"`);
      return true;
    }
    
    return false;
  };
  
  if (checkForBotPattern(fullName, "Full name")) {
    return true;
  }
  
  if (checkForBotPattern(username, "Username")) {
    return true;
  }
  
  return false;
}

export async function sendBotDetectionAlertEmail(
  suspectedUser: { id: number; username: string; fullName: string; email: string }
): Promise<void> {
  try {
    const admins = await storage.getUsersByRole('admin');
    
    if (!admins || admins.length === 0) {
      console.log('[Bot Detection] No admin users found to notify');
      return;
    }
    
    console.log(`[Bot Detection] Sending alerts to ${admins.length} admin(s)`);
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ff6b6b, #ee5a5a); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Suspected Bot Registration Alert</h1>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">A new user registration has been flagged as potentially suspicious based on their username and name patterns.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff6b6b;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Suspected Account Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>User ID:</strong></td>
                <td style="padding: 8px 0; color: #333;">${suspectedUser.id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Full Name:</strong></td>
                <td style="padding: 8px 0; color: #333;">${suspectedUser.fullName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Username:</strong></td>
                <td style="padding: 8px 0; color: #333;">${suspectedUser.username}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td>
                <td style="padding: 8px 0; color: #333;">${suspectedUser.email}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #666; font-size: 14px;">Please review this account in the Community Settings admin panel and take appropriate action (block/delete) if necessary.</p>
          
          <div style="text-align: center; margin-top: 20px;">
            <a href="${process.env.APP_BASE_URL || 'https://barefootbay.com'}/community-settings" 
               style="display: inline-block; background: #ff6b6b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Review in Admin Panel
            </a>
          </div>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
          This is an automated alert from the Barefoot Bay bot detection system.
        </p>
      </div>
    `;
    
    const emailPromises = admins.map((admin: { username: string; email: string | null }) => {
      if (!admin.email) {
        console.log(`[Bot Detection] Admin ${admin.username} has no email, skipping`);
        return Promise.resolve(false);
      }
      
      return sendEmail({
        to: admin.email,
        from: 'noreply@barefootbay.com',
        subject: `[Bot Alert] Suspected Bot Registration: ${suspectedUser.username}`,
        html: emailHtml,
        text: `Suspected Bot Registration Alert\n\nA new user registration has been flagged as potentially suspicious.\n\nDetails:\n- User ID: ${suspectedUser.id}\n- Full Name: ${suspectedUser.fullName}\n- Username: ${suspectedUser.username}\n- Email: ${suspectedUser.email}\n\nPlease review this account in the Community Settings admin panel.`
      });
    });
    
    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r === true).length;
    console.log(`[Bot Detection] Alert emails sent: ${successCount}/${admins.length}`);
    
  } catch (error) {
    console.error('[Bot Detection] Error sending alert emails:', error);
  }
}
