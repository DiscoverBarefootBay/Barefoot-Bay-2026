// server/services/analytics-service.ts
import { Request } from 'express';
import { db } from '../db';
import { 
    analyticsSessions, 
    analyticsPageViews, 
    analyticsEvents,
    users // Make sure this is used or remove if not
} from '@workspace/db'; // Ensure this path is correct for your Drizzle schema
import geoip from 'geoip-lite';
import crypto from 'crypto';
import { and, asc, count, desc, eq, gte, or, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

// Comprehensive list of bot/crawler user-agent patterns to filter out
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

// Service for analytics operations
class AnalyticsService {
    
    /**
     * Start a new analytics session.
     * This method is called by the analyticsMiddleware when no existing session is found.
     */
    public async startSession(data: {
        userId: number | null | undefined;
        ipAddress: string;
        userAgent: string;
        deviceType: string;
        browser: string;
        referrer: string | null;
        entryPage: string;
        properties: {
            screen?: { width: string | string[] | undefined, height: string | string[] | undefined };
            language?: string | string[] | undefined;
        };
    }): Promise<string> {
        try {
            const newSessionId = crypto.randomUUID();
            const now = new Date();
            const os = this.detectOperatingSystem(data.userAgent); // Uses existing private method
            const visitorFingerprint = this.createVisitorFingerprint(data.ipAddress, data.userAgent);
            const returningVisitor = await this.isReturningVisitor(visitorFingerprint);
            let geoData = data.ipAddress ? geoip.lookup(data.ipAddress) : null;

            if (!geoData && process.env.NODE_ENV !== 'production') {
                geoData = {
                    range: [0, 0], country: 'US', region: 'FL', eu: '0',
                    timezone: 'America/New_York', city: 'Orlando',
                    ll: [28.5383, -81.3792], metro: 0, area: 0
                };
            }

            await db.insert(analyticsSessions).values({
                sessionId: newSessionId,
                userId: data.userId,
                ip: data.ipAddress || 'unknown',
                userAgent: data.userAgent || 'unknown',
                device: data.deviceType,
                browser: data.browser,
                os: os,
                country: geoData?.country || null,
                region: geoData?.region || null,
                city: geoData?.city || null,
                latitude: geoData?.ll ? geoData.ll[0] : null,
                longitude: geoData?.ll ? geoData.ll[1] : null,
                startTimestamp: now,
                endTimestamp: now, 
                pagesViewed: 0, 
                isActive: true,
                referrer: data.referrer,
                entryPage: data.entryPage,
                visitorFingerprint,
                isReturningVisitor: returningVisitor,
                // customDimensions: data.properties // Optional: consider if you want to store these initial properties
            });

            return newSessionId;

        } catch (error) {
            logger.error({ err: error }, 'analytics: error starting session');
            throw error; 
        }
    }

    /**
     * Track a new page view
     */
    async trackPageView(req: Request, data: any) { // `data` here is what analyticsMiddleware passes
        try {
            // Get userId from either req.user (populated by passport) or session passport user
            const userId = (req as any).user?.id || (req as any).session?.passport?.user || null;
            const sessionId = await this.getOrCreateSession(req);

            const userAgent = (req && req.headers) ? req.headers['user-agent'] as string : 'unknown';
            const ip = this.getClientIp(req);

            const pageViewData = {
                sessionId,
                userId,
                ip,
                userAgent,
                path: (data && data.url) ? data.url : (req && req.url) ? req.url : '/', 
                referrer: (data && data.properties?.referrer) || (req && req.headers && req.headers.referer) || null, 
                pageType: (data && data.properties?.pageType) || 'page', 
                pageCategory: (data && data.properties?.pageCategory) || 'uncategorized', 
                timestamp: new Date(),
                customDimensions: (data && data.properties) || {} 
            };

            await db.update(analyticsSessions)
                .set({ 
                    pagesViewed: sql`pages_viewed + 1`,
                    isActive: true, 
                    endTimestamp: new Date() 
                })
                .where(eq(analyticsSessions.sessionId, sessionId));

            const [pageView] = await db.insert(analyticsPageViews)
                .values(pageViewData)
                .returning();

            return { sessionId, pageViewId: pageView.id };
        } catch (error) {
            logger.error({ err: error, path: req.path }, 'analytics: error tracking page view');
            throw error;
        }
    }

    /**
     * Track a user event
     */
    async trackEvent(req: Request, data: any) {
        try {
            const sessionId = await this.getOrCreateSession(req);
            const ip = this.getClientIp(req);
            const userAgent = req.headers['user-agent'] as string;
            // Get userId from either req.user (populated by passport) or session passport user
            const userId = (req as any).user?.id || (req as any).session?.passport?.user || null;

            const eventData = {
                sessionId,
                userId,
                eventType: data.eventType,
                category: data.eventCategory || this.getCategoryForEventType(data.eventType),
                action: data.eventAction || 'interaction',
                label: data.eventLabel || '',
                value: data.eventValue || null,
                path: data.path || data.properties?.url || req.path,
                timestamp: new Date(),
                eventData: data.properties || {},
                positionData: data.positionData || {}
            };

            await db.update(analyticsSessions)
                .set({ 
                    endTimestamp: new Date(),
                    isActive: true 
                })
                .where(eq(analyticsSessions.sessionId, sessionId));

            const [event] = await db.insert(analyticsEvents)
                .values(eventData)
                .returning();

            return { sessionId, eventId: event.id };
        } catch (error) {
            logger.error({ err: error }, 'analytics: error tracking event');
            throw error;
        }
    }

    /**
     * End session tracking
     */
    async endSession(req: Request) {
        try {
            const sessionId = req.cookies['analytics_session_id'];

            if (sessionId) {
                const [session] = await db.select({
                    startTime: analyticsSessions.startTimestamp
                })
                .from(analyticsSessions)
                .where(eq(analyticsSessions.sessionId, sessionId));

                const endTime = new Date();
                let duration = null;

                if (session?.startTime) {
                    duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
                }

                await db.update(analyticsSessions)
                    .set({ 
                        endTimestamp: endTime,
                        duration: duration,
                        isActive: false
                    })
                    .where(eq(analyticsSessions.sessionId, sessionId));

                return { success: true, sessionId, duration };
            }

            return { success: false, message: 'No active session found' };
        } catch (error) {
            logger.error({ err: error }, 'analytics: error ending session');
            throw error;
        }
    }

    /**
     * Get comprehensive bot filter conditions for SQL queries
     * Filters out bots, crawlers, monitoring tools, and internal traffic
     * @param tableAlias - Optional table alias (e.g., 's' for joined queries)
     */
    private getBotFilterSQL(tableAlias?: string) {
        const prefix = tableAlias ? `${tableAlias}.` : '';
        const patterns = BOT_USER_AGENT_PATTERNS.map(p => 
            `${prefix}user_agent NOT LIKE '${p}'`
        ).join(' AND ');
        
        return `
            ${prefix}ip NOT LIKE '127.%'
            AND ${prefix}ip != 'unknown'
            AND ${prefix}ip NOT LIKE '192.168.%'
            AND ${prefix}ip NOT LIKE '10.%'
            AND ${patterns}
        `;
    }
    
    /**
     * Get dashboard data
     */
    async getDashboardData(days: number = 30, liveDataOnly: boolean = false) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const startDateStr = startDate.toISOString();

            console.log(`[Analytics] Getting dashboard data for ${days} days, liveDataOnly: ${liveDataOnly}`);

            // Build bot filter conditions - one for direct queries, one for joined queries with 's' alias
            const botFilter = liveDataOnly ? this.getBotFilterSQL() : '';
            const botFilterJoined = liveDataOnly ? this.getBotFilterSQL('s') : '';
            
            // Get total sessions using raw SQL for comprehensive bot filtering
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

            // Get unique visitors using raw SQL for comprehensive bot filtering
            // Use visitor fingerprints if available, fallback to counting distinct IPs
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

            // Get new vs returning visitor counts computed from visitor identity
            // history rather than the stored `is_returning_visitor` flag (which is
            // set forward-only at session creation and is effectively always false
            // on historical data). A visitor identity is COALESCE(visitor_fingerprint, ip).
            // A visitor is "returning" if their first-ever session predates the
            // window and "new" if their first-ever session falls within it. Counts
            // are visitor-based (not session-based) and sum to uniqueVisitors.
            let newVsReturningQuery = `
                WITH visitor_identities AS (
                    SELECT
                        COALESCE(visitor_fingerprint, ip) AS visitor_id,
                        MIN(start_timestamp) AS first_seen,
                        MAX(start_timestamp) AS last_seen
                    FROM analytics_sessions
                    WHERE COALESCE(visitor_fingerprint, ip) IS NOT NULL
                    AND COALESCE(visitor_fingerprint, ip) <> 'unknown'
            `;
            if (liveDataOnly) {
                newVsReturningQuery += ` AND ${botFilter}`;
            }
            newVsReturningQuery += `
                    GROUP BY COALESCE(visitor_fingerprint, ip)
                )
                SELECT
                    COUNT(*) FILTER (WHERE first_seen >= '${startDateStr}') AS new_count,
                    COUNT(*) FILTER (WHERE first_seen < '${startDateStr}') AS returning_count
                FROM visitor_identities
                WHERE last_seen >= '${startDateStr}'
            `;

            const newVsReturningResult = await db.execute(sql.raw(newVsReturningQuery));
            const newVisitors = Number(newVsReturningResult.rows[0]?.new_count) || 0;
            const returningVisitors = Number(newVsReturningResult.rows[0]?.returning_count) || 0;

            // Get page views with bot filtering through session join
            let pageViewsQuery = `
                SELECT COUNT(*) as count 
                FROM analytics_page_views pv
                LEFT JOIN analytics_sessions s ON pv.session_id = s.session_id
                WHERE pv.timestamp >= '${startDateStr}'
            `;
            if (liveDataOnly) {
                pageViewsQuery += ` AND (${botFilterJoined} OR s.session_id IS NULL)`;
            }
            
            const pageViewsResult = await db.execute(sql.raw(pageViewsQuery));
            const totalPageViews = Number(pageViewsResult.rows[0]?.count) || 0;

            // Get top pages with bot filtering using raw SQL
            let topPagesQuery = `
                SELECT pv.path, pv.page_type as "pageType", COUNT(*) as views 
                FROM analytics_page_views pv
                LEFT JOIN analytics_sessions s ON pv.session_id = s.session_id
                WHERE pv.timestamp >= '${startDateStr}'
            `;
            if (liveDataOnly) {
                topPagesQuery += ` AND (${botFilterJoined} OR s.session_id IS NULL)`;
            }
            topPagesQuery += ` GROUP BY pv.path, pv.page_type ORDER BY views DESC LIMIT 10`;
            
            const topPagesResultRaw = await db.execute(sql.raw(topPagesQuery));
            const topPagesResult = topPagesResultRaw.rows.map((row: any) => {
                const path = row.path || '/';
                const title = this.generateTitleFromPath(path);
                return {
                    url: path,
                    title: title,
                    views: Number(row.views)
                };
            });

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
            
            const deviceResultRaw = await db.execute(sql.raw(deviceQuery));
            const deviceResult = deviceResultRaw.rows.map((row: any) => ({
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
            
            const browserResultRaw = await db.execute(sql.raw(browserQuery));
            const browserResult = browserResultRaw.rows.map((row: any) => ({
                browser: row.browser,
                count: Number(row.count)
            }));

            // Get OS distribution with comprehensive bot filtering
            let osQuery = `
                SELECT os, COUNT(*) as count 
                FROM analytics_sessions 
                WHERE start_timestamp >= '${startDateStr}'
            `;
            if (liveDataOnly) {
                osQuery += ` AND ${botFilter}`;
            }
            osQuery += ` GROUP BY os ORDER BY count DESC`;
            
            const osResultRaw = await db.execute(sql.raw(osQuery));
            const osResult = osResultRaw.rows.map((row: any) => ({
                os: row.os,
                count: Number(row.count)
            }));

            // Get country distribution with comprehensive bot filtering
            let countryQuery = `
                SELECT country, COUNT(*) as count 
                FROM analytics_sessions 
                WHERE start_timestamp >= '${startDateStr}'
            `;
            if (liveDataOnly) {
                countryQuery += ` AND ${botFilter}`;
            }
            countryQuery += ` GROUP BY country ORDER BY count DESC`;
            
            const countryResultRaw = await db.execute(sql.raw(countryQuery));
            const countryResult = countryResultRaw.rows.map((row: any) => ({
                country: row.country,
                count: Number(row.count)
            }));

            // Get total events with bot filtering
            let eventsQuery = `
                SELECT COUNT(*) as count 
                FROM analytics_events e
                LEFT JOIN analytics_sessions s ON e.session_id = s.session_id
                WHERE e.timestamp >= '${startDateStr}'
            `;
            if (liveDataOnly) {
                eventsQuery += ` AND (${botFilterJoined} OR s.session_id IS NULL)`;
            }
            
            const eventsResultRaw = await db.execute(sql.raw(eventsQuery));
            const totalEvents = Number(eventsResultRaw.rows[0]?.count) || 0;

            // Get events by type with bot filtering
            let eventsByTypeQuery = `
                SELECT e.event_type as type, COUNT(*) as count 
                FROM analytics_events e
                LEFT JOIN analytics_sessions s ON e.session_id = s.session_id
                WHERE e.timestamp >= '${startDateStr}'
            `;
            if (liveDataOnly) {
                eventsByTypeQuery += ` AND (${botFilterJoined} OR s.session_id IS NULL)`;
            }
            eventsByTypeQuery += ` GROUP BY e.event_type ORDER BY count DESC`;
            
            const eventsByTypeResultRaw = await db.execute(sql.raw(eventsByTypeQuery));
            const eventsByTypeResult = eventsByTypeResultRaw.rows.map((row: any) => ({
                type: row.type,
                count: Number(row.count)
            }));

            // Get events by category with bot filtering
            let eventsByCategoryQuery = `
                SELECT e.category, COUNT(*) as count 
                FROM analytics_events e
                LEFT JOIN analytics_sessions s ON e.session_id = s.session_id
                WHERE e.timestamp >= '${startDateStr}'
            `;
            if (liveDataOnly) {
                eventsByCategoryQuery += ` AND (${botFilterJoined} OR s.session_id IS NULL)`;
            }
            eventsByCategoryQuery += ` GROUP BY e.category ORDER BY count DESC`;
            
            const eventsByCategoryResultRaw = await db.execute(sql.raw(eventsByCategoryQuery));
            const eventsByCategoryResult = eventsByCategoryResultRaw.rows.map((row: any) => ({
                category: row.category,
                count: Number(row.count)
            }));

            // Get geo data with comprehensive bot filtering
            let geoDataQuery = `
                SELECT country, region, city, latitude, longitude, COUNT(*) as count 
                FROM analytics_sessions 
                WHERE start_timestamp >= '${startDateStr}'
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
            `;
            if (liveDataOnly) {
                geoDataQuery += ` AND ${botFilter}`;
            }
            geoDataQuery += ` GROUP BY country, region, city, latitude, longitude ORDER BY count DESC`;
            
            const geoDataResultRaw = await db.execute(sql.raw(geoDataQuery));
            const geoDataResult = geoDataResultRaw.rows.map((row: any) => ({
                country: row.country,
                region: row.region,
                city: row.city,
                latitude: Number(row.latitude),
                longitude: Number(row.longitude),
                count: Number(row.count)
            }));

            return {
                timeRange: {
                    startDate: startDate.toISOString(),
                    endDate: new Date().toISOString(),
                    days,
                },
                sessions: {
                    total: totalSessions,
                    uniqueVisitors,
                    newVsReturning: { new: newVisitors, returning: returningVisitors },
                    byDevice: deviceResult,
                    byBrowser: browserResult,
                    byOS: osResult,
                    byCountry: countryResult,
                },
                pageViews: {
                    total: totalPageViews,
                    topPages: topPagesResult,
                },
                events: {
                    total: totalEvents,
                    byType: eventsByTypeResult,
                    byCategory: eventsByCategoryResult,
                },
                location: {
                    geoData: geoDataResult,
                    // Data accuracy warnings for geographic information
                    warnings: {
                        geoAccuracy: 'Geographic data is based on IP geolocation and may be inaccurate for VPN users, mobile networks, or corporate proxies.',
                        testDataPresent: !liveDataOnly ? 'Results may include test data when "Live data only" is disabled.' : null,
                        sampleSize: geoDataResult.length < 10 ? 'Small sample size may affect geographic accuracy.' : null
                    }
                },
                traffic: {
                    byDay: await this.getDailyTrafficData(startDate, liveDataOnly),
                    pageViewsByDay: await this.getDailyPageViewsData(startDate, liveDataOnly),
                },
                // Analytics metadata and definitions
                metadata: {
                    activeUsersDefinition: 'Users who have been active within the last 15 minutes (based on session activity)',
                    sessionTimeout: '30 minutes of inactivity',
                    dataFilters: liveDataOnly ? 'Live data only (excludes test traffic)' : 'All data (includes test traffic)',
                    geolocationAccuracy: 'Based on IP address lookup - may be inaccurate for VPN/mobile users',
                    generatedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Error getting dashboard data:', error);
            throw error;
        }
    }

    /**
     * Get active users data
     * 
     * ACTIVE USER DEFINITION:
     * A user is considered "active" if they have:
     * 1. Started a session within the last 15 minutes, OR
     * 2. Have an ongoing session that hasn't ended and was active in the last 15 minutes
     * 3. AND their session is marked as isActive = true
     * 
     * This provides real-time visibility into current site usage.
     * Sessions automatically expire after 30 minutes of inactivity.
     */
    async getActiveUsers(liveDataOnly: boolean = false) {
        try {
            // Define active threshold: users active in the last 15 minutes
            const activeThresholdMinutes = 15;
            const fifteenMinutesAgo = new Date();
            fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - activeThresholdMinutes);

            console.log(`[Analytics] Getting active users from ${fifteenMinutesAgo.toISOString()}, liveDataOnly: ${liveDataOnly}`);

            // Build WHERE conditions
            const baseConditions = [
                or(
                    // Session started recently
                    gte(analyticsSessions.startTimestamp, fifteenMinutesAgo),
                    // Or session is ongoing and was recently active
                    and(
                        gte(analyticsSessions.endTimestamp, fifteenMinutesAgo),
                        eq(analyticsSessions.isActive, true)
                    )
                ),
                // Must be marked as active
                eq(analyticsSessions.isActive, true),
                // Exclude bots, crawlers, and headless browsers (use COALESCE for NULL safety)
                sql`NOT (
                    COALESCE(${analyticsSessions.userAgent}, '') ~* 'HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|Twitterbot|LinkedInBot|bot|crawler|spider|scraper'
                )`
            ];

            // Add additional filtering when liveDataOnly is enabled
            if (liveDataOnly) {
                baseConditions.push(
                    // Exclude local/internal IPs (RFC 1918 private ranges + unknown)
                    sql`${analyticsSessions.ip} NOT LIKE '127.%'`,
                    sql`${analyticsSessions.ip} != 'unknown'`,
                    sql`${analyticsSessions.ip} NOT LIKE '192.168.%'`,
                    sql`${analyticsSessions.ip} NOT LIKE '10.%'`,
                    sql`${analyticsSessions.ip} NOT LIKE '172.16.%'`,
                    sql`${analyticsSessions.ip} NOT LIKE '172.17.%'`,
                    sql`${analyticsSessions.ip} NOT LIKE '172.18.%'`,
                    sql`${analyticsSessions.ip} NOT LIKE '172.19.%'`,
                    sql`${analyticsSessions.ip} NOT LIKE '172.2_.%'`,
                    sql`${analyticsSessions.ip} NOT LIKE '172.30.%'`,
                    sql`${analyticsSessions.ip} NOT LIKE '172.31.%'`,
                    // Known bot/suspicious IP ranges
                    sql`${analyticsSessions.ip} NOT LIKE '43.173.%'`,  // China Telecom bot network
                    sql`${analyticsSessions.ip} NOT LIKE '35.191.%'`,  // Google Cloud Load Balancer / health checks
                    sql`${analyticsSessions.ip} NOT LIKE '66.249.%'`,  // Googlebot crawler
                    // Filter outdated Chrome versions (< 120) - likely bots using old user agents
                    sql`NOT (
                        COALESCE(${analyticsSessions.userAgent}, '') ~* 'Chrome/(10[0-9]|11[0-9])\\.'
                    )`
                );
            }

            const activeSessions = await db.select({
                id: analyticsSessions.id, 
                sessionId: analyticsSessions.sessionId, 
                userId: analyticsSessions.userId,
                device: analyticsSessions.device, 
                browser: analyticsSessions.browser, 
                os: analyticsSessions.os,
                country: analyticsSessions.country, 
                city: analyticsSessions.city,
                latitude: analyticsSessions.latitude, 
                longitude: analyticsSessions.longitude,
                startTimestamp: analyticsSessions.startTimestamp, 
                endTimestamp: analyticsSessions.endTimestamp,
                userAgent: analyticsSessions.userAgent,
            })
            .from(analyticsSessions)
            .where(and(...baseConditions))
            .orderBy(desc(analyticsSessions.startTimestamp))
            .limit(50);

            const activeUsers = await Promise.all(activeSessions.map(async (session) => {
                // Build page view exclusion conditions
                const pageViewConditions = [
                    eq(analyticsPageViews.sessionId, session.sessionId),
                    // Exclude static asset paths - media files, images, etc.
                    sql`NOT (
                        ${analyticsPageViews.path} ~* '\\.(mp4|webm|mov|avi|mp3|wav|ogg|jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot|pdf)$'
                        OR ${analyticsPageViews.path} ~* '^/(banner-slides|uploads/banner-slides)/'
                    )`
                ];

                // When filtering for real users, exclude technical/probe paths that aren't real pages
                if (liveDataOnly) {
                    pageViewConditions.push(
                        sql`NOT (
                            ${analyticsPageViews.path} LIKE '/.well-known/%'
                            OR ${analyticsPageViews.path} LIKE '%well-known%'
                            OR ${analyticsPageViews.path} = '/robots.txt'
                            OR ${analyticsPageViews.path} LIKE '/sitemap%'
                            OR ${analyticsPageViews.path} LIKE '/favicon%'
                            OR ${analyticsPageViews.path} LIKE '/api/%'
                            OR ${analyticsPageViews.path} LIKE '/health%'
                            OR ${analyticsPageViews.path} LIKE '/_%'
                        )`
                    );
                }

                // Get last page view that isn't a static asset (exclude media/static file paths)
                const [lastPageView] = await db.select({
                    path: analyticsPageViews.path,
                    pageType: analyticsPageViews.pageType,
                    pageCategory: analyticsPageViews.pageCategory,
                })
                .from(analyticsPageViews)
                .where(and(...pageViewConditions))
                .orderBy(desc(analyticsPageViews.timestamp))
                .limit(1);

                // Skip sessions that have no valid page views (only accessed static files or filtered paths)
                if (!lastPageView) {
                    return null;
                }

                let user = null;
                if (session.userId) {
                    const [userData] = await db.select({
                        id: users.id, username: users.username, fullName: users.fullName,
                    })
                    .from(users)
                    .where(eq(users.id, session.userId));
                    user = userData || null;
                }

                return {
                    sessionId: session.sessionId, user, device: session.device, browser: session.browser, os: session.os,
                    location: { country: session.country || 'Unknown', city: session.city || 'Unknown', latitude: session.latitude, longitude: session.longitude },
                    startTime: session.startTimestamp.toISOString(), endTime: session.endTimestamp ? session.endTimestamp.toISOString() : null,
                    currentPage: { path: lastPageView.path, pageType: lastPageView.pageType, pageCategory: lastPageView.pageCategory },
                };
            }));

            // Filter out null entries (sessions with only asset page views or filtered paths)
            const filteredUsers = activeUsers.filter(user => user !== null);

            return {
                count: filteredUsers.length,
                users: filteredUsers,
            };
        } catch (error) {
            console.error('Error getting active users:', error);
            throw error;
        }
    }

    /**
     * Get user journey data
     */
    async getUserJourneyData(journeyType: string, days: number = 30, liveDataOnly: boolean = false) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            switch (journeyType) {
                case 'entryPages': {
                    console.log(`[Analytics] Getting entry pages for ${days} days, liveDataOnly: ${liveDataOnly}`);
                    const result = await db.execute(sql`
                        WITH first_pageviews AS (
                            SELECT 
                                pv.id, pv.path, pv.page_type, pv.page_category, pv.session_id,
                                ROW_NUMBER() OVER (PARTITION BY pv.session_id ORDER BY pv.timestamp ASC) as rn
                            FROM analytics_page_views pv
                            JOIN analytics_sessions s ON pv.session_id = s.session_id
                            WHERE s.start_timestamp >= ${startDate}
                            ${liveDataOnly ? sql`AND (s.ip NOT LIKE '127.%' AND s.ip != 'unknown' AND s.ip NOT LIKE '192.168.%' AND s.ip NOT LIKE '10.%')` : sql``}
                        )
                        SELECT 
                            path, page_type, page_category, COUNT(*) as count
                        FROM first_pageviews
                        WHERE rn = 1
                        GROUP BY path, page_type, page_category
                        ORDER BY count DESC
                        LIMIT 20
                    `);
                    return result.rows.map(row => ({
                        path: row.path, pageType: row.page_type, pageCategory: row.page_category, count: Number(row.count),
                    }));
                }

                case 'exitPages': {
                    console.log(`[Analytics] Getting exit pages for ${days} days, liveDataOnly: ${liveDataOnly}`);
                    const result = await db.execute(sql`
                        WITH last_pageviews AS (
                            SELECT 
                                pv.id, pv.path, pv.page_type, pv.page_category, pv.session_id,
                                ROW_NUMBER() OVER (PARTITION BY pv.session_id ORDER BY pv.timestamp DESC) as rn
                            FROM analytics_page_views pv
                            JOIN analytics_sessions s ON pv.session_id = s.session_id
                            WHERE s.start_timestamp >= ${startDate}
                            ${liveDataOnly ? sql`AND (s.ip NOT LIKE '127.%' AND s.ip != 'unknown' AND s.ip NOT LIKE '192.168.%' AND s.ip NOT LIKE '10.%')` : sql``}
                        )
                        SELECT 
                            path, page_type, page_category, COUNT(*) as count
                        FROM last_pageviews
                        WHERE rn = 1
                        GROUP BY path, page_type, page_category
                        ORDER BY count DESC
                        LIMIT 20
                    `);
                    return result.rows.map(row => ({
                        path: row.path, pageType: row.page_type, pageCategory: row.page_category, count: Number(row.count),
                    }));
                }

                case 'pathTransitions': {
                    console.log(`[Analytics] Getting path transitions for ${days} days, liveDataOnly: ${liveDataOnly}`);
                    const result = await db.execute(sql`
                        WITH page_paths AS (
                            SELECT
                                pv.path AS source_path,
                                pv.page_type AS source_page_type,
                                pv.page_category AS source_page_category,
                                LEAD(pv.path) OVER (PARTITION BY pv.session_id ORDER BY pv.timestamp ASC) AS target_path,
                                LEAD(pv.page_type) OVER (PARTITION BY pv.session_id ORDER BY pv.timestamp ASC) AS target_page_type,
                                LEAD(pv.page_category) OVER (PARTITION BY pv.session_id ORDER BY pv.timestamp ASC) AS target_page_category
                            FROM analytics_page_views pv
                            JOIN analytics_sessions s ON pv.session_id = s.session_id
                            WHERE 
                                s.start_timestamp >= ${startDate}
                                ${liveDataOnly ? sql`AND (s.ip NOT LIKE '127.%' AND s.ip != 'unknown' AND s.ip NOT LIKE '192.168.%' AND s.ip NOT LIKE '10.%')` : sql``}
                        )
                        SELECT
                            source_path, source_page_type, source_page_category, 
                            target_path, target_page_type, target_page_category,
                            COUNT(*) as transitions
                        FROM page_paths
                        WHERE target_path IS NOT NULL
                        GROUP BY 
                            source_path, source_page_type, source_page_category, 
                            target_path, target_page_type, target_page_category
                        ORDER BY transitions DESC
                        LIMIT 30
                    `);

                    const nodes: { id: string; pageType: string; pageCategory: string }[] = [];
                    const links: { source: string; target: string; value: number }[] = [];
                    const nodeIds = new Set<string>();

                    result.rows.forEach(row => {
                        const sourcePath = row.source_path as string;
                        const targetPath = row.target_path as string;

                        if (!nodeIds.has(sourcePath)) {
                            nodes.push({ 
                                id: sourcePath, 
                                pageType: row.source_page_type as string || 'unknown',
                                pageCategory: row.source_page_category as string || 'unknown'
                            });
                            nodeIds.add(sourcePath);
                        }

                        if (!nodeIds.has(targetPath)) {
                            nodes.push({ 
                                id: targetPath, 
                                pageType: row.target_page_type as string || 'unknown',
                                pageCategory: row.target_page_category as string || 'unknown'
                            });
                            nodeIds.add(targetPath);
                        }

                        links.push({
                            source: sourcePath,
                            target: targetPath,
                            value: Number(row.transitions)
                        });
                    });

                    return { nodes, links };
                }

                default:
                    throw new Error(`Invalid journey type: ${journeyType}`);
            }
        } catch (error) {
            console.error(`Error getting user journey data for type ${journeyType}:`, error);
            throw error;
        }
    }

    /**
     * Get or create a session for tracking
     */
    private async getOrCreateSession(req: Request): Promise<string> {
        let sessionId = req.cookies?.['analytics_session_id'];
        
        // Get userId from either req.user (populated by passport) or session passport user
        const currentUserId = (req as any).user?.id || (req as any).session?.passport?.user || null;

        if (sessionId) {
            const [session] = await db.select()
                .from(analyticsSessions)
                .where(eq(analyticsSessions.sessionId, sessionId));

            if (session) {
                // If user is now logged in but session doesn't have userId, update it
                if (currentUserId && !session.userId) {
                    await db.update(analyticsSessions)
                        .set({ userId: currentUserId })
                        .where(eq(analyticsSessions.sessionId, sessionId));
                }
                return sessionId;
            }
        }

        const userAgent = (req && req.headers) ? req.headers['user-agent'] as string : 'unknown';
        const device = this.detectDeviceType(userAgent);
        const browser = this.detectBrowser(userAgent);
        const os = this.detectOperatingSystem(userAgent);

        const ip = this.getClientIp(req);
        let geoData = ip ? geoip.lookup(ip) : null;

        if (!geoData && process.env.NODE_ENV !== 'production') {
            geoData = {
                range: [0, 0], country: 'US', region: 'FL', eu: '0',
                timezone: 'America/New_York', city: 'Orlando',
                ll: [28.5383, -81.3792], metro: 0, area: 0
            };
        }

        const newSessionId = crypto.randomUUID();
        const visitorFingerprint = this.createVisitorFingerprint(ip, userAgent);
        const returningVisitor = await this.isReturningVisitor(visitorFingerprint);

        await db.insert(analyticsSessions)
            .values({
                sessionId: newSessionId, userId: currentUserId, ip: ip || 'unknown', userAgent: userAgent || 'unknown',
                device, browser, os,
                country: geoData?.country || null, region: geoData?.region || null, city: geoData?.city || null,
                latitude: geoData?.ll ? geoData.ll[0] : null, longitude: geoData?.ll ? geoData.ll[1] : null,
                startTimestamp: new Date(), pagesViewed: 1, // Start pagesViewed at 1 for the first page view
                isActive: true,
                visitorFingerprint,
                isReturningVisitor: returningVisitor,
                // referrer and entryPage should be set by the first trackPageView or by startSession if it were more complex
            })
            .returning();

        if (req.res) {
            req.res.cookie('analytics_session_id', newSessionId, {
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
            });
        }

        return newSessionId;
    }

    /**
     * Generate a human-readable title from a URL path
     */
    private generateTitleFromPath(path: string): string {
        if (!path || path === '/') return 'Homepage';
        const segments = path.split('/').filter(s => s.length > 0);
        if (segments.length === 0) return 'Homepage';
        const lastSegment = segments[segments.length - 1];
        return lastSegment
            .replace(/[-_]/g, ' ')
            .replace(/\.(php|html|htm|jsp|asp)$/i, '')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Detect operating system from user agent
     */
    private detectOperatingSystem(userAgent: string): string {
        if (!userAgent) return 'Unknown';
        userAgent = userAgent.toLowerCase();
        if (userAgent.includes('windows')) return 'Windows';
        if (userAgent.includes('mac os x') || userAgent.includes('macintosh')) return 'macOS';
        if (userAgent.includes('ipad') || userAgent.includes('iphone') || userAgent.includes('ipod')) return 'iOS';
        if (userAgent.includes('android')) return 'Android';
        if (userAgent.includes('linux')) return 'Linux';
        return 'Other';
    }

    /**
     * Get the client IP address
     */
    /**
     * Create a stable visitor fingerprint from IP + User-Agent.
     * Returns null when we lack usable identifying data, so unknown visitors
     * are not all collapsed into a single fingerprint bucket.
     */
    private createVisitorFingerprint(ip: string | null | undefined, userAgent: string | null | undefined): string | null {
        if (!ip || ip === 'unknown' || !userAgent || userAgent === 'unknown') {
            return null;
        }
        return crypto.createHash('sha256').update(`${ip}|${userAgent}`).digest('hex');
    }

    /**
     * Determine whether a visitor fingerprint has already been seen in a prior session.
     */
    private async isReturningVisitor(visitorFingerprint: string | null): Promise<boolean> {
        if (!visitorFingerprint) return false;
        const [prior] = await db.select({ id: analyticsSessions.id })
            .from(analyticsSessions)
            .where(eq(analyticsSessions.visitorFingerprint, visitorFingerprint))
            .limit(1);
        return !!prior;
    }

    private getClientIp(req: Request): string | null {
        if (!req || !req.headers) {
            return null;
        }
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor) {
            return (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]).trim();
        }
        if (req.headers['x-real-ip']) {
            return req.headers['x-real-ip'] as string;
        }
        return req.ip || null;
    }

    /**
     * Detect device type from user agent
     * Always returns either 'mobile', 'tablet', or 'desktop' - never 'unknown'
     */
    private detectDeviceType(userAgent: string): string {
        if (!userAgent) return 'desktop'; 
        userAgent = userAgent.toLowerCase();
        const mobileKeywords = [
            'iphone', 'ipod', 'android.*mobile', 'windows.*phone', 'blackberry',
            '\\bsymbian\\b', 'series60', 'series40', 'bb10', 'meego', 'webos',
            'palm', 'opera mini', 'opera mobi', 'fennec', 'mobile safari',
            'samsung.*mobile', 'nokia', 'bolt', 'netfront', 'skyfire', 'midp',
            'wap.*browser', 'profile\\/midp', 'ucweb', 'mobile', '\\bmob', 'smartphone',
            'htc', 'lg-', 'sony', 'xiaomi', 'huawei', 'vivo', 'oppo', 'alcatel'
        ];
        for (const keyword of mobileKeywords) {
            if (userAgent.match(new RegExp(keyword, 'i'))) {
                return 'mobile';
            }
        }
        const tabletKeywords = [
            'ipad', 'tablet', 'kindle', 'playbook', 'nexus 7', 'nexus 9', 'nexus 10',
            'android(?!.*mobile)', 'silk', 'surface'
        ];
        for (const keyword of tabletKeywords) {
            if (userAgent.match(new RegExp(keyword, 'i'))) {
                return 'tablet';
            }
        }
        if (userAgent.includes('headlesschrome')) {
            console.log('[Analytics] Detected headless browser, classifying as desktop');
            return 'desktop';
        }
        if (userAgent.match(/\(.*touch.*\)/i)) {
            return 'tablet';
        }
        return 'desktop';
    }

    /**
     * Detect browser from user agent
     */
    private detectBrowser(userAgent: string): string {
        if (!userAgent) return 'unknown';
        userAgent = userAgent.toLowerCase();
        if (userAgent.includes('edge') || userAgent.includes('edg')) {
            return 'Edge';
        } else if (userAgent.includes('chrome')) {
            return 'Chrome';
        } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
            return 'Safari';
        } else if (userAgent.includes('firefox')) {
            return 'Firefox';
        } else if (userAgent.includes('msie') || userAgent.includes('trident')) {
            return 'Internet Explorer';
        } else {
            return 'Unknown';
        }
    }

    /**
     * Get daily traffic data by counting sessions per day
     */
    private async getDailyTrafficData(startDate: Date, liveDataOnly: boolean = false) {
        try {
            console.log(`[Analytics] Getting daily traffic data since ${startDate.toISOString()}, liveDataOnly: ${liveDataOnly}`);
            // Count every session per day (the previous `visitor_fingerprint IS NOT NULL`
            // requirement zeroed out days because fingerprints are not populated on
            // historical data). Unique visitors use COALESCE(visitor_fingerprint, ip)
            // so the count works whether or not fingerprints exist. The bot filter is
            // IP-based here to stay aligned with getDailyPageViewsData so the two daily
            // series on the Traffic chart line up.
            const result = await db.execute(sql`
                SELECT 
                    DATE_TRUNC('day', start_timestamp) AS day,
                    COUNT(*) AS sessions,
                    COUNT(DISTINCT COALESCE(visitor_fingerprint, ip)) AS unique_visitors
                FROM analytics_sessions
                WHERE start_timestamp >= ${startDate}
                ${liveDataOnly ? sql`AND (ip NOT LIKE '127.%' AND ip != 'unknown' AND ip NOT LIKE '192.168.%' AND ip NOT LIKE '10.%')` : sql``}
                GROUP BY DATE_TRUNC('day', start_timestamp)
                ORDER BY day ASC
            `);

            return result.rows.map(row => {
                let dateStr = 'unknown';
                try {
                    if (row.day) {
                        dateStr = new Date(String(row.day)).toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.error('Error parsing date:', e);
                }

                return {
                    date: dateStr,
                    sessions: Number(row.sessions),
                    uniqueVisitors: Number(row.unique_visitors)
                };
            });
        } catch (error) {
            console.error('Error getting daily traffic data:', error);
            return [];
        }
    }

    /**
     * Get daily page views data by counting page views per day
     */
    private async getDailyPageViewsData(startDate: Date, liveDataOnly: boolean = false) {
        try {
            console.log(`[Analytics] Getting daily page views data since ${startDate.toISOString()}, liveDataOnly: ${liveDataOnly}`);
            const result = await db.execute(sql`
                SELECT 
                    DATE_TRUNC('day', pv.timestamp) AS day,
                    COUNT(*) AS page_views
                FROM analytics_page_views pv
                ${liveDataOnly ? sql`
                JOIN analytics_sessions s ON pv.session_id = s.session_id
                WHERE 
                    pv.timestamp >= ${startDate}
                    AND (s.ip NOT LIKE '127.%' AND s.ip != 'unknown' AND s.ip NOT LIKE '192.168.%' AND s.ip NOT LIKE '10.%')
                ` : sql`
                WHERE pv.timestamp >= ${startDate}
                `}
                GROUP BY DATE_TRUNC('day', pv.timestamp)
                ORDER BY day ASC
            `);

            return result.rows.map(row => {
                let dateStr = 'unknown';
                try {
                    if (row.day) {
                        dateStr = new Date(String(row.day)).toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.error('Error parsing date:', e);
                }

                return {
                    date: dateStr,
                    pageViews: Number(row.page_views)
                };
            });
        } catch (error) {
            console.error('Error getting daily page views data:', error);
            return [];
        }
    }

    /**
     * Helper to map event types to categories
     */
    private getCategoryForEventType(eventType: string): string {
        const categoryMap: Record<string, string> = {
            'click': 'user_interaction', 'view': 'content', 'scroll': 'user_engagement',
            'search': 'search', 'form_submit': 'conversion', 'signup': 'conversion',
            'login': 'auth', 'logout': 'auth', 'purchase': 'ecommerce',
        };
        return categoryMap[eventType] || 'other';
    }

    /**
     * Get active users count for a specific page
     * Returns count of users who have viewed the page in the last 5 minutes
     */
    public async getActiveUsersForPage(pagePath: string): Promise<{ activeUsers: number; lastUpdate: Date }> {
        try {
            // Consider users active if they've viewed the page in the last 5 minutes
            const activeThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
            
            const result = await db.execute(sql`
                SELECT COUNT(DISTINCT session_id) as active_users
                FROM analytics_page_views
                WHERE path = ${pagePath}
                AND timestamp >= ${activeThreshold}
            `);
            
            const activeUsers = Number(result.rows[0]?.active_users || 0);
            
            return {
                activeUsers,
                lastUpdate: new Date()
            };
        } catch (error) {
            console.error('[Analytics] Error getting active users:', error);
            return {
                activeUsers: 0,
                lastUpdate: new Date()
            };
        }
    }

    // ===== Enhanced Analytics Dashboard support =====

    private escapeSql(value: string): string {
        return String(value).replace(/'/g, "''");
    }

    private resolveRange(startDate?: string, endDate?: string, days: number = 30): { startStr: string; endStr: string } {
        let start: Date;
        let end: Date;
        if (startDate) {
            const parsed = new Date(startDate);
            start = isNaN(parsed.getTime()) ? new Date(Date.now() - days * 86400000) : parsed;
        } else {
            start = new Date(Date.now() - (Number.isFinite(days) && days > 0 ? Math.floor(days) : 30) * 86400000);
        }
        if (endDate) {
            const parsedEnd = new Date(endDate);
            end = isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;
            // If endDate has no time component (date only), include the whole day
            if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                end.setHours(23, 59, 59, 999);
            }
        } else {
            end = new Date();
        }
        return { startStr: start.toISOString(), endStr: end.toISOString() };
    }

    private sessionBotFilter(liveDataOnly: boolean, alias: string = ''): string {
        return liveDataOnly ? ` AND (${this.getBotFilterSQL(alias)})` : '';
    }

    /**
     * Flat analytics overview consumed by the Enhanced Analytics Dashboard "Overview" tab.
     */
    async getEnhancedOverview(startDate?: string, endDate?: string, liveDataOnly: boolean = false) {
        const { startStr, endStr } = this.resolveRange(startDate, endDate, 30);
        const sFilter = this.sessionBotFilter(liveDataOnly, 's');
        const sessRange = `s.start_timestamp >= '${startStr}' AND s.start_timestamp <= '${endStr}'`;
        const pvJoin = `LEFT JOIN analytics_sessions s ON pv.session_id = s.session_id`;
        const pvRange = `pv.timestamp >= '${startStr}' AND pv.timestamp <= '${endStr}'`;
        const pvBot = liveDataOnly ? ` AND (s.session_id IS NULL OR (${this.getBotFilterSQL('s')}))` : '';

        const totalPageViewsQ = `SELECT COUNT(*) c FROM analytics_page_views pv ${pvJoin} WHERE ${pvRange}${pvBot}`;
        const uniqueUsersQ = `SELECT COUNT(DISTINCT s.ip) c FROM analytics_sessions s WHERE ${sessRange}${sFilter}`;
        const uniqueIPsQ = `SELECT COUNT(DISTINCT s.ip) c FROM analytics_sessions s WHERE ${sessRange}${sFilter}`;
        const authQ = `SELECT COUNT(DISTINCT s.user_id) c FROM analytics_sessions s WHERE ${sessRange} AND s.user_id IS NOT NULL${sFilter}`;
        const unauthQ = `SELECT COUNT(DISTINCT COALESCE(s.visitor_fingerprint, s.ip)) c FROM analytics_sessions s WHERE ${sessRange} AND s.user_id IS NULL${sFilter}`;
        const sessTotalQ = `SELECT COUNT(*) c FROM analytics_sessions s WHERE ${sessRange}${sFilter}`;
        const bounceQ = `SELECT COUNT(*) c FROM analytics_sessions s WHERE ${sessRange} AND COALESCE(s.pages_viewed, 0) <= 1${sFilter}`;
        // Cap each session at 30 min (1800s). end_timestamp is bumped to NOW() on every
        // pageview/event, so returning visitors produce multi-day "sessions" that wildly
        // inflate a plain AVG. LEAST() clamps the long tail to a GA-style 30-min timeout.
        const durQ = `SELECT AVG(LEAST(EXTRACT(EPOCH FROM (s.end_timestamp - s.start_timestamp)), 1800)) a FROM analytics_sessions s WHERE ${sessRange} AND s.end_timestamp IS NOT NULL AND s.end_timestamp >= s.start_timestamp${sFilter}`;
        // Unique visitors per day are anchored on sessions (distinct IP by session start day),
        // identical to the Overview "Unique Users"/"Unique IP Addresses" cards, so a single-day
        // frame reconciles exactly. Page-view count stays anchored on page-view timestamps and
        // matches the Overview "Total Page Views" card. The two date-grouped subqueries are merged
        // by day. Counting distinct IP straight from the page-views join cannot reconcile because
        // many sessions have IPs but no page-view rows, so they appear only in the session count.
        const dailyQ = `SELECT COALESCE(p.d, x.d) d, COALESCE(p.c, 0) c, COALESCE(x.u, 0) u FROM (SELECT to_char(date_trunc('day', pv.timestamp), 'YYYY-MM-DD') d, COUNT(*) c FROM analytics_page_views pv ${pvJoin} WHERE ${pvRange}${pvBot} GROUP BY 1) p FULL OUTER JOIN (SELECT to_char(date_trunc('day', s.start_timestamp), 'YYYY-MM-DD') d, COUNT(DISTINCT s.ip) u FROM analytics_sessions s WHERE ${sessRange}${sFilter} GROUP BY 1) x ON p.d = x.d ORDER BY 1 ASC`;
        const topPagesQ = `SELECT pv.path p, COUNT(*) c FROM analytics_page_views pv ${pvJoin} WHERE ${pvRange}${pvBot} GROUP BY pv.path ORDER BY c DESC LIMIT 10`;
        const devicesQ = `SELECT COALESCE(s.device, 'Unknown') device, COUNT(*) c FROM analytics_sessions s WHERE ${sessRange}${sFilter} GROUP BY 1 ORDER BY c DESC LIMIT 10`;
        const browsersQ = `SELECT COALESCE(s.browser, 'Unknown') browser, COUNT(*) c FROM analytics_sessions s WHERE ${sessRange}${sFilter} GROUP BY 1 ORDER BY c DESC LIMIT 10`;
        const referrersQ = `SELECT pv.referrer r, COUNT(*) c FROM analytics_page_views pv ${pvJoin} WHERE ${pvRange} AND pv.referrer LIKE 'http%'${pvBot} GROUP BY pv.referrer ORDER BY c DESC LIMIT 10`;

        const [tpv, uu, uip, auth, unauth, sess, bounce, dur, daily, top, dev, brow, refs] = await Promise.all([
            db.execute(sql.raw(totalPageViewsQ)),
            db.execute(sql.raw(uniqueUsersQ)),
            db.execute(sql.raw(uniqueIPsQ)),
            db.execute(sql.raw(authQ)),
            db.execute(sql.raw(unauthQ)),
            db.execute(sql.raw(sessTotalQ)),
            db.execute(sql.raw(bounceQ)),
            db.execute(sql.raw(durQ)),
            db.execute(sql.raw(dailyQ)),
            db.execute(sql.raw(topPagesQ)),
            db.execute(sql.raw(devicesQ)),
            db.execute(sql.raw(browsersQ)),
            db.execute(sql.raw(referrersQ)),
        ]);

        const totalPageViews = Number(tpv.rows[0]?.c || 0);
        const uniqueUsers = Number(uu.rows[0]?.c || 0);
        const totalUniqueIPs = Number(uip.rows[0]?.c || 0);
        const totalAuthenticatedUsers = Number(auth.rows[0]?.c || 0);
        const totalUnauthenticatedUsers = Number(unauth.rows[0]?.c || 0);
        const totalSessions = Number(sess.rows[0]?.c || 0);
        const totalBounces = Number(bounce.rows[0]?.c || 0);
        const avgSessionDuration = Math.round(Number(dur.rows[0]?.a || 0));
        const bounceRate = totalSessions > 0 ? Math.round((totalBounces / totalSessions) * 100) : 0;

        return {
            totalPageViews,
            uniqueUsers,
            avgSessionDuration,
            bounce_rate: bounceRate,
            bounceRate,
            pageViews: daily.rows.map((r: any) => ({ date: r.d, count: Number(r.c), users: Number(r.u) })),
            topPages: top.rows.map((r: any) => ({ path: r.p, count: Number(r.c) })),
            devices: dev.rows.map((r: any) => ({ device: r.device, count: Number(r.c) })),
            browsers: brow.rows.map((r: any) => ({ browser: r.browser, count: Number(r.c) })),
            referrers: refs.rows.map((r: any) => ({ referrer: r.r, count: Number(r.c) })),
            totalUniqueVisitors: uniqueUsers,
            totalUniqueIPs,
            totalAuthenticatedUsers,
            totalUnauthenticatedUsers,
            totalBounces,
        };
    }

    /**
     * Combined user-journey data (path transitions, entry pages, exit pages).
     */
    async getUserJourneyCombined(startDate?: string, endDate?: string, liveDataOnly: boolean = false) {
        const { startStr, endStr } = this.resolveRange(startDate, endDate, 30);
        const pvJoin = `LEFT JOIN analytics_sessions s ON pv.session_id = s.session_id`;
        const pvRange = `pv.timestamp >= '${startStr}' AND pv.timestamp <= '${endStr}'`;
        const pvBot = liveDataOnly ? ` AND (s.session_id IS NULL OR (${this.getBotFilterSQL('s')}))` : '';

        const transitionsQ = `
            WITH pv AS (
                SELECT pv.session_id, pv.path, pv.timestamp
                FROM analytics_page_views pv ${pvJoin}
                WHERE ${pvRange}${pvBot}
            ),
            trans AS (
                SELECT session_id, path, LAG(path) OVER (PARTITION BY session_id ORDER BY timestamp) prev
                FROM pv
            )
            SELECT prev AS source, path AS target, COUNT(*) c
            FROM trans WHERE prev IS NOT NULL AND prev <> path
            GROUP BY prev, path ORDER BY c DESC LIMIT 50`;

        const entryQ = `
            WITH firsts AS (
                SELECT DISTINCT ON (pv.session_id) pv.session_id, pv.path
                FROM analytics_page_views pv ${pvJoin}
                WHERE ${pvRange}${pvBot}
                ORDER BY pv.session_id, pv.timestamp ASC
            )
            SELECT path, COUNT(*) c FROM firsts GROUP BY path ORDER BY c DESC LIMIT 20`;

        const exitQ = `
            WITH lasts AS (
                SELECT DISTINCT ON (pv.session_id) pv.session_id, pv.path
                FROM analytics_page_views pv ${pvJoin}
                WHERE ${pvRange}${pvBot}
                ORDER BY pv.session_id, pv.timestamp DESC
            )
            SELECT path, COUNT(*) c FROM lasts GROUP BY path ORDER BY c DESC LIMIT 20`;

        const [trans, entry, exit] = await Promise.all([
            db.execute(sql.raw(transitionsQ)),
            db.execute(sql.raw(entryQ)),
            db.execute(sql.raw(exitQ)),
        ]);

        const entryTotal = entry.rows.reduce((acc: number, r: any) => acc + Number(r.c), 0);
        const exitTotal = exit.rows.reduce((acc: number, r: any) => acc + Number(r.c), 0);

        return {
            success: true,
            pathTransitions: trans.rows.map((r: any) => ({ source: r.source, target: r.target, count: Number(r.c) })),
            entryPages: entry.rows.map((r: any) => ({
                path: r.path,
                count: Number(r.c),
                percentage: entryTotal > 0 ? Math.round((Number(r.c) / entryTotal) * 100) : 0,
            })),
            exitPages: exit.rows.map((r: any) => ({
                path: r.path,
                count: Number(r.c),
                percentage: exitTotal > 0 ? Math.round((Number(r.c) / exitTotal) * 100) : 0,
            })),
        };
    }

    /**
     * Click position data for the click heatmap.
     */
    async getClickData(startDate?: string, endDate?: string, path?: string, liveDataOnly: boolean = false) {
        const { startStr, endStr } = this.resolveRange(startDate, endDate, 30);
        const pvBot = liveDataOnly ? ` AND (s.session_id IS NULL OR (${this.getBotFilterSQL('s')}))` : '';
        const pathFilter = path ? ` AND e.path = '${this.escapeSql(path)}'` : '';
        const q = `
            SELECT e.path, e.timestamp, e.position_data, e.event_data, e.category
            FROM analytics_events e
            LEFT JOIN analytics_sessions s ON e.session_id = s.session_id
            WHERE e.event_type = 'click' AND e.timestamp >= '${startStr}' AND e.timestamp <= '${endStr}'${pathFilter}${pvBot}
            ORDER BY e.timestamp DESC LIMIT 5000`;
        const result = await db.execute(sql.raw(q));
        const clicks = result.rows
            .map((r: any) => {
                const pd = (typeof r.position_data === 'string' ? safeJson(r.position_data) : r.position_data) || {};
                const ed = (typeof r.event_data === 'string' ? safeJson(r.event_data) : r.event_data) || {};
                const x = Number(pd.x);
                const y = Number(pd.y);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                return {
                    x,
                    y,
                    path: r.path || '/',
                    timestamp: r.timestamp,
                    elementType: pd.elementType || ed.elementType || r.category || undefined,
                    elementId: pd.elementId || ed.elementId || undefined,
                };
            })
            .filter((c: any) => c !== null);
        return { clicks };
    }

    /**
     * Per-page performance metrics for the "Pages" tab.
     * Aggregates analytics_page_views joined with analytics_sessions to produce,
     * per path: total views, unique visitors, average time on page (seconds, clamped
     * to a 30-min ceiling to drop outliers) and bounce rate (share of single-page
     * sessions that viewed the path). Bot/crawler traffic is excluded when
     * liveDataOnly is set, consistent with the rest of the analytics service.
     */
    async getPagePerformance(startDate?: string, endDate?: string, liveDataOnly: boolean = false) {
        const { startStr, endStr } = this.resolveRange(startDate, endDate, 30);
        const pvRange = `pv.timestamp >= '${startStr}' AND pv.timestamp <= '${endStr}'`;
        const pvBot = liveDataOnly ? ` AND (s.session_id IS NULL OR (${this.getBotFilterSQL('s')}))` : '';

        const q = `
            SELECT
                pv.path AS path,
                COUNT(*) AS views,
                COUNT(DISTINCT COALESCE(s.visitor_fingerprint, s.ip, pv.ip)) AS unique_visitors,
                AVG(LEAST(pv.duration, 1800)) FILTER (WHERE pv.duration IS NOT NULL AND pv.duration >= 0) AS avg_duration,
                COUNT(DISTINCT pv.session_id) AS total_sessions,
                COUNT(DISTINCT s.session_id) FILTER (WHERE COALESCE(s.pages_viewed, 0) <= 1) AS bounce_sessions
            FROM analytics_page_views pv
            LEFT JOIN analytics_sessions s ON pv.session_id = s.session_id
            WHERE ${pvRange}${pvBot}
            GROUP BY pv.path
            ORDER BY views DESC
            LIMIT 50`;

        const result = await db.execute(sql.raw(q));
        const pages = result.rows.map((r: any) => {
            const path = r.path || '/';
            const views = Number(r.views) || 0;
            const uniqueVisitors = Number(r.unique_visitors) || 0;
            const avgTimeOnPage = Math.round(Number(r.avg_duration) || 0);
            const totalSessions = Number(r.total_sessions) || 0;
            const bounceSessions = Number(r.bounce_sessions) || 0;
            const bounceRate = totalSessions > 0 ? Math.round((bounceSessions / totalSessions) * 100) : 0;
            return {
                path,
                title: this.generateTitleFromPath(path),
                views,
                uniqueVisitors,
                avgTimeOnPage,
                bounceRate,
            };
        });

        return { pages };
    }

    /**
     * User segmentation across activity, frequency, retention, conversion and time-of-day.
     */
    async getUserSegments(startDate?: string, endDate?: string, liveDataOnly: boolean = false) {
        const { startStr, endStr } = this.resolveRange(startDate, endDate, 30);
        const sFilter = this.sessionBotFilter(liveDataOnly, '');
        const range = `start_timestamp >= '${startStr}' AND start_timestamp <= '${endStr}'`;

        const visitorsQ = `
            SELECT
                SUM(COALESCE(pages_viewed, 0)) AS views,
                COUNT(*) AS sessions,
                MAX(start_timestamp) AS last_seen,
                BOOL_OR(user_id IS NOT NULL) AS auth
            FROM analytics_sessions
            WHERE ${range} AND COALESCE(visitor_fingerprint, ip) IS NOT NULL AND COALESCE(visitor_fingerprint, ip) <> 'unknown'${sFilter}
            GROUP BY COALESCE(visitor_fingerprint, ip)`;

        const timeQ = `
            SELECT CASE
                WHEN h < 6 THEN 'Night (12am-6am)'
                WHEN h < 12 THEN 'Morning (6am-12pm)'
                WHEN h < 18 THEN 'Afternoon (12pm-6pm)'
                ELSE 'Evening (6pm-12am)' END AS seg, COUNT(*) c
            FROM (SELECT EXTRACT(HOUR FROM start_timestamp) h FROM analytics_sessions WHERE ${range}${sFilter}) t
            GROUP BY 1`;

        const [visitors, timeRes] = await Promise.all([
            db.execute(sql.raw(visitorsQ)),
            db.execute(sql.raw(timeQ)),
        ]);

        const rows = visitors.rows as any[];
        const totalUsers = rows.length;
        const now = Date.now();

        const counter = (predicate: (r: any) => string) => {
            const map = new Map<string, number>();
            for (const r of rows) {
                const key = predicate(r);
                map.set(key, (map.get(key) || 0) + 1);
            }
            return map;
        };

        const toSegments = (map: Map<string, number>, order: string[]) => {
            const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
            return order
                .filter(name => map.has(name))
                .map(name => {
                    const c = map.get(name) || 0;
                    return { name, count: c, percentage: total > 0 ? Math.round((c / total) * 100) : 0 };
                });
        };

        const activityMap = counter(r => {
            const v = Number(r.views || 0);
            if (v >= 10) return 'Highly Active (10+ views)';
            if (v >= 4) return 'Active (4-9 views)';
            if (v >= 2) return 'Casual (2-3 views)';
            return 'Single View';
        });
        const frequencyMap = counter(r => {
            const s = Number(r.sessions || 0);
            if (s >= 16) return 'Power Users (16+ sessions)';
            if (s >= 6) return 'Frequent (6-15 sessions)';
            if (s >= 2) return 'Occasional (2-5 sessions)';
            return 'One-time Visitors';
        });
        const retentionMap = counter(r => {
            const last = r.last_seen ? new Date(r.last_seen).getTime() : 0;
            const daysAgo = (now - last) / 86400000;
            if (daysAgo <= 1) return 'Active Today';
            if (daysAgo <= 7) return 'This Week';
            if (daysAgo <= 30) return 'This Month';
            return 'Older';
        });
        const conversionMap = counter(r => (r.auth ? 'Registered Users' : 'Anonymous Visitors'));

        const timeMap = new Map<string, number>();
        for (const r of timeRes.rows as any[]) {
            timeMap.set(String(r.seg), Number(r.c));
        }

        return {
            success: true,
            totalUsers,
            activitySegments: toSegments(activityMap, ['Highly Active (10+ views)', 'Active (4-9 views)', 'Casual (2-3 views)', 'Single View']),
            frequencySegments: toSegments(frequencyMap, ['Power Users (16+ sessions)', 'Frequent (6-15 sessions)', 'Occasional (2-5 sessions)', 'One-time Visitors']),
            retentionSegments: toSegments(retentionMap, ['Active Today', 'This Week', 'This Month', 'Older']),
            conversionSegments: toSegments(conversionMap, ['Registered Users', 'Anonymous Visitors']),
            timeSegments: toSegments(timeMap, ['Morning (6am-12pm)', 'Afternoon (12pm-6pm)', 'Evening (6pm-12am)', 'Night (12am-6am)']),
        };
    }

    /**
     * Per-session geolocation rows for the visitor map.
     */
    async getGeoLocations(startDate?: string, endDate?: string, page?: string, country?: string, liveDataOnly: boolean = false) {
        const { startStr, endStr } = this.resolveRange(startDate, endDate, 30);
        const sFilter = this.sessionBotFilter(liveDataOnly, 's');
        const countryFilter = country ? ` AND s.country = '${this.escapeSql(country)}'` : '';
        const pageFilter = page
            ? ` AND EXISTS (SELECT 1 FROM analytics_page_views pv WHERE pv.session_id = s.session_id AND pv.path = '${this.escapeSql(page)}')`
            : '';
        const q = `
            SELECT s.session_id "sessionId", s.country, s.region, s.city, s.latitude, s.longitude,
                COALESCE(s.pages_viewed, 0) views, s.start_timestamp "lastActive"
            FROM analytics_sessions s
            WHERE s.start_timestamp >= '${startStr}' AND s.start_timestamp <= '${endStr}'
                AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL${countryFilter}${pageFilter}${sFilter}
            ORDER BY s.start_timestamp DESC LIMIT 500`;
        const result = await db.execute(sql.raw(q));
        const sessions = result.rows as any[];
        if (sessions.length === 0) return [];

        const ids = sessions.map(s => `'${this.escapeSql(String(s.sessionId))}'`).join(',');
        const topPagesQ = `
            SELECT session_id, path, COUNT(*) c
            FROM analytics_page_views
            WHERE session_id IN (${ids})
            GROUP BY session_id, path ORDER BY c DESC`;
        const tp = await db.execute(sql.raw(topPagesQ));
        const bySession = new Map<string, { path: string; count: number }[]>();
        for (const r of tp.rows as any[]) {
            const list = bySession.get(r.session_id) || [];
            if (list.length < 5) list.push({ path: r.path, count: Number(r.c) });
            bySession.set(r.session_id, list);
        }

        return sessions.map(s => ({
            sessionId: s.sessionId,
            country: s.country || 'Unknown',
            region: s.region || '',
            city: s.city || '',
            latitude: Number(s.latitude),
            longitude: Number(s.longitude),
            views: Number(s.views),
            lastActive: s.lastActive,
            topPages: bySession.get(s.sessionId) || [],
        }));
    }

    /**
     * Visitor counts grouped by country (heatmap side panel).
     */
    async getCountryVisitors(startDate?: string, endDate?: string, page?: string, liveDataOnly: boolean = false) {
        const { startStr, endStr } = this.resolveRange(startDate, endDate, 30);
        const sFilter = this.sessionBotFilter(liveDataOnly, 's');
        const pageFilter = page
            ? ` AND EXISTS (SELECT 1 FROM analytics_page_views pv WHERE pv.session_id = s.session_id AND pv.path = '${this.escapeSql(page)}')`
            : '';
        const q = `
            SELECT s.country, COUNT(*) count
            FROM analytics_sessions s
            WHERE s.start_timestamp >= '${startStr}' AND s.start_timestamp <= '${endStr}'
                AND s.country IS NOT NULL AND s.country <> ''${pageFilter}${sFilter}
            GROUP BY s.country ORDER BY count DESC LIMIT 100`;
        const result = await db.execute(sql.raw(q));
        return result.rows.map((r: any) => ({ country: r.country, count: Number(r.count) }));
    }

    /**
     * Raw events for CSV export.
     */
    async getEventsForExport(startDate?: string, endDate?: string) {
        const { startStr, endStr } = this.resolveRange(startDate, endDate, 30);
        const q = `
            SELECT event_type, category, action, label, path, timestamp
            FROM analytics_events
            WHERE timestamp >= '${startStr}' AND timestamp <= '${endStr}'
            ORDER BY timestamp DESC LIMIT 10000`;
        const result = await db.execute(sql.raw(q));
        return result.rows.map((r: any) => ({
            eventType: r.event_type,
            category: r.category,
            action: r.action,
            label: r.label,
            path: r.path,
            timestamp: r.timestamp,
        }));
    }
} // End of AnalyticsService class

function safeJson(value: string): any {
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

export const analyticsService = new AnalyticsService();