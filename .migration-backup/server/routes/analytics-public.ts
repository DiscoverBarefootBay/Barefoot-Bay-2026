import express from 'express';
import { analyticsService } from '../services/analytics-service';
import { db } from '../db';
import { 
  analyticsSessions, 
  analyticsPageViews, 
  analyticsEvents
} from '@shared/schema';
import { and, count, desc, eq, gte, or, sql } from 'drizzle-orm';
import { stringify } from 'csv-stringify/sync';

const router = express.Router();

/**
 * Florida timezone helper - All analytics should be based on Florida Eastern Time
 * This ensures "Today" means the current day in Florida, not UTC
 */
const FLORIDA_TIMEZONE = 'America/New_York';

/**
 * Get the current date components in Florida Eastern timezone
 * Returns { year, month, day, hour, minute } in Florida local time
 */
function getFloridaDateComponents(date: Date = new Date()): { year: number; month: number; day: number; hour: number; minute: number } {
  // Use Intl.DateTimeFormat to get reliable timezone-aware date components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FLORIDA_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
  
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute')
  };
}

/**
 * Get midnight (start of day) in Florida timezone, returned as UTC ISO string for database queries
 * Uses PostgreSQL AT TIME ZONE for accurate conversion, but we need a reference date
 * @param daysAgo - Number of days ago (0 = today in Florida)
 */
function getFloridaMidnightUTC(daysAgo: number = 0): Date {
  // Get current date in Florida - this is timezone-aware via Intl API
  const floridaComponents = getFloridaDateComponents();
  
  // Calculate the target date using Date.UTC to avoid server-local timezone issues
  // This creates a UTC timestamp for the target date at noon (used only for date math)
  const targetDateUTC = new Date(Date.UTC(
    floridaComponents.year, 
    floridaComponents.month - 1, 
    floridaComponents.day - daysAgo,
    12, 0, 0 // noon UTC - safe for date math
  ));
  
  // Extract year, month, day from the UTC date
  const year = targetDateUTC.getUTCFullYear();
  const month = String(targetDateUTC.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetDateUTC.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  // Create a UTC timestamp for noon on target date to get the DST offset for that specific date
  // Using 'Z' suffix ensures we're working with UTC, not server local time
  const testDateUTC = new Date(`${dateStr}T12:00:00.000Z`);
  const offsetOnTargetDate = getTimezoneOffsetForDate(testDateUTC);
  
  // Midnight Florida = 00:00 + offset hours in UTC
  // e.g., midnight EST (UTC-5) = 05:00 UTC, midnight EDT (UTC-4) = 04:00 UTC
  const utcHour = Math.floor(offsetOnTargetDate / 60);
  const utcMinute = offsetOnTargetDate % 60;
  
  return new Date(`${dateStr}T${String(utcHour).padStart(2, '0')}:${String(utcMinute).padStart(2, '0')}:00.000Z`);
}

/**
 * Get the timezone offset for Florida Eastern Time on a specific date (in minutes)
 * Returns positive number (e.g., 300 for EST/winter, 240 for EDT/summer)
 */
function getTimezoneOffsetForDate(date: Date): number {
  // Get date components in both Florida and UTC for the same instant
  const floridaFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FLORIDA_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const floridaParts = floridaFormatter.formatToParts(date);
  const utcParts = utcFormatter.formatToParts(date);
  
  const getNum = (parts: Intl.DateTimeFormatPart[], type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
  
  const floridaMinutes = getNum(floridaParts, 'hour') * 60 + getNum(floridaParts, 'minute');
  const utcMinutes = getNum(utcParts, 'hour') * 60 + getNum(utcParts, 'minute');
  
  // Handle day boundary crossing
  const floridaDay = getNum(floridaParts, 'day');
  const utcDay = getNum(utcParts, 'day');
  
  let offset = utcMinutes - floridaMinutes;
  if (utcDay > floridaDay) {
    offset += 24 * 60; // UTC is next day
  } else if (utcDay < floridaDay) {
    offset -= 24 * 60; // Florida is next day
  }
  
  return offset;
}

/**
 * Get Florida date string for display (M/D/YYYY format)
 */
function getFloridaDateString(): string {
  const components = getFloridaDateComponents();
  return `${components.month}/${components.day}/${components.year}`;
}

/**
 * Format a UTC date for display in Florida timezone (M-D format for charts)
 */
function formatDateForChartFlorida(date: Date): string {
  // Use Intl to format the date in Florida timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FLORIDA_TIMEZONE,
    month: 'numeric',
    day: 'numeric'
  });
  // Format returns "1/31", convert to "1-31"
  return formatter.format(date).replace('/', '-');
}

/**
 * Get end of current day in Florida timezone, as a UTC Date for API responses
 * This represents 23:59:59 Florida time as a UTC timestamp
 */
function getFloridaEndOfDayUTC(): Date {
  // Get Florida midnight (start of today) as UTC
  const floridaMidnight = getFloridaMidnightUTC(0);
  
  // Add 23 hours, 59 minutes, 59.999 seconds to get end of day
  // This properly handles month/year boundaries via date arithmetic
  const msInDay = (23 * 60 + 59) * 60 * 1000 + 59999;
  
  return new Date(floridaMidnight.getTime() + msInDay);
}

/**
 * Format a UTC date for display in Florida timezone (M/D/YYYY format)
 */
function formatDateDisplayFlorida(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FLORIDA_TIMEZONE,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });
  return formatter.format(date);
}

/**
 * Comprehensive bot user-agent patterns for filtering non-human traffic
 * Covers search engines, SEO tools, monitoring services, AI crawlers, etc.
 */
