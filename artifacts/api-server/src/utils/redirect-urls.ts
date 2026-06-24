/**
 * Centralized redirect URL utility for Square payments
 * This ensures consistent redirect URL generation across all payment flows
 */

import { Request } from 'express';

/**
 * Get the appropriate redirect URL for the current environment
 * @param req - Express request object to extract hostname
 * @param path - The path to redirect to (default: '/payment-complete')
 * @returns Complete redirect URL for the current environment
 */
export function getEnvironmentRedirectUrl(req: Request, path: string = '/payment-complete'): string {
  // For production, always use the production domain
  if (process.env.NODE_ENV === 'production') {
    const url = `https://barefootbay.com${path}`;
    console.log(`Using production domain for redirect: ${url}`);
    return url;
  }
  
  // For development, extract hostname from current request (most reliable method)
  const hostname = req.get('host');
  if (hostname) {
    const url = `https://${hostname}${path}`;
    console.log(`Using request hostname for redirect: ${url}`);
    return url;
  }
  
  // Fallback to environment variables for development
  if (process.env.PUBLIC_URL) {
    const url = `${process.env.PUBLIC_URL}${path}`;
    console.log(`Using PUBLIC_URL for redirect: ${url}`);
    return url;
  }
  
  if (process.env.REPLIT_DEPLOYMENT_ID) {
    const url = `https://${process.env.REPLIT_DEPLOYMENT_ID}-00-y43hx7t2mc3m.janeway.replit.dev${path}`;
    console.log(`Using Replit deployment URL for redirect: ${url}`);
    return url;
  }
  
  // Development fallback for known Replit environment
  const url = `https://10d91268-aa00-4bbf-8cbc-902453f7f73d-00-y43hx7t2mc3m.janeway.replit.dev${path}`;
  console.log(`Using development fallback URL for redirect: ${url}`);
  return url;
}

/**
 * Validate that a redirect URL is accessible and properly formatted
 * @param url - The URL to validate
 * @returns boolean indicating if the URL is valid
 */
export function validateRedirectUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Ensure HTTPS for security
    if (parsedUrl.protocol !== 'https:') {
      console.warn(`Redirect URL is not HTTPS: ${url}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Invalid redirect URL: ${url}`, error);
    return false;
  }
}

/**
 * Legacy support function that mimics the old getRedirectUrl behavior
 * but uses the new centralized logic
 * @param req - Express request object
 * @param path - The path to redirect to
 * @returns Complete redirect URL
 */
export function getRedirectUrl(req: Request, path: string): string {
  return getEnvironmentRedirectUrl(req, path);
}