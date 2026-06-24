/**
 * Server Performance Optimization Module
 * 
 * This module configures performance optimizations for the Node.js server:
 * - Response compression for faster data transfer
 * - Security headers with Helmet
 * - Rate limiting to prevent abuse
 * - In-memory caching for frequently accessed data
 * - PostgreSQL connection pool optimization
 * - Request performance timing and monitoring
 */

import compression from 'compression';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mcache from 'memory-cache';
import { Express, Request, Response, NextFunction } from 'express';
import { Pool } from '@neondatabase/serverless';

// Cache middleware
export const cache = (duration: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for authenticated requests or non-GET requests
    if (req.method !== 'GET' || req.isAuthenticated()) {
      return next();
    }

    const key = '__express__' + req.originalUrl || req.url;
    const cachedBody = mcache.get(key);
    
    if (cachedBody) {
      res.send(cachedBody);
      return;
    } else {
      const originalSend = res.send;
      res.send = function(body) {
        mcache.put(key, body, duration * 1000);
        return originalSend.call(this, body);
      };
      next();
    }
  };
};

// Configure rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 2000, // Temporarily increased from 200 to 2000 requests per windowMs
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Don't skip successful requests
  skipSuccessfulRequests: false,
  // Skip rate limiting for admin users if auth is initialized, otherwise apply to all
  skip: (req: Request) => {
    // Safe check if authentication is available
    // Also skip rate limiting for forum-related requests
    if (req.path.startsWith('/forum/')) {
      return true;
    }
    return req.user?.role === 'admin';
  },
  message: {
    status: 429,
    message: 'Too many requests, please try again later.'
  }
});

// Helmet configuration for security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'", "*", "data:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://www.googletagmanager.com", "http://localhost:*", "https://*.replit.app", "https://*.replit.dev", "*"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "http://localhost:*", "https://*.replit.app", "https://*.replit.dev", "*"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://cdn.jsdelivr.net", "http://localhost:*", "https://*.replit.app", "https://*.replit.dev", "*"],
      connectSrc: ["'self'", "http://localhost:*", "https://*.replit.app", "https://*.replit.dev", "https://barefootbay.com", "wss://*.replit.app", "wss://*.replit.dev", "ws://localhost:*", "*"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com", "http://localhost:*", "https://*.replit.app", "https://*.replit.dev", "*"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "http://localhost:*", "https://*.replit.app", "https://*.replit.dev", "data:", "blob:", "*"],
      frameSrc: ["'self'", "http://localhost:*", "https://*.replit.app", "https://*.replit.dev", "*"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Configure the PostgreSQL connection pool for optimal performance
export const configurePostgresPool = (pool: Pool) => {
  // Set optimal pool settings for a 16GB RAM server
  const newPoolConfig = {
    max: 20,                          // Maximum number of clients in the pool (adjust based on load)
    idleTimeoutMillis: 30000,         // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 5000,    // How long to wait for a connection to become available
    allowExitOnIdle: false            // Don't exit the pool when it becomes idle
  };
  
  // Apply the settings
  Object.assign(pool, newPoolConfig);
  
  // Log the configuration
  console.log('PostgreSQL connection pool optimized for production with settings:', newPoolConfig);
  
  return pool;
};

// Configuration for response compression
export const compressionConfig = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  // Skip compressing responses with these content types
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Skip compression for already compressed formats
    const contentType = res.getHeader('Content-Type') as string || '';
    if (contentType.includes('image/') || 
        contentType.includes('video/') || 
        contentType.includes('audio/')) {
      return false;
    }
    
    return compression.filter(req, res);
  },
  // Use higher compression level for better compression at expense of CPU
  level: 6
});

// Performance timing middleware to track slow requests
export const performanceTimer = (slowRequestThreshold = 500) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for non-API routes
    if (!req.path.startsWith('/api/')) {
      return next();
    }
    
    // Record start time
    const start = Date.now();
    
    // Track response
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      // Log slow requests with detailed information
      if (duration > slowRequestThreshold) {
        const logData = {
          method: req.method,
          path: req.path,
          params: req.params,
          query: req.query,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          user: req.user?.id ? `ID: ${req.user.id}` : 'unauthenticated',
          userAgent: req.headers['user-agent']
        };
        
        console.warn(`⚠️ Slow request detected (${duration}ms):`, JSON.stringify(logData, null, 2));
      }
    });
    
    next();
  };
};

// Apply all performance optimizations to an Express app
export const applyPerformanceOptimizations = (app: Express, pool: Pool) => {
  // Apply compression (should be one of the first middleware)
  app.use(compressionConfig);
  
  // Apply security headers
  app.use(securityHeaders);
  
  // Apply rate limiting to API routes
  app.use('/api/', apiLimiter);
  
  // Apply performance timing middleware (configurable threshold in ms)
  const slowRequestThreshold = parseInt(process.env.SLOW_REQUEST_THRESHOLD || '500');
  app.use(performanceTimer(slowRequestThreshold));
  
  // Optimize PostgreSQL connection pool
  configurePostgresPool(pool);
  
  // Log that optimizations were applied
  console.log('✓ Performance optimizations applied');
  
  return app;
};