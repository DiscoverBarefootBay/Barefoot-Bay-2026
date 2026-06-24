import express from 'express';
import { IStorage } from '../storage';
import { requireAdmin } from '../auth';
import { Square } from '../square-client';
import { logger } from '../utils/logger';
import { processMembershipOrderById } from '../utils/membership-processor';
import * as userSubscriptions from '../user-subscriptions';

/**
 * Router for handling manual membership processing and sponsored memberships
 * @param {IStorage} storage - Database storage interface
 * @param {Square} square - Square API client
 */
// Function to create the router with dependencies
export function createMembershipProcessingRouter(storage: IStorage, square: Square) {
  const router = express.Router();
  
  // Ensure only admins can access these routes
  router.use(requireAdmin);
  
  // Add a sponsored membership (bypasses payment processing) - MUST BE BEFORE /:orderId
  router.post('/sponsored-membership', async (req, res) => {
    try {
      const { userId, planType, durationMonths, reason } = req.body;
      
      if (!userId || !planType) {
        return res.status(400).json({
          success: false,
          message: 'User ID and plan type are required'
        });
      }
      
      // Validate the user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Log the admin action
      logger.info(`Admin adding sponsored ${planType} membership for user ${userId} (${user.username}), duration: ${durationMonths || 'default'} months, reason: ${reason || 'Not specified'}`);
      
      // Create direct subscription without Square payment processing
      const result = await userSubscriptions.createMembershipSubscription(
        userId,
        planType,
        { 
          direct: true,           // Create without Square payment verification
          overrideExisting: true, // Replace any existing subscription
          sponsoredBy: req.user.id, // Record which admin sponsored this membership
          sponsorshipReason: reason || 'Admin sponsored' 
        }
      );
      
      // If custom duration was specified, adjust the end date
      if (durationMonths && result.success && result.subscriptionStartDate) {
        // Calculate new end date based on specified duration
        const customEndDate = new Date(result.subscriptionStartDate);
        customEndDate.setMonth(customEndDate.getMonth() + parseInt(durationMonths));
        
        // Update the subscription with custom end date
        await storage.updateUser(userId, {
          subscriptionEndDate: customEndDate,
          updatedAt: new Date()
        });
        
        // Update the result object
        result.subscriptionEndDate = customEndDate;
        result.message = `Sponsored membership created with custom duration of ${durationMonths} months`;
      }
      
      return res.json(result);
    } catch (error) {
      logger.error('Error creating sponsored membership:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  });
  
  // Process a specific order by ID
  router.post('/:orderId', async (req, res) => {
    try {
      const orderId = req.params.orderId;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
      }
      
      logger.info(`Admin manually processing membership order: ${orderId}`);
      
      // Process the order
      const result = await processMembershipOrderById(orderId, storage, square);
      
      if (result.success) {
        return res.json({
          success: true,
          message: `Membership order processed successfully: ${result.message}`,
          user: result.user
        });
      } else {
        return res.json({
          success: false,
          message: `Failed to process membership order: ${result.message}`
        });
      }
    } catch (error) {
      logger.error('Error processing membership order:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  });
  
  // Get pending membership orders
  router.get('/pending', async (req, res) => {
    try {
      // In a real implementation, we would fetch pending membership orders from Square
      // For demo purposes, we'll return an empty array
      return res.json({ success: true, pendingOrders: [] });
    } catch (error) {
      logger.error('Error fetching pending membership orders:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  });
  
  // Remove a membership (manual cancellation or revocation)
  router.delete('/membership/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { immediate, reason } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      // Log the admin action
      logger.info(`Admin removing membership for user ${userId}, immediate: ${immediate ? 'yes' : 'no'}, reason: ${reason || 'Not specified'}`);
      
      // Get user to verify they have a subscription
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
          message: 'User does not have an active subscription'
        });
      }
      
      // Cancel the subscription
      const result = await userSubscriptions.cancelMembershipSubscription(userId);
      
      // If immediate revocation is requested, downgrade the user now
      if (immediate && result.success) {
        await storage.updateUser(userId, {
          role: 'registered', // Downgrade from paid immediately
          subscriptionStatus: 'revoked',
          updatedAt: new Date()
        });
        
        result.message = 'Membership has been immediately revoked';
      }
      
      return res.json(result);
    } catch (error) {
      logger.error('Error removing membership:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  });
  
  // Get all users with active subscriptions
  router.get('/subscribed-users', async (req, res) => {
    try {
      // Fetch all users with subscriptions
      const users = await storage.getUsers({ 
        filters: { 
          subscriptionStatus: ['active', 'cancelled'] // Include both active and pending cancellation
        }
      });
      
      // Map users to a simplified format with just the subscription info
      const subscribedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        subscriptionId: user.subscriptionId,
        subscriptionType: user.subscriptionType,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
      }));
      
      return res.json({
        success: true,
        users: subscribedUsers
      });
    } catch (error) {
      logger.error('Error fetching subscribed users:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  });
  
  return router;
}

// Create and export the router with dependencies
import { storage } from '../storage';
import { Square, getSquareClient } from '../square-client';

// Export default router for direct use in routes.ts
export default createMembershipProcessingRouter(storage, getSquareClient());