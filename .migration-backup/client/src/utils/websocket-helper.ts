/**
 * DISABLED WebSocket helper - all functionality is disabled to avoid interference with Object Storage
 * 
 * This is a stub implementation that provides the same interface but performs no operations.
 * This resolves conflicts between WebSocket and Replit Object Storage operations.
 */

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  time?: string;
  clientId?: string;
  status?: string;
}

class WebSocketHelper {
  // Singleton instance
  private static instance: WebSocketHelper | null = null;

  /**
   * Get the singleton instance of WebSocketHelper
   */
  public static getInstance(): WebSocketHelper {
    if (!WebSocketHelper.instance) {
      WebSocketHelper.instance = new WebSocketHelper();
    }
    return WebSocketHelper.instance;
  }

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    console.log('[WebSocket] WebSocket functionality is disabled to prevent conflicts with Object Storage');
  }

  /**
   * Connect to the WebSocket server - DISABLED
   * @returns Promise that resolves immediately
   */
  public connect(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Register a handler for specific message types - DISABLED
   * @param type Message type to listen for
   * @param handler Function to call when message is received
   */
  public on(type: string, handler: MessageHandler): void {
    // No-op
  }

  /**
   * Remove a handler for a specific message type - DISABLED
   * @param type Message type
   * @param handler Handler to remove
   */
  public off(type: string, handler: MessageHandler): void {
    // No-op
  }

  /**
   * Register a handler for connection events - DISABLED
   * @param handler Function to call when connected
   */
  public onConnect(handler: ConnectionHandler): void {
    // No-op
  }

  /**
   * Remove a connection handler - DISABLED
   * @param handler Handler to remove
   */
  public offConnect(handler: ConnectionHandler): void {
    // No-op
  }

  /**
   * Register a handler for disconnection events - DISABLED
   * @param handler Function to call when disconnected
   */
  public onDisconnect(handler: ConnectionHandler): void {
    // No-op
  }

  /**
   * Remove a disconnection handler - DISABLED
   * @param handler Handler to remove
   */
  public offDisconnect(handler: ConnectionHandler): void {
    // No-op
  }

  /**
   * Send a message to the server - DISABLED
   * @returns Always returns false
   */
  public send(type: string, data: any, attemptReconnect = true): boolean {
    return false;
  }

  /**
   * Send a video status update - DISABLED
   * @returns Always returns false
   */
  public sendVideoStatus(videoUrl: string, status: 'loaded' | 'playing' | 'error', errorDetails?: string): boolean {
    return false;
  }

  /**
   * Disconnect from the WebSocket server - DISABLED
   */
  public disconnect(): void {
    // No-op
  }

  /**
   * Check if connected to the WebSocket server - DISABLED
   * @returns Always returns false
   */
  public isConnected(): boolean {
    return false;
  }

  /**
   * Get the WebSocket instance - DISABLED
   * @returns Always returns null
   */
  public getSocket(): null {
    return null;
  }

  /**
   * Get the client ID assigned by the server - DISABLED
   * @returns Always returns null
   */
  public getClientId(): null {
    return null;
  }
}

// Export the singleton instance
export const websocketHelper = WebSocketHelper.getInstance();

// Export the class for advanced usage
export default WebSocketHelper;