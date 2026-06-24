/**
 * Deployment-specific WebSocket configuration for Barefoot Bay
 * This file is used only when the app is deployed, not in development mode
 */

// This utility provides functions to help with WebSocket connections in the Replit deployment environment

/**
 * Generates the correct WebSocket URL for the deployment environment
 * Handles special Replit domain formats correctly
 */
export function getDeploymentWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  
  // Standard WebSocket URL
  const standardUrl = `${protocol}//${host}/ws`;
  
  // Check if we're in a Replit environment by looking for typical Replit domain patterns
  const isReplitDomain = host.includes('.repl.co') || 
                        host.includes('.replit.app') || 
                        host.includes('.replit.dev');
  
  // For Replit deployments, use a different URL format if needed
  if (isReplitDomain) {
    console.log(`Detected Replit deployment domain: ${host}`);
    
    // If needed, additional logic can be added here for specific Replit domain handling
    // For now, we'll use the standard URL format since Replit forwards WebSocket traffic correctly
  }
  
  console.log(`Using WebSocket URL: ${standardUrl}`);
  return standardUrl;
}

/**
 * Determines if we need to use custom WebSocket connection handling
 * based on the deployment environment
 */
export function isInDeploymentEnvironment(): boolean {
  // Check if we're in production mode
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Check if we're on a Replit domain
  const host = window.location.host;
  const isReplitDomain = host.includes('.repl.co') || 
                        host.includes('.replit.app') || 
                        host.includes('.replit.dev');
  
  return isProduction && isReplitDomain;
}

/**
 * Creates a WebSocket instance with the appropriate configuration for the deployment environment
 */
export function createDeploymentWebSocket(): WebSocket {
  const wsUrl = getDeploymentWebSocketUrl();
  return new WebSocket(wsUrl);
}