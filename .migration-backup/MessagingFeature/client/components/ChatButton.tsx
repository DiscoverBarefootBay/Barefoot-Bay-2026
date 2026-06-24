/**
 * ChatButton Component
 * 
 * A floating action button for toggling the chat interface.
 */

import React from 'react';
import { useChatContext } from '../context/ChatContext';

interface ChatButtonProps {
  icon?: React.ReactNode;
  label?: string;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export function ChatButton({
  icon,
  label = 'Chat',
  className = '',
  position = 'bottom-right'
}: ChatButtonProps) {
  const { toggleChat, isMinimized, openMobileChat } = useChatContext();
  
  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };
  
  // Handle click based on screen size
  const handleClick = () => {
    // For mobile devices, open the mobile chat
    if (window.innerWidth < 768) {
      openMobileChat();
    } else {
      // For desktop, toggle the chat panel
      toggleChat();
    }
  };
  
  // Default chat icon
  const defaultIcon = (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className="mr-2 h-5 w-5"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
  
  return (
    <button
      onClick={handleClick}
      className={`
        fixed ${positionClasses[position]} z-40
        flex items-center justify-center
        px-4 py-3 rounded-full
        bg-primary text-white
        shadow-lg hover:shadow-xl
        transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-primary/50
        ${className}
      `}
      aria-label={label}
    >
      {icon || defaultIcon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

export default ChatButton;