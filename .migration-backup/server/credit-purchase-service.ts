/**
 * Credit Purchase Service - Dedicated service for purchasing credits through Square
 * This separates credit purchasing from listing payments for better reliability
 */

import { randomUUID } from 'crypto';
import { creditService } from './credit-service.js';
import { getEnvironmentRedirectUrl } from './utils/redirect-urls.js';
import { Request } from 'express';
// Legacy function removed - now using centralized redirect utility

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number; // in cents
  description: string;
}

// Available credit packages
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'basic',
    name: 'Basic Package',
    credits: 2,
    price: 1000, // $10.00
    description: '2 credits for listing publications'
  },
  {
    id: 'standard',
    name: 'Standard Package', 
    credits: 5,
    price: 2500, // $25.00
    description: '5 credits for listing publications'
  },
  {
    id: 'premium',
    name: 'Premium Package',
    credits: 10,
    price: 5000, // $50.00
    description: '10 credits for listing publications'
  }
];

/**
 * Create a Square payment link for purchasing credits
 */
export async function createCreditPurchaseLink(req: Request, packageId: string, userId: number, promoCode?: string, redirectPath?: string): Promise<{
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  error?: string;
}> {
  try {
    const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
    if (!creditPackage) {
      return { success: false, error: 'Invalid credit package selected' };
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    
    if (!accessToken || !locationId) {
      return { success: false, error: 'Square payment service not configured - missing credentials' };
    }

    const orderId = randomUUID();
    const checkoutRequestId = randomUUID();

    // Check if promo code is valid and get discount
    let discountAmount = 0;
    let discounts: Array<{
      name: string;
      percentage: string;
      discount_type: string;
    }> = [];
    
    if (promoCode && promoCode.toUpperCase() === 'FREE100') {
      // Apply 100% discount for Free100 code
      discountAmount = creditPackage.price;
      discounts = [
        {
          name: "FREE100 Promo",
          percentage: "100",
          discount_type: "FIXED_PERCENTAGE"
        }
      ];
    }

    // Create the payment link request
    const requestBody = {
      idempotency_key: checkoutRequestId,
      checkout_options: {
        enable_coupon: true, // Enable coupon functionality
        enable_loyalty: false,
        redirect_url: getEnvironmentRedirectUrl(req, `/payment-complete?type=credits&pkg=${packageId}&ord=${orderId}&promo=${promoCode || ''}&redirect=${encodeURIComponent(redirectPath || '/for-sale')}`)
      },

      order: {
        location_id: locationId,
        reference_id: `cr_${userId}_${orderId.substring(0, 20)}`,
        line_items: [
          {
            name: creditPackage.name,
            quantity: "1",
            base_price_money: {
              amount: creditPackage.price,
              currency: "USD"
            },
            note: `${creditPackage.credits} credits`
          }
        ],
        ...(discounts.length > 0 && { discounts })
      }
    };

    console.log('Creating Square payment link for credits:', {
      packageId,
      userId,
      credits: creditPackage.credits,
      price: creditPackage.price / 100,
      locationId,
      hasPromoCode: !!promoCode,
      discountAmount,
      requestBody: JSON.stringify(requestBody, null, 2)
    });

    const response = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-12-18'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Square API error creating credit purchase link:', {
        status: response.status,
        statusText: response.statusText,
        responseData: data,
        requestBody: JSON.stringify(requestBody, null, 2),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken ? '[PRESENT]' : '[MISSING]'}`,
          'Square-Version': '2024-12-18'
        }
      });
      
      const errorDetail = data.errors?.[0]?.detail || data.message || 'Unknown error';
      const errorCode = data.errors?.[0]?.code || 'UNKNOWN_ERROR';
      
      return { 
        success: false, 
        error: `Square API error (${response.status}): ${errorDetail} [${errorCode}]`
      };
    }

    if (data.payment_link?.url) {
      console.log('Credit purchase payment link created successfully:', data.payment_link.url);
      
      // Store the pending credit purchase order in the database for later verification
      try {
        const { db } = await import('./storage.js');
        const { sql } = await import('drizzle-orm');
        
        await db.execute(sql`
          INSERT INTO credit_transactions (
            user_id, transaction_type, credits, description, 
            square_payment_id, order_id, checkout_id, 
            amount, currency, payment_status, created_at
          ) VALUES (
            ${userId}, 'purchase', ${creditPackage.credits}, 
            ${'Pending purchase: ' + creditPackage.name + ' (' + creditPackage.credits + ' credits)'},
            ${orderId}, ${orderId}, ${data.payment_link.id || orderId},
            ${creditPackage.price / 100}, 'USD', 'pending', NOW()
          )
        `);
        
        console.log('Stored pending credit purchase order:', {
          orderId,
          userId,
          packageId,
          credits: creditPackage.credits
        });
      } catch (storageError) {
        console.error('Error storing pending credit purchase order:', storageError);
        // Continue anyway since the payment link was created successfully
      }
      
      return {
        success: true,
        paymentUrl: data.payment_link.url,
        orderId: orderId
      };
    } else {
      console.error('No payment URL returned from Square:', data);
      return { success: false, error: 'Failed to create payment link' };
    }

  } catch (error) {
    console.error('Error creating credit purchase link:', error);
    return { success: false, error: 'Failed to create payment link' };
  }
}

/**
 * Verify payment with Square API to ensure the order was actually paid
 * This is critical for security - we must verify with Square before awarding credits
 * SECURITY: This function fails CLOSED - if we can't verify, we don't award credits
 */
async function verifyPaymentWithSquare(orderId: string, userId: number, checkoutId?: string, squareOrderId?: string): Promise<{
  verified: boolean;
  squareOrderId?: string;
  paymentStatus?: string;
  error?: string;
}> {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  
  if (!accessToken || !locationId) {
    console.error('Square credentials not configured for payment verification');
    return { verified: false, error: 'Payment service not configured' };
  }
  
  try {
    // Method 0 (BEST): If we have the Square orderId from the redirect URL, fetch it directly
    // This is the most reliable method as Square includes this in the redirect
    if (squareOrderId) {
      console.log('Verifying payment using Square Order ID directly:', squareOrderId);
      
      const orderResponse = await fetch(`https://connect.squareup.com/v2/orders/${squareOrderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-12-18'
        }
      });
      
      if (orderResponse.ok) {
        const orderData = await orderResponse.json();
        const order = orderData.order;
        
        console.log('Direct order lookup result:', {
          orderId: order?.id,
          state: order?.state,
          totalMoney: order?.total_money,
          netAmountDueMoney: order?.net_amount_due_money
        });
        
        // For $0 orders (promo codes), state might be OPEN but net_amount_due is 0
        // COMPLETED means payment was processed, but for $0 orders it may stay OPEN
        if (order?.state === 'COMPLETED') {
          console.log('Order verified as COMPLETED');
          return {
            verified: true,
            squareOrderId: order.id,
            paymentStatus: 'completed'
          };
        }
        
        // Check for $0 orders (promo code orders) - they may be in OPEN state but fully paid
        if (order?.state === 'OPEN' && order?.net_amount_due_money?.amount === 0) {
          console.log('Order verified as $0 promo order (OPEN with net_amount_due = 0)');
          return {
            verified: true,
            squareOrderId: order.id,
            paymentStatus: 'completed'
          };
        }
        
        console.log('Order found but not verified - state:', order?.state, 'net_amount_due:', order?.net_amount_due_money?.amount);
      } else {
        console.log('Direct order lookup failed:', orderResponse.status);
      }
    }
    
    // Method 1: If we have a checkout_id (payment link ID), use the Payment Links API
    if (checkoutId) {
      console.log('Verifying payment using Payment Link ID:', checkoutId);
      
      const paymentLinkResponse = await fetch(`https://connect.squareup.com/v2/online-checkout/payment-links/${checkoutId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-12-18'
        }
      });
      
      if (paymentLinkResponse.ok) {
        const paymentLinkData = await paymentLinkResponse.json();
        const paymentLink = paymentLinkData.payment_link;
        
        console.log('Payment link status:', {
          id: paymentLink?.id,
          orderId: paymentLink?.order_id,
          createdAt: paymentLink?.created_at
        });
        
        // If the payment link has an order_id, retrieve that order to check its status
        if (paymentLink?.order_id) {
          const orderResponse = await fetch(`https://connect.squareup.com/v2/orders/${paymentLink.order_id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Square-Version': '2024-12-18'
            }
          });
          
          if (orderResponse.ok) {
            const orderData = await orderResponse.json();
            const order = orderData.order;
            
            console.log('Order from payment link:', {
              orderId: order?.id,
              state: order?.state,
              totalMoney: order?.total_money,
              netAmountDueMoney: order?.net_amount_due_money
            });
            
            if (order?.state === 'COMPLETED') {
              return {
                verified: true,
                squareOrderId: order.id,
                paymentStatus: 'completed'
              };
            }
            
            // Handle $0 orders from payment link
            if (order?.state === 'OPEN' && order?.net_amount_due_money?.amount === 0) {
              console.log('Payment link order verified as $0 promo order');
              return {
                verified: true,
                squareOrderId: order.id,
                paymentStatus: 'completed'
              };
            }
          }
        }
      } else {
        console.log('Payment link lookup failed:', paymentLinkResponse.status);
      }
    }
    
    // Method 2: Search orders by reference_id as fallback
    const referenceId = `cr_${userId}_${orderId.substring(0, 20)}`;
    console.log('Searching Square orders with reference_id:', referenceId);
    
    const searchResponse = await fetch('https://connect.squareup.com/v2/orders/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-12-18'
      },
      body: JSON.stringify({
        location_ids: [locationId],
        query: {
          filter: {
            state_filter: {
              states: ['COMPLETED', 'OPEN'] // Include OPEN for $0 orders
            }
          },
          sort: {
            sort_field: 'CREATED_AT',
            sort_order: 'DESC'
          }
        },
        return_entries: false,
        limit: 20
      })
    });
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('Square search returned', searchData.orders?.length || 0, 'orders');
      
      // Look for an order with matching reference_id
      if (searchData.orders && searchData.orders.length > 0) {
        for (const order of searchData.orders) {
          if (order.reference_id === referenceId) {
            if (order.state === 'COMPLETED') {
              console.log('Found matching Square order by reference_id:', order.id);
              return {
                verified: true,
                squareOrderId: order.id,
                paymentStatus: 'completed'
              };
            }
            // Handle $0 orders
            if (order.state === 'OPEN' && order.net_amount_due_money?.amount === 0) {
              console.log('Found matching $0 Square order by reference_id:', order.id);
              return {
                verified: true,
                squareOrderId: order.id,
                paymentStatus: 'completed'
              };
            }
          }
        }
      }
    }
    
    // Order not found - payment may not have completed
    console.log('Order not found in Square completed orders');
    return { 
      verified: false, 
      error: 'Payment not yet confirmed. Please wait a moment and try again, or contact support if you were charged.' 
    };
    
  } catch (error) {
    console.error('Error verifying payment with Square:', error);
    // SECURITY: Fail closed - don't assume payment completed
    return { verified: false, error: 'Unable to verify payment. Please try again or contact support.' };
  }
}

