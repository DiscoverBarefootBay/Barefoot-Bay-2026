import { IStorage } from '../storage';
import { Square } from '../square-client';
import { logger } from './logger';

/**
 * Processes a membership order and upgrades the user's role to "paid"
 * 
 * @param orderId - The Square order ID
 * @param storage - The database storage interface
 * @param square - The Square API client
 * @returns A promise that resolves to a result object
 */
export async function processMembershipOrderById(
  orderId: string,
  storage: IStorage,
  square: Square
): Promise<{
  success: boolean;
  message: string;
  user?: any;
}> {
  try {
    logger.info(`Processing membership order: ${orderId}`);
    
    // Step 1: Verify order exists and is a valid membership order
    const orderResponse = await square.client.ordersApi.retrieveOrder(orderId);
    
    if (!orderResponse.result || !orderResponse.result.order) {
      return {
        success: false,
        message: `Order ${orderId} not found in Square`
      };
    }
    
    const order = orderResponse.result.order;
    
    // Step 2: Verify this is a membership order
    // In a real implementation, we would check the line items for membership products
    // This is a simplified version that assumes all orders are membership orders
    const isMembershipOrder = true; // In a real app, we would check line items
    
    if (!isMembershipOrder) {
      return {
        success: false,
        message: `Order ${orderId} is not a membership purchase`
      };
    }
    
    // Step 3: Get the customer email from the order
    const customerEmail = order.fulfillments?.[0]?.shipmentDetails?.recipient?.emailAddress || 
                         order.customerEmail || 
                         order.customer?.emailAddress;
    
    // Step 4: Return early if no customer email found
    if (!customerEmail) {
      return {
        success: false,
        message: 'No customer email associated with order'
      };
    }
    
    // Step 5: Find the user by email
    const users = await storage.findUsersByEmail(customerEmail);
    
    if (!users || users.length === 0) {
      return {
        success: false,
        message: `No user found with email: ${customerEmail}`
      };
    }
    
    const user = users[0];
    
    // Step 6: Check if already a paid user
    if (user.role === 'paid') {
      return {
        success: true,
        message: `User ${user.username} already has paid status`,
        user
      };
    }
    
    // Step 7: Determine subscription type and duration
    // In a real app, we would parse the line items to determine the plan type
    const isPlanMonthly = true; // Default to monthly for simplicity
    
    // Set subscription details
    const subscriptionType = isPlanMonthly ? 'monthly' : 'annual';
    const durationDays = isPlanMonthly ? 30 : 365;
    
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + durationDays);
    
    // Step 8: Update user with subscription details
    const subscriptionData = {
      subscriptionId: orderId,
      subscriptionType,
      subscriptionStatus: 'active',
      subscriptionStartDate: today,
      subscriptionEndDate: endDate,
      previousRole: user.role, // Store current role before upgrading
      role: 'paid',
      // Store customer ID for future charges
      squareCustomerId: order.customerId || null
    };
    
    // Step 9: Update the user in the database
    try {
      await storage.updateUser(user.id, subscriptionData);
      
      // Log the successful upgrade
      logger.info(`Upgraded user ${user.username} to paid status via order ${orderId}`);
      
      return {
        success: true,
        message: `Successfully upgraded ${user.username} to paid status. Subscription valid until ${endDate.toLocaleDateString()}`,
        user: { ...user, ...subscriptionData }
      };
    } catch (error) {
      logger.error(`Failed to update user ${user.id}:`, error);
      return {
        success: false,
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  } catch (error) {
    logger.error(`Error processing membership order ${orderId}:`, error);
    return {
      success: false,
      message: `Error processing order: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Handles the automatic membership expiration process
 * 
 * @param storage - The database storage interface
 */
export async function processExpiredMemberships(storage: IStorage): Promise<void> {
  try {
    logger.info('Processing expired memberships');
    
    // Get all paid users with subscriptions
    const paidUsers = await storage.getUsersByRole('paid');
    
    if (!paidUsers || paidUsers.length === 0) {
      logger.info('No paid users found to check for expired memberships');
      return;
    }
    
    const now = new Date();
    let expiredCount = 0;
    
    // Check each paid user for expired subscription
    for (const user of paidUsers) {
      if (!user.subscriptionEndDate) {
        // Skip users without an end date
        continue;
      }
      
      const endDate = new Date(user.subscriptionEndDate);
      
      if (endDate < now) {
        // Subscription has expired, downgrade user
        logger.info(`Subscription expired for user ${user.username} (ID: ${user.id})`);
        
        // Restore user to their previous role or default to 'registered'
        const restoredRole = user.previousRole || 'registered';
        
        // Update user back to previous role
        await storage.updateUser(user.id, {
          role: restoredRole,
          subscriptionStatus: 'expired',
          previousRole: null, // Clear the stored previous role
          // Keep other subscription data for record-keeping
        });
        
        expiredCount++;
        logger.info(`Downgraded user ${user.username} from paid to ${restoredRole}`);
      }
    }
    
    logger.info(`Processed ${paidUsers.length} paid users, found ${expiredCount} expired subscriptions`);
  } catch (error) {
    logger.error('Error processing expired memberships:', error);
  }
}

/**
 * Processes all pending membership orders
 * 
 * @param storage - The database storage interface
 * @param square - The Square API client
 */
// Export alias for compatibility with existing code
export const processMembershipOrders = processPendingMembershipOrders;

export async function processPendingMembershipOrders(
  storage: IStorage,
  square: Square | null
): Promise<{
  success: boolean;
  processed: number;
  failed: number;
  message: string;
}> {
  try {
    logger.info('Checking for pending membership orders');
    
    // If no Square client provided, try to get one
    if (!square || !square.client) {
      logger.warn('No Square client provided, attempting to get one');
      
      // We can't use dynamic imports here, so we need to return an error
      logger.error('No valid Square client provided and cannot dynamically import');
      return {
        success: false,
        processed: 0,
        failed: 0,
        message: 'No valid Square client available'
      };
    }
    
    // Get orders from the past 48 hours
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    try {
      // Query Square API for recent orders
      const { result } = await square.client.ordersApi.searchOrders({
        locationIds: [process.env.SQUARE_LOCATION_ID as string],
        query: {
          filter: {
            stateFilter: {
              states: ['COMPLETED']
            },
            dateTimeFilter: {
              createdAt: {
                startAt: twoDaysAgo.toISOString()
              }
            }
          },
          sort: {
            sortField: 'CREATED_AT',
            sortOrder: 'DESC'
          }
        }
      });
    
    if (!result || !result.orders || !result.orders.length) {
      logger.info('No recent orders found in Square');
      return {
        success: true,
        processed: 0,
        failed: 0,
        message: 'No recent orders found to process'
      };
    }
    
    logger.info(`Found ${result.orders.length} recent orders in Square`);
    
    let processed = 0;
    let failed = 0;
    
    // Process each order that might be a membership
    for (const order of result.orders) {
      try {
        // Check if this order has already been processed by looking for a user with this subscription ID
        const existingUser = await storage.getUserBySubscriptionId(order.id);
        
        if (existingUser) {
          logger.info(`Order ${order.id} already processed for user ${existingUser.username}`);
          continue;
        }
        
        // Check if this is a membership product
        const isMembershipOrder = order.lineItems?.some(item => 
          item.name?.toLowerCase().includes('membership') || 
          item.note?.toLowerCase().includes('membership')
        );
        
        if (!isMembershipOrder) {
          // Not a membership order
          continue;
        }
        
        // Process this order - find the user and upgrade them
        const result = await processMembershipOrderById(order.id, storage, square);
        
        if (result.success) {
          processed++;
          logger.info(`Automatically processed order ${order.id} - ${result.message}`);
        } else {
          failed++;
          logger.warn(`Failed to process order ${order.id} - ${result.message}`);
        }
      } catch (orderError) {
        failed++;
        logger.error(`Error processing individual order ${order.id}:`, orderError);
      }
    }
    
    return {
      success: true,
      processed,
      failed,
      message: `Processed ${processed} pending orders, ${failed} failed`
    };
    } catch (squareError) {
      logger.error('Error querying Square orders:', squareError);
      return {
        success: false,
        processed: 0,
        failed: 0,
        message: `Error querying Square orders: ${squareError instanceof Error ? squareError.message : 'Unknown error'}`
      };
    }
  } catch (error) {
    logger.error('Error processing pending membership orders:', error);
    return {
      success: false,
      processed: 0,
      failed: 0,
      message: `Error processing pending orders: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}