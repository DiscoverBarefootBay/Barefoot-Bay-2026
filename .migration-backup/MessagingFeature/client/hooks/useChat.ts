/**
 * Chat Hook
 * 
 * A React hook for managing chat state and interactions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Message, QuickReply, WebSocketMessage } from '../../shared/types';
import { useWebSocket } from './useWebSocket';

interface ChatConfig {
  apiBasePath?: string;
  initialMessages?: Message[];
  initialQuickReplies?: QuickReply[];
  enableWebSocket?: boolean;
  defaultGreeting?: string;
}

export function useChat({
  apiBasePath = '/api/chat',
  initialMessages = [],
  initialQuickReplies = [],
  enableWebSocket = true,
  defaultGreeting = "👋 Hi there! How can I help you today?"
}: ChatConfig = {}) {
  // Chat state
  const [messages, setMessages] = useState<Message[]>(initialMessages.length > 0 
    ? initialMessages 
    : [{ role: "assistant", content: defaultGreeting }]
  );
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(initialQuickReplies);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Initialize chat session
  const initSession = useCallback(async () => {
    try {
      const response = await fetch(`${apiBasePath}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize chat session: ${response.status}`);
      }
      
      const data = await response.json();
      setSessionId(data.sessionId);
      return data.sessionId;
    } catch (error) {
      console.error("Error initializing chat session:", error);
      return null;
    }
  }, [apiBasePath]);
  
  // Initialize session on component mount
  useEffect(() => {
    if (!sessionId) {
      initSession();
    }
  }, [sessionId, initSession]);

  // WebSocket integration for real-time messaging
  const handleSocketMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'message' && message.payload) {
      setMessages(prev => [...prev, message.payload as Message]);
    } else if (message.type === 'typing') {
      setIsTyping(message.payload?.isTyping || false);
    }
  }, []);

  const { isConnected, sendMessage: sendWsMessage, sendTyping } = useWebSocket({
    sessionId,
    onMessage: enableWebSocket ? handleSocketMessage : undefined
  });

  // Send a message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !sessionId) return;
    
    // Optimistically add user message to UI
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // If using WebSockets, send through that channel
    if (enableWebSocket && isConnected) {
      sendWsMessage('message', userMessage);
      
      // For WebSocket mode, we don't need the fetch call below
      // but we still wait briefly to simulate a response
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
      
      return;
    }
    
    // Otherwise send via REST API
    try {
      const response = await fetch(`${apiBasePath}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          role: 'user',
          content,
          timestamp: new Date()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }
      
      // Here you might want to handle the bot's response
      // Simulating a bot response after a short delay
      setTimeout(() => {
        // This is where you would integrate with an actual bot or AI service
        const botResponse: Message = {
          role: 'assistant',
          content: `I received your message: "${content}". This is a placeholder response.`,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, botResponse]);
        setIsLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Add error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error sending your message. Please try again later.'
      }]);
      
      setIsLoading(false);
    }
  }, [sessionId, enableWebSocket, isConnected, sendWsMessage, apiBasePath]);

  // Handle quick replies
  const handleQuickReply = useCallback((reply: QuickReply) => {
    // Send the quick reply text as a user message
    sendMessage(reply.text);
    
    // You can also perform a specific action based on the action field
    // For example, navigate to a different page or open a modal
    console.log(`Quick reply action: ${reply.action}`);
  }, [sendMessage]);

  // Chat UI state management functions
  const toggleChat = useCallback(() => {
    setIsMinimized(prev => !prev);
  }, []);

  const openChat = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const openMobileChat = useCallback(() => {
    setIsMobileChatOpen(true);
  }, []);

  const closeMobileChat = useCallback(() => {
    setIsMobileChatOpen(false);
  }, []);

  const expandChat = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const collapseChat = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Set typing indicator
  const startTyping = useCallback(() => {
    if (enableWebSocket && isConnected) {
      sendTyping(true);
    }
  }, [enableWebSocket, isConnected, sendTyping]);

  const stopTyping = useCallback(() => {
    if (enableWebSocket && isConnected) {
      sendTyping(false);
    }
  }, [enableWebSocket, isConnected, sendTyping]);

  return {
    // State
    messages,
    quickReplies,
    isLoading,
    isTyping,
    isMinimized,
    isExpanded,
    isMobileChatOpen,
    sessionId,
    isConnected: enableWebSocket ? isConnected : null,
    
    // Actions
    sendMessage,
    handleQuickReply,
    toggleChat,
    openChat,
    openMobileChat,
    closeMobileChat,
    expandChat,
    collapseChat,
    toggleExpanded,
    startTyping,
    stopTyping,
    
    // Utils
    setQuickReplies
  };
}