/**
 * Verify and process a completed credit purchase
 */
export async function verifyCreditPurchase(
  orderId: string, 
  packageId: string, 
  userId: number,
  squareOrderId?: string
): Promise<{
  success: boolean;
  credits?: number;
  transactionId?: number;
  error?: string;
}> {
  try {
    console.log('Looking for credit package with ID:', packageId);
    console.log('Available packages:', CREDIT_PACKAGES.map(p => ({ id: p.id, credits: p.credits })));
    
    // Handle both old format (credits_5) and new format (basic)
    let creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
    
    // If not found, try mapping old format to new format
    if (!creditPackage) {
      const creditMap: Record<string, string> = {
        'credits_2': 'basic',
        'credits_5': 'standard', 
        'credits_10': 'premium'
      };
      
      const mappedId = creditMap[packageId];
      if (mappedId) {
        creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === mappedId);
        console.log(`Mapped old package ID ${packageId} to ${mappedId}`);
      }
    }
    
    if (!creditPackage) {
      console.log('No matching credit package found for:', packageId);
      return { success: false, error: `Invalid credit package: ${packageId}` };
    }
    
    console.log('Found credit package:', creditPackage);

    // Check if we already processed this order
    const existingTransaction = await checkExistingCreditTransaction(orderId);
    if (existingTransaction) {
      console.log('Credit purchase already processed:', orderId);
      
      // If it was already completed, return the existing transaction
      if (existingTransaction.payment_status === 'completed') {
        return {
          success: true,
          credits: existingTransaction.credits as number,
          transactionId: existingTransaction.id as number
        };
      }
      
      // SECURITY: Before awarding credits, verify the payment with Square
      console.log('Verifying payment with Square before awarding credits...', { orderId, userId, squareOrderId });
      const checkoutId = existingTransaction.checkout_id as string | undefined;
      const squareVerification = await verifyPaymentWithSquare(orderId, userId, checkoutId, squareOrderId);
      
      if (!squareVerification.verified) {
        console.log('Square payment verification failed:', squareVerification.error);
        return {
          success: false,
          error: squareVerification.error || 'Payment could not be verified with Square'
        };
      }
      
      console.log('Square payment verified successfully:', squareVerification);
      
      // If it was pending, update it to completed and award credits
      // Use atomic UPDATE with WHERE clause to prevent race condition
      console.log('Updating pending credit purchase to completed:', orderId);
      
      const { db } = await import('./storage.js');
      const { sql } = await import('drizzle-orm');
      
      // Atomic update: only update if still pending (prevents double-credit race condition)
      const updateResult = await db.execute(sql`
        UPDATE credit_transactions 
        SET payment_status = 'completed', 
            square_payment_id = ${squareVerification.squareOrderId || orderId},
            description = ${'Verified: ' + creditPackage.name + ' (' + creditPackage.credits + ' credits)'}
        WHERE order_id = ${orderId} 
          AND user_id = ${userId}
          AND payment_status = 'pending'
        RETURNING id
      `);
      
      // Check if we actually updated the row (it was still pending)
      if (updateResult.rows.length === 0) {
        console.log('Transaction was already completed by another process (webhook?), skipping credit award');
        // Another process (likely webhook) already completed it, just return success
        return {
          success: true,
          credits: creditPackage.credits,
          transactionId: existingTransaction.id as number
        };
      }
      
      // We successfully claimed the transaction, now award credits
      await db.execute(sql`
        INSERT INTO user_credits (user_id, credits, created_at, updated_at)
        VALUES (${userId}, ${creditPackage.credits}, NOW(), NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          credits = user_credits.credits + ${creditPackage.credits},
          updated_at = NOW()
      `);
      
      console.log('✅ Credit purchase verified with Square and credits awarded:', {
        transactionId: existingTransaction.id,
        userId,
        credits: creditPackage.credits,
        squareOrderId: squareVerification.squareOrderId
      });
      
      return {
        success: true,
        credits: creditPackage.credits,
        transactionId: existingTransaction.id as number
      };
    }

    // No existing transaction - this is unexpected but we still need to verify with Square
    // SECURITY: Before awarding credits, verify the payment with Square
    console.log('No existing transaction found, verifying payment with Square...');
    const squareVerification = await verifyPaymentWithSquare(orderId, userId);
    
    if (!squareVerification.verified) {
      console.log('Square payment verification failed (new transaction):', squareVerification.error);
      return {
        success: false,
        error: squareVerification.error || 'Payment could not be verified with Square'
      };
    }
    
    console.log('Square payment verified for new transaction:', squareVerification);

    const { db } = await import('./storage.js');
    const { sql } = await import('drizzle-orm');
    
    const transactionResult = await db.execute(sql`
      INSERT INTO credit_transactions (
        user_id, transaction_type, credits, description, 
        square_payment_id, order_id, checkout_id, 
        amount, currency, payment_status, created_at
      ) VALUES (
        ${userId}, 'purchase', ${creditPackage.credits}, 
        ${'Verified: ' + creditPackage.name + ' (' + creditPackage.credits + ' credits)'},
        ${squareVerification.squareOrderId || orderId}, ${orderId}, ${orderId},
        ${creditPackage.price / 100}, 'USD', 'completed', NOW()
      ) RETURNING id
    `);
    
    const transactionId = transactionResult.rows[0]?.id as number;

    // Update user's credit balance in user_credits table
    await db.execute(sql`
      INSERT INTO user_credits (user_id, credits, created_at, updated_at)
      VALUES (${userId}, ${creditPackage.credits}, NOW(), NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        credits = user_credits.credits + ${creditPackage.credits},
        updated_at = NOW()
    `);

    console.log('✅ Credit purchase verified with Square and completed:', {
      transactionId,
      userId,
      credits: creditPackage.credits,
      squareOrderId: squareVerification.squareOrderId
    });

    return {
      success: true,
      credits: creditPackage.credits,
      transactionId: transactionId as number
    };

  } catch (error) {
    console.error('Error verifying credit purchase:', error);
    return { success: false, error: 'Failed to process credit purchase' };
  }
}

/**
 * Check if a credit transaction already exists for this order
 */
export async function checkExistingCreditTransaction(orderId: string) {
  try {
    const { db } = await import('./storage.js');
    const { sql } = await import('drizzle-orm');
    
    const result = await db.execute(sql`
      SELECT * FROM credit_transactions 
      WHERE order_id = ${orderId} 
      AND transaction_type = 'purchase' 
      LIMIT 1
    `);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error checking existing credit transaction:', error);
    return null;
  }
}

/**
 * Get user's current credit balance
 */
export async function getUserCreditBalance(userId: number): Promise<number> {
  try {
    return await creditService.getUserCredits(userId);
  } catch (error) {
    console.error('Error getting user credit balance:', error);
    return 0;
  }
}