const BOT_USER_AGENT_PATTERNS = [
    // Search engine bots
    '%bot%',
    '%Bot%',
    '%crawler%',
    '%Crawler%',
    '%spider%',
    '%Spider%',
    // Specific search engines
    '%Googlebot%',
    '%bingbot%',
    '%Bingbot%',
    '%Yahoo%',
    '%DuckDuckBot%',
    '%Baidu%',
    '%YandexBot%',
    // SEO tools
    '%AhrefsBot%',
    '%SemrushBot%',
    '%MJ12bot%',
    '%DotBot%',
    '%Screaming Frog%',
    // Monitoring/health check tools  
    '%UptimeRobot%',
    '%Pingdom%',
    '%StatusCake%',
    '%Site24x7%',
    '%GTmetrix%',
    // Command line tools
    '%curl%',
    '%wget%',
    '%httpie%',
    // Programming language HTTP clients
    '%Go-http-client%',
    '%python-requests%',
    '%Python-urllib%',
    '%axios%',
    '%node-fetch%',
    '%Java%HttpClient%',
    // Social media crawlers
    '%facebookexternalhit%',
    '%Facebot%',
    '%Twitterbot%',
    '%LinkedInBot%',
    '%Pinterest%',
    '%Slackbot%',
    '%Discordbot%',
    '%TelegramBot%',
    '%WhatsApp%',
    // AI crawlers
    '%ClaudeBot%',
    '%ChatGPT%',
    '%GPTBot%',
    '%PerplexityBot%',
    '%Anthropic%',
    '%OpenAI%',
    '%CCBot%',
    // Google services
    '%GoogleAssociationService%',
    '%Google-Read-Aloud%',
    '%Googlebot-Image%',
    '%Googlebot-Video%',
    '%Mediapartners-Google%',
    '%AdsBot-Google%',
    // Other bots
    '%HeadlessChrome%',
    '%PhantomJS%',
    '%Lighthouse%',
    '%PageSpeed%',
    '%Applebot%',
];

/**
 * Generate SQL filter conditions for excluding bot traffic
 * @param tableAlias Optional table alias (e.g., 's' for joined queries)
 */
// Known bot/suspicious IP ranges to filter out
const BOT_IP_RANGES = [
    '43.173.%',     // China Telecom bot network (coordinated scraping activity)
    '35.191.%',     // Google Cloud Load Balancer / health checks
    '66.249.%',     // Googlebot crawler
];

function getBotFilterSQL(tableAlias?: string): string {
    const prefix = tableAlias ? `${tableAlias}.` : '';
    
    // User-agent based filtering
    const uaPatterns = BOT_USER_AGENT_PATTERNS.map(p => 
        `${prefix}user_agent NOT LIKE '${p}'`
    ).join(' AND ');
    
    // IP-based filtering for known bot networks
    const ipPatterns = BOT_IP_RANGES.map(p => 
        `${prefix}ip NOT LIKE '${p}'`
    ).join(' AND ');
    
    return `(${uaPatterns} AND ${ipPatterns})`;
}

/**
 * Generate test geo data for the dashboard when running in development
 * This is only used when there's no real geo data in the database
 */
function generateTestGeoData() {
  // Common page paths from our site
  const pagePaths = [
    '/home', 
    '/forum', 
    '/calendar', 
    '/vendors',
    '/listings',
    '/community',
    '/membership',
    '/contact'
  ];
  
  // Create sample visitor locations across the US
  const locations = [
    // Florida
    {
      country: 'US',
      region: 'FL',
      city: 'Orlando',
      latitude: 28.5383,
      longitude: -81.3792,
      session_count: 35,
      ip: '192.168.1.10',
      device: 'desktop',
      browser: 'Chrome 135.0.0.0',
      visited_pages: ['/home', '/forum', '/calendar']
    },
    {
      country: 'US',
      region: 'FL',
      city: 'Miami',
      latitude: 25.7617,
      longitude: -80.1918,
      session_count: 28,
      ip: '192.168.1.11',
      device: 'mobile',
      browser: 'Safari 16.0',
      visited_pages: ['/home', '/vendors', '/calendar']
    },
    {
      country: 'US',
      region: 'FL',
      city: 'Tampa',
      latitude: 27.9506,
      longitude: -82.4572,
      session_count: 21,
      ip: '192.168.1.12',
      device: 'desktop',
      browser: 'Firefox 115.0',
      visited_pages: ['/forum', '/calendar', '/listings']
    },
    // Other states
    {
      country: 'US',
      region: 'NY',
      city: 'New York',
      latitude: 40.7128,
      longitude: -74.0060,
      session_count: 18,
      ip: '192.168.1.13',
      device: 'desktop',
      browser: 'Chrome 135.0.0.0',
      visited_pages: ['/home', '/membership', '/community']
    },
    {
      country: 'US',
      region: 'CA',
      city: 'Los Angeles',
      latitude: 34.0522,
      longitude: -118.2437,
      session_count: 15,
      ip: '192.168.1.14',
      device: 'tablet',
      browser: 'Safari 15.0',
      visited_pages: ['/listings', '/calendar', '/vendors']
    },
    {
      country: 'US',
      region: 'TX',
      city: 'Houston',
      latitude: 29.7604,
      longitude: -95.3698,
      session_count: 12,
      ip: '192.168.1.15',
      device: 'mobile',
      browser: 'Chrome 135.0.0.0',
      visited_pages: ['/home', '/forum', '/community']
    },
    {
      country: 'US',
      region: 'IL',
      city: 'Chicago',
      latitude: 41.8781,
      longitude: -87.6298,
      session_count: 10,
      ip: '192.168.1.16',
      device: 'desktop',
      browser: 'Edge 114.0',
      visited_pages: ['/community', '/membership', '/calendar']
    },
    {
      country: 'US',
      region: 'GA',
      city: 'Atlanta',
      latitude: 33.7490,
      longitude: -84.3880,
      session_count: 8,
      ip: '192.168.1.17',
      device: 'desktop',
      browser: 'Chrome 135.0.0.0',
      visited_pages: ['/home', '/forum', '/vendors']
    }
  ];
  
  return locations;
}

// Public route for basic site stats
router.get('/sitestats', async (req, res) => {
  try {
    const stats = await getPublicSiteStats();
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting public site stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get site stats'
    });
  }
});

