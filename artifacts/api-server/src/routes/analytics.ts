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

// ===== Enhanced Analytics Dashboard endpoints =====

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);

// Flat overview for the Overview tab
router.get('/data', isAdmin, async (req, res) => {
  try {
    const data = await analyticsService.getEnhancedOverview(
      str(req.query.startDate),
      str(req.query.endDate),
      req.query.liveDataOnly === 'true'
    );
    res.json(data);
  } catch (error) {
    console.error('Error fetching enhanced analytics overview:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to fetch analytics data' });
  }
});

// Combined user journey (path transitions, entry/exit pages)
router.get('/user-journey', isAdmin, async (req, res) => {
  try {
    const data = await analyticsService.getUserJourneyCombined(
      str(req.query.startDate),
      str(req.query.endDate),
      req.query.liveDataOnly === 'true'
    );
    res.json(data);
  } catch (error) {
    console.error('Error fetching user journey data:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to fetch user journey data' });
  }
});

// Click heatmap data
router.get('/click-data', isAdmin, async (req, res) => {
  try {
    const data = await analyticsService.getClickData(
      str(req.query.startDate),
      str(req.query.endDate),
      str(req.query.path),
      req.query.liveDataOnly === 'true'
    );
    res.json(data);
  } catch (error) {
    console.error('Error fetching click data:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to fetch click data' });
  }
});

// User segmentation
router.get('/user-segments', isAdmin, async (req, res) => {
  try {
    const data = await analyticsService.getUserSegments(
      str(req.query.startDate),
      str(req.query.endDate),
      req.query.liveDataOnly === 'true'
    );
    res.json(data);
  } catch (error) {
    console.error('Error fetching user segments:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to fetch user segments' });
  }
});

// Geolocation rows for the visitor map
router.get('/geo-location', isAdmin, async (req, res) => {
  try {
    const data = await analyticsService.getGeoLocations(
      str(req.query.startDate),
      str(req.query.endDate),
      str(req.query.page),
      str(req.query.country),
      req.query.liveDataOnly === 'true'
    );
    res.json(data);
  } catch (error) {
    console.error('Error fetching geo-location data:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to fetch geo-location data' });
  }
});

// Country visitor counts
router.get('/country-visitors', isAdmin, async (req, res) => {
  try {
    const data = await analyticsService.getCountryVisitors(
      str(req.query.startDate),
      str(req.query.endDate),
      str(req.query.page),
      req.query.liveDataOnly === 'true'
    );
    res.json(data);
  } catch (error) {
    console.error('Error fetching country visitors:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to fetch country visitors' });
  }
});

// CSV/JSON exports
function toCsv(rows: Record<string, any>[], headers: string[]): string {
  const escape = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

router.get('/export/:type', isAdmin, async (req, res) => {
  try {
    const type = req.params.type;
    const format = (str(req.query.format) || 'csv').toLowerCase();
    const startDate = str(req.query.startDate);
    const endDate = str(req.query.endDate);
    const dateStamp = new Date().toISOString().slice(0, 10);

    const send = (filename: string, contentType: string, body: string) => {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(body);
    };

    if (type === 'page-views') {
      const overview = await analyticsService.getEnhancedOverview(startDate, endDate, false);
      const rows = overview.pageViews.map((p: any) => ({ date: p.date, pageViews: p.count, uniqueVisitors: p.users }));
      if (format === 'json') return send(`page-views-${dateStamp}.json`, 'application/json', JSON.stringify(rows, null, 2));
      return send(`page-views-${dateStamp}.csv`, 'text/csv;charset=utf-8', toCsv(rows, ['date', 'pageViews', 'uniqueVisitors']));
    }

    if (type === 'user-journeys') {
      const journeys = await analyticsService.getUserJourneyCombined(startDate, endDate, false);
      const rows = journeys.pathTransitions.map((t: any) => ({ source: t.source, target: t.target, count: t.count }));
      if (format === 'json') return send(`user-journeys-${dateStamp}.json`, 'application/json', JSON.stringify(journeys, null, 2));
      return send(`user-journeys-${dateStamp}.csv`, 'text/csv;charset=utf-8', toCsv(rows, ['source', 'target', 'count']));
    }

    if (type === 'events') {
      const rows = await analyticsService.getEventsForExport(startDate, endDate);
      if (format === 'json') return send(`events-${dateStamp}.json`, 'application/json', JSON.stringify(rows, null, 2));
      return send(`events-${dateStamp}.csv`, 'text/csv;charset=utf-8', toCsv(rows, ['eventType', 'category', 'action', 'label', 'path', 'timestamp']));
    }

    if (type === 'full') {
      const [overview, journeys, segments] = await Promise.all([
        analyticsService.getEnhancedOverview(startDate, endDate, false),
        analyticsService.getUserJourneyCombined(startDate, endDate, false),
        analyticsService.getUserSegments(startDate, endDate, false),
      ]);
      const full = { generatedAt: new Date().toISOString(), overview, journeys, segments };
      return send(`full-analytics-${dateStamp}.json`, 'application/json', JSON.stringify(full, null, 2));
    }

    return res.status(400).json({ success: false, error: 'Invalid export type' });
  } catch (error) {
    console.error('Error exporting analytics report:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to export report' });
  }
});

export default router;