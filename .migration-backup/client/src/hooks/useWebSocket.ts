import { useState, useEffect, useCallback } from 'react';

type WebSocketStatus = 'connecting' | 'open' | 'closing' | 'closed' | 'error';

interface UseWebSocketProps {
  url: string;
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  autoConnect?: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectInterval = 5000,
  reconnectAttempts = 5,
  autoConnect = true
}: UseWebSocketProps) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const [reconnectCount, setReconnectCount] = useState(0);

  // Send message function
  const sendMessage = useCallback((data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      socket.send(message);
      return true;
    }
    return false;
  }, [socket]);

  // Connect function to initialize WebSocket
  const connect = useCallback(() => {
    if (socket !== null) {
      socket.close();
    }
    
    try {
      const newSocket = new WebSocket(url);
      setStatus('connecting');
      
      newSocket.onopen = () => {
        setStatus('open');
        setReconnectCount(0);
        if (onOpen) onOpen();
      };
      
      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          if (onMessage) onMessage(event.data);
        }
      };
      
      newSocket.onclose = () => {
        setStatus('closed');
        if (onClose) onClose();
        
        // Attempt to reconnect if not at max attempts
        if (reconnectCount < reconnectAttempts) {
          setTimeout(() => {
            setReconnectCount(prev => prev + 1);
            connect();
          }, reconnectInterval);
        }
      };
      
      newSocket.onerror = (error) => {
        setStatus('error');
        if (onError) onError(error);
        newSocket.close();
      };
      
      setSocket(newSocket);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setStatus('error');
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnectInterval, reconnectAttempts, reconnectCount, socket]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (socket) {
      setStatus('closing');
      socket.close();
      setSocket(null);
    }
  }, [socket]);

  // Initialize WebSocket on mount if autoConnect is true
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [autoConnect, connect, socket]);

  return {
    socket,
    status,
    connect,
    disconnect,
    sendMessage,
    reconnectCount
  };
}