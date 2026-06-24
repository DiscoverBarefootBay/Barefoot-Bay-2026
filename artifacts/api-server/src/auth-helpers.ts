import { Request, Response, NextFunction } from 'express';

/**
 * Check if the current request user is an admin
 * @param req Express Request object
 * @returns boolean indicating if the user is an admin
 */
export const checkIsAdmin = (req: Request): boolean => {
  if (!req.isAuthenticated || !req.user) {
    return false;
  }
  
  // Check if user is authenticated and has admin role
  return req.isAuthenticated() && 
    (req.user.role === 'admin' || 
     req.user.isAdmin === true);
};

/**
 * Middleware to ensure user is authenticated and is an admin
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (checkIsAdmin(req)) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: 'Access denied. Admin privileges required.'
  });
};