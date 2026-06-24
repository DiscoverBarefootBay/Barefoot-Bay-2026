/**
 * Deployment Authentication Diagnostic Tool
 * 
 * This file provides routes to debug authentication and session issues in deployment.
 * Add these routes to your application for diagnosing authentication problems.
 */
import { Router, Request, Response } from 'express';

export const deploymentDiagnosticRouter = Router();

// Comprehensive environment and cookie diagnostic endpoint
deploymentDiagnosticRouter.get('/diagnostic', (req: Request, res: Response) => {
  // Extract session information safely
  const sessionInfo = req.session ? {
    id: req.sessionID,
    cookie: req.session.cookie ? {
      originalMaxAge: req.session.cookie.originalMaxAge,
      secure: req.session.cookie.secure,
      httpOnly: req.session.cookie.httpOnly,
      path: req.session.cookie.path,
      domain: req.session.cookie.domain,
      sameSite: req.session.cookie.sameSite,
    } : 'No cookie in session',
    // TypeScript doesn't know about isNew, but it's a standard Express session property
    // @ts-ignore
    isNew: req.session.isNew || false,
  } : 'No session available';

  // Safely extract authentication info
  const authInfo = {
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'isAuthenticated method not available',
    user: req.user ? {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    } : null
  };

  // Request information
  const requestInfo = {
    headers: {
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent'],
      cookie: req.headers.cookie ? 'Present' : 'None',
      authorization: req.headers.authorization ? 'Present' : 'None'
    },
    ip: req.ip,
    protocol: req.protocol,
    secure: req.secure,
    xhr: req.xhr,
    path: req.path,
    method: req.method
  };

  // Environment configuration
  const envConfig = {
    NODE_ENV: process.env.NODE_ENV || 'not set',
    SESSION_SECRET: process.env.SESSION_SECRET ? 'Set (hidden)' : 'Not set',
    COOKIE_SECURE: process.env.COOKIE_SECURE || 'not set',
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || 'not set',
    REPL_ID: process.env.REPL_ID || 'not set',
    REPL_OWNER: process.env.REPL_OWNER || 'not set',
    REPL_SLUG: process.env.REPL_SLUG || 'not set'
  };

  // CORS check 
  const corsCheck = {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:5000',
      'https://barefootbay.com',
      'https://www.barefootbay.com',
      'https://*.barefootbay.com',
      'https://*.replit.app',
      'https://*.replit.dev'
    ],
    currentOrigin: req.headers.origin || 'No origin header',
    isOriginAllowed: !!req.headers.origin && (
      req.headers.origin.includes('barefootbay.com') || 
      req.headers.origin.includes('replit.app') || 
      req.headers.origin.includes('replit.dev') ||
      req.headers.origin.includes('localhost')
    )
  };

  const diagnosticData = {
    timestamp: new Date().toISOString(),
    authInfo,
    sessionInfo,
    requestInfo,
    envConfig,
    corsCheck
  };

  console.log('Authentication diagnostic data:', JSON.stringify(diagnosticData, null, 2));
  
  res.json(diagnosticData);
});

// Add a test cookie endpoint 
deploymentDiagnosticRouter.get('/test-cookie', (req: Request, res: Response) => {
  // Set a test cookie with the same settings as session
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieSecure = isProduction || process.env.COOKIE_SECURE === 'true';
  
  res.cookie('test_cookie', 'cookie_test_value', {
    secure: cookieSecure,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 60 * 60 * 1000 // 1 hour
  });
  
  res.json({
    success: true,
    message: 'Test cookie set',
    cookieSettings: {
      secure: cookieSecure,
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      domain: process.env.COOKIE_DOMAIN || 'not set',
      path: '/'
    }
  });
});

// Check test cookie
deploymentDiagnosticRouter.get('/check-test-cookie', (req: Request, res: Response) => {
  const testCookieExists = req.headers.cookie && req.headers.cookie.includes('test_cookie');
  
  res.json({
    success: true,
    testCookieExists,
    allCookies: req.headers.cookie || 'No cookies found'
  });
});

// Set a client-side readable cookie
deploymentDiagnosticRouter.get('/client-readable-cookie', (req: Request, res: Response) => {
  // Set a non-HttpOnly cookie that can be read by client JavaScript
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieSecure = isProduction || process.env.COOKIE_SECURE === 'true';
  
  res.cookie('client_readable', 'value_for_client_js', {
    secure: cookieSecure,
    httpOnly: false, // Client JavaScript can read this
    sameSite: isProduction ? 'none' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 60 * 60 * 1000 // 1 hour
  });
  
  res.json({
    success: true,
    message: 'Client-readable cookie set',
    instructions: 'Check document.cookie in your browser console to verify'
  });
});

export default deploymentDiagnosticRouter;