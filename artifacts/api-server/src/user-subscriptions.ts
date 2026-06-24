import { storage } from './storage';
import { getSquareClient, SubscriptionPlans, SubscriptionPlanDetails } from './square-client';
import Stripe from 'stripe';

// Initialize Stripe if we have a key
const stripe = process.env.STRIPE_SECRET_KEY ? 
  new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }) : 
  null;

/**
 * Subscription plans for user memberships
 */
export const MEMBERSHIP_PLANS = {
  MONTHLY: 'monthly',
  ANNUAL: 'annual'
};

export interface MembershipSubscriptionResult {
  success: boolean;
  message?: string;
  subscriptionId?: string;
  squareCustomerId?: string;
  subscriptionType?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  error?: any;
}

/**
 * Create a membership subscription for a user
 * @param userId The ID of the user creating the subscription
 * @param planType The type of subscription plan (MONTHLY, ANNUAL)
 * @param options Optional parameters for creating the subscription
 * @returns The created subscription details
 */
export async function createMembershipSubscription(
  userId: number,
  planType: string,
  options?: { 
    orderId?: number;       // ID of the related order, if this is from a store purchase
    direct?: boolean;       // If true, create subscription directly without Square API
    overrideExisting?: boolean; // If true, will replace existing subscription if present
    verified?: boolean;     // If true, payment has already been verified (typically from webhook)
    squareClient?: any;     // Square client instance
    sponsoredBy?: number;   // User ID of admin who sponsored this membership
    sponsorshipReason?: string; // Reason for sponsorship
  }
): Promise<MembershipSubscriptionResult> {
  console.log(`[SPONSORED MEMBERSHIP] Creating ${planType} subscription for user ${userId}, direct: ${options?.direct}`);
  
  try {
    // Verify the user exists
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    console.log(`[SPONSORED MEMBERSHIP] Found user: ${user.username}, current role: ${user.role}, direct flag: ${options?.direct}`);
    
    // Check if user already has an active subscription and we're not overriding
    if (user.subscriptionId && user.subscriptionStatus === 'active' && !options?.overrideExisting) {
      console.log(`User ${userId} already has an active subscription: ${user.subscriptionId}`);
      return {
        success: false,
        message: "User already has an active subscription",
        subscriptionId: user.subscriptionId,
        subscriptionType: user.subscriptionType,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate
      };
    }
    
    // If the subscription is cancelled or expired, treat it as a new subscription
    if (user.subscriptionStatus === 'cancelled' || user.subscriptionStatus === 'expired') {
      console.log(`User ${userId} has a ${user.subscriptionStatus} subscription, allowing resubscription`);
      // We'll override the existing subscription data
      options = { ...options, overrideExisting: true };
    }
    
    // Generate subscription ID for direct creation
    let subscriptionId = user.subscriptionId;
    let squareCustomerId = user.squareCustomerId;
    
    // CRITICAL: Check direct flag BEFORE any Square operations
    if (!options?.direct) {
      console.log(`[SPONSORED MEMBERSHIP] Using Square payment processing (direct=false)`);
      // Get Square client
      const squareClient = getSquareClient();
      if (!squareClient) {
        throw new Error("Square client not available");
      }
      
      // Make sure user has a Square customer ID, create one if they don't
      if (!squareCustomerId) {
        // Create a Square customer for this user
        const customer = await squareClient.createCustomer(userId, user.email);
        squareCustomerId = customer.id;
        
        // Update the user with their Square customer ID
        await storage.updateUser(userId, {
          squareCustomerId
        });
      }
      
      // Map our plan types to Square subscription plans
      const subscriptionPlan = planType === MEMBERSHIP_PLANS.MONTHLY 
        ? SubscriptionPlans.MONTHLY
        : SubscriptionPlans.ANNUAL;
      
      // Create a subscription with Square
      const subscriptionResult = await squareClient.createSubscription(
        squareCustomerId,
        subscriptionPlan
      );
      
      if (!subscriptionResult.id) {
        throw new Error("Failed to create subscription");
      }
      
      subscriptionId = subscriptionResult.id;
    } else {
      console.log(`[SPONSORED MEMBERSHIP] Bypassing Square - creating direct local subscription`);
      // For direct creation, generate a local subscription ID if needed
      if (!subscriptionId || options?.overrideExisting) {
        const date = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
        subscriptionId = `sponsored_${userId}_${date}`;
        console.log(`[SPONSORED MEMBERSHIP] Generated new subscription ID: ${subscriptionId}`);
      }
      console.log(`[SPONSORED MEMBERSHIP] Creating direct subscription with ID: ${subscriptionId} for user ${userId}`);
    }
    
    // Calculate end date based on plan type
    const startDate = new Date();
    const endDate = new Date();
    if (planType === MEMBERSHIP_PLANS.MONTHLY) {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    // Save the current role and update the user with subscription information
    const originalRole = user.role;
    console.log(`Upgrading user ${userId} from role '${originalRole}' to 'paid'`);
    
    await storage.updateUser(userId, {
      role: 'paid', // Upgrade user to paid role
      previousRole: originalRole, // Store the previous role for restoration
      subscriptionId,
      subscriptionType: planType,
      subscriptionStatus: 'active',
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      updatedAt: new Date()
    });
    
    // Log when we're creating a subscription from an order
    if (options?.orderId) {
      console.log(`Created subscription ${subscriptionId} for user ${userId} from order ${options.orderId}`);
    }
    
    return {
      success: true,
      message: "Subscription created successfully",
      subscriptionId,
      squareCustomerId,
      subscriptionType: planType,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate
    };
  } catch (error) {
    console.error("Error creating membership subscription:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      error
    };
  }
}

/**
 * Cancel a membership subscription
 * @param userId The ID of the user cancelling the subscription
 * @returns The result of the cancellation
 */
export async function cancelMembershipSubscription(
  userId: number
): Promise<MembershipSubscriptionResult> {
  console.log(`Cancelling membership subscription for user ${userId}`);
  
  try {
    // Verify the user exists
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Check if user has an active subscription
    if (!user.subscriptionId) {
      throw new Error("No active subscription found");
    }
    
    // Check if this is a mock subscription (starts with 'mock_'), a local subscription (starts with 'local_subscription'), or a sponsored subscription (starts with 'sponsored_')
    const isMockSubscription = user.subscriptionId.startsWith('mock_');
    const isLocalSubscription = user.subscriptionId.startsWith('local_subscription');
    const isSponsoredSubscription = user.subscriptionId.startsWith('sponsored_');
    
    // Only try to cancel with Square if it's NOT a mock, local, or sponsored subscription
    if (!isMockSubscription && !isLocalSubscription && !isSponsoredSubscription) {
      // Get Square client
      const squareClient = getSquareClient();
      if (!squareClient) {
        throw new Error("Square client not available");
      }
      
      // Cancel the subscription with Square
      await squareClient.cancelSubscription(user.subscriptionId);
    } else {
      const subscriptionType = isMockSubscription ? 'mock' : (isLocalSubscription ? 'local' : 'sponsored');
      console.log(`Detected ${subscriptionType} subscription ID: ${user.subscriptionId}, skipping Square API call and updating database directly`);
    }
    
    // Update the user to reflect cancelled subscription
    await storage.updateUser(userId, {
      // Keep role as paid until end of subscription period
      subscriptionStatus: 'cancelled',
      updatedAt: new Date()
    });
    
    return {
      success: true,
      message: "Subscription cancelled successfully. Access will continue until the end of the current billing period.",
      subscriptionId: user.subscriptionId,
      squareCustomerId: user.squareCustomerId,
      subscriptionType: user.subscriptionType,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate
    };
  } catch (error) {
    console.error("Error cancelling membership subscription:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      error
    };
  }
}

/**
 * Activate a membership subscription after successful payment
 * @param userId The ID of the user activating the subscription
 * @param planType The type of subscription plan (MONTHLY, ANNUAL)
 * @returns The activated subscription details
 */
export async function activateMembershipSubscription(
  userId: number,
  planType: string
): Promise<MembershipSubscriptionResult> {
  console.log(`Activating ${planType} membership subscription for user ${userId}`);
  
  try {
    // Create a direct subscription with verification flag
    return await createMembershipSubscription(userId, planType, {
      direct: true,
      verified: true,
      overrideExisting: true
    });
  } catch (error) {
    console.error("Error activating membership subscription:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      error
    };
  }
}

/**
 * Handle subscription renewal for a user
 * @param userId The user ID
 * @param subscriptionId The subscription ID from Square
 * @returns Success status and updated subscription info
 */
export async function renewMembershipSubscription(
  userId: number,
  subscriptionId: string
): Promise<MembershipSubscriptionResult> {
  console.log(`Renewing membership subscription ${subscriptionId} for user ${userId}`);
  
  try {
    // Verify the user exists
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Verify subscription matches
    if (user.subscriptionId !== subscriptionId) {
      throw new Error("Subscription ID mismatch");
    }
    
    // Calculate new end date based on subscription type
    const newEndDate = new Date();
    if (user.subscriptionType === MEMBERSHIP_PLANS.MONTHLY) {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    }
    
    // Update the user with new subscription information
    await storage.updateUser(userId, {
      role: 'paid', // Ensure role is set to paid
      subscriptionStatus: 'active',
      subscriptionEndDate: newEndDate,
      updatedAt: new Date()
    });
    
    return {
      success: true,
      message: "Subscription renewed successfully",
      subscriptionId,
      squareCustomerId: user.squareCustomerId,
      subscriptionType: user.subscriptionType,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: newEndDate
    };
  } catch (error) {
    console.error("Error renewing membership subscription:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      error
    };
  }
}

/**
 * Get a user's membership subscription details
 * @param userId The ID of the user
 * @returns The subscription details
 */
export async function getMembershipSubscription(
  userId: number
): Promise<MembershipSubscriptionResult> {
  console.log(`Getting membership subscription for user ${userId}`);
  
  try {
    // Verify the user exists
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`User with ID ${userId} not found`);
      throw new Error("User not found");
    }
    
    console.log('User subscription data:', {
      subscriptionId: user.subscriptionId,
      subscriptionType: user.subscriptionType,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate
    });
    
    // If user has no subscription, return empty result
    if (!user.subscriptionId) {
      return {
        success: false,
        message: "No subscription found for user"
      };
    }
    
    // Get the Square client if available
    const squareClient = getSquareClient();
    
    // If we have a Square client, check the subscription status with Square
    if (squareClient && user.subscriptionId && user.subscriptionId !== '') {
      try {
        const subscriptionStatus = await squareClient.getSubscription(user.subscriptionId);
        
        // If subscription is no longer active with Square but shows active in our db,
        // update our records and downgrade user if their subscription period is over
        if (subscriptionStatus.status !== 'ACTIVE' && user.subscriptionStatus === 'active') {
          // If current date is past the end date, downgrade user
          if (new Date() > user.subscriptionEndDate) {
            // Restore user to their previous role or default to 'registered'
            const restoredRole = user.previousRole || 'registered';
            console.log(`Downgrading user ${userId} from 'paid' back to '${restoredRole}'`);
            
            await storage.updateUser(userId, {
              role: restoredRole, // Restore to previous role
              subscriptionStatus: 'expired',
              previousRole: null, // Clear the stored previous role
              updatedAt: new Date()
            });
          } else {
            // Otherwise just mark as cancelled but keep access until end date
            await storage.updateUser(userId, {
              subscriptionStatus: 'cancelled',
              updatedAt: new Date()
            });
          }
        }
      } catch (error) {
        console.warn("Failed to verify subscription with Square:", error);
        // Continue with local data if Square API fails
      }
    } else if (user.subscriptionId && stripe) {
      // Check with Stripe if available
      try {
        const subscription = await stripe.subscriptions.retrieve(user.subscriptionId);
        
        // If subscription is no longer active with Stripe but shows active in our db,
        // update our records and downgrade user if their subscription period is over
        if (subscription.status !== 'active' && user.subscriptionStatus === 'active') {
          // If current date is past the end date, downgrade user
          if (new Date() > user.subscriptionEndDate) {
            // Restore user to their previous role or default to 'registered'
            const restoredRole = user.previousRole || 'registered';
            console.log(`Downgrading user ${userId} from 'paid' back to '${restoredRole}'`);
            
            await storage.updateUser(userId, {
              role: restoredRole, // Restore to previous role
              subscriptionStatus: 'expired',
              previousRole: null, // Clear the stored previous role
              updatedAt: new Date()
            });
          } else {
            // Otherwise just mark as cancelled but keep access until end date
            await storage.updateUser(userId, {
              subscriptionStatus: 'cancelled',
              updatedAt: new Date()
            });
          }
        }
      } catch (error) {
        console.warn("Failed to verify subscription with Stripe:", error);
        // Continue with local data if Stripe API fails
      }
    } else {
      // No payment provider available, use local data
      console.log("Using local subscription data (no payment provider available)");
    }
    
    // Return subscription details from user record
    return {
      success: true,
      message: "Subscription found",
      subscriptionId: user.subscriptionId,
      squareCustomerId: user.squareCustomerId,
      subscriptionType: user.subscriptionType,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate
    };
  } catch (error) {
    console.error("Error getting membership subscription:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      error
    };
  }
}

