import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeMediaUrl } from "@/lib/object-storage-helper";

interface UserAvatarProps {
  user: {
    username: string;
    avatarUrl?: string | null;
    isResident?: boolean;
    role?: string;
    hasMembershipBadge?: boolean;
    subscriptionStatus?: string;
    subscriptionStartDate?: string | Date;
    subscriptionEndDate?: string | Date;
    createdAt?: string | Date;
    // Add other badge-related properties here
  };
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  inComments?: boolean; // Special flag for comments section
  inNavbar?: boolean; // Special flag for navbar display
  inMobileMenu?: boolean; // Special flag for mobile menu display with more spacing
  className?: string; // Additional CSS classes
  unreadMessages?: number; // Number of unread messages (for notification indicators)
}

export function UserAvatar({ 
  user, 
  size = "md", 
  showBadge = true,
  inComments = false,
  inNavbar = false,
  inMobileMenu = false,
  className = "",
  unreadMessages = 0
}: UserAvatarProps) {

  // Check if user is a 2025 founder (registration year is 2025 AND had paid subscription in 2025)
  const isFounder = user && user.createdAt && (() => {
    const accountCreatedIn2025 = new Date(user.createdAt).getFullYear() === 2025;
    
    // Check if they have/had a paid subscription during 2025
    const hasPaidSubscriptionIn2025 = (() => {
      // Check if they have a paid role
      if (user.role === "paid" || user.role === "admin") return true;
      
      // Check if they have an active subscription
      if (user.subscriptionStatus === "active") return true;
      
      // Check if their subscription started in 2025
      if (user.subscriptionStartDate) {
        const subscriptionStartYear = new Date(user.subscriptionStartDate).getFullYear();
        if (subscriptionStartYear === 2025) return true;
      }
      
      return false;
    })();
    
    return accountCreatedIn2025 && hasPaidSubscriptionIn2025;
  })();
  
  // Badge visibility conditions with null checks
  const shouldShowResidentBadge = showBadge && user && user.isResident === true;
  const shouldShowMembershipBadge = showBadge && user && (
    user.role === "paid" || 
    user.subscriptionStatus === "active"
  );
  const shouldShowAdminBadge = showBadge && user && user.role === "admin";
  const shouldShowFounderBadge = showBadge && isFounder;
  
  // Size mappings for avatar
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12"
  };
  
  // Badge size adjustments - using pixels for more consistent positioning
  const badgeSizeClasses = {
    sm: "h-4 w-4 text-[8px]",
    md: "h-5 w-5 text-[9px]",
    lg: "h-6 w-6 text-[10px]"
  };
  
  // Badge sizes for comments - larger to ensure visibility
  const commentsBadgeSizeClasses = {
    sm: "h-4 w-4 text-[8px]",
    md: "h-4 w-4 text-[8px]",
    lg: "h-5 w-5 text-[9px]"
  };

  // Badge position styles based on size and context
  // Multiple badges need different positions
  const badgePositionStyles = {
    // Resident badge (bottom right)
    resident: {
      default: {
        sm: { bottom: '0', right: '0', transform: 'translate(25%, 25%)' },
        md: { bottom: '0', right: '0', transform: 'translate(25%, 25%)' },
        lg: { bottom: '0', right: '0', transform: 'translate(25%, 25%)' }
      },
      comments: {
        sm: { bottom: '0', right: '0', transform: 'translate(25%, 25%)' },
        md: { bottom: '0', right: '0', transform: 'translate(25%, 25%)' },
        lg: { bottom: '0', right: '0', transform: 'translate(25%, 25%)' }
      },
      navbar: {
        sm: { bottom: '0', right: '0', transform: 'translate(30%, 30%)' },
        md: { bottom: '0', right: '0', transform: 'translate(30%, 30%)' },
        lg: { bottom: '0', right: '0', transform: 'translate(30%, 30%)' }
      },
      mobileMenu: {
        sm: { bottom: '-8px', right: '-8px' },
        md: { bottom: '-10px', right: '-10px' },
        lg: { bottom: '-12px', right: '-12px' }
      }
    },
    // Membership badge (top right)
    membership: {
      default: {
        sm: { top: '0', right: '0', transform: 'translate(25%, -25%)' },
        md: { top: '0', right: '0', transform: 'translate(25%, -25%)' },
        lg: { top: '0', right: '0', transform: 'translate(25%, -25%)' }
      },
      comments: {
        sm: { top: '0', right: '0', transform: 'translate(25%, -25%)' },
        md: { top: '0', right: '0', transform: 'translate(25%, -25%)' },
        lg: { top: '0', right: '0', transform: 'translate(25%, -25%)' }
      },
      navbar: {
        sm: { top: '0', right: '0', transform: 'translate(30%, -30%)' },
        md: { top: '0', right: '0', transform: 'translate(30%, -30%)' },
        lg: { top: '0', right: '0', transform: 'translate(30%, -30%)' }
      },
      mobileMenu: {
        sm: { top: '-8px', right: '-8px' },
        md: { top: '-10px', right: '-10px' },
        lg: { top: '-12px', right: '-12px' }
      }
    },
    // Admin badge (bottom left)
    admin: {
      default: {
        sm: { bottom: '0', left: '0', transform: 'translate(-25%, 25%)' },
        md: { bottom: '0', left: '0', transform: 'translate(-25%, 25%)' },
        lg: { bottom: '0', left: '0', transform: 'translate(-25%, 25%)' }
      },
      comments: {
        sm: { bottom: '0', left: '0', transform: 'translate(-25%, 25%)' },
        md: { bottom: '0', left: '0', transform: 'translate(-25%, 25%)' },
        lg: { bottom: '0', left: '0', transform: 'translate(-25%, 25%)' }
      },
      navbar: {
        sm: { bottom: '0', left: '0', transform: 'translate(-30%, 30%)' },
        md: { bottom: '0', left: '0', transform: 'translate(-30%, 30%)' },
        lg: { bottom: '0', left: '0', transform: 'translate(-30%, 30%)' }
      },
      mobileMenu: {
        sm: { bottom: '-8px', left: '-8px' },
        md: { bottom: '-10px', left: '-10px' },
        lg: { bottom: '-12px', left: '-12px' }
      }
    },
    // Founder badge (top left)
    founder: {
      default: {
        sm: { top: '0', left: '0', transform: 'translate(-25%, -25%)' },
        md: { top: '0', left: '0', transform: 'translate(-25%, -25%)' },
        lg: { top: '0', left: '0', transform: 'translate(-25%, -25%)' }
      },
      comments: {
        sm: { top: '0', left: '0', transform: 'translate(-25%, -25%)' },
        md: { top: '0', left: '0', transform: 'translate(-25%, -25%)' },
        lg: { top: '0', left: '0', transform: 'translate(-25%, -25%)' }
      },
      navbar: {
        sm: { top: '0', left: '0', transform: 'translate(-30%, -30%)' },
        md: { top: '0', left: '0', transform: 'translate(-30%, -30%)' },
        lg: { top: '0', left: '0', transform: 'translate(-30%, -30%)' }
      },
      mobileMenu: {
        sm: { top: '-8px', left: '-8px' },
        md: { top: '-10px', left: '-10px' },
        lg: { top: '-12px', left: '-12px' }
      }
    }
  };

  // Get the proper size classes
  const avatarSizeClass = sizeClasses[size];
  const badgeSizeClass = inComments ? commentsBadgeSizeClasses[size] : badgeSizeClasses[size];
  
  // Determine badge positions based on context
  const getPositionForBadgeType = (badgeType: 'resident' | 'membership' | 'admin' | 'founder') => {
    if (inComments) {
      return badgePositionStyles[badgeType].comments[size];
    } else if (inMobileMenu) {
      return badgePositionStyles[badgeType].mobileMenu[size];
    } else if (inNavbar) {
      return badgePositionStyles[badgeType].navbar[size];
    } else {
      return badgePositionStyles[badgeType].default[size];
    }
  };
  
  // Common badge style base
  const baseBadgeClass = `absolute ${badgeSizeClass} rounded-full 
    font-bold ${inComments ? 'border-[3px]' : 'border-2'} border-white flex items-center justify-center z-10 
    ${inComments ? 'shadow-md' : 'shadow-sm'} transition-all duration-200 hover:scale-110 hover:brightness-110 
    backdrop-blur-sm cursor-help`;
  
  // Define unread message notification styles
  const hasUnreadMessages = unreadMessages > 0;
  
  // Create pulsing red border animation for unread messages - much more prominent now
  const unreadBorderClass = hasUnreadMessages 
    ? "before:absolute before:inset-[-3px] before:rounded-full before:border-[3px] before:border-red-600 before:animate-pulse before:z-10 before:shadow-[0_0_10px_4px_rgba(239,68,68,0.9)]" 
    : "";
  
  return (
    <div className={`relative inline-block ${className} ${unreadBorderClass}`}>
      <Avatar className={avatarSizeClass}>
        <AvatarImage 
          src={user?.avatarUrl ? normalizeMediaUrl(user.avatarUrl) : undefined} 
          alt={user?.username || "User"}
          className="object-cover"
        />
        <AvatarFallback>
          {user?.username?.[0]?.toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>
      
      {/* Removed the unread messages badge number from avatar, keeping only the pulsing border */}
      
      {/* Resident badge - bottom right */}
      {shouldShowResidentBadge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={`${baseBadgeClass} bg-gradient-to-br from-teal-400 to-blue-700 text-white drop-shadow-md`}
                style={getPositionForBadgeType('resident')}
              >
                🌴
              </div>
            </TooltipTrigger>
            <TooltipContent className="w-auto max-w-xs p-0 bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="p-3">
                <div className="text-center mb-2">
                  <div className="text-3xl mb-1">🌴</div>
                  <h3 className="font-bold text-base">Barefoot Bay Resident</h3>
                </div>
                <div className="text-sm text-gray-700 pt-1 border-t">
                  <p>Verified resident of Barefoot Bay community.</p>
                  <p className="mt-1 text-xs text-blue-600">Access to resident-only amenities and events.</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {/* Membership badge (diamond) - top right */}
      {shouldShowMembershipBadge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={`${baseBadgeClass} bg-gradient-to-br from-yellow-300 to-amber-500 text-white drop-shadow-md`}
                style={getPositionForBadgeType('membership')}
              >
                💎
              </div>
            </TooltipTrigger>
            <TooltipContent className="w-auto max-w-xs p-0 bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="p-3">
                <div className="text-center mb-2">
                  <div className="text-3xl mb-1">💎</div>
                  <h3 className="font-bold text-base">Paid Membership</h3>
                </div>
                <div className="text-sm text-gray-700 pt-1 border-t">
                  <p>Verified premium member with active subscription.</p>
                  <p className="mt-1 text-xs text-amber-600">Benefits include premium content and exclusive features.</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {/* Admin badge (shield) - bottom left */}
      {shouldShowAdminBadge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={`${baseBadgeClass} bg-gradient-to-br from-blue-700 to-blue-900 text-white drop-shadow-md`}
                style={getPositionForBadgeType('admin')}
              >
                🛡️
              </div>
            </TooltipTrigger>
            <TooltipContent className="w-auto max-w-xs p-0 bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="p-3">
                <div className="text-center mb-2">
                  <div className="text-3xl mb-1">🛡️</div>
                  <h3 className="font-bold text-base">Administrator</h3>
                </div>
                <div className="text-sm text-gray-700 pt-1 border-t">
                  <p>Community administrator with moderation rights.</p>
                  <p className="mt-1 text-xs text-blue-600">Maintains community standards and provides assistance.</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {/* Founder badge (medal) - top left */}
      {shouldShowFounderBadge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={`${baseBadgeClass} bg-gradient-to-br from-yellow-500 to-yellow-700 text-white drop-shadow-md`}
                style={getPositionForBadgeType('founder')}
              >
                🎖️
              </div>
            </TooltipTrigger>
            <TooltipContent className="w-auto max-w-xs p-0 bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="p-3">
                <div className="text-center mb-2">
                  <div className="text-3xl mb-1">🎖️</div>
                  <h3 className="font-bold text-base">Founder Member</h3>
                </div>
                <div className="text-sm text-gray-700 pt-1 border-t">
                  <p>Original founding member from 2025 with paid membership.</p>
                  <p className="mt-1 text-xs text-amber-600">Early supporter who helped establish our community.</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}