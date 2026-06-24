/**
 * Chat Component
 * 
 * Main chat interface component that displays messages and allows sending new ones.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useChatContext } from '../context/ChatContext';
import MessageBubble from './MessageBubble';
import QuickReply from './QuickReply';
import TypingIndicator from './TypingIndicator';

interface ChatProps {
  className?: string;
  showHeader?: boolean;
  headerTitle?: string;
  placeholder?: string;
}

export function Chat({
  className = '',
  showHeader = true,
  headerTitle = 'Chat',
  placeholder = 'Type a message...'
}: ChatProps) {
  const {
    messages,
    quickReplies,
    isLoading,
    isTyping,
    isMinimized,
    isExpanded,
    sendMessage,
    handleQuickReply,
    toggleChat,
    expandChat,
    collapseChat,
    startTyping,
    stopTyping
  } = useChatContext();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, quickReplies, isTyping]);

  // Add animated entry effect for messages
  useEffect(() => {
    if (chatMessagesRef.current) {
      const messageBubbles = chatMessagesRef.current.querySelectorAll('.message-bubble');
      
      messageBubbles.forEach((bubble, index) => {
        setTimeout(() => {
          (bubble as HTMLElement).classList.add('opacity-100');
        }, index * 150);
      });
    }
  }, [messages.length]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    expandChat();
  };

  // Handle typing events
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    // Send typing indicator when user starts typing
    if (e.target.value && !isTyping) {
      startTyping();
    } else if (!e.target.value && isTyping) {
      stopTyping();
    }
  };

  // Handle Escape key to collapse chat
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isExpanded) {
      collapseChat();
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className={`
        bg-card rounded-lg shadow-lg flex flex-col
        ${isExpanded ? 'fixed inset-0 z-50' : 'max-h-[600px] w-full'}
        ${isMinimized ? 'h-12' : 'h-[500px]'}
        transition-all duration-300 ease-in-out
        ${className}
      `}
    >
      {/* Chat header */}
      {showHeader && (
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg">{headerTitle}</h3>
          
          <div className="flex space-x-2">
            {isExpanded ? (
              <button
                onClick={collapseChat}
                className="p-1 rounded-full hover:bg-muted transition-colors"
                aria-label="Minimize"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14h6v6"></path>
                  <path d="M20 10h-6V4"></path>
                  <path d="m14 10 7-7"></path>
                  <path d="m3 21 7-7"></path>
                </svg>
              </button>
            ) : (
              <button
                onClick={expandChat}
                className="p-1 rounded-full hover:bg-muted transition-colors"
                aria-label="Expand"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6"></path>
                  <path d="M9 21H3v-6"></path>
                  <path d="m21 3-7 7"></path>
                  <path d="m3 21 7-7"></path>
                </svg>
              </button>
            )}
            
            <button
              onClick={toggleChat}
              className="p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="Toggle chat"
            >
              {isMinimized ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Collapsible content */}
      <div className={`flex-1 flex flex-col ${isMinimized ? 'hidden' : ''}`}>
        {/* Messages area */}
        <div 
          className="flex-1 overflow-y-auto p-4" 
          ref={chatMessagesRef}
        >
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              isLast={index === messages.length - 1}
              className="message-bubble opacity-0"
            />
          ))}
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0 mr-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" x2="12" y1="19" y2="22"></line>
                  </svg>
                </div>
              </div>
              <TypingIndicator />
            </div>
          )}
          
          {/* Quick replies */}
          {quickReplies.length > 0 && !isLoading && (
            <QuickReply
              replies={quickReplies}
              onSelect={handleQuickReply}
              className="mb-4"
            />
          )}
          
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input area */}
        <div className="border-t p-3">
          <form onSubmit={handleSubmit} className="flex items-center">
            <input
              type="text"
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              className="
                flex-1 border rounded-l-lg px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-primary/50
                disabled:opacity-50 disabled:bg-muted
              "
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="
                bg-primary text-white rounded-r-lg px-4 py-2
                hover:bg-primary/90 transition-colors
                disabled:opacity-50 disabled:bg-primary/50
                focus:outline-none focus:ring-2 focus:ring-primary/50
              "
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="m22 2-7 20-4-9-9-4Z"></path>
                <path d="M22 2 11 13"></path>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Chat;