import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './services/analytics-service';
import { logger } from './lib/logger';

/**
 * Analytics middleware to track page views and visits
 * This middleware will be applied to all routes to capture analytics data
 */
export const analyticsMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip tracking for certain paths
    const skipPatterns = [
      /^\/(api|assets|static|favicon|robots|manifest)/i, // API and static assets
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp4|webm|mov|avi|mp3|wav|ogg|pdf)$/i, // Static file extensions including media
      /^\/analytics\//i, // Analytics routes (to avoid recursion)
      /^\/(banner-slides|uploads\/banner-slides)\//i, // Banner/media uploads
    ];

    if (skipPatterns.some(pattern => pattern.test(req.path))) {
      return next();
    }

    // Skip tracking for bots, crawlers, and headless browsers
    const userAgent = req.headers['user-agent'] as string || '';
    const botPatterns = [
      /HeadlessChrome/i,
      /PhantomJS/i,
      /Puppeteer/i,
      /Playwright/i,
      /Selenium/i,
      /Googlebot/i,
      /Bingbot/i,
      /Slurp/i,
      /DuckDuckBot/i,
      /Baiduspider/i,
      /YandexBot/i,
      /facebookexternalhit/i,
      /Twitterbot/i,
      /LinkedInBot/i,
    ];

    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      return next();
    }

    // Get or create session ID from cookie
    let sessionId = req.cookies?.['analytics_session_id'];

    if (!sessionId) {
      // Simple detection of device type and browser
      const deviceType = detectDeviceType(userAgent);
      const browser = detectBrowser(userAgent);

      // Start a new session
      sessionId = await analyticsService.startSession({
        userId: req.user?.id,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string || '127.0.0.1',
        userAgent: userAgent,
        deviceType: deviceType,
        browser: browser,
        referrer: req.headers.referer || null,
        entryPage: req.path,
        properties: {
          screen: req.headers['sec-ch-viewport-width']
                  ? { width: req.headers['sec-ch-viewport-width'], height: req.headers['sec-ch-viewport-height'] }
                  : undefined,
          language: req.headers['accept-language']
        }
      });

      // Set session cookie (30-day expiration to match getOrCreateSession)
      res.cookie('analytics_session_id', sessionId, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      // Make the freshly created session visible to getOrCreateSession() within
      // THIS same request. The cookie above is only set on the response, so it is
      // not yet present on req.cookies; without this, trackPageView() would call
      // getOrCreateSession(), find no cookie, and create a SECOND session — the
      // page view then lands on the duplicate while this session keeps
      // pages_viewed = 0. That double-counting is what collapsed the
      // page-views-per-session ratio and inflated session/visitor counts.
      if (req.cookies && typeof req.cookies === 'object') {
        req.cookies['analytics_session_id'] = sessionId;
      } else {
        (req as any).cookies = { analytics_session_id: sessionId };
      }
    }

    // Track the page view in the background without blocking the request.
    analyticsService.trackPageView(req, {
      sessionId,
      url: req.path,
      title: req.path, // We don't have the page title in the middleware
      properties: {
        query: req.query,
        method: req.method,
        isAuthenticated: req.isAuthenticated?.() || false
      }
    }).catch(err => {
      // Surface recording failures instead of dropping them silently — a sudden
      // burst of these is the signal that analytics tracking has regressed.
      logger.warn({ err, path: req.path }, 'analytics: failed to record page view');
    });

    // Continue to the next middleware
    next();
  } catch (error) {
    logger.error({ err: error, path: req.path }, 'analytics: middleware error');
    // Don't block the request, just continue
    next();
  }
};

/**
 * Simple function to detect device type from user agent
 */
function detectDeviceType(userAgent: string): string {
  if (!userAgent) return 'unknown';

  userAgent = userAgent.toLowerCase();

  if (userAgent.match(/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i)) {
    return 'mobile';
  } else if (userAgent.match(/tablet|ipad/i)) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Simple function to detect browser from user agent
 */
function detectBrowser(userAgent: string): string {
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

// Export the analytics service for direct usage
export { analyticsService };
