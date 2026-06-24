/**
 * MessageBubble Component
 * 
 * Renders a single message bubble in the chat interface.
 */

import React from 'react';
import { Message } from '../../shared/types';

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
  className?: string;
}

export function MessageBubble({ message, isLast, className = '' }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  // Format timestamp if available
  const formattedTime = message.timestamp 
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  
  return (
    <div 
      className={`group mb-4 transition-opacity duration-300 ease-in-out ${className}`}
      data-user={isUser ? 'true' : 'false'}
    >
      <div className={`flex items-start ${isUser ? 'justify-end' : ''}`}>
        {/* Avatar for non-user messages */}
        {!isUser && (
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
        )}
        
        {/* Message content */}
        <div className={`relative max-w-[80%] ${isUser ? 'order-1' : 'order-2'}`}>
          <div 
            className={`
              px-4 py-2 rounded-lg 
              ${isUser 
                ? 'bg-primary text-white rounded-tr-none' 
                : 'bg-muted text-foreground rounded-tl-none'
              }
            `}
          >
            {message.content}
          </div>
          
          {/* Timestamp */}
          {formattedTime && (
            <div className={`
              text-xs text-muted-foreground mt-1
              ${isUser ? 'text-right' : 'text-left'}
            `}>
              {formattedTime}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;