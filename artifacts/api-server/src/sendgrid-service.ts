import sgMail from '@sendgrid/mail';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { getSendGridApiKey } from './lib/sendgrid-credentials';
import {
  loadForSaleEmailConfig,
  renderTemplate,
  htmlToText,
  type ForSaleEmailConfig,
} from './forsale-email-config';
import type { Event } from '@workspace/db';

/**
 * Shared options for the three configurable For Sale expiration emails.
 * `config` lets a caller load the admin config once and reuse it across a batch
 * of sends (avoids a DB read per recipient). `ignoreEnabled` lets the admin
 * "send test" path preview an email type even when it's been disabled.
 */
interface ForSaleEmailOptions {
  config?: ForSaleEmailConfig;
  ignoreEnabled?: boolean;
}

/**
 * Get the correct base URL for the application based on environment
 * @returns The base URL for the current environment
 */
function getBaseUrl(): string {
  // In production, always use the production URL
  if (process.env.NODE_ENV === 'production') {
    const productionUrl = process.env.APP_BASE_URL || 'https://barefootbay.com';
    
    // Warn if APP_BASE_URL is not set in production
    if (!process.env.APP_BASE_URL) {
      console.warn('[SendGrid] ⚠️ APP_BASE_URL not set in production, using default: https://barefootbay.com');
    }
    
    console.log('[SendGrid] 🔗 Using production base URL:', productionUrl);
    return productionUrl;
  }
  
  // In development, use REPLIT_DEV_DOMAIN if available
  if (process.env.REPLIT_DEV_DOMAIN) {
    const devUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    console.log('[SendGrid] 🔗 Using dev base URL:', devUrl);
    return devUrl;
  }
  
  // Fallback to localhost for local development
  console.log('[SendGrid] 🔗 Using fallback base URL: http://localhost:5000');
  return 'http://localhost:5000';
}

interface EmailAttachment {
  content: string; // base64 encoded content
  filename: string;
  type: string; // MIME type
}

interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

/**
 * Canonical sender address for ALL outgoing Barefoot Bay email.
 * Every send is forced to use this address (see sendEmail) so the From line can
 * never drift to another address. This must match a SendGrid-authenticated /
 * verified sender on the barefootbay.com domain for DKIM/DMARC alignment.
 */
export const FROM_EMAIL = 'team@barefootbay.com';

/**
 * Dedupe a list of recipient records by case-insensitive email so that two
 * users sharing a mailbox (e.g. a couple registered with the same email) are
 * counted as a single recipient. Preserves the first record encountered for
 * each unique email and skips entries with missing/blank emails.
 */
export function dedupeRecipientsByEmail<T extends { email?: string | null }>(
  recipients: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const recipient of recipients) {
    const key = recipient.email?.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(recipient);
  }
  return result;
}

export interface GroupedNotifiedUser {
  username: string;
  email: string;
  additionalUsernames: string[];
}

/**
 * Group notified-user records by case-insensitive email so admins can still see
 * every user record covered by a single mailbox. The first record encountered
 * for an email becomes the primary entry; any subsequent records sharing that
 * mailbox have their usernames appended to `additionalUsernames`. Entries with
 * missing/blank emails are skipped.
 */
export function groupNotifiedUsersByEmail(
  recipients: Array<{ username?: string | null; email?: string | null }>,
): GroupedNotifiedUser[] {
  const map = new Map<string, GroupedNotifiedUser>();
  for (const recipient of recipients) {
    const email = recipient.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    const username = (recipient.username ?? '').trim();
    const existing = map.get(key);
    if (existing) {
      if (
        username &&
        username !== existing.username &&
        !existing.additionalUsernames.includes(username)
      ) {
        existing.additionalUsernames.push(username);
      }
    } else {
      map.set(key, {
        username,
        email,
        additionalUsernames: [],
      });
    }
  }
  return Array.from(map.values());
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    // Validate email parameters
    if (!params.to || !params.to.trim()) {
      console.error('[SendGrid] ❌ Missing or empty "to" email address');
      return false;
    }
    
    if (!params.to.includes('@')) {
      console.error('[SendGrid] ❌ Invalid email address format:', params.to);
      return false;
    }

    console.log('[SendGrid] Sending email:', {
      to: params.to,
      from: FROM_EMAIL,
      subject: params.subject,
      hasText: !!params.text,
      hasHtml: !!params.html,
      attachmentCount: params.attachments?.length || 0
    });

    const emailData: any = {
      to: params.to,
      // Always send from the canonical address regardless of what the caller
      // passed, so the From line can never drift to an unauthenticated address.
      from: FROM_EMAIL,
      subject: params.subject,
      text: params.text || '',
      html: params.html,
    };

    // Add attachments if present
    if (params.attachments && params.attachments.length > 0) {
      emailData.attachments = params.attachments.map(att => ({
        content: att.content,
        filename: att.filename,
        type: att.type,
        disposition: 'attachment'
      }));
      console.log(`[SendGrid] Adding ${params.attachments.length} attachment(s) to email`);
    }

    sgMail.setApiKey(await getSendGridApiKey());
    await sgMail.send(emailData);

    console.log('[SendGrid] ✅ Email sent successfully to:', params.to);
    return true;
  } catch (error: any) {
    console.error('[SendGrid] ❌ Email send error:', {
      to: params.to,
      from: FROM_EMAIL,
      subject: params.subject,
      errorMessage: error?.message || 'Unknown error',
      errorCode: error?.code || 'N/A',
      errorResponse: error?.response?.body || error?.response || 'No response body'
    });
    return false;
  }
}

export async function sendListingContactEmail(
  listingId: number,
  listingTitle: string,
  toEmail: string,
  sender: { username: string; email: string; fullName?: string; phoneNumber?: string },
  message: string
): Promise<boolean> {
  console.log('[SendGrid Contact] Sending listing contact email:', {
    listingId,
    listingTitle,
    toEmail,
    senderUsername: sender.username,
    senderEmail: sender.email,
    senderPhone: sender.phoneNumber,
    messageLength: message.length
  });

  const subject = `New inquiry about your listing: ${listingTitle}`;
  const senderName = sender.fullName || sender.username;
  const senderEmail = sender.email ?? 'noreply@barefootbay.com';
  const senderPhone = sender.phoneNumber || 'Not provided';
  
  const text = `
You have received a new inquiry about your listing "${listingTitle}" from ${senderName}.

Message:
${message}

Sender Contact Information:
Name: ${senderName}
Email: ${senderEmail}
Phone: ${senderPhone}

View your listing: https://barefootbay.com/for-sale/${listingId}

---
This message was sent through the Barefoot Bay community platform.
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Listing Inquiry</h2>
      <p>You have received a new inquiry about your listing <strong>"${listingTitle}"</strong> from <strong>${senderName}</strong>.</p>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Message:</h3>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
      
      <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <h3 style="margin-top: 0; color: #1e40af;">Sender Contact Information:</h3>
        <p style="margin: 8px 0;"><strong>Name:</strong> ${senderName}</p>
        <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${senderEmail}">${senderEmail}</a></p>
        <p style="margin: 8px 0;"><strong>Phone:</strong> ${senderPhone}</p>
      </div>
      
      <p><a href="https://barefootbay.com/for-sale/${listingId}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Your Listing</a></p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #6b7280;">This message was sent through the Barefoot Bay community platform.</p>
    </div>
  `;

  return await sendEmail({
    to: toEmail,
    from: FROM_EMAIL,
    subject,
    text,
    html
  });
}