// Main public analytics endpoint - used by analytics dashboard
router.get('/public', async (req, res) => {
  try {
    const range = parseInt(req.query.range as string) || 30;
    const liveDataOnly = req.query.liveDataOnly === 'true';
    console.log(`[Analytics Public] Fetching public data for range: ${range} days${liveDataOnly ? ' (live data only)' : ''}`);
    
    const data = await getPublicAnalyticsData(range, liveDataOnly);
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error getting public analytics data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics data'
    });
  }
});

// Public route for checking analytics API status and providing API keys
router.get('/status', (req, res) => {
  // Get API key from environment or configuration
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  
  res.status(200).json({
    success: true,
    message: 'Analytics public API is operational',
    config: {
      googleMapsApiKey
    }
  });
});

// Bot probe paths - requests to these paths are 100% bots scanning for vulnerabilities
const BOT_PROBE_PATHS = [
  '/wp-admin%',
  '/wp-login%',
  '/wp-content%',
  '/wp-includes%',
  '/xmlrpc.php',
  '/phpmyadmin%',
  '/.env',
  '/.git%',
  '/administrator%',
  '/admin.php',
  '/config.php',
  '/setup.php',
];

/**
 * Generate SQL subquery to filter out sessions that ONLY visited bot probe paths
 * A session is considered a bot if ALL its page views match bot probe patterns
 */
function getBotProbeSessionFilter(): string {
  const pathPatterns = BOT_PROBE_PATHS.map(p => `path LIKE '${p}'`).join(' OR ');
  
  // Exclude sessions where every page view matches a bot probe path
  return `session_id NOT IN (
    SELECT DISTINCT session_id 
    FROM analytics_sessions s2
    WHERE NOT EXISTS (
      SELECT 1 FROM analytics_page_views pv 
      WHERE pv.session_id = s2.session_id 
      AND NOT (${pathPatterns})
    )
  )`;
}

// Route for getting currently active users (users active in the last 5 minutes)
router.get('/active-users', async (req, res) => {
  try {
    // Get timestamp for 5 minutes ago
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    const fiveMinutesAgoStr = fiveMinutesAgo.toISOString();
    
    // Get bot filter for this query (always filter bots from active users)
    const botFilter = getBotFilterSQL('s');
    
    // Build path filter to exclude bot probe paths
    const pathFilter = BOT_PROBE_PATHS.map(p => `current_page NOT LIKE '${p}'`).join(' AND ');
    
    // Query for sessions with activity in the last 5 minutes
    // Deduplicate by user identifier to show each person only once:
    // - Logged-in users: partition by username
    // - Anonymous users: partition by user_agent + current_page + start_time bucket (5 sec)
    //   This catches IPv4/IPv6 duplicates from the same device (parallel requests within ~1 second)
    //   while not merging different anonymous users viewing the same page at different times
    // Trade-off: In the rare case of multiple users with identical user_agent hitting the same 
    //   page within 5 seconds, they may be merged. This is acceptable for a community site
    //   with low concurrent traffic; the alternative (showing IPv4/IPv6 duplicates) is worse UX.
    // Prefer IPv4 addresses over IPv6 (IPv6 contains ':')
    // Apply comprehensive bot filtering and path-based bot detection
    const activeSessionsQuery = `
      WITH session_pages AS (
        SELECT 
          s.id,
          s.session_id,
          s.user_id,
          s.ip,
          s.user_agent,
          s.device,
          s.start_timestamp,
          COALESCE(u.username, 'Anonymous') as username,
          (
            SELECT path FROM analytics_page_views
            WHERE session_id = s.session_id
            ORDER BY timestamp DESC
            LIMIT 1
          ) as current_page,
          (
            SELECT timestamp FROM analytics_page_views
            WHERE session_id = s.session_id
            ORDER BY timestamp DESC
            LIMIT 1
          ) as last_activity
        FROM analytics_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE EXISTS (
          SELECT 1 FROM analytics_page_views
          WHERE session_id = s.session_id
          AND timestamp >= '${fiveMinutesAgoStr}'
        )
        AND ${botFilter}
      ),
      ranked_sessions AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY 
              CASE 
                WHEN username != 'Anonymous' THEN username
                ELSE user_agent || '|' || COALESCE(current_page, '/') || '|' || 
                     FLOOR(EXTRACT(EPOCH FROM start_timestamp) / 5)
              END
            ORDER BY 
              CASE WHEN ip NOT LIKE '%:%' THEN 0 ELSE 1 END,
              last_activity DESC
          ) as rn
        FROM session_pages
      )
      SELECT * FROM ranked_sessions
      WHERE rn = 1
        AND ${pathFilter}
      ORDER BY last_activity DESC
      LIMIT 10
    `;
    
    // Execute the query without parameters
    const result = await db.execute(sql.raw(activeSessionsQuery));
    
    // Format active users data for the dashboard
    // Show IP address instead of 'Anonymous' for non-signed-in users
    const activeUsers = result.rows.map((row: any) => ({
      name: row.username !== 'Anonymous' ? row.username : (row.ip || 'Anonymous'),
      currentPage: row.current_page || '/',
      lastActivity: row.last_activity
    }));
    
    // Return active users data
    res.status(200).json({
      success: true,
      data: activeUsers
    });
  } catch (error) {
    console.error('Error getting active users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active users'
    });
  }
});

