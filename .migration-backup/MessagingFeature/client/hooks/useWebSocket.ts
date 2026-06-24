/**
 * WebSocket Hook
 * 
 * A React hook for managing WebSocket connections.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketMessage } from '../../shared/types';

interface UseWebSocketProps {
  sessionId: string | null;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({
  sessionId,
  onMessage,
  onConnect,
  onDisconnect,
  onError
}: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    // Create WebSocket URL based on current protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    // Create WebSocket instance
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    // Set up event handlers
    socket.addEventListener('open', () => {
      setIsConnected(true);
      
      // Send initial connection message with session ID
      socket.send(JSON.stringify({
        type: 'connect',
        sessionId,
        payload: { timestamp: new Date() }
      }));
      
      if (onConnect) onConnect();
    });

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        if (onMessage) onMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    socket.addEventListener('close', () => {
      setIsConnected(false);
      if (onDisconnect) onDisconnect();
    });

    socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      if (onError) onError(error);
    });

    // Clean up on unmount
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        // Send disconnect message
        socket.send(JSON.stringify({
          type: 'disconnect',
          sessionId,
          payload: { timestamp: new Date() }
        }));
        
        socket.close();
      }
    };
  }, [sessionId, onMessage, onConnect, onDisconnect, onError]);

  // Send message function
  const sendMessage = useCallback((type: string, payload: any) => {
    if (!sessionId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }

    try {
      socketRef.current.send(JSON.stringify({
        type,
        sessionId,
        payload,
        timestamp: new Date()
      }));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [sessionId]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean = true) => {
    return sendMessage('typing', { isTyping });
  }, [sendMessage]);

  return {
    isConnected,
    sendMessage,
    sendTyping
  };
}