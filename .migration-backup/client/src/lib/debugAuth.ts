/**
 * Debug authentication helper functions
 * Use these functions to diagnose authentication issues in development and production
 */

import { apiRequest } from './queryClient';

export interface DebugAuthResponse {
  hasSession: boolean;
  sessionID: string;
  isAuthenticated: boolean;
  user: {
    id: number;
    username: string;
    role: string;
    isApproved: boolean;
  } | null;
  requestInfo: {
    protocol: string;
    secure: boolean;
    hostname: string;
    originalUrl: string;
    ip: string;
    method: string;
    path: string;
    userAgent: string | null;
    referrer: string | null;
  };
  configInfo: {
    nodeEnv: string | null;
    cookieSecure: string | null;
    cookieDomain: string | null;
    trustProxy: string | null;
    port: number | string;
  };
}

/**
 * Fetch authentication debug information from the server
 * This helps diagnose cookie and session issues between environments
 */
export async function fetchAuthDebugInfo(): Promise<DebugAuthResponse> {
  // Debug cookies in current window
  try {
    console.log('Current document cookies:', document.cookie);
  } catch (e) {
    console.error('Error reading document cookies:', e);
  }
  
  // Check if we're in a Replit deployment
  const isReplitDeployment = window.location.hostname.includes('repl.co') || 
                             window.location.hostname.includes('replit.app');
  console.log(`Debug auth request from: ${window.location.hostname}, isDeploy: ${isReplitDeployment}`);
  
  // Make the request to the debug endpoint
  const rawResponse = await fetch('/api/debug/auth', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json'
    }
  });
  
  if (!rawResponse.ok) {
    throw new Error(`Failed to fetch auth debug info: ${rawResponse.status} ${rawResponse.statusText}`);
  }
  
  // Parse the JSON response
  const jsonResponse = await rawResponse.json();
  
  // Create a properly typed response
  const response: DebugAuthResponse = {
    hasSession: jsonResponse.hasSession,
    sessionID: jsonResponse.sessionID,
    isAuthenticated: jsonResponse.isAuthenticated,
    user: jsonResponse.user,
    requestInfo: jsonResponse.requestInfo,
    configInfo: jsonResponse.configInfo
  };
  
  // Log the results for easy debugging
  console.log('Auth debug response:', response);
  
  return response;
}

/**
 * Helper hook to get auth debug information
 * Can be used in components that need to display debug information
 */
export function useAuthDebug() {
  const fetchDebugInfo = async () => {
    try {
      return await fetchAuthDebugInfo();
    } catch (error) {
      console.error('Error fetching auth debug info:', error);
      throw error;
    }
  };
  
  return { fetchDebugInfo };
}