/**
 * TypingIndicator Component
 * 
 * Displays a typing animation when someone is typing a message.
 */

import React from 'react';

interface TypingIndicatorProps {
  className?: string;
}

export function TypingIndicator({ className = '' }: TypingIndicatorProps) {
  return (
    <div className={`flex items-center space-x-2 px-4 py-2 bg-muted text-foreground rounded-lg rounded-tl-none max-w-[80%] ${className}`}>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-sm text-muted-foreground">Typing...</span>
    </div>
  );
}

export default TypingIndicator;