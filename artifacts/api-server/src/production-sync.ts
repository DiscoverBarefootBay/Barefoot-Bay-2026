/**
 * Utility to synchronize user data across development and production databases
 * 
 * This module provides endpoints to help diagnose and fix issues related to
 * data inconsistencies between development and production environments.
 */

import { NextFunction, Request, Response, Router } from 'express';
import { storage } from './storage';

export const productionSyncRouter = Router();

// Enhanced diagnostic endpoint to check authentication status with robust cross-domain support
productionSyncRouter.get('/auth-status', (req, res) => {
  try {
    // For production environments, we need to handle cross-domain requests properly
    if (process.env.NODE_ENV === 'production') {
      // Set CORS headers for the preflight request
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    }
    
    // Extract domain info for debugging
    const host = req.headers.host || '';
    const referer = req.headers.referer || '';
    const origin = req.headers.origin || '';
    
    // Detect if this is a cross-domain request
    let isCrossDomain = false;
    if (host && (referer || origin)) {
      // Extract domain from host and referer/origin
      const hostDomain = host.includes(':') ? host.split(':')[0] : host;
      const refererDomain = referer ? new URL(referer).hostname : '';
      const originDomain = origin ? new URL(origin).hostname : '';
      
      // Check if the domains don't match
      isCrossDomain = (refererDomain && refererDomain !== hostDomain) || 
                       (originDomain && originDomain !== hostDomain);
    }
    
    // Check if cookie is properly parsed but session data is missing
    const cookiePresent = !!req.headers.cookie;
    const sessionIdPresent = !!req.sessionID;
    const sessionDataPresent = !!req.session;
    const userPresent = !!req.user;
    
    // Detailed authentication information for diagnostic purposes
    const authInfo = {
      isAuthenticated: req.isAuthenticated(),
      hasSession: sessionDataPresent,
      sessionID: req.sessionID || null,
      hasCookies: cookiePresent,
      hasUser: userPresent,
      userInfo: req.user ? {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        isApproved: req.user.isApproved
      } : null,
      headers: {
        host: host,
        origin: origin,
        referer: referer,
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type'],
        accept: req.headers.accept
      },
      nodeEnv: process.env.NODE_ENV || 'development',
      isCrossDomain: isCrossDomain,
      cookieStatus: {
        parsedCorrectly: cookiePresent,
        sessionIdExtracted: sessionIdPresent,
        sessionDataFound: sessionDataPresent
      }
    };
    
    console.log('Enhanced auth status check:', authInfo);
    
    // In production with cross-domain requests, provide a helpful message specifically for that scenario
    if (process.env.NODE_ENV === 'production' && isCrossDomain && !req.isAuthenticated()) {
      console.warn('Cross-domain authentication issue detected:', {
        host: host,
        referer: referer,
        origin: origin,
        hasCookies: cookiePresent,
        hasSession: sessionDataPresent,
        hasSessionID: sessionIdPresent
      });
    }
    
    // For this diagnostic endpoint, we don't require admin access
    // We just return the authentication status
    return res.json(authInfo);
  } catch (err) {
    console.error('Error checking auth status:', err);
    return res.status(500).json({ 
      error: 'Error checking auth status', 
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// Create a middleware to ensure only admins can access these routes
function adminRequired(req: Request, res: Response, next: NextFunction) {
  // Detailed debug logging for authentication troubleshooting
  console.log('Admin check requested', {
    isAuthenticated: req.isAuthenticated(),
    hasUser: !!req.user,
    userRole: req.user?.role,
    sessionID: req.sessionID,
    cookies: req.headers.cookie,
    origin: req.headers.origin,
    host: req.headers.host,
    referer: req.headers.referer,
  });
  
  // On production we're more likely to have credential issues, so be extra careful
  if (!req.isAuthenticated()) {
    const isProduction = process.env.NODE_ENV === 'production';
    console.error(`Authentication failed in ${isProduction ? 'production' : 'development'} environment`);
    
    // Add proper CORS headers for cross-domain requests in production
    if (isProduction) {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    }
    
    return res.status(401).json({ 
      message: "Not authenticated",
      error: "Authentication failed. Please ensure you're logged in with admin credentials.",
      sessionPresent: !!req.sessionID
    });
  }
  
  // Make sure the user has admin role
  if (!req.user || req.user.role !== 'admin') {
    console.error(`Authorization failed: user present but not admin. Role=${req.user?.role}`);
    return res.status(403).json({ 
      message: "Admin access required",
      error: "You must have administrator privileges to access this feature."
    });
  }
  
  // User is authenticated and has admin role
  console.log(`Admin authentication successful for user: ${req.user.username}`);
  next();
}

// Get direct database stats
productionSyncRouter.get('/stats', adminRequired, async (req, res) => {
  try {
    // Check if request is authenticated for additional security
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      console.error('Unauthorized access to database stats');
      return res.status(403).json({ error: 'Unauthorized access to database stats' });
    }
    
    // Get all users directly from the database
    const allUsers = await storage.getUsers();
    
    // Get stats about the users
    const pendingUsers = allUsers.filter(user => user.isApproved === false);
    const adminUsers = allUsers.filter(user => user.role === 'admin');
    const registeredUsers = allUsers.filter(user => user.role === 'registered');
    
    // Create the response object
    const responseData = {
      environment: process.env.NODE_ENV || 'development',
      database: {
        connectionType: process.env.DATABASE_URL ? 'external' : 'in-memory',
        connectionString: process.env.DATABASE_URL ? '(hidden for security)' : null,
      },
      userStats: {
        total: allUsers.length,
        pending: pendingUsers.length,
        approved: allUsers.length - pendingUsers.length,
        byRole: {
          admin: adminUsers.length,
          registered: registeredUsers.length,
        }
      },
      pendingUsers: pendingUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isApproved: user.isApproved,
        createdAt: user.createdAt
      }))
    };

    // Set content type explicitly to avoid body stream issues
    res.setHeader('Content-Type', 'application/json');
    
    // Return the response
    return res.json(responseData);
  } catch (err) {
    console.error('Error getting database stats:', err);
    
    // Include more detailed error info to help with debugging production issues
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorStack = err instanceof Error ? err.stack : '';
    
    return res.status(500).json({ 
      error: 'Failed to get database stats',
      message: errorMessage,
      timestamp: new Date().toISOString(),
      // Only include stack trace in development for security
      ...(process.env.NODE_ENV !== 'production' && { stack: errorStack })
    });
  }
});

// Create test pending users if needed
productionSyncRouter.post('/create-test-users', adminRequired, async (req, res) => {
  try {
    // Double-check authentication for additional security
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      console.error('Unauthorized attempt to create test users');
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    // Create a test pending user
    const testUser = await storage.createUser({
      username: `test-pending-${Date.now()}`,
      password: 'password123', // This will be hashed by storage.createUser
      email: `test-${Date.now()}@example.com`,
      fullName: 'Test Pending User',
      role: 'registered',
      isApproved: false,
      isResident: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Set content type explicitly to avoid body stream issues
    res.setHeader('Content-Type', 'application/json');
    
    return res.json({
      success: true,
      message: 'Test pending user created successfully',
      user: {
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        fullName: testUser.fullName,
        role: testUser.role,
        isApproved: testUser.isApproved
      }
    });
  } catch (err) {
    console.error('Error creating test user:', err);
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return res.status(500).json({ 
      error: 'Failed to create test user',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Force refresh all users from database
productionSyncRouter.post('/force-refresh', adminRequired, async (req, res) => {
  try {
    // Double-check authentication for additional security
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      console.error('Unauthorized attempt to force database refresh');
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    // Force a refresh of all users from the database
    const allUsers = await storage.getUsers(true); // Pass true to force refresh
    
    // Get stats about the refresh
    const pendingUsers = allUsers.filter(user => user.isApproved === false);
    
    // Log detailed information to help with debugging
    console.log(`Force refresh completed. Found ${allUsers.length} total users with ${pendingUsers.length} pending approvals.`);
    if (pendingUsers.length > 0) {
      console.log('Pending users:', pendingUsers.map(u => u.username).join(', '));
    }
    
    // Set content type explicitly to avoid body stream issues
    res.setHeader('Content-Type', 'application/json');
    
    return res.json({
      success: true,
      message: 'User data refreshed successfully',
      userCount: allUsers.length,
      pendingCount: pendingUsers.length,
      pendingUsers: pendingUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email, 
        fullName: user.fullName,
        isApproved: user.isApproved,
        createdAt: user.createdAt
      }))
    });
  } catch (err) {
    console.error('Error forcing refresh:', err);
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return res.status(500).json({ 
      error: 'Failed to force refresh',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});