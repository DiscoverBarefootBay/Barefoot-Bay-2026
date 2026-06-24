// server/services/analytics-service.ts
import { Request } from 'express';
import { db } from '../db';
import { 
    analyticsSessions, 
    analyticsPageViews, 
    analyticsEvents,
    users // Make sure this is used or remove if not
} from '@shared/schema'; // Ensure this path is correct for your Drizzle schema
import geoip from 'geoip-lite';
import crypto from 'crypto';
import { and, asc, count, desc, eq, gte, or, sql } from 'drizzle-orm';

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
            let geoData = data.ipAddress ? geoip.lookup(data.ipAddress) : null;

            if (!geoData && process.env.NODE_ENV !== 'production') {
                console.log('[AnalyticsService] Using fallback geo location for startSession');
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
                // customDimensions: data.properties // Optional: consider if you want to store these initial properties
            });

            console.log(`[AnalyticsService] New session started: ${newSessionId}`);
            return newSessionId;

        } catch (error) {
            console.error('Error in AnalyticsService.startSession:', error);
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
            console.log(`[Analytics Service] trackPageView called - Path: ${req.path}, User: ${userId || 'anonymous'}`);
            console.log(`[Analytics Service] Data received:`, JSON.stringify(data, null, 2));
            
            const sessionId = await this.getOrCreateSession(req); 
            console.log(`[Analytics Service] Session ID obtained: ${sessionId}`);

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

            console.log(`[Analytics Service] Page view data to insert:`, JSON.stringify(pageViewData, null, 2));

            console.log(`[Analytics Service] Updating session ${sessionId} pages_viewed count...`);
            await db.update(analyticsSessions)
                .set({ 
                    pagesViewed: sql`pages_viewed + 1`,
                    isActive: true, 
                    endTimestamp: new Date() 
                })
                .where(eq(analyticsSessions.sessionId, sessionId));

            console.log(`[Analytics Service] Inserting page view into database...`);
            const [pageView] = await db.insert(analyticsPageViews)
                .values(pageViewData)
                .returning();

            console.log(`[Analytics Service] Page view successfully inserted with ID: ${pageView.id}`);
            return { sessionId, pageViewId: pageView.id };
        } catch (error) {
            console.error('[Analytics Service] Error tracking page view:', error);
            console.error('[Analytics Service] Error stack:', error.stack);
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
                path: data.path || req.path,
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
            console.error('Error tracking event:', error);
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
            console.error('Error ending session:', error);
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

            // Get returning visitor counts using raw SQL
            let returningVisitorsQuery = `
                SELECT COUNT(*) as count 
                FROM analytics_sessions 
                WHERE start_timestamp >= '${startDateStr}'
                AND is_returning_visitor = true
            `;
            if (liveDataOnly) {
                returningVisitorsQuery += ` AND ${botFilter}`;
            }
            
            const returningVisitorsResult = await db.execute(sql.raw(returningVisitorsQuery));
            const returningVisitors = Number(returningVisitorsResult.rows[0]?.count) || 0;
            const newVisitors = totalSessions - returningVisitors;

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
                                pv1.path AS source_path, pv1.page_type AS source_page_type, pv1.page_category AS source_page_category,
                                pv2.path AS target_path, pv2.page_type AS target_page_type, pv2.page_category AS target_page_category,
                                pv1.session_id
                            FROM analytics_page_views pv1
                            JOIN analytics_page_views pv2 ON 
                                pv1.session_id = pv2.session_id AND
                                pv1.timestamp < pv2.timestamp
                            JOIN analytics_sessions s ON pv1.session_id = s.session_id
                            WHERE 
                                s.start_timestamp >= ${startDate}
                                ${liveDataOnly ? sql`AND (s.ip NOT LIKE '127.%' AND s.ip != 'unknown' AND s.ip NOT LIKE '192.168.%' AND s.ip NOT LIKE '10.%')` : sql``}
                                AND pv2.timestamp = (
                                    SELECT MIN(pv3.timestamp)
                                    FROM analytics_page_views pv3
                                    WHERE 
                                        pv3.session_id = pv1.session_id AND
                                        pv3.timestamp > pv1.timestamp
                                )
                        )
                        SELECT
                            source_path, source_page_type, source_page_category, 
                            target_path, target_page_type, target_page_category,
                            COUNT(*) as transitions
                        FROM page_paths
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
                    console.log(`[Analytics] Updating session ${sessionId} with userId ${currentUserId}`);
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
            console.log('[Analytics] Using fallback geo location for testing');
            geoData = {
                range: [0, 0], country: 'US', region: 'FL', eu: '0',
                timezone: 'America/New_York', city: 'Orlando',
                ll: [28.5383, -81.3792], metro: 0, area: 0
            };
        }

        const newSessionId = crypto.randomUUID();

        await db.insert(analyticsSessions)
            .values({
                sessionId: newSessionId, userId: currentUserId, ip: ip || 'unknown', userAgent: userAgent || 'unknown',
                device, browser, os,
                country: geoData?.country || null, region: geoData?.region || null, city: geoData?.city || null,
                latitude: geoData?.ll ? geoData.ll[0] : null, longitude: geoData?.ll ? geoData.ll[1] : null,
                startTimestamp: new Date(), pagesViewed: 1, // Start pagesViewed at 1 for the first page view
                isActive: true,
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
            // Use visitor fingerprints instead of IP addresses for accurate unique visitor counting by day
            const result = await db.execute(sql`
                SELECT 
                    DATE_TRUNC('day', start_timestamp) AS day,
                    COUNT(*) AS sessions,
                    COUNT(DISTINCT visitor_fingerprint) AS unique_visitors
                FROM analytics_sessions
                WHERE start_timestamp >= ${startDate}
                ${liveDataOnly ? sql`AND (ip NOT LIKE '127.%' AND ip != 'unknown' AND ip NOT LIKE '192.168.%' AND ip NOT LIKE '10.%') AND visitor_fingerprint IS NOT NULL` : sql`AND visitor_fingerprint IS NOT NULL`}
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
} // End of AnalyticsService class

export const analyticsService = new AnalyticsService();