export async function sendListingContactConfirmationEmail(
  listingId: number,
  listingTitle: string,
  owner: { name?: string; email?: string; phone?: string },
  sender: { username: string; email: string; fullName?: string; phoneNumber?: string },
  message: string
): Promise<boolean> {
  console.log('[SendGrid Contact Confirmation] Sending confirmation email to sender:', {
    listingId,
    listingTitle,
    senderEmail: sender.email,
    ownerEmail: owner.email,
    messageLength: message.length
  });

  const subject = `Copy of your message about: ${listingTitle}`;
  const senderName = sender.fullName || sender.username;
  const ownerName = owner.name || 'the listing owner';
  const ownerEmail = owner.email || 'Not provided';
  const ownerPhone = owner.phone || 'Not provided';
  
  const text = `
This is a copy of the message you sent about the listing "${listingTitle}".

Your Message:
${message}

Listing Owner Contact Information:
Name: ${ownerName}
Email: ${ownerEmail}
Phone: ${ownerPhone}

The listing owner should respond directly to your email address (${sender.email}).

View the listing: https://barefootbay.com/for-sale/${listingId}

---
This is an automated confirmation from the Barefoot Bay community platform.
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Message Sent Successfully</h2>
      <p>Hi ${senderName},</p>
      <p>This is a copy of the message you sent about the listing <strong>"${listingTitle}"</strong>.</p>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Your Message:</h3>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
      
      <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <h3 style="margin-top: 0; color: #1e40af;">Listing Owner Contact Information:</h3>
        <p style="margin: 8px 0;"><strong>Name:</strong> ${ownerName}</p>
        <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${ownerEmail}">${ownerEmail}</a></p>
        <p style="margin: 8px 0;"><strong>Phone:</strong> ${ownerPhone}</p>
      </div>
      
      <p>The listing owner should respond directly to your email address (${sender.email}).</p>
      
      <p><a href="https://barefootbay.com/for-sale/${listingId}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View the Listing</a></p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #6b7280;">This is an automated confirmation from the Barefoot Bay community platform.</p>
    </div>
  `;

  return await sendEmail({
    to: sender.email,
    from: FROM_EMAIL,
    subject,
    text,
    html
  });
}

/**
 * Admin alert sent the moment a real estate listing crosses its expiration date
 * and is flipped to EXPIRED. Gives admins everything they need to follow up with
 * the seller: a link to the listing plus the seller's name, phone, and email.
 */
export async function sendListingExpiredAdminEmail(
  toEmail: string,
  listing: { id: number; title: string; address?: string | null; listingType?: string | null },
  seller: { name?: string | null; email?: string | null; phone?: string | null },
  options?: ForSaleEmailOptions,
): Promise<boolean> {
  const config = options?.config ?? (await loadForSaleEmailConfig());
  const template = config.adminExpired;
  if (!template.enabled && !options?.ignoreEnabled) {
    return false;
  }

  const baseUrl = getBaseUrl();
  const data = {
    listingUrl: `${baseUrl}/for-sale/${listing.id}`,
    listingTitle: listing.title || 'Untitled listing',
    listingType: listing.listingType?.trim() || 'Listing',
    address: listing.address?.trim() || 'Not provided',
    sellerName: seller.name?.trim() || 'Not provided',
    sellerEmail: seller.email?.trim() || 'Not provided',
    sellerPhone: seller.phone?.trim() || 'Not provided',
    baseUrl,
  };

  const subject = renderTemplate(template.subject, data);
  const html = renderTemplate(template.html, data);
  const text = htmlToText(html);

  return await sendEmail({ to: toEmail, from: FROM_EMAIL, subject, text, html });
}

/**
 * Reminder sent to the seller AFTER their listing has expired (no advance
 * warning). Explains how to renew/republish on barefootbay.com and tells them to
 * disregard the email if the item is already sold/rented.
 */
export async function sendListingExpiredSellerEmail(
  toEmail: string,
  sellerName: string | null | undefined,
  listing: { id: number; title: string; listingType?: string | null },
  options?: ForSaleEmailOptions,
): Promise<boolean> {
  const config = options?.config ?? (await loadForSaleEmailConfig());
  const template = config.sellerExpired;
  if (!template.enabled && !options?.ignoreEnabled) {
    return false;
  }

  const baseUrl = getBaseUrl();
  const data = {
    baseUrl,
    myListingsUrl: `${baseUrl}/my-listings`,
    listingTitle: listing.title || 'your listing',
    sellerName: sellerName?.trim() || 'there',
  };

  const subject = renderTemplate(template.subject, data);
  const html = renderTemplate(template.html, data);
  const text = htmlToText(html);

  return await sendEmail({ to: toEmail, from: FROM_EMAIL, subject, text, html });
}

/**
 * Weekly admin reminder fired while the public For Sale page has had zero active
 * listings for 7+ straight days, nudging admins to follow up with sellers whose
 * listings expired.
 */
export async function sendNoActiveListingsAdminEmail(
  toEmail: string,
  daysEmpty: number,
  options?: ForSaleEmailOptions,
): Promise<boolean> {
  const config = options?.config ?? (await loadForSaleEmailConfig());
  const template = config.noActiveListings;
  if (!template.enabled && !options?.ignoreEnabled) {
    return false;
  }

  const baseUrl = getBaseUrl();
  const data = {
    baseUrl,
    forSaleUrl: `${baseUrl}/for-sale`,
    daysEmpty,
  };

  const subject = renderTemplate(template.subject, data);
  const html = renderTemplate(template.html, data);
  const text = htmlToText(html);

  return await sendEmail({ to: toEmail, from: FROM_EMAIL, subject, text, html });
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  baseUrl: string
): Promise<boolean> {
  console.log('[SendGrid Password Reset] Sending password reset email:', {
    email,
    resetToken: resetToken.substring(0, 8) + '...',
    baseUrl
  });

  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  const subject = 'Reset Your Barefoot Bay Password';
  
  const text = `
You have requested to reset your password for your Barefoot Bay account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email.

---
Barefoot Bay Community Platform
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Reset Your Password</h2>
      <p>You have requested to reset your password for your Barefoot Bay account.</p>
      
      <div style="margin: 30px 0;">
        <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </div>
      
      <p style="color: #6b7280;">This link will expire in 1 hour.</p>
      
      <p style="color: #6b7280;">If you did not request this password reset, please ignore this email.</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #6b7280;">Barefoot Bay Community Platform</p>
    </div>
  `;

  return await sendEmail({
    to: email,
    from: FROM_EMAIL, // Using verified SendGrid sender
    subject,
    text,
    html
  });
}

/**
 * Send order confirmation email via SendGrid
 * @param order - Order object with order details
 * @param toEmail - Customer email address
 * @returns Promise<boolean> - Success status
 */
