import { UserRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useFlags } from "@/hooks/use-flags";

export function usePermissions() {
  const { user, effectiveRole } = useAuth();
  const { isFeatureEnabled } = useFlags();
  
  // Define permission roles based on our expanded role system
  // Use effectiveRole for permission checks to support "View As" feature
  const isAdmin = effectiveRole === UserRole.ADMIN;
  const isModerator = effectiveRole === UserRole.MODERATOR || isAdmin;
  const isPaidUser = effectiveRole === UserRole.PAID || isModerator;
  const isBadgeHolder = effectiveRole === UserRole.BADGE_HOLDER || isPaidUser;
  const isRegistered = effectiveRole === UserRole.REGISTERED || isBadgeHolder;
  const isGuest = !user || effectiveRole === UserRole.GUEST;
  
  // SIMPLIFIED PERMISSION SYSTEM: Only check if the user is blocked
  // isApproved has been completely removed from the system
  const isBlocked = user?.isBlocked === true;
  
  // An admin or moderator automatically has permission and can't be blocked
  // For all others, they just need to not be blocked
  const hasPermission = isModerator || !isBlocked;
  
  // Debug the user role and block status
  if (user) {
    console.log("DEBUG usePermissions - Effective role:", effectiveRole, "isAdmin:", isAdmin, 
                "isBlocked:", isBlocked, "hasPermission:", hasPermission);
  }
  
  // Get permissions from feature flags - only need to check role and block status
  const canComment = isFeatureEnabled("comments") && hasPermission;
  const canReact = isFeatureEnabled("reactions") && hasPermission;
  const canPostCalendarEvent = isFeatureEnabled("calendar_post") && hasPermission;
  const canPostForumTopic = isFeatureEnabled("forum_post") && hasPermission;
  const canPostForSaleListing = isFeatureEnabled("for_sale_post") && hasPermission;
  const canCreateVendorPage = isFeatureEnabled("vendor_page") && hasPermission;
  const canAccessAdmin = isFeatureEnabled("admin_access") && hasPermission;
  const canAccessAdminForum = isFeatureEnabled("admin_forum") && hasPermission;
  const canCreateFeaturedContent = isFeatureEnabled("featured_content") && hasPermission;
  const canUseMessages = isFeatureEnabled("messages") && hasPermission;

  
  // Special handling for navigation icons (weather, rocket, live chat)
  // Guests should never see them, admins should always see them
  // For other roles, respect the feature flag
  const canSeeWeatherRocketIcons = !isGuest && (isAdmin || (isFeatureEnabled("weather_rocket_icons") && hasPermission));
  
  // Function to check feature permissions with role and block status
  const checkFeaturePermission = (featureName: string) => {
    return isFeatureEnabled(featureName) && hasPermission;
  };
  
  return {
    // CONTENT CREATION PERMISSIONS - NOW LINKED TO FEATURE FLAGS
    
    // Calendar permissions
    canCreateEvent: canPostCalendarEvent,
    canInteractWithEvent: canReact,
    canCommentOnEvent: canComment,
    
    // For sale permissions
    canCreateListing: canPostForSaleListing,
    
    // Forum permissions
    canCreateTopic: canPostForumTopic,
    canCommentOnTopic: canComment,
    canReactToPost: canReact,
    
    // Category-specific forum permissions
    canCreateTopicInCategory: (categoryId: number) => {
      if (!canPostForumTopic) return false;
      // Admins can create topics in any category
      if (isAdmin) return true;
      // Non-admins can only create topics in General Discussion (ID: 7)
      return categoryId === 7;
    },
    
    // Vendor permissions
    canCreateVendorPage: canCreateVendorPage,
    
    // MODERATION PERMISSIONS
    
    // Moderator+ can block users and delete inappropriate content
    canBlockUsers: isModerator,
    canDeleteContent: isModerator,
    
    // ADMIN PRIVILEGES
    
    // Only admins with admin_access permission can manage users/site settings
    canManageUsers: canAccessAdmin,
    canAccessAnalytics: canAccessAdmin,
    canBulkUpload: canAccessAdmin,
    canApproveUsers: canAccessAdmin,
    canManageSiteSettings: canAccessAdmin,
    
    // Status flags for role checks
    isAdmin,
    isModerator,
    isPaidUser,
    isBadgeHolder,
    isRegistered,
    isGuest,
    
    // Account status flags
    isBlocked,
    hasPermission, // The standard way to check permissions
    
    // Feature flags for permissions
    canComment,
    canReact,
    canPostCalendarEvent,
    canPostForumTopic,
    canPostForSaleListing,
    canAccessAdmin,
    canAccessAdminForum,
    canCreateFeaturedContent,
    canSeeWeatherRocketIcons,
    canUseMessages,
    
    // Feature permission checker function
    checkFeaturePermission,
  };
}
