import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface ForumBadgeProps {
  inMobileMenu?: boolean;
}

export function ForumBadge({ inMobileMenu = false }: ForumBadgeProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showX, setShowX] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // Using Tailwind's md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Fetch total unread forum content count across all categories
  const { data: unreadData } = useQuery({
    queryKey: [`/api/forum/unread-count`],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds (less frequent than chat)
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
  });

  const unreadCount = (unreadData as { unreadCount?: number })?.unreadCount || 0;

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isMarking) return;
    
    try {
      setIsMarking(true);
      
      // Immediately hide the badge for instant feedback
      setShowX(false);
      
      // Immediately update the query cache to show 0 unread
      queryClient.setQueryData(["/api/forum/unread-count"], { unreadCount: 0 });
      
      const response = await fetch("/api/forum/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        // Invalidate and refetch forum-related queries in the background
        queryClient.invalidateQueries({ queryKey: ["/api/forum/unread-count"] });
        queryClient.invalidateQueries({ queryKey: ["forum"] });
      } else {
        console.error("Failed to mark forum content as read");
        // Revert the optimistic update on error
        queryClient.invalidateQueries({ queryKey: ["/api/forum/unread-count"] });
      }
    } catch (error) {
      console.error("Error marking forum content as read:", error);
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/forum/unread-count"] });
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

  const baseClasses = "bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 cursor-pointer transition-colors";
  const positionClasses = inMobileMenu ? "" : "absolute -top-1 -right-1";

  if (showX && !isMobile) {
    return (
      <div 
        className={`${baseClasses} ${positionClasses}`}
        onClick={handleMarkAllRead}
        onMouseLeave={handleMouseLeave}
        title="Mark all forum content as read"
      >
        {isMarking ? (
          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <X size={12} />
        )}
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} ${positionClasses}`}
      onClick={handleClick}
      title={isMobile ? "Mark all forum content as read" : "Click to mark all forum content as read"}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </div>
  );
}