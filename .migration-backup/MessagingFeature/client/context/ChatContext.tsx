/**
 * Chat Context
 * 
 * React context for providing chat state to components.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useChat } from '../hooks/useChat';
import { Message, QuickReply } from '../../shared/types';

interface ChatContextValue {
  // Chat state
  messages: Message[];
  quickReplies: QuickReply[];
  isLoading: boolean;
  isTyping: boolean;
  isMinimized: boolean;
  isExpanded: boolean;
  isMobileChatOpen: boolean;
  sessionId: string | null;
  isConnected: boolean | null;
  
  // Chat actions
  sendMessage: (content: string) => void;
  handleQuickReply: (reply: QuickReply) => void;
  toggleChat: () => void;
  openChat: () => void;
  openMobileChat: () => void;
  closeMobileChat: () => void;
  expandChat: () => void;
  collapseChat: () => void;
  toggleExpanded: () => void;
  startTyping: () => void;
  stopTyping: () => void;
  
  // Utils
  setQuickReplies: (replies: QuickReply[]) => void;
}

interface ChatProviderProps {
  children: ReactNode;
  config?: {
    apiBasePath?: string;
    initialMessages?: Message[];
    initialQuickReplies?: QuickReply[];
    enableWebSocket?: boolean;
    defaultGreeting?: string;
  };
}

// Create context with a default undefined value
const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// Provider component
export function ChatProvider({ children, config }: ChatProviderProps) {
  const chat = useChat(config);
  
  return (
    <ChatContext.Provider value={chat}>
      {children}
    </ChatContext.Provider>
  );
}

// Context hook for consuming components
export function useChatContext() {
  const context = useContext(ChatContext);
  
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  
  return context;
}

// Named exports
export { ChatContext };