/**
 * Calendar Events Diagnostic Endpoint
 * 
 * This endpoint helps diagnose issues with calendar events in production vs development
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { requireAdmin } from '../auth';

export const calendarDiagnosticsRouter = Router();

// Get comprehensive calendar event statistics
calendarDiagnosticsRouter.get('/calendar-stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[CalendarDiagnostics] Fetching calendar statistics...');
    
    // Get all events from the database
    const allEvents = await storage.getEvents();
    
    // Calculate statistics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const stats = {
      environment: process.env.NODE_ENV || 'development',
      databaseUrl: process.env.DATABASE_URL ? '(connected)' : 'not configured',
      timestamp: new Date().toISOString(),
      totalEvents: allEvents.length,
      eventsByCategory: {
        entertainment: allEvents.filter(e => e.category === 'entertainment').length,
        government: allEvents.filter(e => e.category === 'government').length,
        social: allEvents.filter(e => e.category === 'social').length,
        promotional: allEvents.filter(e => e.category === 'promotional').length,
        bulletin: allEvents.filter(e => e.category === 'bulletin').length,
        other: allEvents.filter(e => !['entertainment', 'government', 'social', 'promotional', 'bulletin'].includes(e.category)).length
      },
      eventsToday: allEvents.filter(e => {
        const eventDate = new Date(e.startDate);
        return eventDate.toDateString() === today.toDateString();
      }).length,
      upcomingEvents: allEvents.filter(e => new Date(e.startDate) >= now).length,
      pastEvents: allEvents.filter(e => new Date(e.startDate) < now).length,
      sampleEvents: allEvents.slice(0, 5).map(e => ({
        id: e.id,
        title: e.title,
        category: e.category,
        startDate: e.startDate,
        hasMedia: e.mediaUrls && e.mediaUrls.length > 0
      })),
      recentEvents: allEvents
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        .slice(0, 10)
        .map(e => ({
          id: e.id,
          title: e.title,
          category: e.category,
          startDate: e.startDate
        }))
    };

    console.log('[CalendarDiagnostics] Stats:', {
      total: stats.totalEvents,
      today: stats.eventsToday,
      upcoming: stats.upcomingEvents
    });

    res.json(stats);
  } catch (error) {
    console.error('[CalendarDiagnostics] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch calendar statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// Check specific date for events
calendarDiagnosticsRouter.get('/calendar-check-date/:date', requireAdmin, async (req: Request, res: Response) => {
  try {
    const dateStr = req.params.date;
    const targetDate = new Date(dateStr);
    
    console.log(`[CalendarDiagnostics] Checking events for date: ${dateStr}`);
    
    const allEvents = await storage.getEvents();
    const eventsOnDate = allEvents.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate.toDateString() === targetDate.toDateString();
    });

    res.json({
      date: dateStr,
      environment: process.env.NODE_ENV || 'development',
      eventsFound: eventsOnDate.length,
      events: eventsOnDate.map(e => ({
        id: e.id,
        title: e.title,
        category: e.category,
        startDate: e.startDate,
        endDate: e.endDate,
        location: e.location,
        hasMedia: e.mediaUrls && e.mediaUrls.length > 0,
        mediaCount: e.mediaUrls ? e.mediaUrls.length : 0
      }))
    });
  } catch (error) {
    console.error('[CalendarDiagnostics] Error checking date:', error);
    res.status(500).json({
      error: 'Failed to check calendar date',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export database info (admin only) - helps identify which database is being used
calendarDiagnosticsRouter.get('/database-info', requireAdmin, async (req: Request, res: Response) => {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    
    // Extract basic info without exposing credentials
    let dbInfo: any = 'Not configured';
    if (dbUrl) {
      try {
        // Parse the URL properly to handle passwords
        const url = new URL(dbUrl);
        dbInfo = {
          type: 'PostgreSQL',
          host: url.hostname,
          port: url.port || '5432',
          database: url.pathname.substring(1), // Remove leading slash
          user: url.username,
          // Don't expose password - just indicate if it exists
          hasPassword: !!url.password,
          isProduction: dbUrl.includes('neon.tech') || dbUrl.includes('replit')
        };
      } catch (urlError) {
        console.error('[CalendarDiagnostics] Error parsing database URL:', urlError);
        dbInfo = 'Error parsing database URL';
      }
    }

    res.json({
      environment: process.env.NODE_ENV || 'development',
      databaseInfo: dbInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CalendarDiagnostics] Error getting database info:', error);
    res.status(500).json({
      error: 'Failed to get database info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