export async function sendOrderConfirmationEmail(
  order: any,
  toEmail: string
): Promise<boolean> {
  console.log('[SendGrid Order Confirmation] Sending order confirmation email:', {
    orderId: order.id,
    toEmail,
    total: order.total
  });

  const subject = `Order Confirmation #${order.id} - Barefoot Bay`;
  
  // Format the date
  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Format shipping address
  let formattedAddress = '';
  if (order.shippingAddress) {
    const address = order.shippingAddress as any;
    formattedAddress = `
      ${address.fullName}<br>
      ${address.streetAddress}<br>
      ${address.city}, ${address.state} ${address.zipCode}<br>
      ${address.country}
    `;
  }

  const text = `
Order Confirmation - Barefoot Bay

Thank You for Your Order!

Order #${order.id}
Date: ${formattedDate}

Dear Customer,

Your order has been placed successfully and is now being processed.

ORDER DETAILS:
Order #: ${order.id}
Status: ${order.status}
Total: $${Number(order.total).toFixed(2)}

${order.shippingAddress ? `
SHIPPING ADDRESS:
${(order.shippingAddress as any).fullName}
${(order.shippingAddress as any).streetAddress}
${(order.shippingAddress as any).city}, ${(order.shippingAddress as any).state} ${(order.shippingAddress as any).zipCode}
${(order.shippingAddress as any).country}
` : ''}

Thank you for shopping with Barefoot Bay!

---
This is an automated message from Barefoot Bay. Please do not reply to this email.
For any questions regarding your order, please contact our customer service.
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation - Barefoot Bay</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #4361ee;
          padding-bottom: 20px;
        }
        h1 {
          color: #4361ee;
          margin-top: 0;
        }
        .order-details {
          border: 1px solid #eee;
          border-radius: 5px;
          padding: 15px;
          margin: 20px 0;
          background-color: #f9f9f9;
        }
        .footer {
          margin-top: 30px;
          border-top: 1px solid #e0e0e0;
          padding-top: 20px;
          text-align: center;
          font-size: 0.9em;
          color: #777777;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Thank You for Your Order!</h1>
          <p>Order #${order.id}</p>
          <p>Date: ${formattedDate}</p>
        </div>
        
        <p>Dear Customer,</p>
        
        <p>Your order has been placed successfully and is now being processed.</p>
        
        <div class="order-details">
          <h3>Order Details</h3>
          <p><strong>Order #:</strong> ${order.id}</p>
          <p><strong>Status:</strong> ${order.status}</p>
          <p><strong>Total:</strong> $${Number(order.total).toFixed(2)}</p>
          
          ${formattedAddress ? `
          <h3>Shipping Address</h3>
          <p>${formattedAddress}</p>
          ` : ''}
        </div>
        
        <p>Thank you for shopping with Barefoot Bay!</p>
        
        <div class="footer">
          <p>This is an automated message from Barefoot Bay. Please do not reply to this email.</p>
          <p>For any questions regarding your order, please contact our customer service.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: toEmail,
    from: FROM_EMAIL, // Using verified SendGrid sender
    subject,
    text,
    html
  });
}

/**
 * Send notification email for new forum post
 * @param post - Forum post object with post details
 * @param categoryName - Name of the forum category
 * @param authorName - Name of the post author
 * @param recipientEmails - Array of recipient email addresses
 * @returns Promise<boolean> - Success status
 */
export async function sendForumPostNotificationEmail(
  post: { id: number; title: string; content: string },
  categoryName: string,
  authorName: string,
  recipientEmails: string[]
): Promise<boolean> {
  console.log('[SendGrid Forum Notification] Sending forum post notification emails:', {
    postId: post.id,
    postTitle: post.title,
    categoryName,
    authorName,
    recipientCount: recipientEmails.length
  });

  const subject = `New Forum Post: ${post.title}`;
  const forumUrl = `https://barefootbay.com/forum/post/${post.id}`;
  
  // Strip HTML tags from content for preview
  const contentPreview = post.content
    .replace(/<[^>]*>/g, '')
    .substring(0, 200)
    .trim() + (post.content.length > 200 ? '...' : '');
  
  const text = `
New Forum Post in ${categoryName}

${post.title}

By ${authorName}

${contentPreview}

View the full post: ${forumUrl}

---
This is an automated notification from the Barefoot Bay community platform.
To manage your notification preferences, please log in to your account.
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Forum Post - Barefoot Bay</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #27272a;
          margin: 0;
          padding: 0;
          background-color: #f4f4f5;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #90C9D4 0%, #6BB5C1 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 5px;
          letter-spacing: 1px;
        }
        .tagline {
          font-size: 12px;
          opacity: 0.95;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 30px 25px;
        }
        h1 {
          color: #434054;
          margin: 0 0 20px 0;
          font-size: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .post-info {
          background-color: #f4f4f5;
          border-left: 4px solid #90C9D4;
          padding: 20px;
          margin: 25px 0;
          border-radius: 0 8px 8px 0;
        }
        .post-title {
          font-size: 18px;
          font-weight: bold;
          color: #434054;
          margin-bottom: 12px;
        }
        .post-meta {
          font-size: 14px;
          color: #71717a;
          margin-bottom: 15px;
        }
        .post-preview {
          color: #52525b;
          line-height: 1.6;
          margin: 15px 0 0 0;
        }
        .cta-button {
          display: inline-block;
          background-color: #90C9D4;
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          margin: 25px 0;
          font-weight: 600;
          transition: background-color 0.3s ease;
        }
        .cta-button:hover {
          background-color: #6BB5C1;
        }
        .footer {
          background-color: #f4f4f5;
          padding: 25px;
          text-align: center;
          font-size: 13px;
          color: #71717a;
          border-top: 1px solid #e4e4e7;
        }
        .footer p {
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📢 New Forum Post</div>
          <div class="tagline">A new post has been created in the ${categoryName} forum category</div>
        </div>
        
        <div class="content">
          <div class="post-info">
            <div class="post-title">${post.title}</div>
            <div class="post-meta">Posted by ${authorName}</div>
            <div class="post-preview">${contentPreview}</div>
          </div>
          
          <div style="text-align: center;">
            <a href="${forumUrl}" class="cta-button">View Full Post</a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Barefoot Bay Community Platform</strong></p>
          <p>This is an automated notification from the Barefoot Bay community platform.</p>
          <p>
            <a href="${getBaseUrl()}/unsubscribe" 
               style="color: #71717a; text-decoration: underline;">
              Unsubscribe from email notifications
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Validate recipient emails before sending
  const filteredEmails = recipientEmails.filter(email => {
    const isValid = email && email.trim().length > 0 && email.includes('@');
    if (!isValid) {
      console.error(`[SendGrid Forum Notification] ❌ Invalid email address detected: "${email}"`);
    }
    return isValid;
  });

  // Normalize to lowercase and dedupe so two users sharing a mailbox
  // (e.g. a couple registered with the same email) only get one copy.
  const validEmails = Array.from(
    new Set(filteredEmails.map(e => e.trim().toLowerCase()))
  );
  if (validEmails.length !== filteredEmails.length) {
    console.log(`[SendGrid Forum Notification] 🧹 Removed ${filteredEmails.length - validEmails.length} duplicate recipient email(s); ${validEmails.length} unique mailbox(es) will be emailed`);
  }

  if (validEmails.length === 0) {
    console.error('[SendGrid Forum Notification] ❌ No valid email addresses to send to');
    return false;
  }

  console.log(`[SendGrid Forum Notification] Validated ${validEmails.length}/${recipientEmails.length} email addresses`);

  // Send emails to all recipients
  let successCount = 0;
  let failureCount = 0;
  
  for (const email of validEmails) {
    try {
      console.log(`[SendGrid Forum Notification] Attempting to send email to: ${email}`);
      const success = await sendEmail({
        to: email,
        from: FROM_EMAIL,
        subject,
        text,
        html
      });
      
      if (success) {
        successCount++;
        console.log(`[SendGrid Forum Notification] ✅ Successfully sent to ${email}`);
      } else {
        failureCount++;
        console.error(`[SendGrid Forum Notification] ❌ Failed to send to ${email} (returned false)`);
      }
    } catch (error) {
      failureCount++;
      console.error(`[SendGrid Forum Notification] ❌ Exception while sending to ${email}:`, error);
    }
  }

  console.log(`[SendGrid Forum Notification] ✅ Sent ${successCount}/${validEmails.length} emails successfully (${failureCount} failures)`);
  return successCount > 0;
}

/**
 * Send calendar event notification emails to all users
 * @param events - Array of event objects with event details
 * @param recipientEmails - Array of recipient email addresses
 * @param daysAhead - Number of days ahead to filter events (1 for 1-day, 7 for 1-week)
 * @returns Promise<{ success: boolean; sentCount: number; totalCount: number }>
 */
// The calendar email path is fed events straight from the database query
// (storage.getEvents() -> Event), so CalendarEvent is derived from the Drizzle
// `Event` row type rather than re-declared independently. Picking the columns
// the email actually renders keeps this type in lock-step with the schema: if a
// column's type changes (e.g. startDate/endDate are `Date`, not `string`), the
// email code typechecks against the real shape instead of silently drifting.
// All date fields are normalised with `new Date(...)` before use, so the `Date`
// values the DB returns are handled directly.
type CalendarEvent = Pick<
  Event,
  | "id"
  | "title"
  | "startDate"
  | "endDate"
  | "location"
  | "description"
  | "category"
  | "parentEventId"
  | "sponsorTagline"
  | "sponsorPhone"
  | "sponsorWebsiteUrl"
  | "sponsorVendorPageSlug"
  | "sponsorIsPoliticalAd"
  | "sponsorPoliticalAdText"
  | "mediaUrls"
>;

type CalendarEmailOptions = {
  customEventOrder?: number[];
  attachImageEventIds?: number[];
};

/**
 * Fetch an image from a URL and return it as a base64 data URI.
 * Returns null if the image cannot be fetched.
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const { URL } = await import('url');
    const parsedUrl = new URL(url);

    // SSRF protection: only allow http/https, block private/reserved addresses
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;

    const hostname = parsedUrl.hostname.toLowerCase();
    // Block loopback, link-local, private ranges, and internal hostnames
    const blocked = [
      /^localhost$/,
      /^127\./,
      /^0\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fc[0-9a-f]{2}:/i,  // IPv6 ULA
      /^fe80:/i,            // IPv6 link-local
    ];
    if (blocked.some(re => re.test(hostname))) return null;

    // For external hosts, allow only trusted domains (CDN/storage + our own production domain)
    const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0] ?? '';
    const isOwnHost = replitDomain && hostname === replitDomain.toLowerCase();
    if (!isOwnHost) {
      const allowedHostPattern = /\.(amazonaws\.com|storage\.googleapis\.com|r2\.cloudflarestorage\.com|replit\.com|repl\.co)$|^barefootbay\.com$/i;
      if (!allowedHostPattern.test(hostname)) return null;
    }

    const https = await import('https');
    const http = await import('http');
    const client = parsedUrl.protocol === 'https:' ? https : http;

    return new Promise((resolve) => {
      const req = client.get(url, { timeout: 5000 }, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        // Only allow image content types
        const contentType = res.headers['content-type'] ?? '';
        if (!contentType.startsWith('image/')) {
          res.destroy();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        let totalSize = 0;
        res.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;
          if (totalSize > 5 * 1024 * 1024) { // 5MB limit
            res.destroy();
            resolve(null);
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(`data:${contentType};base64,${buffer.toString('base64')}`);
        });
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  } catch {
    return null;
  }
}

/**
 * Build the HTML + text content for a calendar notification email.
 * Extracted so it can be reused by both the send function and the preview endpoint.
 */
async function buildCalendarEmailContent(
  events: CalendarEvent[],
  daysAhead: number,
  options: CalendarEmailOptions = {}
): Promise<{ subject: string; html: string; text: string }> {
  const { customEventOrder, attachImageEventIds } = options;

  // Separate platinum sponsors, promotional events, and regular events
  // Include both parent and child platinum sponsor events, then deduplicate by parentEventId
  const allPlatinumEvents = events.filter(e => e.category === 'platinum_sponsor');
  const seenSponsorIds = new Set<number>();
  const platinumSponsors = allPlatinumEvents.filter(e => {
    const key = e.parentEventId ?? e.id;
    if (seenSponsorIds.has(key)) return false;
    seenSponsorIds.add(key);
    return true;
  });
  const nonSponsorEvents = events.filter(e => e.category !== 'platinum_sponsor');

  let sortedEvents: CalendarEvent[];
  let useUnifiedList = false;

  if (customEventOrder && customEventOrder.length > 0) {
    // Apply custom ordering across ALL events (sponsors + non-sponsors) as a unified list
    const orderedIds = new Set(customEventOrder);
    const orderedPart = customEventOrder
      .map(id => events.find(e => e.id === id))
      .filter(Boolean) as CalendarEvent[];
    const remaining = events.filter(e => !orderedIds.has(e.id));
    sortedEvents = [...orderedPart, ...remaining];
    useUnifiedList = true;
  } else {
    const promotionalEvents = nonSponsorEvents.filter(e => e.category === 'promotional');
    const regularEvents = nonSponsorEvents.filter(e => e.category !== 'promotional');
    const sortedPromotionalEvents = [...promotionalEvents].sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    const sortedRegularEvents = [...regularEvents].sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    sortedEvents = [...sortedPromotionalEvents, ...sortedRegularEvents];
  }

  // Resolve public image URLs for events that need them.
  // We use direct public HTTPS URLs (not base64 data URIs) because Gmail and
  // virtually all email clients deliberately strip data: URI images from emails
  // as a security measure. Public hosted URLs are the standard approach for
  // HTML email images and are fetched by the client at open time.
  const imagePublicUrls: Record<number, string | null> = {};
  if (attachImageEventIds && attachImageEventIds.length > 0) {
    for (const eventId of attachImageEventIds) {
      const event = events.find(e => e.id === eventId);
      if (event?.mediaUrls && event.mediaUrls.length > 0) {
        const imageUrl = event.mediaUrls[0];
        // Expand relative /api/... paths to a full public URL
        imagePublicUrls[eventId] = imageUrl.startsWith('/')
          ? `https://barefootbay.com${imageUrl}`
          : imageUrl;
      }
    }
  }

  // Calculate date range for subject line using Florida time to match calendar
  const FLORIDA_TZ = 'America/New_York'; // Eastern Time (handles EST/EDT automatically)
  const now = new Date();
  let dateRangeText = '';
  
  if (daysAhead === 0) {
    // For same-day notifications, show today's date in Florida time
    dateRangeText = formatInTimeZone(now, FLORIDA_TZ, 'MMM d, yyyy');
  } else if (daysAhead === 1) {
    // For 1-day notifications, show tomorrow's date in Florida time
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateRangeText = formatInTimeZone(tomorrow, FLORIDA_TZ, 'MMM d, yyyy');
  } else {
    // For 7-day notifications, show date range in Florida time
    const startDate = formatInTimeZone(now, FLORIDA_TZ, 'MMM d');
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysAhead);
    const endDateFormatted = formatInTimeZone(endDate, FLORIDA_TZ, 'MMM d, yyyy');
    dateRangeText = `${startDate} - ${endDateFormatted}`;
  }

  const subject = daysAhead === 0
    ? `Barefoot Bay Events Today - ${dateRangeText}`
    : daysAhead === 1 
      ? `Barefoot Bay Events Tomorrow - ${dateRangeText}` 
      : `Barefoot Bay Events This Week - ${dateRangeText}`;
  
  const timeframe = daysAhead === 0 ? 'today' : daysAhead === 1 ? 'tomorrow' : 'this week';
  const headingText = daysAhead === 0 ? "Today's Events" : `Upcoming Events ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}`;
  const baseUrl = 'https://barefootbay.com';
  
  // Generate platinum sponsor card HTML for a single sponsor event (used in unified list)
  const renderSponsorCard = (sponsor: CalendarEvent) => {
    const contactParts: string[] = [];
    if (sponsor.sponsorPhone) {
      contactParts.push(`<a href="tel:${sponsor.sponsorPhone}" style="display: inline-block; background: #F3F4F6; border: 1px solid #9CA3AF; border-radius: 4px; padding: 3px 10px; font-size: 12px; color: #374151; text-decoration: none; font-weight: 600;">📞 ${sponsor.sponsorPhone}</a>`);
    }
    if (sponsor.sponsorWebsiteUrl) {
      contactParts.push(`<a href="${sponsor.sponsorWebsiteUrl}" style="display: inline-block; background: #F3F4F6; border: 1px solid #9CA3AF; border-radius: 4px; padding: 3px 10px; font-size: 12px; color: #374151; text-decoration: none; font-weight: 600;">🌐 Visit Website</a>`);
    }
    const contactLine = contactParts.length > 0 ? `<div style="margin-top: 10px;">${contactParts.join(' ')}</div>` : '';
    const disclaimerLine = sponsor.sponsorIsPoliticalAd && sponsor.sponsorPoliticalAdText
      ? `<div style="font-size: 11px; color: #888; font-style: italic; margin-top: 6px;">*${sponsor.sponsorPoliticalAdText}</div>`
      : '';
    return `
      <div style="border-top: 3px solid #9CA3AF; border-left: 2px solid #9CA3AF; border-right: 2px solid #9CA3AF; border-bottom: 2px solid #9CA3AF; border-radius: 8px; padding: 16px 20px; margin: 20px 0; background: #FFFFFF;">
        <div style="font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">Platinum Sponsor</div>
        <div style="font-size: 16px; font-weight: 700; line-height: 1.3;">
          <a href="${baseUrl}/events/${sponsor.id}" style="color: #1a1a2e; text-decoration: none;">${sponsor.title}</a>
        </div>
        ${sponsor.sponsorTagline ? `<div style="font-size: 13px; color: #6B7280; font-style: italic; margin-top: 4px;">${sponsor.sponsorTagline}</div>` : ''}
        ${contactLine}
        ${disclaimerLine}
      </div>
    `;
  };

  // Generate event list HTML
  const eventListHtml = sortedEvents.map(event => {
    // When using unified list, render platinum sponsor events with their own card style
    if (useUnifiedList && event.category === 'platinum_sponsor') {
      return renderSponsorCard(event);
    }

    // Use Florida/Eastern Time to match calendar display
    const FLORIDA_TZ = 'America/New_York'; // Eastern Time (handles EST/EDT automatically)
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    // Format in Florida timezone
    const formattedDate = formatInTimeZone(startDate, FLORIDA_TZ, 'EEE, MMM d, yyyy');
    const formattedStartTime = formatInTimeZone(startDate, FLORIDA_TZ, 'h:mm a');
    const formattedEndTime = formatInTimeZone(endDate, FLORIDA_TZ, 'h:mm a');
    
    // Create time range string with ET timezone indicator
    const timeRange = `${formattedStartTime} - ${formattedEndTime} ET`;
    
    // Check if this is a promotional event
    const isPromotional = event.category === 'promotional';
    
    // Style variations for promotional events (gold border/outline matching calendar page)
    const cardStyle = isPromotional 
      ? 'background: linear-gradient(135deg, #fffef7 0%, #fef9e7 50%, #fdf6e3 100%); border: 2px solid rgba(212, 175, 55, 0.6); box-shadow: 0 0 8px rgba(212, 175, 55, 0.15), 0 0 16px rgba(212, 175, 55, 0.08);'
      : 'background-color: #f4f4f5; border-left: 4px solid #90C9D4;';
    
    // Promotional badge for promotional events (matching calendar sand gold #efe59c)
    const promotionalBadge = isPromotional 
      ? `<span style="display: inline-block; background-color: #efe59c; color: #1a1a2e; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px; text-transform: uppercase; letter-spacing: 0.5px;">⭐ Promotional</span>`
      : '';
    
    // Date/time display - hidden for promotional events
    const dateTimeHtml = isPromotional 
      ? '' 
      : `<div class="event-meta"><strong>📅 ${formattedDate}, ${timeRange}</strong></div>`;

    // Inline image if requested and available
    const inlineImage = imagePublicUrls[event.id]
      ? `<div style="margin: 10px 0;"><img src="${imagePublicUrls[event.id]}" alt="${event.title}" style="max-width: 100%; border-radius: 6px; display: block;" /></div>`
      : '';
    
    return `
      <div class="event-card" style="${cardStyle} padding: 20px; margin: 20px 0; border-radius: 8px;">
        <div class="event-title" style="font-size: 18px; font-weight: bold; color: #434054; margin-bottom: 10px;">
          <a href="${baseUrl}/events/${event.id}" style="color: #434054; text-decoration: none;">${event.title}</a>${promotionalBadge}
        </div>
        ${dateTimeHtml}
        ${event.location ? `<div class="event-meta" style="font-size: 14px; color: #71717a; margin: 5px 0;">📍 ${event.location}</div>` : ''}
        ${inlineImage}
        ${event.description ? `<div class="event-description" style="color: #52525b; margin-top: 10px; line-height: 1.6;">${event.description.substring(0, 150)}${event.description.length > 150 ? '...' : ''}</div>` : ''}
        <div style="margin-top: 12px;">
          <a href="${baseUrl}/events/${event.id}" style="color: ${isPromotional ? '#d4a017' : '#90C9D4'}; text-decoration: none; font-weight: 600;">View Event Details →</a>
        </div>
      </div>
    `;
  }).join('');
  
  // Randomize platinum sponsors order for fair visibility (only used in default non-unified layout)
  const shuffledSponsors = [...platinumSponsors];
  for (let i = shuffledSponsors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledSponsors[i], shuffledSponsors[j]] = [shuffledSponsors[j], shuffledSponsors[i]];
  }

  // Generate platinum sponsors HTML section — only shown when no custom order is set
  const platinumSponsorsHtml = !useUnifiedList && shuffledSponsors.length > 0 ? `
    <div style="margin: 16px 0 24px 0;">
      ${shuffledSponsors.map((sponsor) => {
        const contactParts: string[] = [];
        if (sponsor.sponsorPhone) {
          contactParts.push(`<a href="tel:${sponsor.sponsorPhone}" style="display: inline-block; background: #F3F4F6; border: 1px solid #9CA3AF; border-radius: 4px; padding: 3px 10px; font-size: 12px; color: #374151; text-decoration: none; font-weight: 600;">📞 ${sponsor.sponsorPhone}</a>`);
        }
        if (sponsor.sponsorWebsiteUrl) {
          contactParts.push(`<a href="${sponsor.sponsorWebsiteUrl}" style="display: inline-block; background: #F3F4F6; border: 1px solid #9CA3AF; border-radius: 4px; padding: 3px 10px; font-size: 12px; color: #374151; text-decoration: none; font-weight: 600;">🌐 Visit Website</a>`);
        }
        const contactLine = contactParts.length > 0 ? `<div style="margin-top: 10px;">${contactParts.join(' ')}</div>` : '';
        const disclaimerLine = sponsor.sponsorIsPoliticalAd && sponsor.sponsorPoliticalAdText
          ? `<div style="font-size: 11px; color: #888; font-style: italic; margin-top: 6px;">*${sponsor.sponsorPoliticalAdText}</div>`
          : '';
        return `
          <div style="border-top: 3px solid #9CA3AF; border-left: 2px solid #9CA3AF; border-right: 2px solid #9CA3AF; border-bottom: 2px solid #9CA3AF; border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; background: #FFFFFF;">
            <div style="font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">Platinum Sponsor</div>
            <div style="font-size: 16px; font-weight: 700; line-height: 1.3;">
              <a href="${baseUrl}/events/${sponsor.id}" style="color: #1a1a2e; text-decoration: none;">${sponsor.title}</a>
            </div>
            ${sponsor.sponsorTagline ? `<div style="font-size: 13px; color: #6B7280; font-style: italic; margin-top: 4px;">${sponsor.sponsorTagline}</div>` : ''}
            ${contactLine}
            ${disclaimerLine}
          </div>
        `;
      }).join('')}
      <div style="font-size: 11px; color: #9CA3AF; text-align: center; margin-top: 4px; letter-spacing: 0.3px;">Proudly Supporting BarefootBay.com and The Tattler</div>
    </div>
  ` : '';

  // Generate platinum sponsors plain text (only used in default non-unified layout)
  const platinumSponsorsText = !useUnifiedList && shuffledSponsors.length > 0 ? `
Our Platinum Sponsor${shuffledSponsors.length > 1 ? 's' : ''}
${shuffledSponsors.map(sponsor => {
    const parts = [sponsor.title];
    if (sponsor.sponsorTagline) parts.push(`  ${sponsor.sponsorTagline}`);
    if (sponsor.sponsorPhone) parts.push(`  📞 ${sponsor.sponsorPhone}`);
    if (sponsor.sponsorWebsiteUrl) parts.push(`  🌐 ${sponsor.sponsorWebsiteUrl}`);
    if (sponsor.sponsorIsPoliticalAd && sponsor.sponsorPoliticalAdText) parts.push(`  *${sponsor.sponsorPoliticalAdText}`);
    return parts.join('\n');
  }).join('\n\n')}
Proudly Supporting BarefootBay.com and The Tattler
---
` : '';

  // Generate event list text (plain text version)
  const eventListText = sortedEvents.map(event => {
    // When using unified list, render platinum sponsor events inline in plain text
    if (useUnifiedList && event.category === 'platinum_sponsor') {
      const parts = [`[Platinum Sponsor] ${event.title}`];
      if (event.sponsorTagline) parts.push(`  ${event.sponsorTagline}`);
      if (event.sponsorPhone) parts.push(`  📞 ${event.sponsorPhone}`);
      if (event.sponsorWebsiteUrl) parts.push(`  🌐 ${event.sponsorWebsiteUrl}`);
      if (event.sponsorIsPoliticalAd && event.sponsorPoliticalAdText) parts.push(`  *${event.sponsorPoliticalAdText}`);
      parts.push(`View: ${baseUrl}/events/${event.id}`);
      parts.push('---');
      return parts.join('\n');
    }

    // Use Florida/Eastern Time to match calendar display
    // This ensures events always show in the local time where they occur (Barefoot Bay, FL)
    const FLORIDA_TZ = 'America/New_York'; // Eastern Time (handles EST/EDT automatically)
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    // Format in Florida timezone
    const formattedDate = formatInTimeZone(startDate, FLORIDA_TZ, 'EEE, MMM d, yyyy');
    const formattedStartTime = formatInTimeZone(startDate, FLORIDA_TZ, 'h:mm a');
    const formattedEndTime = formatInTimeZone(endDate, FLORIDA_TZ, 'h:mm a');
    
    // Create time range string with ET timezone indicator
    const timeRange = `${formattedStartTime} - ${formattedEndTime} ET`;
    
    // Check if this is a promotional event
    const isPromotional = event.category === 'promotional';
    
    // Date/time line - hidden for promotional events
    const dateTimeLine = isPromotional ? '' : `Date: ${formattedDate}, ${timeRange}\n`;
    
    // Promotional indicator
    const promotionalLabel = isPromotional ? ' [⭐ PROMOTIONAL]' : '';
    
    return `
${event.title}${promotionalLabel}
${dateTimeLine}${event.location ? `Location: ${event.location}` : ''}
${event.description ? `${event.description.substring(0, 150)}${event.description.length > 150 ? '...' : ''}` : ''}
View: ${baseUrl}/events/${event.id}
---
    `.trim();
  }).join('\n\n');
  
  const text = `
${headingText} - Barefoot Bay Calendar

Hello!

Here are the upcoming events ${timeframe} in the Barefoot Bay community:

${platinumSponsorsText}${eventListText}

View all events on the calendar: ${baseUrl}/calendar

---
This is an automated notification from the Barefoot Bay community platform.
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Upcoming Events - Barefoot Bay</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #27272a;
          margin: 0;
          padding: 0;
          background-color: #f4f4f5;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #90C9D4 0%, #6BB5C1 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 5px;
          letter-spacing: 1px;
        }
        .tagline {
          font-size: 12px;
          opacity: 0.95;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 30px 25px;
        }
        .event-card {
          background-color: #f4f4f5;
          border-left: 4px solid #90C9D4;
          padding: 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .event-title {
          font-size: 18px;
          font-weight: bold;
          color: #434054;
          margin-bottom: 10px;
        }
        .event-meta {
          font-size: 14px;
          color: #71717a;
          margin: 5px 0;
        }
        .event-description {
          color: #52525b;
          margin-top: 10px;
          line-height: 1.6;
        }
        .cta-button {
          display: inline-block;
          background-color: #90C9D4;
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          margin: 25px 0;
          font-weight: 600;
          transition: background-color 0.3s ease;
        }
        .cta-button:hover {
          background-color: #6BB5C1;
        }
        .footer {
          background-color: #f4f4f5;
          padding: 25px;
          text-align: center;
          font-size: 13px;
          color: #71717a;
          border-top: 1px solid #e4e4e7;
        }
        .footer p {
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📅 ${headingText}</div>
          <div class="tagline">Stay informed about events happening in the Barefoot Bay community</div>
        </div>
        
        <div class="content">
          <p>Hello!</p>
          
          <p>Here are the upcoming events ${timeframe} in the Barefoot Bay community:</p>
          
          ${platinumSponsorsHtml}
          
          ${eventListHtml}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${baseUrl}/calendar" class="cta-button">View Full Calendar</a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Barefoot Bay Community Platform</strong></p>
          <p>This is an automated notification from the Barefoot Bay community platform.</p>
          <p>
            <a href="${getBaseUrl()}/unsubscribe" 
               style="color: #71717a; text-decoration: underline;">
              Unsubscribe from email notifications
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html, text };
}

export async function sendCalendarEventNotificationEmail(
  events: CalendarEvent[],
  recipientEmails: string[],
  daysAhead: number,
  options: CalendarEmailOptions = {}
): Promise<{ success: boolean; sentCount: number; totalCount: number }> {
  console.log('[SendGrid Calendar Notification] Sending calendar event notification emails:', {
    eventCount: events.length,
    recipientCount: recipientEmails.length,
    daysAhead
  });

  const { subject, html, text } = await buildCalendarEmailContent(events, daysAhead, options);

  // Normalize to lowercase and dedupe so two users sharing a mailbox
  // (e.g. a couple registered with the same email) only get one copy.
  const dedupedEmails = Array.from(
    new Set(
      recipientEmails
        .filter(e => typeof e === 'string' && e.trim().length > 0)
        .map(e => e.trim().toLowerCase())
    )
  );
  if (dedupedEmails.length !== recipientEmails.length) {
    console.log(`[SendGrid Calendar Notification] 🧹 Removed ${recipientEmails.length - dedupedEmails.length} duplicate/invalid recipient email(s); ${dedupedEmails.length} unique mailbox(es) will be emailed`);
  }

  // Send emails to all recipients
  let successCount = 0;
  for (const email of dedupedEmails) {
    try {
      const success = await sendEmail({
        to: email,
        from: FROM_EMAIL,
        subject,
        text,
        html
      });
      if (success) successCount++;
    } catch (error) {
      console.error(`[SendGrid Calendar Notification] Failed to send to ${email}:`, error);
    }
  }

  console.log(`[SendGrid Calendar Notification] Sent ${successCount}/${dedupedEmails.length} emails successfully`);
  return { 
    success: successCount > 0, 
    sentCount: successCount, 
    totalCount: dedupedEmails.length 
  };
}

/**
 * Build a preview of the calendar email HTML for a given day-ahead count and options.
 * Does NOT send anything — used by the admin preview endpoint.
 */
export async function buildCalendarEmailPreview(
  events: CalendarEvent[],
  daysAhead: number,
  options: CalendarEmailOptions = {}
): Promise<{ subject: string; html: string }> {
  const { subject, html } = await buildCalendarEmailContent(events, daysAhead, options);
  return { subject, html };
}

/**
 * Send a message notification email with Barefoot Bay branding
 */
export async function sendMessageEmail(
  recipientEmail: string,
  subject: string,
  messageContent: string,
  senderName: string,
  senderEmail: string,
  attachments?: EmailAttachment[]
): Promise<boolean> {
  console.log('[SendGrid Message] Sending message email:', {
    recipientEmail,
    subject,
    senderName,
    contentLength: messageContent.length,
    attachmentCount: attachments?.length || 0
  });

  const baseUrl = getBaseUrl();
  
  const attachmentText = attachments && attachments.length > 0 
    ? `\n\nAttachments (${attachments.length}): ${attachments.map(a => a.filename).join(', ')}`
    : '';
  
  const text = `
