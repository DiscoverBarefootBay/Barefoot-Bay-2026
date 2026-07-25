import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, X } from "lucide-react";
import { Link } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";
import { useNavigationTooltip } from '@/contexts/navigation-tooltip-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const LIVE_CHAT_POST_ID = 267; // Specific forum post ID for live chat

export function LiveChatBubble() {
  const { user } = useAuth();
  const { canSeeWeatherRocketIcons } = usePermissions();
  const { activeTooltip, toggleTooltip } = useNavigationTooltip();
  const [isGlitching, setIsGlitching] = useState(false);
  const [showMarkReadX, setShowMarkReadX] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const queryClient = useQueryClient();
  
  // Fetch unread comments count for the specific post
  const { data: unreadData } = useQuery({
    queryKey: [`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`],
    enabled: !!user,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
    onError: (error: any) => {
      console.error('Error fetching unread comments count:', error);
    }
  });

  const unreadCount = unreadData?.unreadCount || 0;

  // Mutation to mark all comments as read for this specific post
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/forum/posts/${LIVE_CHAT_POST_ID}/mark-all-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark live chat comments as read');
      }
      
      return response.json();
    },
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: [`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`] });
      
      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData([`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`]);
      
      // Optimistically update the cache
      queryClient.setQueryData([`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`], { unreadCount: 0 });
      
      // Reset the X mode state immediately
      setShowMarkReadX(false);
      
      return { previousData };
    },
    onSuccess: (data) => {
      console.log('Successfully marked all live chat comments as read:', data);
      // Invalidate queries to refresh with latest server data
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`] });
    },
    onError: (error, variables, context) => {
      console.error('Error marking all live chat comments as read:', error);
      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData([`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`], context.previousData);
      }
      // Reset the X mode state on error too
      setShowMarkReadX(false);
    }
  });

  // Handle click to trigger glitch effect or show tooltip for disabled state
  const handleClick = () => {
    if (isDisabled) {
      toggleTooltip('chat');
    } else {
      setIsGlitching(true);
      // Reset the glitch after animation completes
      setTimeout(() => setIsGlitching(false), 300); // Adjust timing to match animation duration
    }
  };

  // Handle X button click
  const handleMarkAllReadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    markAllReadMutation.mutate();
  };

  // Handle mobile badge click (for mobile direct click to mark all read)
  const handleBadgeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // On mobile, clicking the badge directly marks all as read
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      markAllReadMutation.mutate();
    }
  };

  // Handle hover for desktop
  const handleMouseEnter = () => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile && unreadCount > 0) {
      setIsHovered(true);
      setShowMarkReadX(true);
    }
  };

  const handleMouseLeave = () => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      setIsHovered(false);
      setShowMarkReadX(false);
    }
  };

  // Show as faded with tooltip when user doesn't have permission or is not logged in
  const isDisabled = !user || !canSeeWeatherRocketIcons;

  const chatContent = (
    <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 hover:bg-gray-100/20 rounded-full transition-colors">
      {/* Custom chat icon with animated typing dots */}
      <div className="relative w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8">
        {/* Chat bubble outline with glitch effect on click */}
        <svg 
          className={`w-full h-full fill-transparent ${isGlitching ? 'animate-chat-glitch' : ''}`}
          style={{ stroke: '#00cc00', strokeWidth: '1.5' }}
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        
        {/* Animated typing dots - positioned slightly above center */}
        <div className="absolute flex items-center justify-center space-x-0.5" 
             style={{ 
               top: '43%',
               left: '50%', 
               transform: 'translate(-50%, -50%)', 
               zIndex: 10 
             }}>
          <div className="w-0.5 h-0.5 rounded-full animate-typing-pulse-1" style={{ backgroundColor: '#00cc00' }}></div>
          <div className="w-0.5 h-0.5 rounded-full animate-typing-pulse-2" style={{ backgroundColor: '#00cc00' }}></div>
          <div className="w-0.5 h-0.5 rounded-full animate-typing-pulse-3" style={{ backgroundColor: '#00cc00' }}></div>
        </div>
      </div>
      
      {/* Badge indicator for unread comments - positioned relative to the chat container */}
      {unreadCount > 0 && !isDisabled && (
        <div 
          className="absolute -top-1 -right-1 z-20"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleBadgeClick}
        >
          {showMarkReadX ? (
            <button 
              onClick={handleMarkAllReadClick}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 transition-colors"
              aria-label="Mark all live chat comments as read"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <div className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return isDisabled ? (
    <TooltipProvider>
      <Tooltip open={activeTooltip === 'chat'} onOpenChange={(open) => open ? toggleTooltip('chat') : toggleTooltip(null)} delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            className={`touch-manipulation ${
              isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
            onClick={handleClick}
            onTouchEnd={handleClick}
            disabled={isDisabled}
            aria-label="Live Chat - Registration Required"
          >
            {chatContent}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="p-3 text-center">
            <p className="font-bold text-lg mb-2">💬 Live Chat</p>
            <p className="text-red-500 font-semibold mb-2">For Registered Users Only</p>
            <p className="text-sm text-gray-600 mb-2">
              Join community discussions in real-time
            </p>
            <a 
              href="/auth?tab=register" 
              className="text-xs text-blue-600 font-medium hover:underline cursor-pointer"
            >
              Sign up today to unlock this feature!
            </a>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <Link href={`/forum/post/${LIVE_CHAT_POST_ID}`}>
      <button
        className="cursor-pointer"
        onClick={handleClick}
        aria-label="Open Live Chat"
      >
        {chatContent}
      </button>
    </Link>
  );
}