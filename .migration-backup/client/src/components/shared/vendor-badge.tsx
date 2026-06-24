import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface VendorBadgeProps {
  inMobileMenu?: boolean;
}

export function VendorBadge({ inMobileMenu = false }: VendorBadgeProps) {
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
  
  // Fetch unvisited vendor pages count
  const { data: unvisitedVendorsData } = useQuery<{ unvisitedSlugs: string[] }>({
    queryKey: ['/api/vendors/unvisited'],
    queryFn: async () => {
      console.log("🏬 [VENDOR BADGE] Making API call to /api/vendors/unvisited");
      const response = await fetch("/api/vendors/unvisited", {
        credentials: "include",
      });
      if (!response.ok) {
        console.error("🏬 [VENDOR BADGE] API call failed:", response.status, response.statusText);
        throw new Error("Failed to fetch unvisited vendors");
      }
      const result = await response.json();
      console.log("🏬 [VENDOR BADGE] API response:", result);
      return result;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
  });

  const newVendorPagesCount = unvisitedVendorsData?.unvisitedSlugs?.length || 0;

  const handleMarkAllSeen = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isMarking) return;
    
    try {
      setIsMarking(true);
      
      // Immediately hide the badge for instant feedback
      setShowX(false);
      
      // Immediately update the query cache to show 0 unvisited vendors
      queryClient.setQueryData(['/api/vendors/unvisited'], { unvisitedSlugs: [] });
      
      const response = await fetch("/api/vendors/visit", {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        // Invalidate and refetch vendor-related queries in the background
        queryClient.invalidateQueries({ queryKey: ['/api/vendors/unvisited'] });
        queryClient.invalidateQueries({ queryKey: ["vendors"] });
      } else {
        console.error("Failed to mark vendor pages as seen");
        // Revert the optimistic update on error
        queryClient.invalidateQueries({ queryKey: ['/api/vendors/unvisited'] });
      }
    } catch (error) {
      console.error("Error marking vendor pages as seen:", error);
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['/api/vendors/unvisited'] });
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

  // Don't show if user is not logged in or no unvisited vendors
  if (!user || newVendorPagesCount === 0) {
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
        title="Mark all vendors as visited"
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
      title={isMobile ? `${newVendorPagesCount} unvisited vendor${newVendorPagesCount === 1 ? '' : 's'}` : `${newVendorPagesCount} unvisited vendor${newVendorPagesCount === 1 ? '' : 's'} - Click to mark all as visited`}
    >
      {newVendorPagesCount > 99 ? '99+' : newVendorPagesCount}
    </div>
  );
}