import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
    username: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
    [key: string]: any;
  };
}

/**
 * Middleware to verify that a user is authenticated
 * This checks if the user is available in the session
 */
export const authenticateUser = (
  req: Request & AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Check if the user is authenticated through Passport
  if (req.isAuthenticated && req.isAuthenticated()) {
    // The user is already set by Passport
    next();
  } 
  // Fallback to session.user for backward compatibility
  else if (req.session && req.session.user) {
    req.user = req.session.user;
    next();
  } 
  else {
    console.log('Authentication failed:', {
      sessionExists: !!req.session,
      sessionID: req.sessionID || 'none',
      hasPassport: !!(req.session && req.session.passport),
      passportUser: req.session?.passport?.user,
      method: req.method,
      path: req.path,
      cookies: Object.keys(req.cookies || {}).join(',')
    });
    res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Middleware to verify that a user has admin role
 */
export const authenticateAdmin = (
  req: Request & AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Check if user is authenticated through Passport and is an admin
  if (req.isAuthenticated && req.isAuthenticated() && req.user?.role === 'admin') {
    next();
  } 
  // Fallback to session.user for backward compatibility
  else if (req.session && req.session.user && req.session.user.role === 'admin') {
    req.user = req.session.user;
    next();
  } 
  else {
    console.log('Admin authentication failed:', {
      sessionExists: !!req.session,
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      userRole: req.user?.role || req.session?.user?.role || 'none',
      path: req.path,
      method: req.method
    });
    res.status(403).json({ error: 'Forbidden' });
  }
};