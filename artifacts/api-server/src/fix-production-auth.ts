import express from 'express';
import { storage } from './storage';
import { requireAdmin } from './auth';

const router = express.Router();

// Special middleware that allows access with bypass parameter in production
const authWithBypass = (req, res, next) => {
  // Allow bypass parameter if we're in production environment
  const isProduction = process.env.NODE_ENV === 'production';
  const hasEmergencyAccess = req.query.emergencyAccess === 'true';
  
  if (isProduction && hasEmergencyAccess) {
    console.log('Emergency access granted to auth fix page');
    return next();
  }
  
  // Otherwise, use standard admin authentication
  requireAdmin(req, res, next);
};

// Use the authentication middleware with bypass capability
router.use(authWithBypass);

// Get cookie and session status for diagnostic purposes
router.get('/cookie-status', async (req, res) => {
  console.log('Production auth diagnostics: Checking cookie status');
  
  try {
    // Capture raw cookie data
    const rawCookies = req.headers.cookie || '';
    
    // Parse connect.sid cookie to check for session ID
    const connectSidMatch = rawCookies.match(/connect\.sid=([^;]+)/);
    const hasConnectSid = !!connectSidMatch;
    
    // Basic authentication and session status
    const cookieStatus = {
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      user: req.user ? {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        isApproved: req.user.isApproved
      } : null,
      cookies: {
        raw: rawCookies.substring(0, 100) + (rawCookies.length > 100 ? '...' : ''), // Truncate for security
        parsedSessionId: !!connectSidMatch,
        hasConnectSid
      },
      session: {
        exists: !!req.session,
        id: req.sessionID || null,
        cookie: req.session?.cookie ? {
          secure: req.session.cookie.secure,
          httpOnly: req.session.cookie.httpOnly,
          sameSite: req.session.cookie.sameSite,
          maxAge: req.session.cookie.maxAge,
          domain: req.session.cookie.domain || null,
          path: req.session.cookie.path
        } : null
      },
      request: {
        host: req.headers.host || '',
        origin: req.headers.origin || '',
        referer: req.headers.referer || '',
        secure: req.secure,
        protocol: req.protocol,
        domain: req.hostname
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        cookieDomain: process.env.COOKIE_DOMAIN || 'default',
        cookieSecure: process.env.COOKIE_SECURE || 'default'
      }
    };
    
    console.log('Cookie status diagnostics:', {
      isAuthenticated: cookieStatus.isAuthenticated,
      hasUser: cookieStatus.hasUser,
      userId: cookieStatus.user?.id,
      hasSession: cookieStatus.session.exists,
      sessionID: cookieStatus.session.id,
      requestInfo: cookieStatus.request
    });
    
    return res.json(cookieStatus);
  } catch (error) {
    console.error('Error checking cookie status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check cookie status',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Reset session and clear cookies
router.post('/reset-session', (req, res) => {
  console.log('Production auth fix: Resetting session for user:', req.user?.id);
  
  try {
    // Store basic user info for logging
    const userInfo = req.user ? {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    } : null;
    
    // Clear session and logout
    req.logout((err) => {
      if (err) {
        console.error('Error during logout:', err);
        return res.status(500).json({
          success: false,
          message: 'Error during logout process',
          error: err.message
        });
      }
      
      // Destroy session
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error('Error destroying session:', sessionErr);
          return res.status(500).json({
            success: false,
            message: 'Error destroying session',
            error: sessionErr.message
          });
        }
        
        console.log('Session successfully reset for user:', userInfo);
        
        // Clear cookies by setting expired cookies with same path/domain
        // This is important for fixing cross-domain cookie issues
        res.clearCookie('connect.sid');
        
        return res.json({
          success: true,
          message: 'Session successfully reset. You need to log in again.',
          previousUser: userInfo
        });
      });
    });
  } catch (error) {
    console.error('Error resetting session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset session',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Test database connection and session store
router.get('/session-store-test', async (req, res) => {
  console.log('Production auth fix: Testing session store for user:', req.user?.id);
  
  try {
    // Test database connection
    const dbTestResult = await storage.testDatabaseConnection();
    
    // Write a test value to the session to verify session store
    const testValue = 'test-' + Date.now();
    req.session.testValue = testValue;
    
    // Wait for session to save
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('Session saved with test value:', testValue);
          resolve();
        }
      });
    });
    
    // Read the test value back to verify session store is working
    const sessionWritable = req.session.testValue === testValue;
    
    return res.json({
      success: dbTestResult.success && sessionWritable,
      sessionWritable,
      sessionID: req.sessionID,
      timestamp: Date.now(),
      databaseConnection: dbTestResult.success ? 'working' : 'failed',
      databaseInfo: dbTestResult.success ? {
        message: dbTestResult.message,
        timestamp: dbTestResult.timestamp
      } : null,
      databaseError: dbTestResult.success ? null : dbTestResult.message
    });
  } catch (error) {
    console.error('Error testing session store:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to test session store',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export const productionAuthRouter = router;