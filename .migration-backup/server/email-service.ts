import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import type { User, Order } from '@shared/schema';
import { storage } from './storage';

interface EmailOptions {
  from?: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Initialize email transporter - will be lazily loaded
let transporter: nodemailer.Transporter | null = null;

async function initializeTransporter() {
  // Use OAuth2 for Gmail API
  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_USER_EMAIL
  ) {
    console.log('[Email Init] Using Google OAuth2 for email sending');
    
    // Use environment variables for OAuth credentials
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const userEmail = process.env.GOOGLE_USER_EMAIL;
    
    console.log('[Email Init] Using client ID:', clientId);
    console.log('[Email Init] Client Secret first 3 chars:', clientSecret.substring(0, 3) + '...');
    console.log('[Email Init] Refresh Token first 5 chars:', refreshToken.substring(0, 5) + '...');
    console.log('[Email Init] User Email:', userEmail);
    
    try {
      // Create OAuth2 client
      console.log('[Email Init] Creating OAuth2 client...');
      const OAuth2 = google.auth.OAuth2;
      const oauth2Client = new OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground' // Redirect URL for the OAuth2 playground
      );

      // Set refresh token
      console.log('[Email Init] Setting credentials...');
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
    
    try {
      // Always try to get a fresh access token from refresh token for reliability
      console.log('[OAuth2] Generating fresh access token from refresh token');
      const accessToken = await new Promise<string>((resolve, reject) => {
        oauth2Client.getAccessToken((err, token) => {
          if (err) {
            console.error('[OAuth2] Error getting access token:', err);
            
            // Enhanced error logging for debugging
            if (err.response && err.response.data) {
              console.error('[OAuth2] Error response data:', err.response.data);
            }
            
            // Check for specific OAuth2 errors
            if (err.message && err.message.includes('invalid_grant')) {
              console.error('[OAuth2] Invalid grant error - refresh token may be expired or revoked');
            }
            
            reject(err);
          } else if (!token) {
            console.error('[OAuth2] No access token returned (token is null)');
            reject(new Error('No access token returned'));
          } else {
            console.log('[OAuth2] ✅ Fresh access token obtained successfully from refresh token');
            resolve(token);
          }
        });
      });
      
      console.log('Successfully obtained Google OAuth2 access token');
      
      // Create transporter using OAuth2 with connection options
      const transporterConfig = {
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: userEmail,
          clientId: clientId,
          clientSecret: clientSecret,
          refreshToken: refreshToken,
          accessToken: accessToken
        },
        // Add connection timeout and retry options
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000,   // 30 seconds
        socketTimeout: 60000,     // 60 seconds
      };
      
      const createdTransporter = nodemailer.createTransport(transporterConfig);
      
      // Test the transporter connection in production to catch issues early
      if (process.env.NODE_ENV === 'production') {
        try {
          await createdTransporter.verify();
          console.log('[Email Init] ✅ Production transporter connection verified successfully');
        } catch (verifyError) {
          console.error('[Email Init] ❌ Production transporter verification failed:', verifyError);
          console.warn('[Email Init] Returning unverified transporter - will attempt sending anyway');
        }
      }
      
      return createdTransporter;
    } catch (error) {
      console.error('[Email Init] Error setting up Google OAuth2 transport:', error);
      console.error('[Email Init] Error details:', error instanceof Error ? error.message : 'Unknown error');
      
      // Enhanced error context for production debugging
      if (process.env.NODE_ENV === 'production') {
        console.error('[Email Init] PRODUCTION ERROR: OAuth2 setup failed - email functionality will be unavailable');
        console.error('[Email Init] Check Google Cloud Console OAuth2 credentials and refresh token validity');
        
        // In production, provide actionable error information
        if (error instanceof Error) {
          if (error.message.includes('invalid_grant')) {
            console.error('[Email Init] SOLUTION: Refresh token expired - regenerate at https://developers.google.com/oauthplayground');
          } else if (error.message.includes('invalid_client')) {
            console.error('[Email Init] SOLUTION: Invalid client credentials - check Google Cloud Console OAuth2 setup');
          }
        }
      }
      
      throw error; // Don't fall back, OAuth2 is required
    }
  } catch (outerError) {
    console.error('[Email Init] Error in OAuth2 client creation:', outerError);
    console.error('[Email Init] Outer error details:', outerError instanceof Error ? outerError.message : 'Unknown error');
    throw outerError;
  }
  } else {
    const missingOauthCredentials = [];
    if (!process.env.GOOGLE_CLIENT_ID) missingOauthCredentials.push('GOOGLE_CLIENT_ID');
    if (!process.env.GOOGLE_CLIENT_SECRET) missingOauthCredentials.push('GOOGLE_CLIENT_SECRET');
    if (!process.env.GOOGLE_REFRESH_TOKEN) missingOauthCredentials.push('GOOGLE_REFRESH_TOKEN');
    if (!process.env.GOOGLE_USER_EMAIL) missingOauthCredentials.push('GOOGLE_USER_EMAIL');
    
    const errorMessage = `Missing required Google OAuth2 credentials: ${missingOauthCredentials.join(', ')}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Send an email
 * @param options Email options
 * @returns Promise resolving to true if email was sent successfully
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Lazy initialize transporter with error handling
    if (!transporter) {
      try {
        transporter = await initializeTransporter();
      } catch (initError) {
        console.error('[Email Service] Failed to initialize email transporter:', initError);
        console.error('[Email Service] This will cause email sending to fail');
        
        // In production, we should not fail silently but return false to indicate failure
        if (process.env.NODE_ENV === 'production') {
          console.error('[Email Service] PRODUCTION: Email transporter initialization failed');
          return false;
        }
        
        throw initError;
      }
    }
    
    // For Gmail OAuth2, use the authenticated email address directly to avoid deliverability issues
    let defaultFrom = process.env.GOOGLE_USER_EMAIL || 'team@barefootbay.com';
    
    // For production, use the Gmail address directly to ensure deliverability
    // This prevents SPF/DKIM authentication issues that can cause emails to be marked as spam
    if (process.env.NODE_ENV === 'production') {
      defaultFrom = process.env.GOOGLE_USER_EMAIL || 'team@barefootbay.com';
    } else if (process.env.EMAIL_FROM) {
      defaultFrom = process.env.EMAIL_FROM;
    }
    
    // Set from address and additional headers to improve deliverability
    const emailOptions = {
      ...options,
      from: options.from || defaultFrom,
      // Add headers to improve deliverability and prevent Gmail filtering
      headers: {
        'X-Mailer': 'Barefoot Bay Community Platform',
        'X-Priority': '3',
        'Return-Path': defaultFrom,
        'Reply-To': defaultFrom,
        'List-Unsubscribe': '<mailto:unsubscribe@barefootbay.com>',
        'Message-ID': `<${Date.now()}-${Math.random().toString(36)}@barefootbay.com>`,
        'X-Entity-ID': 'barefoot-bay-community',
        'X-Auto-Response-Suppress': 'All',
        'Precedence': 'bulk',
        ...options.headers
      }
    };
    
    // Log email sending attempt for debugging
    console.log(`Sending email to: ${emailOptions.to}`);
    console.log(`Email subject: ${emailOptions.subject}`);
    console.log(`Email from: ${emailOptions.from}`);
    
    try {
      // Send the email with the primary transporter
      const info = await transporter.sendMail(emailOptions);
      
      // Enhanced logging for production troubleshooting
      console.log('✅ Email sent successfully');
      console.log('   Message ID:', info.messageId);
      console.log('   Response:', info.response);
      console.log('   Envelope:', JSON.stringify(info.envelope));
      console.log('   Accepted recipients:', info.accepted);
      console.log('   Rejected recipients:', info.rejected);
      
      // Log any delivery warnings
      if (info.pending && info.pending.length > 0) {
        console.warn('⚠️ Email delivery pending for:', info.pending);
      }
      
      // For development, log preview URL if using Ethereal
      if (info.preview) {
        console.log('Preview URL: %s', info.preview);
      }
      
      // Store delivery information for diagnostics
      if (typeof global.lastEmailDelivery === 'undefined') {
        global.lastEmailDelivery = [];
      }
      global.lastEmailDelivery.push({
        to: emailOptions.to,
        subject: emailOptions.subject,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
        timestamp: new Date()
      });
      
      // Keep only last 10 entries
      if (global.lastEmailDelivery.length > 10) {
        global.lastEmailDelivery = global.lastEmailDelivery.slice(-10);
      }
      
      return true;
    } catch (primaryError) {
      console.error('Error sending email with primary method:', primaryError);
      
      // Try alternative email method (Ethereal) if we're in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('Attempting to send with Ethereal fallback for development...');
        try {
          const testAccount = await nodemailer.createTestAccount();
          console.log('Created test account:', testAccount.user);
          
          const etherealTransporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
          
          const fallbackInfo = await etherealTransporter.sendMail(emailOptions);
          console.log('Email sent with Ethereal fallback: %s', fallbackInfo.messageId);
          console.log('Preview URL: %s', nodemailer.getTestMessageUrl(fallbackInfo));
          
          // Store the preview URL for easy access
          if (typeof global.lastEmailPreviewUrl === 'undefined') {
            global.lastEmailPreviewUrl = [];
          }
          global.lastEmailPreviewUrl.push({
            to: options.to,
            subject: options.subject,
            previewUrl: nodemailer.getTestMessageUrl(fallbackInfo),
            sentAt: new Date()
          });
          
          return true;
        } catch (etherealError) {
          console.error('Ethereal fallback also failed:', etherealError);
        }
      }
      
      throw primaryError; // Re-throw the original error
    }
  } catch (error) {
    console.error('Error sending email:', error);
    // Log more detailed error for debugging
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return false;
  }
}

/**
 * Send a contact email to a real estate listing owner
 * @param listingId Listing ID
 * @param listingTitle Listing title
 * @param toEmail Recipient email (listing owner)
 * @param sender User sending the message
 * @param message Message content
 * @returns Promise resolving to true if email was sent successfully
 */
export async function sendListingContactEmail(
  listingId: number,
  listingTitle: string,
  toEmail: string,
  sender: User,
  message: string
): Promise<boolean> {
  try {
    console.log("[Email Debug] Starting sendListingContactEmail with:", {
      listingId,
      listingTitle,
      toEmail,
      senderUsername: sender.username,
      senderEmail: sender.email,
      messageLength: message.length
    });

    // Create email subject
    const subject = `New inquiry about your listing: ${listingTitle}`;
    
    // Create text version of email
    const text = `
You have received a new inquiry about your listing on Barefoot Bay.

Listing: ${listingTitle}
From: ${sender.fullName || sender.username}
Email: ${sender.email || 'No email provided'}

Message:
${message}

---
This message was sent via the Barefoot Bay community website.
Do not reply to this email directly. Instead, contact the sender using the provided email address.
    `.trim();
  
  // Create HTML version of email
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
    }
    .container {
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .header {
      background-color: #4361ee;
      color: white;
      padding: 10px 20px;
      border-radius: 5px 5px 0 0;
      margin: -20px -20px 20px;
    }
    .message {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #4361ee;
      margin: 20px 0;
    }
    .footer {
      font-size: 12px;
      color: #777;
      border-top: 1px solid #ddd;
      margin-top: 20px;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>New Inquiry About Your Listing</h2>
    </div>
    
    <p>You have received a new inquiry about your listing on Barefoot Bay.</p>
    
    <p><strong>Listing:</strong> ${listingTitle}</p>
    <p><strong>From:</strong> ${sender.fullName || sender.username}</p>
    <p><strong>Email:</strong> ${sender.email || 'No email provided'}</p>
    
    <div class="message">
      <p>${message.replace(/\n/g, '<br>')}</p>
    </div>
    
    <div class="footer">
      <p>This message was sent via the Barefoot Bay community website.</p>
      <p>Do not reply to this email directly. Instead, contact the sender using the provided email address.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
    
    console.log("[Email Debug] Preparing to send email with subject:", subject);
    
    // Send the email
    const result = await sendEmail({
      to: toEmail,
      subject,
      text,
      html,
    });
    
    console.log("[Email Debug] Email send result:", result);
    return result;
  } catch (error) {
    console.error("[Email Debug] Error in sendListingContactEmail:", error);
    console.error("[Email Debug] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    return false;
  }
}

/**
 * Send an order status update notification email to a customer
 * @param order Order object containing all order details
 * @param previousStatus The previous status of the order (for noting the change)
 * @param toEmail Customer's email address
 * @returns Promise resolving to true if email was sent successfully
 */
/**
 * Send an order confirmation email for a newly placed order
 * @param order Order object containing all order details
 * @param toEmail Customer's email address
 * @returns Promise resolving to true if email was sent successfully
 */
export async function sendOrderConfirmationEmail(
  order: Order,
  toEmail: string
): Promise<boolean> {
  // Set email content
  const subject = `Order Confirmation #${order.id} - Barefoot Bay`;
  const statusHeading = 'Thank You for Your Order!';
  const statusMessage = 'Your order has been placed successfully and is now being processed.';
  
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
  
  // Get order items with product details
  let orderItems = [];
  let itemsHtmlContent = '';
  let itemsTextContent = '';
  
  try {
    // Get order items from database
    const items = await storage.getOrderItems(order.id);
    
    if (items && items.length > 0) {
      orderItems = items;
      
      // Create HTML content for items
      itemsHtmlContent = `
      <h3>Items Ordered</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Item</th>
            <th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Quantity</th>
            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Price</th>
          </tr>
        </thead>
        <tbody>
      `;
      
      // Create text content for items
      itemsTextContent = `ITEMS ORDERED:\n`;
      
      // Process each item
      for (const item of items) {
        // Get product details
        const product = await storage.getProduct(item.productId);
        
        if (product) {
          // Add to HTML content
          itemsHtmlContent += `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
              <div style="display: flex; align-items: center;">
                ${product.imageUrls && product.imageUrls.length > 0 ? 
                  `<img src="${process.env.PUBLIC_URL || 'http://localhost:3000'}${product.imageUrls[0]}" alt="${product.name}" style="width: 60px; height: 60px; object-fit: cover; margin-right: 10px; border-radius: 4px;">` : 
                  ''}
                <div>
                  <div style="font-weight: bold;">${product.name}</div>
                  <div style="color: #666; font-size: 14px;">${product.category}</div>
                </div>
              </div>
            </td>
            <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
            <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">$${Number(item.price).toFixed(2)}</td>
          </tr>
          `;
          
          // Add to text content
          itemsTextContent += `${product.name} (${product.category}) - Qty: ${item.quantity} - $${Number(item.price).toFixed(2)}\n`;
        }
      }
      
      // Calculate subtotal, discount and total
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const discount = subtotal - Number(order.total);
      
      // Close the table and add summary
      itemsHtmlContent += `
        </tbody>
      </table>
      
      <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <div>Subtotal:</div>
          <div>$${subtotal.toFixed(2)}</div>
        </div>
        ${discount > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #10b981;">
          <div>Discount${order.discountCode ? ` (${order.discountCode})` : ''}:</div>
          <div>-$${discount.toFixed(2)}</div>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
          <div>Total:</div>
          <div>$${Number(order.total).toFixed(2)}</div>
        </div>
      </div>
      `;
      
      // Add summary to text version
      itemsTextContent += `\nSubtotal: $${subtotal.toFixed(2)}\n`;
      if (discount > 0) {
        itemsTextContent += `Discount${order.discountCode ? ` (${order.discountCode})` : ''}: -$${discount.toFixed(2)}\n`;
      }
      itemsTextContent += `Total: $${Number(order.total).toFixed(2)}\n`;
    }
  } catch (error) {
    console.error('Error getting order items for confirmation email:', error);
  }
  
  // Create text version of email
  const text = `
Order Confirmation - Barefoot Bay

${statusHeading}

Order #${order.id}
Date: ${formattedDate}

Dear Customer,

${statusMessage}

ORDER DETAILS:
Order #: ${order.id}
Status: ${order.status}

${itemsTextContent}

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
  
  // Create HTML version of email
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
    }
    .container {
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .header {
      background-color: #4361ee;
      color: white;
      padding: 10px 20px;
      border-radius: 5px 5px 0 0;
      margin: -20px -20px 20px;
    }
    .logo {
      max-width: 120px;
      margin-bottom: 15px;
    }
    .status-box {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #4361ee;
      margin: 20px 0;
    }
    .order-details {
      border: 1px solid #eee;
      border-radius: 5px;
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      font-size: 12px;
      color: #777;
      border-top: 1px solid #ddd;
      margin-top: 20px;
      padding-top: 20px;
    }
    .button {
      display: inline-block;
      background-color: #4361ee;
      color: white;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${statusHeading}</h2>
    </div>
    
    <p>Order #${order.id}</p>
    <p>Date: ${formattedDate}</p>
    
    <p>Dear Customer,</p>
    
    <div class="status-box">
      <p>${statusMessage}</p>
    </div>
    
    <div class="order-details">
      <h3>Order Details</h3>
      <p><strong>Order #:</strong> ${order.id}</p>
      <p><strong>Status:</strong> ${order.status}</p>
      
      ${itemsHtmlContent}
      
      ${formattedAddress ? `
      <h3>Shipping Address</h3>
      <p>${formattedAddress}</p>
      ` : ''}
    </div>
    
    <p>Thank you for shopping with Barefoot Bay!</p>
    
    <p>
      <a href="${process.env.PUBLIC_URL || 'http://localhost:3000'}/store/my-orders" class="button">View Your Orders</a>
    </p>
    
    <div class="footer">
      <p>This is an automated message from Barefoot Bay. Please do not reply to this email.</p>
      <p>For any questions regarding your order, please contact our customer service.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  // Send the email
  return sendEmail({
    to: toEmail,
    subject,
    text,
    html,
  });
}

export async function sendOrderStatusUpdateEmail(
  order: Order,
  previousStatus: string,
  toEmail: string
): Promise<boolean> {
  // Determine subject and header based on order status
  let subject = `Your Order #${order.id} has been updated`;
  let statusHeading = 'Order Status Update';
  let statusMessage = `Your order status has been updated from ${previousStatus} to ${order.status}.`;
  let additionalInfo = '';
  
  // Customize message based on the new status
  switch (order.status) {
    case 'shipped':
      subject = `Your Order #${order.id} has been shipped`;
      statusHeading = 'Your Order Has Been Shipped';
      statusMessage = 'Your order has been shipped and is on its way to you!';
      
      // Add tracking information if available
      if (order.trackingNumber || order.trackingUrl) {
        additionalInfo = 'You can track your package using the following information:';
        
        if (order.trackingNumber) {
          additionalInfo += `\nTracking Number: ${order.trackingNumber}`;
        }
        
        if (order.trackingUrl) {
          additionalInfo += `\nTracking Link: ${order.trackingUrl}`;
        }
      }
      break;
      
    case 'delivered':
      subject = `Your Order #${order.id} has been delivered`;
      statusHeading = 'Your Order Has Been Delivered';
      statusMessage = 'Your order has been delivered. Thank you for shopping with us!';
      break;
      
    case 'processing':
      subject = `Your Order #${order.id} is being processed`;
      statusHeading = 'Your Order Is Being Processed';
      statusMessage = 'We\'re preparing your order for shipment. We\'ll notify you when it\'s on the way!';
      break;
      
    case 'cancelled':
      subject = `Your Order #${order.id} has been cancelled`;
      statusHeading = 'Your Order Has Been Cancelled';
      statusMessage = 'Your order has been cancelled. If you did not request this cancellation, please contact customer service.';
      break;
  }
  
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
  
  // Create text version of email
  const text = `
Order Status Update - Barefoot Bay

${statusHeading}

Order #${order.id}
Date: ${formattedDate}

Dear Customer,

${statusMessage}

${additionalInfo}

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
  
  // Create HTML version of email
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
    }
    .container {
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .header {
      background-color: #4361ee;
      color: white;
      padding: 10px 20px;
      border-radius: 5px 5px 0 0;
      margin: -20px -20px 20px;
    }
    .status-box {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #4361ee;
      margin: 20px 0;
    }
    .tracking-info {
      background-color: #f0f7ff;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .order-details {
      border: 1px solid #eee;
      border-radius: 5px;
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      font-size: 12px;
      color: #777;
      border-top: 1px solid #ddd;
      margin-top: 20px;
      padding-top: 20px;
    }
    .button {
      display: inline-block;
      background-color: #4361ee;
      color: white;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${statusHeading}</h2>
    </div>
    
    <p>Order #${order.id}</p>
    <p>Date: ${formattedDate}</p>
    
    <p>Dear Customer,</p>
    
    <div class="status-box">
      <p>${statusMessage}</p>
    </div>
    
    ${order.trackingNumber || order.trackingUrl ? `
    <div class="tracking-info">
      <h3>Tracking Information</h3>
      ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>` : ''}
      ${order.trackingUrl ? `<p><a href="${order.trackingUrl}" class="button" target="_blank">Track Your Package</a></p>` : ''}
    </div>
    ` : ''}
    
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
  `.trim();
  
  // Send the email
  return sendEmail({
    to: toEmail,
    subject,
    text,
    html,
  });
}