You have received a new message from ${senderName}.

Subject: ${subject}

${messageContent}${attachmentText}

---
View your messages: ${baseUrl}/messages

To stop receiving email notifications, visit: ${baseUrl}/unsubscribe
  `.trim();

  const attachmentHtml = attachments && attachments.length > 0 
    ? `
      <div style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; font-weight: 600; color: #0369a1;">
          📎 Attachments (${attachments.length}):
        </p>
        <ul style="margin: 0; padding-left: 20px;">
          ${attachments.map(a => `<li style="color: #374151;">${a.filename}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
        }
        .header {
          background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          padding: 30px;
        }
        .message-box {
          background: #f8fafc;
          border-left: 4px solid #0ea5e9;
          padding: 20px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .message-subject {
          font-size: 18px;
          font-weight: 600;
          color: #1e40af;
          margin-bottom: 15px;
        }
        .message-content {
          color: #374151;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .cta-button {
          display: inline-block;
          background: #0ea5e9;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          margin: 20px 0;
        }
        .cta-button:hover {
          background: #0284c7;
        }
        .footer {
          background: #f9fafb;
          padding: 20px 30px;
          text-align: center;
          font-size: 14px;
          color: #71717a;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💬 Barefoot Bay</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.95;">Community Platform</p>
        </div>
        
        <div class="content">
          <p>You have received a new message from <strong>${senderName}</strong>:</p>
          
          <div class="message-box">
            <div class="message-subject">${subject}</div>
            <div class="message-content">${messageContent.replace(/\n/g, '<br>')}</div>
          </div>
          
          ${attachmentHtml}
          
          <div style="text-align: center;">
            <a href="${baseUrl}/messages" class="cta-button">View Your Messages</a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Barefoot Bay Community Platform</strong></p>
          <p>This message was sent through the Barefoot Bay messaging system.</p>
          <p>
            <a href="${baseUrl}/unsubscribe" 
               style="color: #71717a; text-decoration: underline;">
              Unsubscribe from email notifications
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: recipientEmail,
    from: FROM_EMAIL,
    subject: subject,
    text,
    html,
    attachments
  });
}

/**
 * Send notification email to forum post subscribers when a new comment is posted
 * @param comment - Comment object with comment details
 * @param post - Post object with post details
 * @param author - Comment author information
 * @param recipientEmails - Array of subscriber email addresses
 * @returns Promise<{ success: boolean; sentCount: number; totalCount: number }>
 */
export async function sendForumCommentNotificationEmail(
  comment: { id: number; content: string },
  post: { id: number; title: string },
  author: { username: string; fullName?: string | null },
  recipientEmails: string[]
): Promise<{ success: boolean; sentCount: number; totalCount: number }> {
  console.log('[SendGrid Forum Comment Notification] Sending comment notification emails:', {
    commentId: comment.id,
    postId: post.id,
    postTitle: post.title,
    authorName: author.username,
    recipientCount: recipientEmails.length
  });

  const baseUrl = getBaseUrl();
  const postUrl = `${baseUrl}/forum/post/${post.id}`;
  const authorDisplayName = author.fullName || author.username;
  
  // Strip HTML tags from comment content and create preview
  const commentPreview = comment.content
    .replace(/<[^>]*>/g, '')
    .substring(0, 200)
    .trim() + (comment.content.length > 200 ? '...' : '');
  
  const subject = `New comment on: ${post.title}`;
  
  const text = `
New Comment on Forum Post

${post.title}

${authorDisplayName} commented:

"${commentPreview}"

View the full discussion: ${postUrl}

---
This is an automated notification from the Barefoot Bay community platform.
You are receiving this because you are subscribed to this forum post.
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Comment - Barefoot Bay</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #27272a;
          margin: 0;
          padding: 0;
          background-color: #f4f4f5;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #90C9D4 0%, #6BB5C1 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 5px;
          letter-spacing: 1px;
        }
        .tagline {
          font-size: 12px;
          opacity: 0.95;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 30px 25px;
        }
        .post-title {
          font-size: 20px;
          font-weight: bold;
          color: #434054;
          margin-bottom: 20px;
        }
        .comment-box {
          background-color: #f4f4f5;
          border-left: 4px solid #90C9D4;
          padding: 20px;
          margin: 25px 0;
          border-radius: 0 8px 8px 0;
        }
        .author-name {
          font-size: 14px;
          font-weight: 600;
          color: #434054;
          margin-bottom: 12px;
        }
        .comment-preview {
          color: #52525b;
          line-height: 1.6;
          font-style: italic;
        }
        .cta-button {
          display: inline-block;
          background-color: #90C9D4;
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          margin: 25px 0;
          font-weight: 600;
          transition: background-color 0.3s ease;
        }
        .cta-button:hover {
          background-color: #6BB5C1;
        }
        .footer {
          background-color: #f4f4f5;
          padding: 25px;
          text-align: center;
          font-size: 13px;
          color: #71717a;
          border-top: 1px solid #e4e4e7;
        }
        .footer p {
          margin: 8px 0;
        }
        .footer a {
          color: #90C9D4;
          text-decoration: none;
        }
        .footer a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">💬 New Comment</div>
          <div class="tagline">Someone replied to a forum post you're following</div>
        </div>
        
        <div class="content">
          <div class="post-title">${post.title}</div>
          
          <div class="comment-box">
            <div class="author-name">${authorDisplayName} commented:</div>
            <div class="comment-preview">"${commentPreview}"</div>
          </div>
          
          <div style="text-align: center;">
            <a href="${postUrl}" class="cta-button">View Full Discussion</a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Barefoot Bay Community Platform</strong></p>
          <p>You're receiving this because you're subscribed to this forum post.</p>
          <p>
            <a href="${postUrl}#unsubscribe">Unsubscribe from this post</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Validate recipient emails before sending
  const filteredEmails = recipientEmails.filter(email => {
    const isValid = email && email.trim().length > 0 && email.includes('@');
    if (!isValid) {
      console.error(`[SendGrid Forum Comment Notification] ❌ Invalid email address detected: "${email}"`);
    }
    return isValid;
  });

  // Normalize to lowercase and dedupe so two users sharing a mailbox
  // (e.g. a couple registered with the same email) only get one copy.
  const validEmails = Array.from(
    new Set(filteredEmails.map(e => e.trim().toLowerCase()))
  );
  if (validEmails.length !== filteredEmails.length) {
    console.log(`[SendGrid Forum Comment Notification] 🧹 Removed ${filteredEmails.length - validEmails.length} duplicate recipient email(s); ${validEmails.length} unique mailbox(es) will be emailed`);
  }

  if (validEmails.length === 0) {
    console.error('[SendGrid Forum Comment Notification] ❌ No valid email addresses to send to');
    return { success: false, sentCount: 0, totalCount: recipientEmails.length };
  }

  console.log(`[SendGrid Forum Comment Notification] Validated ${validEmails.length}/${recipientEmails.length} email addresses`);

  // Send emails in batches to respect rate limits (20 at a time)
  const BATCH_SIZE = 20;
  let successCount = 0;
  
  for (let i = 0; i < validEmails.length; i += BATCH_SIZE) {
    const batch = validEmails.slice(i, i + BATCH_SIZE);
    console.log(`[SendGrid Forum Comment Notification] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} emails`);
    
    // Send all emails in batch concurrently
    const results = await Promise.allSettled(
      batch.map(email => sendEmail({
        to: email,
        from: FROM_EMAIL,
        subject,
        text,
        html
      }))
    );
    
    // Count successes
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successCount++;
        console.log(`[SendGrid Forum Comment Notification] ✅ Successfully sent to ${batch[index]}`);
      } else {
        const reason = result.status === 'rejected' ? result.reason : 'Unknown error';
        console.error(`[SendGrid Forum Comment Notification] ❌ Failed to send to ${batch[index]}:`, reason);
      }
    });
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < validEmails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[SendGrid Forum Comment Notification] Sent ${successCount}/${validEmails.length} emails successfully`);
  return { 
    success: successCount > 0, 
    sentCount: successCount, 
    totalCount: validEmails.length 
  };
}

/**
 * Send an admin alert email for a high/critical payment issue.
 * Mirrors the dedupe + per-recipient loop pattern used by other batched
 * helpers (task #73): emails are lowercased + deduped before sending so
 * admins sharing a mailbox only receive one alert per issue.
 *
 * Designed for callers in payment-monitor.ts where the caller has already
 * resolved the admin recipient list. Returns a small report so the caller
 * can log results, but failures here never throw.
 */
export async function sendPaymentIssueAdminAlert(
  issue: {
    severity: string;
    type: string;
    userId: number;
    orderId?: string;
    description: string;
    details?: any;
    timestamp: Date;
  },
  recipientEmails: string[]
): Promise<{ success: boolean; emailsSent: number; errors: string[] }> {
  const errors: string[] = [];
  let emailsSent = 0;

  try {
    // Validate, lowercase, dedupe (defense in depth alongside caller filtering)
    const dedupedEmails = Array.from(
      new Set(
        (recipientEmails || [])
          .map(e => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
          .filter(e => e.length > 0 && e.includes('@'))
      )
    );

    if (dedupedEmails.length === 0) {
      console.warn('[PaymentAlert] No valid admin recipient emails - skipping send');
      return { success: false, emailsSent: 0, errors: ['No valid admin recipient emails'] };
    }

    if (dedupedEmails.length !== recipientEmails.length) {
      console.log(`[PaymentAlert] 🧹 Removed ${recipientEmails.length - dedupedEmails.length} duplicate/invalid recipient email(s); ${dedupedEmails.length} unique mailbox(es) will be alerted`);
    }

    const severityLabel = (issue.severity || 'unknown').toUpperCase();
    const isCritical = issue.severity === 'critical';
    const statusColor = isCritical ? '#991b1b' : '#dc2626';
    const statusIcon = isCritical ? '🚨' : '🔴';

    const subject = `${statusIcon} ${severityLabel} Payment Issue: ${issue.type} (User ${issue.userId})`;
    const safeType = escapeHtml(issue.type);
    const safeOrderId = escapeHtml(issue.orderId || 'N/A');

    // Format details safely as a pre block so JSON keys remain readable.
    let detailsBlock = '';
    try {
      if (issue.details !== undefined && issue.details !== null) {
        detailsBlock = JSON.stringify(issue.details, null, 2);
      }
    } catch {
      detailsBlock = String(issue.details);
    }

    const text = `
