/**
 * Direct Square Service
 * This service makes direct API calls to Square without using the SDK to avoid any caching issues
 */
import fetch from 'node-fetch';

// Always read credentials directly from environment variables
export function getDirectSquareCredentials() {
  console.log('Getting direct Square credentials at', new Date().toISOString());
  
  // Directly read from process.env to avoid any caching issues
  const credentials = {
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    applicationId: process.env.SQUARE_APPLICATION_ID,
    locationId: process.env.SQUARE_LOCATION_ID,
  };
  
  // Log masked credentials for debugging
  console.log(`AccessToken: ${credentials.accessToken ? `${credentials.accessToken.substring(0, 5)}...${credentials.accessToken.substring(credentials.accessToken.length - 4)}` : 'Missing'}`);
  console.log(`ApplicationId: ${credentials.applicationId || 'Missing'}`);
  console.log(`LocationId: ${credentials.locationId || 'Missing'}`);
  
  return credentials;
}

/**
 * Helper function to get a default redirect URL
 */
function getDefaultRedirectUrl(path: string = '/for-sale/payment-complete'): string {
  let baseUrl = '';
  
  // For production, use current deployment domain instead of hardcoded
  if (process.env.NODE_ENV === 'production') {
    if (process.env.REPLIT_DOMAINS) {
      baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
      console.log('Using Replit production domain for redirect:', baseUrl);
    } else {
      baseUrl = 'https://barefootbay.com';
      console.log('Using fallback domain for redirect:', baseUrl);
    }
  }
  // Get hostname from request headers if available (most reliable for development)
  else if (global.currentHostname) {
    baseUrl = `https://${global.currentHostname}`;
    console.log('Using current hostname for redirect:', baseUrl);
  } 
  // Check if PUBLIC_URL is set
  else if (process.env.PUBLIC_URL) {
    baseUrl = process.env.PUBLIC_URL;
    console.log('Using PUBLIC_URL for redirect:', baseUrl);
  } 
  // If running on Replit, construct the URL
  else if (process.env.REPLIT_DEPLOYMENT_ID) {
    baseUrl = `https://${process.env.REPLIT_DEPLOYMENT_ID}-00-y43hx7t2mc3m.janeway.replit.dev`;
    console.log('Using Replit deployment URL for redirect:', baseUrl);
  } 
  // Use fixed Replit URL as fallback for development
  else {
    baseUrl = 'https://10d91268-aa00-4bbf-8cbc-902453f7f73d-00-y43hx7t2mc3m.janeway.replit.dev';
    console.log('Using fixed Replit URL for redirect:', baseUrl);
  }
  
  // Make sure the base URL doesn't end with a slash
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Make sure the path starts with a slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  return `${baseUrl}${path}`;
}

/**
 * Create a payment link directly with Square API
 */
export async function createDirectPaymentLink(
  userId: number,
  amount: number,
  userEmail?: string,
  redirectPath?: string,
  itemName: string = 'For Sale Listing Fee'
) {
  console.log(`Creating direct payment link for user ${userId}, amount ${amount}`);
  console.log(`User email: ${userEmail || 'Not provided'}`);
  console.log(`Redirect path: ${redirectPath || 'Using default'}`);
  
  try {
    // Always get fresh credentials directly from environment variables
    const { accessToken, locationId } = getDirectSquareCredentials();
    
    if (!accessToken || !locationId) {
      throw new Error('Missing required Square credentials (accessToken or locationId)');
    }
    
    // Create unique idempotency key
    const idempotencyKey = `direct_payment_${userId}_${Date.now()}`;
    
    // Create redirect URL
    const redirectUrl = redirectPath ? getDefaultRedirectUrl(redirectPath) : getDefaultRedirectUrl();
    console.log(`Redirect URL: ${redirectUrl}`);
    
    // Call Square API directly with fetch
    const response = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
      method: 'POST',
      headers: {
        'Square-Version': '2023-09-25',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        quick_pay: {
          name: itemName,
          price_money: {
            amount,
            currency: 'USD'
          },
          location_id: locationId
        },
        checkout_options: {
          redirect_url: redirectUrl,
          ask_for_shipping_address: false
        },
        pre_populated_data: {
          buyer_email: userEmail || ''
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Square API error response:', errorText);
      throw new Error(`Square API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    
    if (!data.payment_link || !data.payment_link.url) {
      console.error('Square API response missing payment_link data:', data);
      throw new Error('Invalid response from Square API: Missing payment link data');
    }
    
    const paymentUrl = data.payment_link.url;
    const paymentLinkId = data.payment_link.id;
    
    console.log(`Direct payment link created: ${paymentUrl}`);
    console.log(`Direct payment link ID: ${paymentLinkId}`);
    
    // Check if the URL contains the old merchant ID
    if (paymentUrl.includes('MLKK4WVHYZG77')) {
      console.error('⚠️ ERROR: Generated payment URL still contains old merchant ID (MLKK4WVHYZG77)');
      console.error('Environment variables may be incorrect or there might be a caching issue with the Square API');
      
      // Fix the URL to use correct merchant ID
      const correctMerchantId = process.env.SQUARE_LOCATION_ID;
      console.log(`Attempting to fix URL by replacing old merchant ID with current location ID: ${correctMerchantId}`);
      
      // Replace the old merchant ID with the correct one
      const fixedUrl = paymentUrl.replace('MLKK4WVHYZG77', correctMerchantId || '');
      console.log(`Original URL: ${paymentUrl}`);
      console.log(`Fixed URL: ${fixedUrl}`);
      
      // Use the fixed URL instead
      return {
        url: fixedUrl,
        id: paymentLinkId,
        wasFixed: true
      };
    }
    
    return {
      url: paymentUrl,
      id: paymentLinkId,
      wasFixed: false
    };
  } catch (error) {
    console.error('Error creating direct payment link:', error);
    throw error;
  }
}

/**
 * Create a subscription link directly with Square API
 */
export async function createDirectSubscriptionLink(
  userId: number,
  planType: string = 'monthly',
  userEmail?: string
) {
  console.log(`Creating direct subscription link for user ${userId}, plan ${planType}`);
  
  try {
    // Calculate price based on plan type
    const amount = planType === 'annual' ? 5000 : 500; // $50 for annual, $5 for monthly
    const planName = planType === 'annual' ? 'Annual' : 'Monthly';
    
    // Generate a more unique redirect URL with the plan type and userId
    const redirectPath = `/subscriptions/confirm?userId=${userId}&planType=${planType}&status=success`;
    
    // Use the direct payment link function
    return await createDirectPaymentLink(
      userId,
      amount,
      userEmail,
      redirectPath,
      `${planName} Premium Sponsorship`
    );
  } catch (error) {
    console.error('Error creating direct subscription link:', error);
    throw error;
  }
}