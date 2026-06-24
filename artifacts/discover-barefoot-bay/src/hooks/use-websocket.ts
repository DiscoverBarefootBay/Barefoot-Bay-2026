import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketOptions {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
}

/**
 * Custom hook for WebSocket management with built-in reconnection
 * automatically connects to the correct WebSocket URL based on the environment
 */
export const useWebSocketConnection = (options: WebSocketOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>();
  const attemptRef = useRef(0);
  
  // Default options
  const reconnectAttempts = options.reconnectAttempts || 5;
  const reconnectInterval = options.reconnectInterval || 3000;
  
  // Generate correct WebSocket URL based on current window location
  const getWebSocketUrl = useCallback(() => {
    // Only in browser context
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/ws`;
    }
    return null;
  }, []);
  
  // Function to connect to WebSocket server
  const connect = useCallback(() => {
    try {
      const wsUrl = getWebSocketUrl();
      
      if (!wsUrl) {
        setError(new Error('Cannot determine WebSocket URL'));
        return;
      }
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      
      // Close existing connection if any
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      // Create new WebSocket connection
      const socket = new WebSocket(wsUrl);
      
      // Configure event handlers
      socket.onopen = (event) => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        attemptRef.current = 0;
        setError(null);
        if (options.onOpen) options.onOpen(event);
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
        setIsConnected(false);
        if (options.onClose) options.onClose(event);
        
        // Try to reconnect unless the close was intentional (code 1000)
        if (event.code !== 1000 && attemptRef.current < reconnectAttempts) {
          attemptRef.current += 1;
          console.log(`Attempting to reconnect (${attemptRef.current}/${reconnectAttempts})...`);
          
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (attemptRef.current >= reconnectAttempts) {
          setError(new Error('Maximum reconnection attempts reached'));
          console.warn('Maximum reconnection attempts reached');
        }
      };
      
      socket.onerror = (event) => {
        console.error('WebSocket error:', event);
        if (options.onError) options.onError(event);
        setError(new Error('WebSocket connection error'));
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (options.onMessage) options.onMessage(event);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
      
      // Store socket reference
      socketRef.current = socket;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('Error creating WebSocket connection:', err);
    }
  }, [getWebSocketUrl, options, reconnectAttempts, reconnectInterval]);
  
  // Function to send data through the socket
  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      socketRef.current.send(message);
      return true;
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
      return false;
    }
  }, []);
  
  // Function to explicitly disconnect
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close(1000, 'Closed by client');
      socketRef.current = null;
    }
    
    // Clear any pending reconnects
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    setIsConnected(false);
  }, []);
  
  // Connect on hook mount
  useEffect(() => {
    // Don't attempt to connect on the server
    if (typeof window !== 'undefined') {
      connect();
    }
    
    // Clean up on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    isConnected,
    lastMessage,
    error,
    sendMessage,
    connect,
    disconnect
  };
};