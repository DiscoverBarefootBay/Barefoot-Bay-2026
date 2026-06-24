import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser, UserRole } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { migrateLegacyCartData } from "../../lib/cart-utils";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  updateProfileMutation: UseMutationResult<SelectUser, Error, Partial<SelectUser>>;
  viewAsRole: string | null;
  setViewAsRole: (role: string | null) => void;
  effectiveRole: string;
  actualRole: string;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

// Helper function to update username meta tag
const updateUsernameMetaTag = (username: string | null) => {
  // Remove existing username meta tag if it exists
  const existingMeta = document.querySelector('meta[name="username"]');
  if (existingMeta) {
    existingMeta.remove();
  }
  
  // Add new meta tag if username is provided
  if (username) {
    const meta = document.createElement('meta');
    meta.name = 'username';
    meta.content = username;
    document.head.appendChild(meta);
  }
};

const VIEW_AS_STORAGE_KEY = 'barefootbay-view-as-role';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000, // 5 minutes - keep auth data fresh longer
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnReconnect: true, // Refetch when network reconnects
    retry: (failureCount: number, error: any) => {
      // Don't retry on 401 errors (user not authenticated)
      if (error?.status === 401) return false;
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Keep previous data during refetch to prevent UI flash
    placeholderData: (previousData) => previousData
  });

  const [viewAsRole, setViewAsRoleState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(VIEW_AS_STORAGE_KEY);
    }
    return null;
  });

  const actualRole = user?.role || UserRole.GUEST;
  const isActualAdmin = user?.role === UserRole.ADMIN;
  const effectiveRole = isActualAdmin && viewAsRole ? viewAsRole : actualRole;

  const setViewAsRole = (role: string | null) => {
    if (!isActualAdmin && role !== null) {
      console.warn('Only admins can use the View As feature');
      return;
    }
    
    setViewAsRoleState(role);
    if (typeof window !== 'undefined') {
      if (role) {
        sessionStorage.setItem(VIEW_AS_STORAGE_KEY, role);
      } else {
        sessionStorage.removeItem(VIEW_AS_STORAGE_KEY);
      }
    }
  };

  useEffect(() => {
    if (!isActualAdmin && viewAsRole) {
      setViewAsRole(null);
    }
  }, [isActualAdmin, viewAsRole]);

  // Use useEffect to handle meta tag updates when user data changes
  useEffect(() => {
    updateUsernameMetaTag(user?.username || null);
  }, [user]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      
      // Migrate any legacy cart data to user-specific cart
      if (user?.id) {
        migrateLegacyCartData(user.id);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<SelectUser>) => {
      console.log("Debug: Starting profile update mutation with data:", data);

      const res = await apiRequest("PATCH", "/api/user", data);
      const responseText = await res.text();
      console.log("Debug: Raw API response:", responseText);

      try {
        return JSON.parse(responseText);
      } catch (error) {
        console.error("Debug: Error parsing response:", error);
        throw new Error("Invalid server response");
      }
    },
    onSuccess: (user: SelectUser) => {
      console.log("Debug: Profile update successful, updating cache with:", user);

      // Update the cached user data
      queryClient.setQueryData(["/api/user"], user);

      // Show success message
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      // Force a refetch to ensure we have the latest state
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      console.error("Debug: Profile update mutation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      
      setViewAsRole(null);
      
      // Clear all cart data from localStorage when user logs out
      if (typeof window !== 'undefined') {
        // Clear all cart-related localStorage items
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('barefootbay-cart-')) {
            localStorage.removeItem(key);
          }
        });
        // Also clear the old global cart key if it exists
        localStorage.removeItem('barefootbay-cart');
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create the value object to provide to context
  const value = {
    user: user ?? null,
    isLoading,
    error,
    loginMutation,
    logoutMutation,
    registerMutation,
    updateProfileMutation,
    viewAsRole,
    setViewAsRole,
    effectiveRole,
    actualRole,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}