/**
 * Process webhook notifications from Square for subscription-related events
 * @param event The webhook event data from Square
 * @returns Success/failure result
 */
/**
 * Handle Square webhook events for payments and subscriptions
 * @param event The webhook event data from Square
 * @param squareClient The Square client instance
 * @returns Success/failure result
 */
export async function handleSquareWebhook(
  event: any, 
  squareClient: any
): Promise<{ success: boolean, message: string }> {
  console.log(`Processing Square webhook event type: ${event.type}`);
  
  try {
    // Handle payment-related events (for subscription payments)
    if (event.type.startsWith('payment.')) {
      const paymentId = event.data?.id;
      if (!paymentId) {
        return { success: false, message: "No payment ID in event data" };
      }
      
      // Get payment details to extract the note (which should contain userId and planType)
      const paymentDetails = await squareClient.retrievePayment(paymentId);
      
      if (!paymentDetails || !paymentDetails.note) {
        return { success: false, message: "Could not retrieve payment details or note" };
      }
      
      // Extract user ID and plan type from the note
      // Note format: "User ID: 123, Plan: monthly"
      const userIdMatch = paymentDetails.note.match(/User ID: (\d+)/);
      const planTypeMatch = paymentDetails.note.match(/Plan: (\w+)/);
      
      if (!userIdMatch || !planTypeMatch) {
        return { success: false, message: "Could not extract user ID or plan type from payment note" };
      }
      
      const userId = parseInt(userIdMatch[1]);
      const planType = planTypeMatch[1];
      
      // Verify the user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return { success: false, message: "User not found" };
      }
      
      // If payment is successful, create/update the subscription
      if (event.type === 'payment.updated' && paymentDetails.status === 'COMPLETED') {
        // Create a subscription for the user
        const result = await createMembershipSubscription(
          userId,
          planType,
          { verified: true, squareClient, overrideExisting: true }
        );
        
        return {
          success: result.success,
          message: result.success 
            ? `Subscription created for user ${userId} with plan ${planType}`
            : `Failed to create subscription: ${result.message}`
        };
      }
    }
    
    // Handle subscription-related events from Square
    if (event.type.startsWith('subscription.')) {
      const subscriptionId = event.data?.id;
      if (!subscriptionId) {
        return { success: false, message: "No subscription ID in event data" };
      }
      
      // Find user with this subscription
      const users = await storage.getUsersBySubscriptionId(subscriptionId);
      if (!users || users.length === 0) {
        return { success: false, message: "No user found with this subscription ID" };
      }
      
      const user = users[0];
      
      // Handle different types of events
      switch (event.type) {
        case 'subscription.created':
          // This is handled by our createMembershipSubscription function
          return { success: true, message: "Subscription creation event received" };
          
        case 'subscription.updated':
          // Update subscription status based on the event
          const status = event.data?.status?.toLowerCase();
          if (status) {
            if (status === 'active') {
              await storage.updateUser(user.id, {
                role: 'paid',
                subscriptionStatus: 'active',
                updatedAt: new Date()
              });
            } else if (status === 'canceled' || status === 'cancelled') {
              // If subscription is cancelled, keep access until end date
              await storage.updateUser(user.id, {
                subscriptionStatus: 'cancelled',
                updatedAt: new Date()
              });
            } else if (status === 'paused') {
              await storage.updateUser(user.id, {
                subscriptionStatus: 'paused',
                updatedAt: new Date()
              });
            }
          }
          return { success: true, message: "Subscription update event processed" };
          
        case 'subscription.renewed':
          // Renew the subscription
          await renewMembershipSubscription(user.id, subscriptionId);
          return { success: true, message: "Subscription renewal event processed" };
          
        case 'subscription.expired':
        case 'subscription.canceled':
        // Restore user to their previous role or default to 'registered'
        const restoredRole = user.previousRole || 'registered';
        
        await storage.updateUser(user.id, {
          role: restoredRole, // Restore to previous role
          subscriptionStatus: 'expired',
          previousRole: null, // Clear the stored previous role
          updatedAt: new Date()
        });
        console.log(`Webhook: Downgraded user ${user.id} from paid to ${restoredRole} due to ${event.type}`);
        return { success: true, message: "Subscription expiration/cancellation event processed" };
        
      default:
        console.log(`Unhandled subscription event type: ${event.type}`);
        return { success: true, message: "Unhandled subscription event type" };
      }
    }
  } catch (error) {
    console.error("Error processing subscription webhook:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Update a user's Square customer ID
 * @param userId User ID to update
 * @param customerId Square customer ID
 */
export async function updateSquareCustomerId(
  userId: number,
  customerId: string
): Promise<boolean> {
  try {
    await storage.updateUser(userId, {
      squareCustomerId: customerId,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error("Error updating Square customer ID:", error);
    return false;
  }
}

/**
 * Update a user's Square subscription info
 * @param userId User ID to update
 * @param info Object containing customer ID and subscription ID
 * @param planType The subscription plan type (monthly, annual)
 */
export async function updateUserSquareInfo(
  userId: number,
  info: {
    customerId: string;
    subscriptionId: string;
  },
  planType: string = 'monthly'
): Promise<boolean> {
  try {
    // Get current date
    const startDate = new Date();
    
    // Calculate end date based on plan type
    const endDate = new Date();
    if (planType === MEMBERSHIP_PLANS.MONTHLY) {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (planType === MEMBERSHIP_PLANS.ANNUAL) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      // Default to monthly if plan type is unknown
      endDate.setMonth(endDate.getMonth() + 1);
    }
    
    // Update user with subscription info and upgrade to paid role
    await storage.updateUser(userId, {
      role: 'paid', // Upgrade user role to paid
      squareCustomerId: info.customerId,
      subscriptionId: info.subscriptionId,
      subscriptionType: planType,
      subscriptionStatus: 'active',
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error("Error updating user Square info:", error);
    return false;
  }
}

// Keep these aliases for backward compatibility
export const updateStripeCustomerId = updateSquareCustomerId;
export const updateUserStripeInfo = (userId: number, info: { customerId: string; subscriptionId: string; }) => 
  updateUserSquareInfo(userId, info);

/**
 * Get the appropriate role to restore when a subscription expires
 * Special handling for admin users to ensure they get their admin role back
 * @param userId User ID
 * @param username Username
 * @param hasBadge Whether the user has a badge (optional)
 * @returns The role to restore
 */
export function getRoleToRestore(userId: number, username: string, hasBadge?: boolean | null): string {
  // Note: Removed notes parameter extraction since it's not used consistently
  
  // Special handling for admin (Michael)
  if (userId === 6 || username === 'michael') {
    console.log(`Special handling: Restoring admin role for user ${username} (${userId})`);
    return 'admin';
  }
  
  // Handle badge holders - they should go back to badge_holder role not registered
  if (hasBadge) {
    console.log(`User ${username} (${userId}) has a badge, restoring to badge_holder role`);
    return 'badge_holder';
  }
  
  // Default role for regular users who had a subscription
  return 'registered';
}

/**
 * Check and update expired subscriptions
 * This should be run on a regular schedule (e.g., daily cron job)
 */
export async function updateExpiredSubscriptions(): Promise<{ success: boolean, count: number }> {
  console.log("Checking for expired subscriptions...");
  
  try {
    const now = new Date();
    
    // Find users with expired subscriptions
    const expiredUsers = await storage.getUsersWithExpiredSubscriptions(now);
    
    console.log(`Found ${expiredUsers.length} users with expired subscriptions`);
    
    // Update each expired user's role
    let updatedCount = 0;
    for (const user of expiredUsers) {
      // Only update if subscription status isn't already expired
      if (user.subscriptionStatus !== 'expired') {
        // Determine what role to restore to
        const restoredRole = getRoleToRestore(user.id, user.username, user.hasMembershipBadge);
        
        await storage.updateUser(user.id, {
          role: restoredRole, // Restore appropriate role
          subscriptionStatus: 'expired',
          updatedAt: new Date()
        });
        console.log(`Downgraded user ${user.id} from paid to ${restoredRole} due to expired subscription`);
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} users with expired subscriptions`);
    
    return {
      success: true,
      count: updatedCount
    };
  } catch (error) {
    console.error("Error updating expired subscriptions:", error);
    return { 
      success: false, 
      count: 0
    };
  }
}