/**
 * DISABLED WebSocket client utility for Barefoot Bay application
 * 
 * This is a stub implementation that provides the same interface but does nothing.
 * WebSocket functionality has been completely disabled to prevent conflicts with Object Storage.
 */

type MessageHandler = (data: any) => void;

/**
 * Initialize WebSocket connection - DISABLED
 */
export function initSocket() {
  console.log('[WebSocket] WebSocket functionality is disabled to prevent conflicts with Object Storage');
  return;
}

/**
 * Send a message through the WebSocket - DISABLED
 * @param type Message type
 * @param data Message data
 * @returns Always returns false
 */
export function sendMessage(type: string, data: any): boolean {
  return false;
}

/**
 * Register a handler for specific message types - DISABLED
 * @param type Message type to listen for, or 'all' for all messages
 * @param handler Function to call when message is received
 */
export function onMessage(type: string, handler: MessageHandler): void {
  // No-op
}

/**
 * Remove a message handler - DISABLED
 * @param type Message type the handler was registered for
 * @param handler Function to remove
 */
export function offMessage(type: string, handler: MessageHandler): void {
  // No-op
}

/**
 * Check if WebSocket is currently connected - DISABLED
 * @returns Always returns false
 */
export function isConnected(): boolean {
  return false;
}

/**
 * Manually close the WebSocket connection - DISABLED
 */
export function closeConnection(): void {
  // No-op
}

// No auto-connect - WebSockets are disabled