// CSV export endpoint for analytics data
router.get('/export-csv', async (req, res) => {
  try {
    const range = parseInt(req.query.range as string) || 30;
    const liveDataOnly = req.query.liveDataOnly === 'true';
    console.log(`[Analytics Export] Generating CSV export for range: ${range} days${liveDataOnly ? ' (live data only)' : ''}`);
    
    // Get analytics data
    const data = await getPublicAnalyticsData(range, liveDataOnly);
    
    // Format data for CSV export
    const csvData = {
      metrics: [
        {
          label: 'Total Sessions',
          value: data.metrics.totalSessions
        },
        {
          label: 'Unique Visitors',
          value: data.metrics.uniqueVisitors
        },
        {
          label: 'Page Views',
          value: data.metrics.pageViews
        },
        {
          label: 'Avg Session (seconds)',
          value: data.metrics.avgSessionDuration
        },
        {
          label: 'Bounce Rate (%)',
          value: data.metrics.bounceRate
        },
        {
          label: 'Date Range',
          // Use Florida timezone formatted dates for consistent display
          value: `${data.timeRange.floridaStartDate} to ${data.timeRange.floridaEndDate}`
        }
      ],
      // Format top pages data
      topPages: data.topPages.map(page => ({
        page: page.title,
        url: page.url,
        views: page.views
      })),
      // Format device data
      devices: data.devices,
      // Format browser data
      browsers: data.browsers,
      // Format referrer data
      referrers: data.referrers,
      // Format daily traffic data
      dailyTraffic: data.dailyVisitors,
      // Format geo data for export
      locations: data.geoData.locations.map(location => ({
        country: location.country,
        region: location.region,
        city: location.city,
        device: location.device,
        browser: location.browser,
        sessions: location.sessions,
        visitedPages: location.pages.map(p => p.path).join(', ')
      }))
    };
    
    // Create CSV content sections
    const metricsCSV = stringify(csvData.metrics, {
      header: true,
      columns: ['label', 'value']
    });
    
    const topPagesCSV = stringify(csvData.topPages, {
      header: true,
      columns: ['page', 'url', 'views']
    });
    
    const devicesCSV = stringify(csvData.devices, {
      header: true,
      columns: ['name', 'count']
    });
    
    const browsersCSV = stringify(csvData.browsers, {
      header: true,
      columns: ['name', 'count']
    });
    
    const referrersCSV = stringify(csvData.referrers, {
      header: true,
      columns: ['name', 'count']
    });
    
    const dailyTrafficCSV = stringify(csvData.dailyTraffic, {
      header: true,
      columns: ['date', 'visitors', 'sessions']
    });
    
    const locationsCSV = stringify(csvData.locations, {
      header: true,
      columns: ['country', 'region', 'city', 'device', 'browser', 'sessions', 'visitedPages']
    });
    
    // Combine all sections with headers
    const fullCSV = [
      'ANALYTICS DASHBOARD EXPORT',
      `Generated on: ${new Date().toLocaleString()}`,
      `Date Range: ${range} days${liveDataOnly ? ' (live data only)' : ' (includes test data)'}`,
      '\n',
      'SUMMARY METRICS',
      metricsCSV,
      '\n',
      'TOP PAGES',
      topPagesCSV,
      '\n',
      'DEVICE DISTRIBUTION',
      devicesCSV,
      '\n',
      'BROWSER DISTRIBUTION',
      browsersCSV,
      '\n',
      'REFERRERS / TRAFFIC SOURCES',
      referrersCSV,
      '\n',
      'DAILY TRAFFIC',
      dailyTrafficCSV,
      '\n',
      'VISITOR LOCATIONS',
      locationsCSV
    ].join('\n');
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=analytics-export-${new Date().toISOString().split('T')[0]}.csv`);
    
    // Send CSV data
    res.status(200).send(fullCSV);
  } catch (error) {
    console.error('Error generating CSV export:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSV export'
    });
  }
});

/**
 * Get basic site stats for public consumption
 * This provides just the key metrics that are safe to share publicly
 */
async function getPublicSiteStats() {
  try {
    // Get total page views (all time)
    const pageViewsResult = await db.select({
      count: count(analyticsPageViews.id),
    })
    .from(analyticsPageViews);
    
    const totalPageViews = pageViewsResult[0]?.count || 0;
    
    // Get total unique visitors (all time)
    const uniqueVisitorsResult = await db.select({
      count: count(sql`DISTINCT ${analyticsSessions.ip}`),
    })
    .from(analyticsSessions);
    
    const uniqueVisitors = uniqueVisitorsResult[0]?.count || 0;
    
    return {
      totalPageViews,
      uniqueVisitors,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting public site stats:', error);
    throw error;
  }
}

/**
 * Get analytics data for the public dashboard
 * @param days Number of days to include in the data (default: 30)
 * @param liveDataOnly If true, only include data from actual user visits (filters out bots/crawlers)
 */
async function getPublicAnalyticsData(days: number = 30, liveDataOnly: boolean = false) {
  try {
    // Use Florida Eastern timezone for all date calculations
    // This ensures "Today" means today in Florida, not UTC
    let startDate: Date;
    
    if (days === 1) {
      // "Today" - get midnight of today in Florida time
      startDate = getFloridaMidnightUTC(0);
    } else {
      // For multi-day ranges, go back (days-1) days from today in Florida time
      startDate = getFloridaMidnightUTC(days - 1);
    }
    
    const startDateStr = startDate.toISOString();
    
    // Log the date range for debugging (Florida timezone)
    const floridaDateStr = getFloridaDateString();
    console.log(`[Analytics] Florida date: ${floridaDateStr}, Query start: ${startDateStr}, Days: ${days}`);
    
    // Build comprehensive bot filter conditions
    const botFilter = liveDataOnly ? getBotFilterSQL() : '';
    const botFilterWithAlias = liveDataOnly ? getBotFilterSQL('s') : '';
    
    // Get sessions data using raw SQL with comprehensive bot filtering
    // Note: Bot probe path filtering is applied only to active users list (small dataset)
    // to avoid query timeouts on large analytics tables
    let sessionsQuery = `
      SELECT COUNT(*) as count 
      FROM analytics_sessions 
      WHERE start_timestamp >= '${startDateStr}'
    `;
    if (liveDataOnly) {
      sessionsQuery += ` AND ${botFilter}`;
    }
    
    const sessionsResult = await db.execute(sql.raw(sessionsQuery));
    const totalSessions = Number(sessionsResult.rows[0]?.count) || 0;
    
    // Get unique visitors using raw SQL with comprehensive bot filtering
    let uniqueVisitorsQuery = `
      SELECT COUNT(DISTINCT COALESCE(visitor_fingerprint, ip)) as count 
      FROM analytics_sessions 
      WHERE start_timestamp >= '${startDateStr}'
    `;
    if (liveDataOnly) {
      uniqueVisitorsQuery += ` AND ${botFilter}`;
    }
    
    const uniqueVisitorsResult = await db.execute(sql.raw(uniqueVisitorsQuery));
    const uniqueVisitors = Number(uniqueVisitorsResult.rows[0]?.count) || 0;
    
    // Get average session duration
    // When Filtered is ON (liveDataOnly): Only includes sessions > 10 seconds (engaged visitors)
    // When Filtered is OFF: Shows raw average of all sessions
    // Cap duration at 60 minutes (3600 seconds) to exclude outliers from tabs left open for hours/days
    let durationQuery = `
      SELECT AVG(LEAST(duration, 3600)) as avg_duration
      FROM analytics_sessions
      WHERE start_timestamp >= '${startDateStr}' 
        AND duration IS NOT NULL
    `;
    if (liveDataOnly) {
      // Apply 10 second minimum filter and bot filter for engaged human visitors
      // Duration is stored in SECONDS in the database, so threshold is 10 (not 10000)
      durationQuery += ` AND duration > 10 AND ${botFilter}`;
    }
    
    const durationResult = await db.execute(sql.raw(durationQuery));
    
    let avgSessionDuration = 0;
    if (durationResult && durationResult.rows.length > 0) {
      const avgDurationValue = durationResult.rows[0].avg_duration;
      // Duration is stored in SECONDS in the database (not milliseconds)
      avgSessionDuration = avgDurationValue ? Math.round(parseInt(String(avgDurationValue))) : 0;
    }
    
    // Get page views with comprehensive bot filtering
    let pageViewsQuery = `
      SELECT COUNT(*) as count 
      FROM analytics_page_views pv
      LEFT JOIN analytics_sessions s ON pv.session_id = s.session_id
      WHERE pv.timestamp >= '${startDateStr}'
    `;
    if (liveDataOnly) {
      pageViewsQuery += ` AND ${botFilterWithAlias}`;
    }
    
    const pageViewsResult = await db.execute(sql.raw(pageViewsQuery));
    const totalPageViews = Number(pageViewsResult.rows[0]?.count) || 0;
    
    // Get top pages with comprehensive bot filtering
    let topPagesQuery = `
      SELECT pv.path, pv.page_type as "pageType", COUNT(*) as views 
      FROM analytics_page_views pv
      LEFT JOIN analytics_sessions s ON pv.session_id = s.session_id
      WHERE pv.timestamp >= '${startDateStr}'
    `;
    if (liveDataOnly) {
      topPagesQuery += ` AND ${botFilterWithAlias}`;
    }
    topPagesQuery += ` GROUP BY pv.path, pv.page_type ORDER BY views DESC LIMIT 10`;
    
    const topPagesResultRaw = await db.execute(sql.raw(topPagesQuery));
    
    // Format top pages for the dashboard
    const topPages = topPagesResultRaw.rows.map((row: any) => ({
      url: row.path || '',
      title: getPageTitleFromPath(row.path || ''),
      views: Number(row.views)
    }));
    
    // Get device distribution with comprehensive bot filtering
    let deviceQuery = `
      SELECT device, COUNT(*) as count 
      FROM analytics_sessions 
      WHERE start_timestamp >= '${startDateStr}'
    `;
    if (liveDataOnly) {
      deviceQuery += ` AND ${botFilter}`;
    }
    deviceQuery += ` GROUP BY device ORDER BY count DESC`;
    
    const devicesResultRaw = await db.execute(sql.raw(deviceQuery));
    const devicesResult = devicesResultRaw.rows.map((row: any) => ({
      device: row.device,
      count: Number(row.count)
    }));
    
    // Get browser distribution with comprehensive bot filtering
    let browserQuery = `
      SELECT browser, COUNT(*) as count 
      FROM analytics_sessions 
      WHERE start_timestamp >= '${startDateStr}'
    `;
    if (liveDataOnly) {
      browserQuery += ` AND ${botFilter}`;
    }
    browserQuery += ` GROUP BY browser ORDER BY count DESC`;
    
    const browsersResultRaw = await db.execute(sql.raw(browserQuery));
    const browsersResult = browsersResultRaw.rows.map((row: any) => ({
      browser: row.browser,
      count: Number(row.count)
    }));
    
    // Get referrers with comprehensive bot filtering
    let referrersQuery = `
      SELECT pv.referrer, COUNT(*) as count 
      FROM analytics_page_views pv
      LEFT JOIN analytics_sessions s ON pv.session_id = s.session_id
      WHERE pv.timestamp >= '${startDateStr}'
        AND pv.referrer IS NOT NULL
    `;
    if (liveDataOnly) {
      referrersQuery += ` AND ${botFilterWithAlias}`;
    }
    referrersQuery += ` GROUP BY pv.referrer ORDER BY count DESC LIMIT 10`;
    
    const referrersResultRaw = await db.execute(sql.raw(referrersQuery));
    const referrersResult = referrersResultRaw.rows.map((row: any) => ({
      referrer: row.referrer,
      count: Number(row.count)
    }));
    
    // Get geo data with comprehensive bot filtering
    let geoQuery = `
      SELECT 
        a.country, 
        a.city, 
        a.region, 
        a.ip, 
        a.device, 
        a.browser, 
        a.latitude, 
        a.longitude,
        COUNT(DISTINCT a.id) as session_count,
        ARRAY_AGG(DISTINCT p.path) as visited_pages
      FROM analytics_sessions a
      LEFT JOIN analytics_page_views p ON a.session_id = p.session_id
      WHERE 
        a.start_timestamp >= '${startDateStr}'
        AND a.latitude IS NOT NULL 
        AND a.longitude IS NOT NULL
    `;
    
    // If liveDataOnly is true, apply comprehensive bot filter
    if (liveDataOnly) {
      geoQuery += ` AND ${getBotFilterSQL('a')}`;
    }
    
    geoQuery += `
      GROUP BY 
        a.country, 
        a.city, 
        a.region, 
        a.ip, 
        a.device, 
        a.browser, 
        a.latitude, 
        a.longitude
      ORDER BY COUNT(DISTINCT a.id) DESC
    `;
    
    const geoResult = await db.execute(sql.raw(geoQuery));
    
    // If there's no geo data and we're NOT in liveDataOnly mode, generate test data
    // This ensures the map works when showing all data, but won't show fake locations in "Live data only" mode
    if ((!geoResult.rows || geoResult.rows.length === 0) && !liveDataOnly) {
      console.log('[Analytics Public] Using test geo data for dashboard');
      geoResult.rows = generateTestGeoData();
    } else if ((!geoResult.rows || geoResult.rows.length === 0) && liveDataOnly) {
      console.log('[Analytics Public] No geo data available for live data only mode');
      // Empty array for live data only mode when no real visitors exist
      geoResult.rows = [];
    }
    
    // Get daily traffic data
    const dailyTrafficData = await getDailyTrafficData(startDate, liveDataOnly);
    
    // Return data formatted for the dashboard
    return {
      metrics: {
        totalSessions,
        uniqueVisitors,
        avgSessionDuration,
        pageViews: totalPageViews,
        bounceRate: calculateBounceRate(totalSessions, totalPageViews)
      },
      topPages,
      devices: (() => {
        // Consolidate device types by creating a map to aggregate counts
        const deviceCounts = new Map();
        
        // Process each device type
        devicesResult.forEach(d => {
          // Standardize device types to lowercase and ensure valid categories
          let deviceName = (d.device || '').toLowerCase();
          
          // Map device types to standard categories (desktop, mobile, tablet)
          // Always classify as either desktop, mobile, or tablet - never unknown
          if (deviceName === 'mobile' || deviceName.includes('phone')) {
            deviceName = 'mobile';
          } else if (deviceName === 'tablet' || deviceName.includes('ipad')) {
            deviceName = 'tablet';
          } else {
            // Default to desktop for any unknown or ambiguous device type
            deviceName = 'desktop';
          }
          
          // Increment the count for this device type
          const currentCount = deviceCounts.get(deviceName) || 0;
          deviceCounts.set(deviceName, currentCount + Number(d.count || 0));
        });
        
        // Convert map to array for the expected format
        return Array.from(deviceCounts.entries()).map(([name, count]) => ({
          name,
          count
        }));
      })(),
      browsers: (() => {
        // Consolidate browser types by creating a map to aggregate counts
        const browserCounts = new Map();
        
        // Process each browser
        browsersResult.forEach(b => {
          // Get standardized browser name and normalize it
          let browserName = b.browser || 'Other';
          
          // Group all Chrome versions together
          if (browserName.startsWith('Chrome')) {
            browserName = 'Chrome';
          }
          
          // Rename Unknown to Other
          if (browserName === 'Unknown') {
            browserName = 'Other';
          }
          
          // Increment count for this browser
          const currentCount = browserCounts.get(browserName) || 0;
          browserCounts.set(browserName, currentCount + Number(b.count || 0));
        });
        
        // Convert map to array for the expected format
        return Array.from(browserCounts.entries()).map(([name, count]) => ({
          name,
          count
        }));
      })(),
      referrers: (() => {
        // Consolidate referrers by creating a map to aggregate counts
        const referrerCounts = new Map();
        
        // Process each referrer
        referrersResult.forEach(r => {
          // Format and standardize the referrer URL
          const referrerName = formatReferrerUrl(r.referrer || '');
          
          // Increment count for this referrer
          const currentCount = referrerCounts.get(referrerName) || 0;
          referrerCounts.set(referrerName, currentCount + Number(r.count || 0));
        });
        
        // Convert map to array for the expected format and sort by count
        return Array.from(referrerCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
      })(),
      geoData: {
        // Extract all unique page paths from all visitors for filtering options
        pages: (() => {
          // Get all paths and filter out duplicates
          const allPaths: string[] = [];
          const pathMap = new Map<string, boolean>();
          
          geoResult.rows.forEach((row: any) => {
            const paths = row.visited_pages || [];
            paths.filter(Boolean).forEach((path: string) => {
              if (!pathMap.has(path)) {
                pathMap.set(path, true);
                allPaths.push(path);
              }
            });
          });
          
          // Map paths to objects with title
          return allPaths.map((path: string) => ({
            path,
            title: getPageTitleFromPath(path)
          }));
        })(),
        
        locations: geoResult.rows.map((row: any) => {
          // Format visited pages to include both path and title
          const visitedPages = (row.visited_pages || [])
            .filter(Boolean)
            .map((path: string) => ({
              path,
              title: getPageTitleFromPath(path)
            }));
            
          // Standardize device type to lowercase and ensure valid categories
          let deviceType = (row.device || '').toLowerCase();
          
          // Map device types to standard categories (desktop, mobile, tablet)
          // Always classify as either desktop, mobile, or tablet - never unknown
          if (deviceType === 'mobile' || deviceType.includes('phone')) {
            deviceType = 'mobile';
          } else if (deviceType === 'tablet' || deviceType.includes('ipad')) {
            deviceType = 'tablet';
          } else {
            // Default to desktop for any unknown or ambiguous device type
            deviceType = 'desktop';
          }
          
          return {
            country: row.country || 'Unknown',
            region: row.region || '',
            city: row.city || 'Unknown',
            ip: row.ip || '',
            device: deviceType,
            browser: (() => {
              // Standardize browser name
              let browserName = row.browser || 'Other';
              
              // Group all Chrome versions
              if (browserName.startsWith('Chrome')) {
                browserName = 'Chrome';
              }
              
              // Rename Unknown to Other
              if (browserName === 'Unknown') {
                browserName = 'Other';
              }
              
              return browserName;
            })(),
            lat: Number(row.latitude),
            lng: Number(row.longitude),
            sessions: Number(row.session_count || 0),
            pages: visitedPages,
            weight: Math.min(Number(row.session_count || 0) / Math.max(1, totalSessions) * 10, 1)
          };
        })
      },
      dailyVisitors: dailyTrafficData,
      userJourneys: {
        pathTransitions: await getPathTransitions(startDate, liveDataOnly),
        entryPages: await getEntryPages(startDate, liveDataOnly),
        exitPages: await getExitPages(startDate, liveDataOnly)
      },
      timeRange: {
        startDate: startDate.toISOString(),
        // Use Florida timezone for endDate to match how startDate is calculated
        endDate: getFloridaEndOfDayUTC().toISOString(),
        days,
        // Also include Florida-formatted date strings for display
        floridaStartDate: formatDateDisplayFlorida(startDate),
        floridaEndDate: getFloridaDateString(),
      }
    };
  } catch (error) {
    console.error('Error getting public analytics data:', error);
    throw error;
  }
}

// Helper function to estimate bounce rate
function calculateBounceRate(sessions: number, pageViews: number): number {
  if (sessions === 0) return 0;
  // Estimate bounce rate as percentage of sessions with just one page view
  const estimatedBounces = Math.max(0, sessions - (pageViews - sessions));
  return Math.round((estimatedBounces / sessions) * 100);
}

// Helper function to format referrer URLs
function formatReferrerUrl(url: string): string {
  if (!url) return 'Direct / None';
  try {
    const parsed = new URL(url);
    return parsed.hostname || url;
  } catch (e) {
    return url;
  }
}

// Helper function to get a readable page title from path
function getPageTitleFromPath(path: string): string {
  if (!path) return 'Unknown Page';
  
  // Remove query string if present
  const pathOnly = path.split('?')[0];
  
  // Remove trailing slash if present
  const cleanPath = pathOnly.endsWith('/') ? pathOnly.slice(0, -1) : pathOnly;
  
  // If it's the homepage
  if (cleanPath === '' || cleanPath === '/') {
    return 'Homepage';
  }
  
  // Get the last segment of the path
  const segments = cleanPath.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  
  if (!lastSegment) return 'Unknown Page';
  
  // Replace hyphens and underscores with spaces and capitalize
  return lastSegment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

/**
 * Get daily traffic data for the specified date range
 * @param startDate The start date for the data range
 * @param liveDataOnly If true, only include data from actual user visits (no test data)
 * @returns Array of objects with date and visitor count
 */
async function getDailyTrafficData(startDate: Date, liveDataOnly: boolean = false) {
  try {
    // Convert Date to string for direct insertion in SQL
    const startDateStr = startDate.toISOString();
    
    // Build comprehensive bot filter for daily traffic
    const botFilter = liveDataOnly ? getBotFilterSQL() : '';
    
    // Build query with or without the comprehensive bot filter
    // Use Florida timezone (America/New_York) for DATE grouping to match dashboard expectations
    let queryStr = `
      SELECT 
        DATE(start_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') as day,
        COUNT(DISTINCT id) as sessions,
        COUNT(DISTINCT COALESCE(visitor_fingerprint, ip)) as unique_visitors
      FROM analytics_sessions 
      WHERE start_timestamp >= '${startDateStr}'
    `;
    
    // If liveDataOnly is true, apply comprehensive bot filter
    if (liveDataOnly) {
      queryStr += ` AND ${botFilter}`;
    }
    
    queryStr += `
      GROUP BY DATE(start_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
      ORDER BY day ASC
    `;
    
    // Execute the query without parameters since we've embedded them directly
    const result = await db.execute(sql.raw(queryStr));
    
    // If no results, return empty days with zero counts (no dummy data)
    if (!result || !result.rows || result.rows.length === 0) {
      // Create date range with zero values for proper chart display (Florida timezone)
      // Use Date.UTC to avoid server-local timezone issues
      const floridaComponents = getFloridaDateComponents();
      const floridaTodayUTC = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day, 12, 0, 0));
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(floridaTodayUTC.getTime() - i * 24 * 60 * 60 * 1000);
        days.push(formatDateForChartFlorida(date));
      }
      // Return real dates with zero values - not mock data
      return days.map(date => ({ date, visitors: 0, sessions: 0 }));
    }
    
    // Fill in missing dates in the range (Florida timezone)
    // Use Florida "now" as end date to ensure proper range - construct using Date.UTC to avoid server-local issues
    const floridaComponents = getFloridaDateComponents();
    const floridaEndDate = new Date(Date.UTC(floridaComponents.year, floridaComponents.month - 1, floridaComponents.day, 23, 59, 59));
    const days = getDaysInRange(startDate, floridaEndDate);
    const resultsMap = new Map();
    
    // Create a map of date -> count (use M-D format to match getDaysInRange)
    result.rows.forEach((row: any) => {
      if (row.day) {
        // The DB returns a Florida-local DATE (e.g., "2026-01-31")
        // We need to treat this as a Florida date, not UTC
        // Parse the date parts and format directly to avoid timezone conversion issues
        const dayStr = String(row.day);
        // Parse YYYY-MM-DD format
        const match = dayStr.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          // Use the date parts directly in M-D format to match the days array
          const dateStr = `${parseInt(match[2])}-${parseInt(match[3])}`;
          resultsMap.set(dateStr, {
            visitors: Number(row.unique_visitors) || 0,
            sessions: Number(row.sessions) || 0
          });
        }
      }
    });
    
    // Map dates to array with 0 for missing dates
    return days.map(date => ({
      date,
      visitors: (resultsMap.get(date)?.visitors || 0),
      sessions: (resultsMap.get(date)?.sessions || 0)
    }));
  } catch (error) {
    console.error('Error getting daily traffic data:', error);
    // Return empty array to prevent dashboard errors
    return [];
  }
}

/**
 * Get array of formatted date strings in a date range (using Florida timezone)
 */
function getDaysInRange(start: Date, end: Date): string[] {
  const days: string[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    // Format date in Florida timezone for display (M-D format)
    days.push(formatDateForChartFlorida(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

/**
 * Format date to YYYY-MM-DD for database queries
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get path transitions data for user journey visualization
 * @param startDate The start date for the data range
 * @param liveDataOnly If true, only include data from actual user visits (no test data)
 * @returns Array of objects with source, target and value
 */
async function getPathTransitions(startDate: Date, liveDataOnly: boolean = false) {
  try {
    // Convert Date to string for direct insertion in SQL
    const startDateStr = startDate.toISOString();
    
    // Build comprehensive bot filter for path transitions
    const botFilterWithAlias = liveDataOnly ? getBotFilterSQL('s') : '';
    
    // Create parameterized query string
    // Normalize paths by removing trailing slashes to prevent duplicates like /calendar vs /calendar/
    // Also filter out same-page transitions (page refreshes)
    let queryStr = `
      WITH page_views AS (
        SELECT 
          pv.session_id,
          CASE 
            WHEN pv.path = '/' THEN '/'
            ELSE RTRIM(pv.path, '/')
          END as path,
          pv.timestamp,
          ROW_NUMBER() OVER (PARTITION BY pv.session_id ORDER BY pv.timestamp) as view_order
        FROM analytics_page_views pv
    `;
    
    // If liveDataOnly is true, add a join to sessions and apply comprehensive bot filter
    if (liveDataOnly) {
      queryStr += `
        JOIN analytics_sessions s ON pv.session_id = s.session_id
        WHERE pv.timestamp >= '${startDateStr}'
          AND ${botFilterWithAlias}
      `;
    } else {
      queryStr += `
        WHERE pv.timestamp >= '${startDateStr}'
      `;
    }
    
    queryStr += `
      ),
      page_transitions AS (
        SELECT 
          a.path as source_page,
          b.path as target_page,
          COUNT(*) as transition_count
        FROM page_views a
        JOIN page_views b ON a.session_id = b.session_id AND a.view_order = b.view_order - 1
        WHERE a.path != b.path
        GROUP BY a.path, b.path
        ORDER BY transition_count DESC
        LIMIT 20
      )
      SELECT 
        source_page,
        target_page,
        transition_count
      FROM page_transitions
      WHERE transition_count > 1
    `;
    
    // Execute the query without parameters since we've embedded them directly
    const result = await db.execute(sql.raw(queryStr));
    
    if (!result || !result.rows || result.rows.length === 0) {
      return [];
    }
    
    // Format the data for visualization
    return result.rows.map((row: any) => ({
      source: getPageTitleFromPath(row.source_page || ''),
      target: getPageTitleFromPath(row.target_page || ''),
      value: Number(row.transition_count)
    }));
  } catch (error) {
    console.error('Error getting path transitions data:', error);
    return [];
  }
}

/**
 * Get entry pages data for user journey visualization
 * @param startDate The start date for the data range
 * @param liveDataOnly If true, only include data from actual user visits (no test data)
 * @returns Array of entry pages with count
 */
async function getEntryPages(startDate: Date, liveDataOnly: boolean = false) {
  try {
    // Convert Date to string for direct insertion in SQL
    const startDateStr = startDate.toISOString();
    
    // Build comprehensive bot filter for entry pages
    const botFilterWithAlias = liveDataOnly ? getBotFilterSQL('s') : '';
    
    // Create parameterized query string
    let queryStr = `
      WITH first_page_views AS (
        SELECT 
          pv.session_id,
          pv.path,
          ROW_NUMBER() OVER (PARTITION BY pv.session_id ORDER BY pv.timestamp) as view_order
        FROM analytics_page_views pv
    `;
    
    // If liveDataOnly is true, add a join to sessions and apply comprehensive bot filter
    if (liveDataOnly) {
      queryStr += `
        JOIN analytics_sessions s ON pv.session_id = s.session_id
        WHERE pv.timestamp >= '${startDateStr}'
          AND ${botFilterWithAlias}
      `;
    } else {
      queryStr += `
        WHERE pv.timestamp >= '${startDateStr}'
      `;
    }
    
    queryStr += `
      )
      SELECT 
        path,
        COUNT(*) as entry_count
      FROM first_page_views
      WHERE view_order = 1
      GROUP BY path
      ORDER BY entry_count DESC
      LIMIT 10
    `;
    
    // Execute the query without parameters since we've embedded them directly
    const result = await db.execute(sql.raw(queryStr));
    
    if (!result || !result.rows || result.rows.length === 0) {
      return [];
    }
    
    // Format the data for visualization
    return result.rows.map((row: any) => ({
      page: getPageTitleFromPath(row.path || ''),
      count: Number(row.entry_count)
    }));
  } catch (error) {
    console.error('Error getting entry pages data:', error);
    return [];
  }
}

/**
 * Get exit pages data for user journey visualization
 * @param startDate The start date for the data range
 * @param liveDataOnly If true, only include data from actual user visits (no test data)
 * @returns Array of exit pages with count
 */
async function getExitPages(startDate: Date, liveDataOnly: boolean = false) {
  try {
    // Convert Date to string for direct insertion in SQL
    const startDateStr = startDate.toISOString();
    
    // Build comprehensive bot filter for exit pages
    const botFilterWithAlias = liveDataOnly ? getBotFilterSQL('s') : '';
    
    // Create parameterized query string
    let queryStr = `
      WITH last_page_views AS (
        SELECT 
          pv.session_id,
          pv.path,
          ROW_NUMBER() OVER (PARTITION BY pv.session_id ORDER BY pv.timestamp DESC) as reverse_order
        FROM analytics_page_views pv
    `;
    
    // If liveDataOnly is true, add a join to sessions and apply comprehensive bot filter
    if (liveDataOnly) {
      queryStr += `
        JOIN analytics_sessions s ON pv.session_id = s.session_id
        WHERE pv.timestamp >= '${startDateStr}'
          AND ${botFilterWithAlias}
      `;
    } else {
      queryStr += `
        WHERE pv.timestamp >= '${startDateStr}'
      `;
    }
    
    queryStr += `
      )
      SELECT 
        path,
        COUNT(*) as exit_count
      FROM last_page_views
      WHERE reverse_order = 1
      GROUP BY path
      ORDER BY exit_count DESC
      LIMIT 10
    `;
    
    // Execute the query without parameters since we've embedded them directly
    const result = await db.execute(sql.raw(queryStr));
    
    if (!result || !result.rows || result.rows.length === 0) {
      return [];
    }
    
    // Format the data for visualization
    return result.rows.map((row: any) => ({
      page: getPageTitleFromPath(row.path || ''),
      count: Number(row.exit_count)
    }));
  } catch (error) {
    console.error('Error getting exit pages data:', error);
    return [];
  }
}

export default router;