${statusIcon} ${severityLabel} PAYMENT ISSUE

Type: ${issue.type}
User ID: ${issue.userId}
Order ID: ${issue.orderId || 'N/A'}
Time: ${issue.timestamp.toISOString()}

Description:
${issue.description}

${detailsBlock ? `Details:\n${detailsBlock}\n` : ''}
This is an automated alert from the Barefoot Bay payment monitor.
Please review the server logs and admin payment dashboard.
    `.trim();

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="background-color: ${statusColor}; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px;">${statusIcon} ${severityLabel} Payment Issue</h1>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151; width: 130px;">Type:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${safeType}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">User ID:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${issue.userId}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Order ID:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${safeOrderId}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Time:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${issue.timestamp.toISOString()}</td>
        </tr>
      </table>

      <div style="margin-top: 16px; padding: 14px; background-color: #fef2f2; border-left: 4px solid ${statusColor}; border-radius: 4px;">
        <p style="margin: 0; color: #7f1d1d; font-weight: bold;">Description</p>
        <p style="margin: 8px 0 0 0; color: #7f1d1d; white-space: pre-wrap;">${escapeHtml(issue.description)}</p>
      </div>

      ${detailsBlock ? `
      <div style="margin-top: 16px;">
        <p style="margin: 0 0 6px 0; font-weight: bold; color: #374151;">Details</p>
        <pre style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; color: #111827; font-size: 12px; overflow: auto; white-space: pre-wrap;">${escapeHtml(detailsBlock)}</pre>
      </div>
      ` : ''}

      <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 12px;">
        Please review the server logs and admin payment dashboard.
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 14px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">Automated alert from the Barefoot Bay payment monitor.</p>
    </div>
  </div>
</body>
</html>`;

    for (const adminEmail of dedupedEmails) {
      try {
        const sent = await sendEmail({
          to: adminEmail,
          from: FROM_EMAIL,
          subject,
          text,
          html,
        });

        if (sent) {
          emailsSent++;
          console.log(`[PaymentAlert] ✅ Alert sent to ${adminEmail}`);
        } else {
          errors.push(`Failed to send alert to ${adminEmail}`);
          console.error(`[PaymentAlert] ❌ Failed to send alert to ${adminEmail}`);
        }
      } catch (sendErr: any) {
        errors.push(`Error sending to ${adminEmail}: ${sendErr?.message || 'Unknown error'}`);
        console.error(`[PaymentAlert] ❌ Error sending alert to ${adminEmail}:`, sendErr?.message || sendErr);
      }
    }

    console.log(`[PaymentAlert] Alert dispatch complete: ${emailsSent}/${dedupedEmails.length} email(s) sent`);
    return { success: emailsSent > 0, emailsSent, errors };
  } catch (outerErr: any) {
    console.error('[PaymentAlert] ❌ Critical error sending payment-issue alerts:', outerErr);
    return { success: false, emailsSent: 0, errors: [`Critical error: ${outerErr?.message || 'Unknown error'}`] };
  }
}

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendPlatinumSponsorRequestEmail(
  formTitle: string,
  formData: Record<string, any>
): Promise<boolean> {
  const baseUrl = getBaseUrl();

  const fieldRows = Object.entries(formData)
    .map(([key, value]) => {
      const label = key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
      return `<tr><td style="padding: 8px 12px; border: 1px solid #E5E7EB; font-weight: 600; color: #374151; width: 160px; background: #F9FAFB;">${label}</td><td style="padding: 8px 12px; border: 1px solid #E5E7EB; color: #111827;">${value || '—'}</td></tr>`;
    })
    .join('\n');

  const textFields = Object.entries(formData)
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
      return `${label}: ${value || '—'}`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #E5E7EB, #D1D5DB, #9CA3AF); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="margin: 0; color: #1F2937; font-size: 22px;">New Platinum Sponsor Request</h1>
      <p style="margin: 8px 0 0; color: #4B5563; font-size: 14px;">${formTitle}</p>
    </div>
    <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #E5E7EB; border-top: none;">
      <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">A new Platinum Sponsorship request has been submitted through the website:</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        ${fieldRows}
      </table>
      <p style="color: #6B7280; font-size: 13px; margin: 16px 0 0;">
        You can view this request in your 
        <a href="${baseUrl}/messages" style="color: #4B5563; text-decoration: underline;">Messages Inbox</a>.
      </p>
    </div>
    <div style="text-align: center; padding: 16px; color: #9CA3AF; font-size: 12px;">
      Proudly Supporting BarefootBay.com and The Tattler
    </div>
  </div>
</body>
</html>`;

  const text = `New Platinum Sponsor Request\n${formTitle}\n\nA new Platinum Sponsorship request has been submitted:\n\n${textFields}\n\nView in your Messages Inbox: ${baseUrl}/messages\n\nProudly Supporting BarefootBay.com and The Tattler`;

  return sendEmail({
    to: 'team@barefootbay.com',
    from: FROM_EMAIL,
    subject: `New Platinum Sponsor Request: ${formData.business_name || formData.businessName || 'Unknown Business'}`,
    html,
    text,
  });
}

/**
 * Escalation alert sent to all eligible admins when the AUTOMATIC daily calendar
 * digest did not complete (failed to send, missed its window, had no eligible
 * recipients, or — softer — had no events for tomorrow).
 *
 * `severity: "info"` renders a calm, non-alarming style (used for the normal
 * "no events tomorrow" case) so admins aren't startled by quiet days, while
 * `severity: "alert"` renders an attention-grabbing style for genuine failures.
 *
 * Sent individually per admin (deduped) so one bad address doesn't block the
 * rest. Returns true if at least one email was delivered.
 */
export async function sendCalendarScheduleEscalationEmail(
  adminEmails: string[],
  info: {
    reason: string;
    title: string;
    detail: string;
    severity: 'alert' | 'info';
    dateET: string;
    sendTime: string;
  }
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const isAlert = info.severity === 'alert';
  const accent = isAlert ? '#E15A4F' : '#90C9D4';
  const headingBg = isAlert
    ? 'linear-gradient(135deg, #E15A4F, #c94a40)'
    : 'linear-gradient(135deg, #90C9D4, #6fb3c0)';
  const eyebrow = isAlert ? 'Action may be needed' : 'For your awareness';
  const subjectPrefix = isAlert ? '[Action needed]' : '[FYI]';

  const dedupedEmails = Array.from(
    new Set(
      adminEmails
        .filter(e => typeof e === 'string' && e.trim().length > 0)
        .map(e => e.trim().toLowerCase())
    )
  );

  if (dedupedEmails.length === 0) {
    console.warn('[SendGrid Calendar Escalation] No admin emails to notify');
    return false;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: ${headingBg}; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
      <p style="margin: 0 0 6px; color: rgba(255,255,255,0.9); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${eyebrow}</p>
      <h1 style="margin: 0; color: #ffffff; font-size: 20px;">${info.title}</h1>
    </div>
    <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #E5E7EB; border-top: none;">
      <p style="color: #374151; font-size: 14px; margin: 0 0 16px; line-height: 1.5;">${info.detail}</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 8px 12px; border: 1px solid #E5E7EB; font-weight: 600; color: #374151; width: 160px; background: #F9FAFB;">Date</td><td style="padding: 8px 12px; border: 1px solid #E5E7EB; color: #111827;">${info.dateET}</td></tr>
        <tr><td style="padding: 8px 12px; border: 1px solid #E5E7EB; font-weight: 600; color: #374151; background: #F9FAFB;">Scheduled time</td><td style="padding: 8px 12px; border: 1px solid #E5E7EB; color: #111827;">${info.sendTime} ET</td></tr>
      </table>
      <p style="color: #6B7280; font-size: 13px; margin: 16px 0 0; line-height: 1.5;">
        Manage the schedule or send manually from
        <a href="${baseUrl}/admin/calendar-management" style="color: ${accent}; text-decoration: underline;">Calendar Management</a>.
      </p>
    </div>
    <div style="text-align: center; padding: 16px; color: #9CA3AF; font-size: 12px;">
      Automated message from BarefootBay.com calendar email scheduler
    </div>
  </div>
</body>
</html>`;

  const text = `${eyebrow}: ${info.title}\n\n${info.detail}\n\nDate: ${info.dateET}\nScheduled time: ${info.sendTime} ET\n\nManage the schedule or send manually: ${baseUrl}/admin/calendar-management`;

  const subject = `${subjectPrefix} ${info.title}`;

  let successCount = 0;
  for (const email of dedupedEmails) {
    try {
      const ok = await sendEmail({ to: email, from: FROM_EMAIL, subject, html, text });
      if (ok) successCount++;
    } catch (error) {
      console.error(`[SendGrid Calendar Escalation] Failed to send to ${email}:`, error);
    }
  }

  console.log(`[SendGrid Calendar Escalation] Sent ${successCount}/${dedupedEmails.length} escalation email(s) (reason=${info.reason})`);
  return successCount > 0;
}