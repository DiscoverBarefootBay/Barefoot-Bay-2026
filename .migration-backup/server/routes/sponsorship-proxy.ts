/**
 * Sponsorship API Proxy
 * 
 * This route forwards requests from /api/sponsorship/* endpoints to /api/subscriptions/*
 * to maintain backward compatibility while providing a more appropriate name for users.
 */

import { Router, Request, Response, NextFunction } from 'express';
import userSubscriptionsRouter from './subscriptions';

const router = Router();

// Create a middleware to forward all requests to the subscriptions router
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[SponsorshipProxy] Forwarding request from ${req.originalUrl} to subscriptions endpoint`);
  
  // Update the path to match what the subscriptions router expects
  const originalPath = req.path;
  const newPath = originalPath.replace('/sponsorship', '/subscriptions');
  
  // To debug potential issues
  console.log(`[SponsorshipProxy] Original path: ${originalPath}, New path: ${newPath}`);
  
  // Forward to the subscriptions router
  req.url = newPath;
  userSubscriptionsRouter(req, res, next);
});

export default router;