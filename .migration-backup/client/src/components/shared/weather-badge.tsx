import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

export function WeatherBadge() {
  const { user } = useAuth();
  const [showX, setShowX] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // Using Tailwind's md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Fetch unread count specifically for Weather Updates forum (category 4)
  const { data: unreadData } = useQuery({
    queryKey: [`/api/forum/categories/4/unread-count`],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2
  });

  const unreadCount = (unreadData as any)?.unreadCount || 0;

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isMarking) return;
    
    try {
      setIsMarking(true);
      
      // Immediately hide the badge for instant feedback
      setShowX(false);
      
      // Immediately update the query cache to show 0 unread
      queryClient.setQueryData([`/api/forum/categories/4/unread-count`], { unreadCount: 0 });
      
      const response = await fetch("/api/forum/categories/4/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        // Invalidate and refetch weather-related queries in the background
        queryClient.invalidateQueries({ queryKey: [`/api/forum/categories/4/unread-count`] });
        queryClient.invalidateQueries({ queryKey: ["forum"] });
      } else {
        console.error("Failed to mark weather updates as read");
        // Revert the optimistic update on error
        queryClient.invalidateQueries({ queryKey: [`/api/forum/categories/4/unread-count`] });
      }
    } catch (error) {
      console.error("Error marking weather updates as read:", error);
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: [`/api/forum/categories/4/unread-count`] });
    } finally {
      setIsMarking(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isMobile) {
      // On mobile, directly mark as read
      handleMarkAllRead(e);
    } else {
      // On desktop, show X on click
      e.preventDefault();
      e.stopPropagation();
      setShowX(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setShowX(false);
    }
  };

  // Don't show if user is not logged in or no unread items
  if (!user || unreadCount === 0) {
    return null;
  }

  if (showX && !isMobile) {
    return (
      <div 
        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 cursor-pointer transition-colors"
        onClick={handleMarkAllRead}
        onMouseLeave={handleMouseLeave}
        title="Mark all weather updates as read"
      >
        <X size={12} />
      </div>
    );
  }

  return (
    <div 
      className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 cursor-pointer transition-colors"
      onClick={handleClick}
      onMouseLeave={handleMouseLeave}
      title={isMobile ? "Mark all weather updates as read" : "Click to mark all weather updates as read"}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </div>
  );
}