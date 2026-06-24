/**
 * QuickReply Component
 * 
 * Renders quick reply buttons in the chat interface.
 */

import React from 'react';
import { QuickReply as QuickReplyType } from '../../shared/types';

interface QuickReplyProps {
  replies: QuickReplyType[];
  onSelect: (reply: QuickReplyType) => void;
  className?: string;
}

export function QuickReply({ replies, onSelect, className = '' }: QuickReplyProps) {
  if (!replies.length) return null;
  
  return (
    <div className={`flex flex-wrap gap-2 my-3 ${className}`}>
      {replies.map((reply, index) => (
        <button
          key={`${reply.action}-${index}`}
          onClick={() => onSelect(reply)}
          className="
            inline-flex items-center px-3 py-1.5
            bg-primary/10 hover:bg-primary/20
            text-primary font-medium text-sm
            rounded-full transition-colors
            focus:outline-none focus:ring-2 focus:ring-primary/50
          "
        >
          {reply.emoji && (
            <span className="mr-1.5">{reply.emoji}</span>
          )}
          <span>{reply.text}</span>
        </button>
      ))}
    </div>
  );
}

export default QuickReply;