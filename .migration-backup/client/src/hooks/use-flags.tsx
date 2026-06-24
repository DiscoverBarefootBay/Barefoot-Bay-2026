import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { FeatureFlagName } from '@shared/schema';
import { useEffect, useState } from 'react';

type FeatureFlag = {
  id: number;
  name: string;
  displayName: string;
  enabledForRoles: string[];
  isActive: boolean;
  description?: string;
};

export function useFlags() {
  const { user, effectiveRole } = useAuth();
  const [forceProductionMode, setForceProductionMode] = useState<boolean>(false);
  
  // Check for production-like mode in localStorage on initialization
  useEffect(() => {
    try {
      const isProdMode = localStorage.getItem('force_production_mode') === 'true';
      setForceProductionMode(isProdMode);
      
      // Add visual indicator to the UI when in production parity mode
      if (isProdMode && process.env.NODE_ENV !== 'production') {
        console.log('[Feature Flags] Running in production-like mode');
        
        // Create or update the production mode indicator
        let indicator = document.getElementById('production-mode-indicator');
        if (!indicator) {
          indicator = document.createElement('div');
          indicator.id = 'production-mode-indicator';
          indicator.style.position = 'fixed';
          indicator.style.bottom = '10px';
          indicator.style.left = '10px';
          indicator.style.backgroundColor = 'rgba(255, 100, 100, 0.9)';
          indicator.style.color = 'white';
          indicator.style.padding = '5px 10px';
          indicator.style.borderRadius = '4px';
          indicator.style.fontSize = '12px';
          indicator.style.fontWeight = 'bold';
          indicator.style.zIndex = '9999';
          document.body.appendChild(indicator);
        }
        
        indicator.textContent = '⚠️ Production Parity Mode';
      }
    } catch (error) {
      console.error('Error checking production mode:', error);
    }
  }, []);

  // Fetch feature flags from the API
  const { data: flags, isLoading, isError } = useQuery({
    queryKey: ['/api/feature-flags'],
    // Always fetch flags regardless of authentication status
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Function to check if a specific feature is enabled for the current user
  const isFeatureEnabled = (featureName: string) => {
    // Check if we're in production or simulating production behavior
    const isProdEnv = process.env.NODE_ENV === 'production' || forceProductionMode;
    
    // If flags aren't loaded yet, apply environment-specific behavior
    if (isLoading) {
      console.log(`[Feature Flags] Still loading flags for ${featureName}, environment: ${isProdEnv ? 'production' : 'development'}`);
      // In production or production-like mode, default to hiding features during loading
      // In normal development, default to showing features for easier development
      return !isProdEnv;
    }
    
    // If there's an error or no data, apply environment-specific behavior
    if (isError || !flags || !Array.isArray(flags)) {
      console.error(`[Feature Flags] Error loading flags for ${featureName}, environment: ${isProdEnv ? 'production' : 'development'}`);
      // In production or production-like mode, default to hiding features when errors occur
      // In normal development, default to showing features for easier development
      return !isProdEnv;
    }

    const isAdmin = effectiveRole === 'admin';
    
    // Special case for weather_rocket_icons - always enable for admins
    if (featureName === 'weather_rocket_icons' && isAdmin) {
      console.log(`[Feature Flags] ${featureName} for admin: true (special case override)`);
      return true;
    }
    
    // Convert any underscores to hyphens for nav flags (e.g., 'for_sale' to 'for-sale')
    // This ensures DB flag names like 'nav-for-sale' will match properly
    const normalizedFeatureName = featureName.replace(/_/g, '-');
    
    // Check for both regular feature flags and navigation-specific flags
    const navFeatureName = `nav-${normalizedFeatureName}`;
    
    // First check if there's a nav-prefixed version of this flag
    // This will take precedence for navbar visibility
    const navFeature = flags.find((flag: FeatureFlag) => flag.name === navFeatureName);
    
    // Check if we should show debug UI for this feature in dev mode
    const showDebugOutline = !isProdEnv && localStorage.getItem('feature_flag_debug') === 'true';
    
    // Add debug logging with improved format
    const userRole = effectiveRole;
    const logPrefix = `[Feature Flags] [${isProdEnv ? 'PROD' : 'DEV'}]`;
    console.log(`${logPrefix} Checking flag ${featureName}`, {
      userRole,
      isAdmin,
      environment: isProdEnv ? 'production' : 'development',
      navFeature: navFeature ? {
        name: navFeature.name,
        enabledForRoles: navFeature.enabledForRoles,
        isActive: navFeature.isActive
      } : 'not found',
      navRoleCheck: navFeature ? navFeature.enabledForRoles.includes(userRole) : false
    });
    
    // Apply debug styling if enabled (development only)
    if (showDebugOutline) {
      setTimeout(() => {
        try {
          // Find elements with data attributes that match this feature
          const elements = document.querySelectorAll(`[data-feature="${featureName}"]`);
          elements.forEach(el => {
            (el as HTMLElement).style.outline = '2px dashed green';
            (el as HTMLElement).style.position = 'relative';
            
            // Add label if it doesn't exist
            if (!el.querySelector('.feature-flag-label')) {
              const label = document.createElement('div');
              label.className = 'feature-flag-label';
              label.style.position = 'absolute';
              label.style.top = '0';
              label.style.right = '0';
              label.style.backgroundColor = 'rgba(0,100,0,0.8)';
              label.style.color = 'white';
              label.style.padding = '2px 5px';
              label.style.fontSize = '10px';
              label.style.borderRadius = '0 0 0 4px';
              label.style.zIndex = '1000';
              label.textContent = featureName;
              el.appendChild(label);
            }
          });
        } catch (e) {
          // Silent catch - don't break functionality for debug features
        }
      }, 100);
    }
    
    // If there's a nav-specific flag, use that for controlling nav visibility
    if (navFeature) {
      // If the feature is completely inactive, nobody should see it
      if (!navFeature.isActive) {
        console.log(`${logPrefix} ${navFeatureName} is inactive`);
        return false;
      }
      
      // For unauthenticated users, check if guest role is enabled
      if (!user) {
        const isEnabled = navFeature.enabledForRoles.includes('guest');
        console.log(`${logPrefix} ${navFeatureName} for guest: ${isEnabled ? 'VISIBLE' : 'HIDDEN'}`);
        return isEnabled;
      }
      
      // For navigation items, ALL users including admins should respect the enabledForRoles settings
      // This is critical for the "Navigation Items" admin panel to work correctly
      const isEnabled = navFeature.enabledForRoles.includes(effectiveRole);
      console.log(`${logPrefix} ${navFeatureName} for ${effectiveRole}: ${isEnabled ? 'VISIBLE' : 'HIDDEN'}`);
      
      // Important: Special override for admins in dev mode only (to help debugging)
      // This lets admins see hidden nav items in development with a special style
      if (!isEnabled && isAdmin && !isProdEnv && localStorage.getItem('show_all_features_for_admin') === 'true') {
        console.log(`${logPrefix} DEV MODE OVERRIDE: Showing disabled navigation ${navFeatureName} for admin`);
        
        // Apply special styling to show this is disabled but visible for debugging
        setTimeout(() => {
          try {
            const navElements = document.querySelectorAll(`[data-nav-feature="${navFeatureName}"]`);
            navElements.forEach(el => {
              (el as HTMLElement).style.opacity = '0.5';
              (el as HTMLElement).style.position = 'relative';
              
              // Add indicator
              if (!el.querySelector('.feature-flag-disabled-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'feature-flag-disabled-indicator';
                indicator.style.position = 'absolute';
                indicator.style.top = '0';
                indicator.style.left = '0';
                indicator.style.backgroundColor = 'rgba(200,0,0,0.8)';
                indicator.style.color = 'white';
                indicator.style.padding = '2px 5px';
                indicator.style.fontSize = '10px';
                indicator.style.borderRadius = '0 0 4px 0';
                indicator.style.zIndex = '1000';
                indicator.textContent = 'DISABLED';
                el.appendChild(indicator);
              }
            });
          } catch (e) {
            // Silent catch - don't break functionality for debug features
          }
        }, 100);
        
        return true; // Show for admin in dev mode
      }
      
      return isEnabled;
    }
    
    // Fallback to regular feature flag if no nav-specific one exists
    const feature = flags.find((flag: FeatureFlag) => flag.name === featureName);
    
    if (!feature || !feature.isActive) {
      console.log(`${logPrefix} ${featureName} is not found or inactive`);
      return false;
    }
    
    // For unauthenticated users, check if guest role is enabled
    if (!user) {
      const isEnabled = feature.enabledForRoles.includes('guest');
      console.log(`${logPrefix} ${featureName} for guest: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
      return isEnabled;
    }
    
    // For regular feature flags (not navigation-specific)
    // Handle admin access differently based on environment 
    if (isAdmin) {
      // In production or parity mode: Override only applies if specifically configured
      if (isProdEnv) {
        // Check if this feature has admin override enabled even in production
        const hasAdminOverride = feature.description?.includes('admin-override') || false;
        console.log(`${logPrefix} ${featureName} for admin in production: ${hasAdminOverride ? 'ENABLED (has override)' : 'checking roles...'}`);
        
        if (hasAdminOverride) {
          return true;
        }
        
        // If no admin override in production, check roles like normal users
        const isEnabledForAdmin = feature.enabledForRoles.includes('admin');
        console.log(`${logPrefix} ${featureName} for admin based on roles: ${isEnabledForAdmin ? 'ENABLED' : 'DISABLED'}`);
        return isEnabledForAdmin;
      } else {
        // In development: Always enable features for admins (default behavior)
        console.log(`${logPrefix} ${featureName} for admin in development: ENABLED (admin override)`);
        return true;
      }
    }
    
    // For non-admin users, check if their role is in the enabled roles list
    const isEnabled = feature.enabledForRoles.includes(effectiveRole);
    console.log(`${logPrefix} ${featureName} for ${effectiveRole}: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
    return isEnabled;
  };

  // Convenience methods for each feature
  const isCalendarEnabled = () => isFeatureEnabled(FeatureFlagName.CALENDAR);
  const isForumEnabled = () => isFeatureEnabled(FeatureFlagName.FORUM);
  const isForSaleEnabled = () => isFeatureEnabled(FeatureFlagName.FOR_SALE);
  const isStoreEnabled = () => isFeatureEnabled(FeatureFlagName.STORE);
  const isVendorsEnabled = () => isFeatureEnabled(FeatureFlagName.VENDORS);
  const isCommunityEnabled = () => isFeatureEnabled(FeatureFlagName.COMMUNITY);
  const isAdminEnabled = () => isFeatureEnabled(FeatureFlagName.ADMIN);
  const isMessagesEnabled = () => isFeatureEnabled(FeatureFlagName.MESSAGES);

  // Return the loading state, all flags, and convenient helpers
  return {
    isLoading,
    isError,
    flags,
    isFeatureEnabled,
    isCalendarEnabled,
    isForumEnabled,
    isForSaleEnabled,
    isStoreEnabled,
    isVendorsEnabled,
    isCommunityEnabled,
    isAdminEnabled,
    isMessagesEnabled,
  };
}