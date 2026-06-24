import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface ForSaleBadgeProps {
  inMobileMenu?: boolean;
}

export function ForSaleBadge({ inMobileMenu = false }: ForSaleBadgeProps) {
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
  
  // Fetch new real estate listings count since last visit
  const { data: newListingsData } = useQuery({
    queryKey: [`/api/real-estate/new-listings-count`],
    queryFn: async () => {
      console.log("🏠 [FOR SALE BADGE] Making API call to /api/real-estate/new-listings-count");
      const response = await fetch("/api/real-estate/new-listings-count", {
        credentials: "include",
      });
      if (!response.ok) {
        console.error("🏠 [FOR SALE BADGE] API call failed:", response.status, response.statusText);
        throw new Error("Failed to fetch new listings count");
      }
      const result = await response.json();
      console.log("🏠 [FOR SALE BADGE] API response:", result);
      return result;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
  });

  const newListingsCount = newListingsData?.count || 0;

  const handleMarkAllSeen = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isMarking) return;
    
    try {
      setIsMarking(true);
      const response = await fetch("/api/real-estate/visit", {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        // Invalidate and refetch real estate-related queries
        await queryClient.invalidateQueries({ queryKey: ["/api/real-estate/new-listings-count"] });
        await queryClient.invalidateQueries({ queryKey: ["real-estate"] });
        setShowX(false);
      } else {
        console.error("Failed to mark real estate listings as seen");
      }
    } catch (error) {
      console.error("Error marking real estate listings as seen:", error);
    } finally {
      setIsMarking(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isMobile) {
      // On mobile, directly mark as seen
      handleMarkAllSeen(e);
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

  // Don't show if user is not logged in or no new listings
  if (!user || newListingsCount === 0) {
    return null;
  }

  const baseClasses = "bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 cursor-pointer transition-colors";
  const positionClasses = inMobileMenu ? "" : "absolute -top-1 -right-1";

  if (showX && !isMobile) {
    return (
      <div 
        className={`${baseClasses} ${positionClasses}`}
        onClick={handleMarkAllSeen}
        onMouseLeave={handleMouseLeave}
        title="Mark all real estate listings as seen"
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
      title={isMobile ? "Mark all real estate listings as seen" : "Click to mark all real estate listings as seen"}
    >
      {newListingsCount > 99 ? '99+' : newListingsCount}
    </div>
  );
}