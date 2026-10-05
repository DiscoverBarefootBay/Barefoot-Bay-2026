import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface StoreBadgeProps {
  inMobileMenu?: boolean;
}

export function StoreBadge({ inMobileMenu = false }: StoreBadgeProps) {
  const { user } = useAuth();
  const newProductsKey = ["/api/products/new-products-count", user?.id ?? null] as const;
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
  
  // Fetch new store products count since last visit
  const { data: newProductsData } = useQuery({
    queryKey: newProductsKey,
    queryFn: async () => {
      console.log("🏪 [STORE BADGE] Making API call to /api/products/new-products-count");
      const response = await fetch("/api/products/new-products-count", {
        credentials: "include",
      });
      if (!response.ok) {
        console.error("🏪 [STORE BADGE] API call failed:", response.status, response.statusText);
        throw new Error("Failed to fetch new products count");
      }
      const result = await response.json();
      console.log("🏪 [STORE BADGE] API response:", result);
      return result;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
  });

  const newProductsCount = newProductsData?.count || 0;

  const handleMarkAllSeen = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isMarking) return;
    
    try {
      setIsMarking(true);
      
      // Immediately hide the badge for instant feedback
      setShowX(false);
      
      // Immediately update the query cache to show 0 new products
      queryClient.setQueryData(newProductsKey, { count: 0 });
      
      const response = await fetch("/api/products/visit", {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        // Invalidate and refetch product-related queries in the background
        queryClient.invalidateQueries({ queryKey: ["/api/products/new-products-count"] });
        queryClient.invalidateQueries({ queryKey: ["products"] });
      } else {
        console.error("Failed to mark store products as seen");
        // Revert the optimistic update on error
        queryClient.invalidateQueries({ queryKey: ["/api/products/new-products-count"] });
      }
    } catch (error) {
      console.error("Error marking store products as seen:", error);
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/products/new-products-count"] });
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

  // Don't show if user is not logged in or no new products
  if (!user || newProductsCount === 0) {
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
        title="Mark all store products as seen"
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
      title={isMobile ? "Mark all store products as seen" : "Click to mark all store products as seen"}
    >
      {newProductsCount > 99 ? '99+' : newProductsCount}
    </div>
  );
}