import { useAuth } from "../components/providers/auth-provider";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { RouteComponentProps } from "wouter";
import { useFlags } from "@/hooks/use-flags";
import { FeatureFlagName, UserRole } from "@shared/schema";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
  requiredFeature?: keyof typeof FeatureFlagName;
}

export function ProtectedRoute({
  path,
  component: Component,
  requiredFeature
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const { isFeatureEnabled, isLoading: isFlagsLoading } = useFlags();
  const [featureEnabled, setFeatureEnabled] = useState<boolean>(true);
  
  // Check if the required feature is enabled for this route
  useEffect(() => {
    if (requiredFeature) {
      // For admin routes, special handling to ensure admin access works
      if (requiredFeature === "ADMIN") {
        // If the user is an admin, we always allow access to admin routes
        // This ensures admin can always access admin pages even if feature flags have issues
        if (user?.role === UserRole.ADMIN) {
          console.log("Admin user detected, enabling admin route access automatically");
          setFeatureEnabled(true);
          return;
        }
      }
      
      // Enhanced logging for debugging feature flag issues
      const featureFlagName = FeatureFlagName[requiredFeature];
      const userType = user ? user.role : 'guest';
      
      // We need to check both the direct feature and the nav version of the feature
      // If requiredFeature is "STORE", we'll check both "store" and "nav-store"
      const isEnabled = isFeatureEnabled(featureFlagName);
      console.log(`[ProtectedRoute] Access check for path=${path}, feature=${featureFlagName}, userType=${userType}, isEnabled=${isEnabled}`);
      setFeatureEnabled(isEnabled);
    }
  }, [requiredFeature, isFeatureEnabled, user?.role, path]);

  if (isLoading || isFlagsLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    // Check if the feature is enabled for guest users before redirecting
    if (requiredFeature) {
      const featureFlagName = FeatureFlagName[requiredFeature];
      const isEnabledForGuests = isFeatureEnabled(featureFlagName);
      console.log(`[ProtectedRoute] Guest access check for path=${path}, feature=${featureFlagName}: ${isEnabledForGuests}`);
      
      // If the feature is enabled for guests, allow access without authentication
      if (isEnabledForGuests) {
        console.log(`[ProtectedRoute] Allowing guest access to ${path} as ${featureFlagName} is enabled for guests`);
        // Render the component for guest users if the feature is enabled for them
        return <Route path={path}>{(params) => <Component {...params} />}</Route>;
      } else {
        console.log(`[ProtectedRoute] Denying guest access to ${path} as ${featureFlagName} is NOT enabled for guests`);
        
        // Redirect to auth only if the feature is not enabled for guests
        console.log(`[ProtectedRoute] Redirecting unauthenticated user from ${path} to /auth (feature not enabled for guests)`);
        return (
          <Route path={path}>
            <Redirect to="/auth" />
          </Route>
        );
      }
    } else {
      // If no specific feature required, redirect to auth (default protected behavior)
      console.log(`[ProtectedRoute] Redirecting unauthenticated user from ${path} to /auth (no feature requirement)`);
      return (
        <Route path={path}>
          <Redirect to="/auth" />
        </Route>
      );
    }
  }
  
  // If the route requires a specific feature and it's not enabled for the user
  if (requiredFeature && !featureEnabled) {
    return (
      <Route path={path}>
        <NotFound message="This feature is not available for your account." />
      </Route>
    );
  }

  // Render the component without passing any props
  // The Route component will automatically pass route params when used with wouter
  return <Route path={path}>{(params) => <Component {...params} />}</Route>;
}
