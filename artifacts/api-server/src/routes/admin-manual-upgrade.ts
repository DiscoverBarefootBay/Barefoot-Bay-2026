/**
 * Admin API for manually upgrading users to paid subscription status
 * This endpoint allows admins to manually set both role and subscription status
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, authenticateAdmin } from '../middleware/auth';
import { storage } from '../storage';

const router = Router();

interface ManualUpgradeRequest {
  userId: number;
  subscriptionType: 'monthly' | 'annual';
  duration?: number; // Duration in days, optional
}

/**
 * POST /api/admin/manual-upgrade
 * Manually upgrade a user to paid subscription status
 */
router.post('/manual-upgrade', authenticateUser, authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, subscriptionType, duration }: ManualUpgradeRequest = req.body;

    // Validate input
    if (!userId || !subscriptionType) {
      return res.status(400).json({
        success: false,
        message: 'userId and subscriptionType are required'
      });
    }

    if (!['monthly', 'annual'].includes(subscriptionType)) {
      return res.status(400).json({
        success: false,
        message: 'subscriptionType must be either "monthly" or "annual"'
      });
    }

    // Get the user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${userId} not found`
      });
    }

    // Calculate subscription dates
    const today = new Date();
    const endDate = new Date();
    
    // Use custom duration or default based on subscription type
    const durationDays = duration || (subscriptionType === 'monthly' ? 30 : 365);
    endDate.setDate(today.getDate() + durationDays);

    // Prepare subscription data
    const subscriptionData = {
      role: 'paid',
      previousRole: user.role, // Store current role before upgrading
      subscriptionType,
      subscriptionStatus: 'active',
      subscriptionStartDate: today,
      subscriptionEndDate: endDate,
      subscriptionId: `manual-${Date.now()}-${userId}`, // Generate a manual subscription ID
      updatedAt: new Date()
    };

    // Update the user
    await storage.updateUser(userId, subscriptionData);

    console.log(`Admin manually upgraded user ${user.username} (${userId}) to paid status`);

    return res.json({
      success: true,
      message: `Successfully upgraded ${user.username} to paid status`,
      data: {
        username: user.username,
        previousRole: user.role,
        newRole: 'paid',
        subscriptionType,
        subscriptionStatus: 'active',
        subscriptionEndDate: endDate.toISOString(),
        durationDays
      }
    });

  } catch (error) {
    console.error('Error in manual upgrade:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during manual upgrade'
    });
  }
});

/**
 * POST /api/admin/manual-downgrade
 * Manually downgrade a user from paid subscription status
 */
router.post('/manual-downgrade', authenticateUser, authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    // Get the user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${userId} not found`
      });
    }

    // Determine what role to restore to
    const restoredRole = user.previousRole || 'registered';

    // Prepare downgrade data
    const downgradeData = {
      role: restoredRole,
      subscriptionStatus: 'expired',
      previousRole: null, // Clear the stored previous role
      updatedAt: new Date()
      // Keep other subscription data for record-keeping
    };

    // Update the user
    await storage.updateUser(userId, downgradeData);

    console.log(`Admin manually downgraded user ${user.username} (${userId}) from paid to ${restoredRole}`);

    return res.json({
      success: true,
      message: `Successfully downgraded ${user.username} from paid to ${restoredRole}`,
      data: {
        username: user.username,
        previousRole: 'paid',
        newRole: restoredRole,
        subscriptionStatus: 'expired'
      }
    });

  } catch (error) {
    console.error('Error in manual downgrade:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during manual downgrade'
    });
  }
});

/**
 * GET /api/admin/subscription-users
 * Get all users with subscription data for admin management
 */
router.get('/subscription-users', authenticateUser, authenticateAdmin, async (req: Request, res: Response) => {
  try {
    // Get all users with subscription data
    const allUsers = await storage.getAllUsers();
    
    // Filter and format users with subscription information
    const subscriptionUsers = allUsers
      .filter(user => user.subscriptionStatus || user.role === 'paid')
      .map(user => ({
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
        previousRole: user.previousRole
      }));

    return res.json({
      success: true,
      data: subscriptionUsers
    });

  } catch (error) {
    console.error('Error fetching subscription users:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching subscription users'
    });
  }
});

export default router;