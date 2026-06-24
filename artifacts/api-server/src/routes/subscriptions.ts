import { Router } from 'express';
import { z } from "zod";
import fetch from 'node-fetch';
import * as userSubscriptions from '../user-subscriptions';
import { getSquareClient } from '../square-client';
import { createDirectSubscriptionLink, getDirectSquareCredentials } from '../direct-square-service';
import { storage } from '../storage';

const router = Router();

// Subscription status schema for validation
const WebhookEventSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    status: z.string().optional(),
  }).optional(),
});

/**
 * Get user's subscription status
 */
router.get('/status', async (req, res) => {
  try {
    // Require authentication
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const userId = req.user.id;
    const result = await userSubscriptions.getMembershipSubscription(userId);
    
    return res.json({
      success: result.success,
      message: result.message,
      subscription: {
        subscriptionId: result.subscriptionId,
        type: result.subscriptionType,
        // Since MembershipSubscriptionResult doesn't have a status field, derive it from dates
        status: result.subscriptionEndDate && new Date(result.subscriptionEndDate) < new Date() 
          ? 'expired' 
          : result.subscriptionId ? 'active' : 'none',
        startDate: result.subscriptionStartDate,
        endDate: result.subscriptionEndDate
      }
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Create a new subscription
 */
router.post('/create', async (req, res) => {
  try {
    // Require authentication
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const userId = req.user.id;
    const planType = req.body.planType || 'monthly';
    
    // Get Square client
    const squareClient = getSquareClient();
    
    // Create subscription with Square
    const result = await userSubscriptions.createMembershipSubscription(
      userId,
      planType,
      { squareClient } // Pass the Square client for payment processing
    );
    
    return res.json({
      success: result.success,
      message: result.message,
      subscriptionId: result.subscriptionId,
      subscriptionType: result.subscriptionType,
      subscriptionEndDate: result.subscriptionEndDate
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Create a Square checkout session for a subscription payment
 * Uses direct Square API calls to bypass any caching issues
 */
router.post('/create-checkout', async (req, res) => {
  try {
    // Require authentication
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { planType } = req.body;
    const userId = req.user.id;

    console.log(`Creating checkout for user ${userId} with plan type ${planType}`);
    console.log(`User email: ${req.user.email || 'not available'}`);
    
    // Use mock checkout only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Using mock checkout (development mode)');
      // Create a mock checkout URL for testing purposes - always use HTTPS
      const mockCheckoutUrl = `https://${req.get('host')}/subscriptions/confirm?userId=${userId}&planType=${planType}&status=success`;
      
      return res.json({
        success: true,
        checkoutUrl: mockCheckoutUrl,
        message: 'Mock checkout created successfully (dev mode)'
      });
    }
    
    // In production, use our direct Square API implementation that bypasses caching completely
    console.log('Using direct Square API implementation to bypass SDK caching issues');
    
    // Print the Square credentials being read from environment directly
    console.log('Environment variables: ');
    console.log(`SQUARE_LOCATION_ID: ${process.env.SQUARE_LOCATION_ID || 'Missing'}`);
    console.log(`SQUARE_ACCESS_TOKEN: ${process.env.SQUARE_ACCESS_TOKEN ? 'Available (masked)' : 'Missing'}`);
    
    try {
      // Use our direct Square service to create a payment link
      const paymentResult = await createDirectSubscriptionLink(
        userId,
        planType,
        req.user.email
      );
      
      console.log(`Direct checkout URL created: ${paymentResult.url}`);
      
      // Check if the URL was fixed (had the old merchant ID and was corrected)
      if (paymentResult.wasFixed) {
        console.log('⚠️ WARNING: Payment URL was fixed to replace old merchant ID with current ID');
        console.log('This indicates a persistent issue with Square account configuration');
        
        // Log details for troubleshooting
        console.log(`Using Square Location ID: ${process.env.SQUARE_LOCATION_ID}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`Using corrected URL: ${paymentResult.url}`);
      }
      
      return res.json({
        success: true,
        checkoutUrl: paymentResult.url,
        message: paymentResult.wasFixed 
          ? 'Square checkout created (URL was fixed to use current merchant ID)'
          : 'Square checkout created successfully using direct API'
      });
    } catch (directError) {
      console.error('Error with direct Square API:', directError);
      
      // If we're in production, return an error
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({
          success: false,
          message: 'Payment service unavailable. Please try again later or contact support.'
        });
      }
      
      // For development, fall back to mock checkout
      console.log('Falling back to mock checkout due to Square API error');
      const mockCheckoutUrl = `https://${req.get('host')}/subscriptions/confirm?userId=${userId}&planType=${planType}&status=success`;
      
      return res.json({
        success: true,
        checkoutUrl: mockCheckoutUrl,
        message: 'Mock checkout created as fallback (Square API error)'
      });
    }
  } catch (error) {
    console.error('Unexpected error in create-checkout:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
});

/**
 * Confirm subscription after payment is completed
 */
router.get('/confirm', async (req, res) => {
  try {
    const { userId, planType, status } = req.query;
    
    // Verify parameters
    if (!userId || !planType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Convert userId to number
    const userIdNum = parseInt(userId as string, 10);
    
    // Check if payment was successful
    const isSuccess = status === 'success';
    
    if (isSuccess) {
      console.log(`Payment success for user ${userIdNum} with plan ${planType}`);
      
      // For successful payments, create or update the subscription
      const result = await userSubscriptions.activateMembershipSubscription(
        userIdNum,
        planType as string
      );
      
      if (result.success) {
        console.log(`Subscription activated successfully: ${result.subscriptionId}`);
        
        // Redirect to success page
        return res.redirect('/subscription/success');
      } else {
        console.error('Failed to activate subscription:', result.message);
        
        // Redirect to error page with message
        return res.redirect(`/subscription/error?message=${encodeURIComponent(result.message)}`);
      }
    } else {
      console.log(`Payment cancelled or failed for user ${userIdNum}`);
      
      // Redirect to cancelled page
      return res.redirect('/subscription/cancelled');
    }
  } catch (error) {
    console.error('Error confirming subscription:', error);
    
    // Redirect to error page
    return res.redirect('/subscription/error');
  }
});

/**
 * Cancel user's membership subscription
 */
router.post('/cancel', async (req, res) => {
  try {
    // Require authentication
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const userId = req.user.id;
    console.log(`Cancelling membership subscription for user ${userId}`);
    
    // Cancel the subscription
    const result = await userSubscriptions.cancelMembershipSubscription(userId);
    
    return res.json({
      success: result.success,
      message: result.message,
      subscriptionId: result.subscriptionId,
      subscriptionType: result.subscriptionType,
      subscriptionEndDate: result.subscriptionEndDate
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Immediately expire user's membership subscription (for already cancelled subscriptions)
 */
router.post('/expire-now', async (req, res) => {
  try {
    // Require authentication
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const userId = req.user.id;
    console.log(`Immediately expiring membership subscription for user ${userId}`);
    
    // Get user to verify they have a cancelled subscription
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.subscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription found'
      });
    }
    
    if (user.subscriptionStatus !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Subscription must be cancelled before it can be expired immediately'
      });
    }
    
    // Immediately expire the subscription by updating the user
    await storage.updateUser(userId, {
      role: 'registered', // Downgrade from paid immediately
      subscriptionStatus: 'expired',
      subscriptionEndDate: new Date(), // Set end date to now
      updatedAt: new Date()
    });
    
    return res.json({
      success: true,
      message: 'Subscription has been immediately expired. You have been downgraded to a basic account.',
      subscriptionId: user.subscriptionId,
      subscriptionType: user.subscriptionType,
      subscriptionEndDate: new Date()
    });
  } catch (error) {
    console.error('Error expiring subscription:', error);
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Webhook endpoint for Square to notify about subscription status changes
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('Received Square webhook:', JSON.stringify(req.body));
    
    // Validate webhook payload
    const validationResult = WebhookEventSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      console.error('Invalid webhook payload:', validationResult.error);
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload'
      });
    }
    
    const event = validationResult.data;
    
    // Process based on event type
    if (event.type === 'subscription.updated' && event.data?.id) {
      console.log(`Processing subscription update: ${event.data.id}`);
      
      // Update subscription status in database
      // This is just a placeholder, actual implementation would depend on your schema
      console.log(`Subscription ${event.data.id} status updated to: ${event.data.status || 'unknown'}`);
      
      // You would typically query Square API for detailed subscription info here
      // and update your local database accordingly
    }
    
    // Always return 200 to acknowledge receipt
    return res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Still return 200 to prevent Square from retrying
    return res.status(200).json({
      success: false,
      message: 'Error processing webhook, but acknowledged'
    });
  }
});

export default router;