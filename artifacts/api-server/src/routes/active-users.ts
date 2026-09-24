/**
 * Active Users Tracking API
 * 
 * Provides real-time tracking of users currently active on specific pages
 */

import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { redactSensitivePath } from "../lib/redact-path";

// Track active users with a simple in-memory store
interface ActiveUser {
  userId: number | string;
  username: string;
  ip: string;
  userAgent: string;
  lastActive: Date;
  sessionId: string;
  path: string;
}

const activeUsers: Map<string, ActiveUser> = new Map();

// Clean inactive users every 60 seconds
const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
setInterval(() => {
  const now = new Date();
  for (const [key, user] of activeUsers.entries()) {
    if (now.getTime() - user.lastActive.getTime() > INACTIVE_THRESHOLD) {
      activeUsers.delete(key);
    }
  }
}, 60 * 1000); // Run every minute

const router = Router();

// Track user activity on a specific page
router.post('/track-activity', async (req: Request, res: Response) => {
  try {
    const path = redactSensitivePath(req.body?.path);
    const sessionId = req.sessionID || 'anonymous';
    const userId = req.session?.passport?.user;
    
    if (userId) {
      // Get user details from storage
      const user = await storage.getUser(userId);
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string || 'unknown';
      const userAgent = req.headers['user-agent'] || 'Unknown';
      
      // Add or update user in active users map
      activeUsers.set(sessionId, {
        userId,
        username: user?.username || 'Anonymous User',
        ip,
        userAgent,
        lastActive: new Date(),
        sessionId,
        path: path || redactSensitivePath(req.headers.referer) || '/'
      });
      
      console.log(`[Activity Tracker] User ${user?.username || userId} (ID: ${userId}) active on ${path}`);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Activity Tracker] Error tracking activity:', error);
    res.status(500).json({ success: false, error: 'Error tracking activity' });
  }
});

// Get active users for a specific path (or all users if no path specified)
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.passport?.user;
    const pathFilter = req.query.path as string;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Filter users by path if specified
    let filteredUsers = Array.from(activeUsers.values());
    
    if (pathFilter) {
      filteredUsers = filteredUsers.filter(user => user.path === pathFilter);
    }
    
    // Return user data without sensitive information
    const users = filteredUsers.map(user => ({
      userId: user.userId,
      username: user.username,
      lastActive: user.lastActive,
      path: user.path
    }));
    
    res.status(200).json({
      success: true,
      activeUserCount: users.length,
      activeUsers: users,
      path: pathFilter || 'all'
    });
  } catch (error) {
    console.error('[Active Users] Error fetching active users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching active users'
    });
  }
});

// Get active users for admin dashboard (includes more details)
router.get('/admin', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.passport?.user;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Verify user is admin
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }
    
    // Return all active users with detailed information for admin
    const users = Array.from(activeUsers.values()).map(user => ({
      userId: user.userId,
      username: user.username,
      lastActive: user.lastActive,
      path: user.path,
      userAgent: user.userAgent,
      ip: user.ip
    }));
    
    res.status(200).json({
      success: true,
      activeUserCount: users.length,
      activeUsers: users
    });
  } catch (error) {
    console.error('[Active Users Admin] Error fetching active users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching active users'
    });
  }
});

export default router;