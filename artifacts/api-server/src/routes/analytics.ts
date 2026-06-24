import express from 'express';
import { analyticsService } from '../services/analytics-service';
import { z } from 'zod/v4';
import { isAdmin } from '../auth-helpers';
import cookieParser from 'cookie-parser';

const router = express.Router();

// Middleware
router.use(cookieParser());

// Admin-only routes
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const range = parseInt(req.query.range as string) || 30;
    const liveDataOnly = req.query.liveDataOnly === 'true';
    
    console.log(`[Analytics] Fetching dashboard data for range: ${range} days, liveDataOnly: ${liveDataOnly}`);
    
    const data = await analyticsService.getDashboardData(range, liveDataOnly);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message || 'Failed to fetch dashboard data' 
    });
  }
});

router.get('/activeusers', isAdmin, async (req, res) => {
  try {
    const liveDataOnly = req.query.liveDataOnly === 'true';
    console.log(`[Analytics] Fetching active users, liveDataOnly: ${liveDataOnly}`);
    
    const data = await analyticsService.getActiveUsers(liveDataOnly);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message || 'Failed to fetch active users' 
    });
  }
});

router.get('/userjourney/:type', isAdmin, async (req, res) => {
  try {
    const type = req.params.type;
    const days = parseInt(req.query.days as string) || 30;
    const liveDataOnly = req.query.liveDataOnly === 'true';
    
    console.log(`[Analytics] Fetching user journey data of type: ${type} for range: ${days} days, liveDataOnly: ${liveDataOnly}`);
    
    if (!['pathTransitions', 'entryPages', 'exitPages'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid journey type. Must be pathTransitions, entryPages, or exitPages' 
      });
    }
    
    const data = await analyticsService.getUserJourneyData(type, days, liveDataOnly);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching user journey data:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message || 'Failed to fetch user journey data' 
    });
  }
});

// Public tracking endpoints
router.post('/track/pageview', async (req, res) => {
  try {
    const pageViewSchema = z.object({
      url: z.string(),
      title: z.string().optional(),
      loadTime: z.number().optional(),
      screen: z.object({
        width: z.number(),
        height: z.number(),
      }).optional(),
      properties: z.record(z.string(), z.any()).optional(),
    });
    
    const validationResult = pageViewSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid page view data', 
        details: validationResult.error.errors 
      });
    }
    
    const result = await analyticsService.trackPageView(req, req.body);
    
    // Set session cookie if it doesn't exist
    if (result.sessionId && !req.cookies['analytics_session_id']) {
      res.cookie('analytics_session_id', result.sessionId, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error tracking page view:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message || 'Failed to track page view' 
    });
  }
});

router.post('/track/event', async (req, res) => {
  try {
    const eventSchema = z.object({
      eventType: z.string(),
      eventCategory: z.string().optional(),
      eventAction: z.string().optional(),
      eventLabel: z.string().optional(),
      eventValue: z.number().optional(),
      properties: z.record(z.string(), z.any()).optional(),
    });
    
    const validationResult = eventSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid event data', 
        details: validationResult.error.errors 
      });
    }
    
    const result = await analyticsService.trackEvent(req, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message || 'Failed to track event' 
    });
  }
});

router.post('/track/endsession', async (req, res) => {
  try {
    const result = await analyticsService.endSession(req);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message || 'Failed to end session' 
    });
  }
});

// Get active users for a specific page
router.get('/active-users', async (req, res) => {
  try {
    const { page } = req.query;
    
    if (!page || typeof page !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Page parameter is required'
      });
    }
    
    const result = await analyticsService.getActiveUsersForPage(page);
    res.json({ 
      success: true, 
      activeUsers: result.activeUsers,
      lastUpdate: result.lastUpdate
    });
  } catch (error) {
    console.error('Error getting active users:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message || 'Failed to get active users' 
    });
  }
});

export default router;