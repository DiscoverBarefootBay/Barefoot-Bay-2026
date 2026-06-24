/**
 * MobileChat Component
 * 
 * A full-screen chat interface for mobile devices.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useChatContext } from '../context/ChatContext';
import MessageBubble from './MessageBubble';
import QuickReply from './QuickReply';
import TypingIndicator from './TypingIndicator';

interface MobileChatProps {
  headerTitle?: string;
  placeholder?: string;
}

export function MobileChat({
  headerTitle = 'Chat',
  placeholder = 'Type a message...'
}: MobileChatProps) {
  const {
    messages,
    quickReplies,
    isLoading,
    isTyping,
    isMobileChatOpen,
    sendMessage,
    handleQuickReply,
    closeMobileChat,
    startTyping,
    stopTyping
  } = useChatContext();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

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

  // Don't render if chat is not open
  if (!isMobileChatOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={closeMobileChat}
      ></div>
      
      {/* Chat interface */}
      <div className="fixed inset-0 z-50 sm:max-w-md sm:right-0 sm:left-auto bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg">{headerTitle}</h3>
          
          <button
            onClick={closeMobileChat}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>
        
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
              value={input}
              onChange={handleInputChange}
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
    </>
  );
}

export default MobileChat;