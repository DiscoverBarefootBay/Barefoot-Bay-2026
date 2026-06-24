import express from 'express';
import { requireAdmin } from '../auth';
import { storage } from '../storage';
import { logger } from '../utils/logger';
import { z } from 'zod/v4';
import { db, pool } from '../db';
import { analyticsSessions } from '@workspace/db';
import { forumPosts, forumComments, realEstateListings, events } from '@workspace/db';
import { eq, desc, sql, count } from 'drizzle-orm';

const router = express.Router();

// Ensure all routes require admin authentication
router.use(requireAdmin);

// Get all users (admin only)
router.get('/', async (req, res) => {
  try {
    const users = await storage.getUsers();
    console.log(`GET /api/users - Successfully fetched ${users.length} users`);
    
    // Return users in the expected format
    return res.json({
      success: true,
      users: users
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

// Search users by term (username, email, name)
router.get('/search', async (req, res) => {
  try {
    const { term } = req.query;
    
    if (!term || typeof term !== 'string' || term.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search term must be at least 2 characters'
      });
    }
    
    // Search for users by username, email, or fullName
    const searchTerm = term.toLowerCase();
    const users = await storage.getUsers();
    
    // Filter users based on the search term
    const filteredUsers = users.filter(user => {
      return (
        user.username.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        (user.fullName && user.fullName.toLowerCase().includes(searchTerm))
      );
    }).map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus
    }));
    
    // Limit the results to prevent large responses
    const limitedResults = filteredUsers.slice(0, 10);
    
    return res.json({
      success: true,
      users: limitedResults
    });
  } catch (error) {
    logger.error('Error searching users:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

// Get detailed stats for a specific user (admin only)
router.get('/:id/details', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Get the user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get last activity from analytics sessions
    let lastActivity = null;
    try {
      const lastSession = await db.select({
        startTimestamp: analyticsSessions.startTimestamp,
        endTimestamp: analyticsSessions.endTimestamp
      })
        .from(analyticsSessions)
        .where(eq(analyticsSessions.userId, userId))
        .orderBy(desc(analyticsSessions.startTimestamp))
        .limit(1);
      
      if (lastSession.length > 0) {
        lastActivity = lastSession[0].endTimestamp || lastSession[0].startTimestamp;
      }
    } catch (e) {
      logger.warn('Could not fetch last activity for user', userId, e);
    }
    
    // Get content counts
    let forumPostCount = 0;
    let forumCommentCount = 0;
    let listingCount = 0;
    let eventCount = 0;
    
    try {
      // Forum posts
      const postsResult = await db.select({ count: count() })
        .from(forumPosts)
        .where(eq(forumPosts.userId, userId));
      forumPostCount = postsResult[0]?.count || 0;
      
      // Forum comments
      const commentsResult = await db.select({ count: count() })
        .from(forumComments)
        .where(eq(forumComments.userId, userId));
      forumCommentCount = commentsResult[0]?.count || 0;
      
      // Real estate listings
      const listingsResult = await db.select({ count: count() })
        .from(realEstateListings)
        .where(eq(realEstateListings.createdBy, userId));
      listingCount = listingsResult[0]?.count || 0;
      
      // Events
      const eventsResult = await db.select({ count: count() })
        .from(events)
        .where(eq(events.createdBy, userId));
      eventCount = eventsResult[0]?.count || 0;
    } catch (e) {
      logger.warn('Could not fetch content counts for user', userId, e);
    }
    
    // Get session count and total page views
    let totalSessions = 0;
    let totalPageViews = 0;
    try {
      const sessionsResult = await db.select({ 
        count: count(),
        totalPages: sql<number>`COALESCE(SUM(${analyticsSessions.pagesViewed}), 0)`
      })
        .from(analyticsSessions)
        .where(eq(analyticsSessions.userId, userId));
      
      totalSessions = sessionsResult[0]?.count || 0;
      totalPageViews = Number(sessionsResult[0]?.totalPages) || 0;
    } catch (e) {
      logger.warn('Could not fetch session stats for user', userId, e);
    }
    
    return res.json({
      success: true,
      details: {
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastActivity,
        phoneNumber: user.phoneNumber,
        membershipBadgeNumber: user.membershipBadgeNumber,
        squareCustomerId: user.squareCustomerId,
        subscriptionId: user.subscriptionId,
        subscriptionType: user.subscriptionType,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        // Survey data
        isLocalResident: user.isLocalResident,
        ownsHomeInBB: user.ownsHomeInBB,
        rentsHomeInBB: user.rentsHomeInBB,
        isFullTimeResident: user.isFullTimeResident,
        isSnowbird: user.isSnowbird,
        hasMembershipBadge: user.hasMembershipBadge,
        buysDayPasses: user.buysDayPasses,
        hasLivedInBB: user.hasLivedInBB,
        hasVisitedBB: user.hasVisitedBB,
        hasFriendsInBB: user.hasFriendsInBB,
        consideringMovingToBB: user.consideringMovingToBB,
        // Content stats
        contentStats: {
          forumPosts: forumPostCount,
          forumComments: forumCommentCount,
          listings: listingCount,
          events: eventCount
        },
        // Activity stats
        activityStats: {
          totalSessions,
          totalPageViews
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching user details:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

// Get all users with subscription data (for subscription management)
router.get('/', async (req, res) => {
  try {
    const users = await storage.getUsers();
    
    return res.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        subscriptionId: user.subscriptionId,
        subscriptionType: user.subscriptionType,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        squareCustomerId: user.squareCustomerId
      }))
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

// Update user subscription
const updateSubscriptionSchema = z.object({
  subscriptionType: z.enum(['monthly', 'annual']).optional(),
  subscriptionStatus: z.enum(['active', 'cancelled', 'past_due', 'expired']).optional(),
  subscriptionEndDate: z.string().optional()
});

router.patch('/:id/subscription', requireAdmin, async (req, res) => {
  try {
    console.log('Subscription update request:', { userId: req.params.id, body: req.body });
    const userId = parseInt(req.params.id);
    const updates = updateSubscriptionSchema.parse(req.body);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Get current user to verify they exist
    const currentUser = await storage.getUser(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update subscription fields
    const updateData: any = {};
    
    if (updates.subscriptionType) {
      updateData.subscriptionType = updates.subscriptionType;
    }
    
    if (updates.subscriptionStatus) {
      updateData.subscriptionStatus = updates.subscriptionStatus;
    }
    
    if (updates.subscriptionEndDate) {
      updateData.subscriptionEndDate = new Date(updates.subscriptionEndDate);
    }
    
    // Update the user
    await storage.updateUser(userId, updateData);
    
    // Fetch the updated user
    const updatedUser = await storage.getUser(userId);
    
    return res.json({
      success: true,
      user: {
        id: updatedUser!.id,
        username: updatedUser!.username,
        email: updatedUser!.email,
        fullName: updatedUser!.fullName,
        role: updatedUser!.role,
        subscriptionId: updatedUser!.subscriptionId,
        subscriptionType: updatedUser!.subscriptionType,
        subscriptionStatus: updatedUser!.subscriptionStatus,
        subscriptionStartDate: updatedUser!.subscriptionStartDate,
        subscriptionEndDate: updatedUser!.subscriptionEndDate
      }
    });
  } catch (error) {
    logger.error('Error updating user subscription:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

export default router;