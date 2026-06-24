import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { Redirect } from "wouter";
import { UserRole } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  ShieldAlert, 
  UserCheck, 
  Ban, 
  AlertTriangle,
  UserX,
  Search,
  Clock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { calculateSubscriptionInfo, getSubscriptionBadgeVariant, getSubscriptionBadgeText } from "@/utils/subscription";
import { UserDetailsPanel } from "@/components/admin/user-details-panel";

export default function CommunitySettings() {
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  // Changed default tab from "pending-approvals" to "user-roles"
  const [activeTab, setActiveTab] = useState("user-roles");
  const [filters, setFilters] = useState({
    role: "all", // "all", "registered", "paid", "admin"
    badgeHolderStatus: "all", // "all", "resident", "non-resident"
    tagFilter: "",
    searchTerm: "", // Search by name or email
  });

  // Enhanced query with retry and detailed logging for robust user fetching
  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      try {
        console.log("Fetching users from /api/users");
        const response = await apiRequest("GET", "/api/users", null, {
          credentials: 'include', // Ensure cookies are sent
          headers: {
            'Cache-Control': 'no-cache, no-store', // Prevent caching
            'Pragma': 'no-cache'
          }
        });
        
        console.log("Users API response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Handle API response format: {success: true, users: [...]}
        const users = data.success && Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []);
        
        console.log("Users API response data:", {
          count: users.length,
          blockedCount: users.filter((u: any) => u.isBlocked === true).length
        });
        
        // Log detailed information about any blocked users
        const blockedUsers = users.filter((u: any) => u.isBlocked === true);
        if (blockedUsers.length > 0) {
          console.log("Blocked users found:", blockedUsers.map((u: any) => ({ 
            id: u.id, 
            username: u.username,
            blockReason: u.blockReason,
            createdAt: u.createdAt
          })));
        }
        
        return users;
      } catch (err) {
        console.error("Error fetching users:", err);
        throw err;
      }
    },
    staleTime: 15000, // Consider data fresh for 15 seconds
    refetchInterval: 30000, // Refetch every 30 seconds while page is open
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: number; newRole: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/users/${userId}/role`,
        { role: newRole }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });
  
  // State for enhanced deletion dialog
  const [deletionDialog, setDeletionDialog] = useState({
    isOpen: false,
    userId: null as number | null,
    user: null as any,
    dependencies: null as any,
    isLoadingDependencies: false
  });

  // Mutation to check user dependencies before deletion
  const checkDependenciesMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("GET", `/api/users/${userId}/dependencies`);
      if (!response.ok) {
        throw new Error('Failed to check user dependencies');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setDeletionDialog(prev => ({
        ...prev,
        dependencies: data,
        isLoadingDependencies: false
      }));
    },
    onError: (error: Error) => {
      console.error('Error checking dependencies:', error);
      setDeletionDialog(prev => ({
        ...prev,
        isLoadingDependencies: false
      }));
      toast({
        title: "Error",
        description: "Failed to check user dependencies. You can still proceed with deletion.",
        variant: "destructive",
      });
    }
  });

  // Enhanced mutation for deleting users with better progress tracking
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      console.log(`Starting comprehensive deletion for user ID: ${userId}`);
      const response = await apiRequest("DELETE", `/api/users/${userId}`, null);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Delete operation failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeletionDialog({ isOpen: false, userId: null, user: null, dependencies: null, isLoadingDependencies: false });
      
      const userName = data?.user?.fullName || data?.user?.username || "User";
      const summary = data?.deletionSummary;
      
      toast({
        title: "User Successfully Deleted",
        description: summary 
          ? `${userName} deleted. ${summary.totalRecords} records removed from ${summary.tablesAffected} tables in ${summary.duration}.`
          : `${userName} and all associated content has been permanently deleted.`,
        duration: 8000,
      });
    },
    onError: (error: any) => {
      console.error("Delete user error:", error);
      
      // Enhanced error handling with specific error types
      const handleErrorResponse = (errorData: any) => {
        if (errorData?.code === "FOREIGN_KEY_CONSTRAINT" || errorData?.code === "FOREIGN_KEY_VIOLATION") {
          toast({
            title: "Cannot Delete User",
            description: `${errorData.details || "This user has associated content that prevents deletion."}\n\nTable: ${errorData.table || 'Unknown'}\nConstraint: ${errorData.constraint || 'Unknown'}`,
            variant: "destructive",
            duration: 8000,
          });
        } else if (errorData?.code === "DB_CONNECTION_ERROR") {
          toast({
            title: "Database Connection Error",
            description: "Unable to connect to the database. Please check your connection and try again.",
            variant: "destructive",
            duration: 6000,
          });
        } else if (errorData?.code === "DB_ERROR") {
          toast({
            title: "Database Error",
            description: errorData.details || "An unexpected database error occurred during deletion.",
            variant: "destructive",
            duration: 6000,
          });
        } else if (errorData?.code === "AUTH_REQUIRED") {
          toast({
            title: "Authentication Required",
            description: "Please log in again to perform this action.",
            variant: "destructive",
          });
        } else if (errorData?.code === "ADMIN_REQUIRED") {
          toast({
            title: "Access Denied",
            description: "Only administrators can delete user accounts.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Deletion Failed",
            description: errorData?.message || "An unexpected error occurred while deleting the user.",
            variant: "destructive",
            duration: 5000,
          });
        }
      };

      // Try to parse JSON error response
      if (error?.response?.json) {
        error.response.json().then(handleErrorResponse).catch(() => {
          toast({
            title: "Error",
            description: error.message || "Failed to delete user",
            variant: "destructive",
          });
        });
      } else if (typeof error === 'string') {
        try {
          const errorData = JSON.parse(error);
          handleErrorResponse(errorData);
        } catch {
          toast({
            title: "Error",
            description: error || "Failed to delete user",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to delete user",
          variant: "destructive",
        });
      }
    },
  });
  
  // The approval functionality has been removed as it's no longer needed
  // User permissions are now controlled via roles and blocking status
  
  // Mutation for blocking/unblocking users
  const [blockingUserId, setBlockingUserId] = useState<number | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlockingDialogOpen, setIsBlockingDialogOpen] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  
  const toggleBlockUserMutation = useMutation({
    mutationFn: async ({ userId, isBlocked, reason = '' }: { userId: number; isBlocked: boolean; reason?: string }) => {
      console.log(`${isBlocked ? 'Blocking' : 'Unblocking'} user ${userId}${isBlocked ? ` with reason: ${reason}` : ''}`);
      
      const response = await apiRequest(
        "PATCH",
        `/api/users/${userId}/block`,
        { isBlocked, blockReason: reason }
      );
      
      const result = await response.json();
      console.log('User block/unblock response:', result);
      
      if (!result.success) {
        throw new Error(result.message || `Failed to ${isBlocked ? 'block' : 'unblock'} user`);
      }
      
      return result;
    },
    onSuccess: (data) => {
      console.log('User block/unblock successful:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsBlockingDialogOpen(false);
      
      toast({
        title: "Success",
        description: data.message || "User blocking status updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error('User block/unblock error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user blocking status",
        variant: "destructive",
      });
    },
  });

  // Redirect non-admin users
  if (!isAdmin) {
    return <Redirect to="/" />;
  }

  const handleRoleChange = (userId: number, newRole: string) => {
    updateRoleMutation.mutate({ userId, newRole });
  };
  
  const handleBlockUser = (userId: number) => {
    setBlockingUserId(userId);
    setBlockReason('');
    setIsBlockingDialogOpen(true);
  };
  
  const handleConfirmBlockUser = () => {
    if (blockingUserId) {
      toggleBlockUserMutation.mutate({ 
        userId: blockingUserId, 
        isBlocked: true,
        reason: blockReason 
      });
    }
  };
  
  const handleUnblockUser = (userId: number) => {
    toggleBlockUserMutation.mutate({ 
      userId, 
      isBlocked: false 
    });
  };
  
  const handleDeleteUser = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    if (!user) {
      toast({
        title: "Error",
        description: "User not found",
        variant: "destructive",
      });
      return;
    }

    // Open enhanced deletion dialog with dependency checking
    setDeletionDialog({
      isOpen: true,
      userId,
      user,
      dependencies: null,
      isLoadingDependencies: true
    });

    // Start loading dependencies
    checkDependenciesMutation.mutate(userId);
  };
  
  // Display error message if there was an error fetching users
  if (error) {
    console.error("Error in users query:", error);
  }
  
  // Filter for blocked users - ensure users is an array before filtering
  const safeUsers = Array.isArray(users) ? users : [];
  console.log("All users before filtering:", {
    success: true,
    users: safeUsers
  });
  const blockedUsers = safeUsers.filter((user: any) => user?.isBlocked === true);
  console.log("Blocked users after filtering:", blockedUsers);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Community Settings</h1>
      
      <Tabs defaultValue="user-roles" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="blocked-users" className="text-base">
            <div className="flex items-center gap-2">
              <Ban size={18} />
              <span>Blocked Users</span>
              {blockedUsers.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {blockedUsers.length}
                </Badge>
              )}
            </div>
          </TabsTrigger>
          <TabsTrigger value="user-roles" className="text-base">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} />
              <span>User Roles</span>
            </div>
          </TabsTrigger>
        </TabsList>
        

        <TabsContent value="blocked-users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Blocked Users Management</CardTitle>
                <CardDescription>
                  Manage blocked users and their access restrictions
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  console.log("Forcing fresh user data fetch");
                  refetch();
                  toast({
                    title: "Refreshing",
                    description: "Fetching latest user data"
                  });
                }}
                className="flex items-center gap-1"
                disabled={isLoading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isLoading ? "animate-spin" : ""}
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 21h5v-5" />
                </svg>
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle size={48} className="text-green-500 mb-3" />
                  <h3 className="text-xl font-medium mb-2">No Blocked Users</h3>
                  <p className="text-muted-foreground max-w-md">
                    There are currently no blocked users in the system. When users are blocked, they will appear here for management.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 relative">
                    <Label htmlFor="search-blocked-users" className="mb-2 block text-sm font-medium">Search Blocked Users</Label>
                    <div className="relative">
                      <Input
                        id="search-blocked-users"
                        type="text"
                        placeholder="Search by name or email..."
                        value={filters.searchTerm}
                        onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                        className="pl-10"
                      />
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    {(Array.isArray(blockedUsers) ? blockedUsers : []).filter((user: any) => {
                      // Apply name/email search filter
                      if (filters.searchTerm) {
                        const searchTermLower = filters.searchTerm.toLowerCase();
                        const fullName = (user.fullName || '').toLowerCase();
                        const username = (user.username || '').toLowerCase();
                        const email = (user.email || '').toLowerCase();
                        
                        if (!fullName.includes(searchTermLower) && 
                            !username.includes(searchTermLower) && 
                            !email.includes(searchTermLower)) {
                          return false;
                        }
                      }
                      return true;
                    }).map((user: any) => (
                      <div
                        key={user.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-red-200 rounded-lg gap-4 bg-red-50/30"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.username} />
                              <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -top-1 -right-1">
                              <Ban size={16} className="text-red-500" />
                            </div>
                          </div>
                          <div>
                            <h3 className="font-medium flex items-center gap-2">
                              {user.fullName}
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Blocked</Badge>
                            </h3>
                            <p className="text-sm text-muted-foreground">{user.username}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            {user.blockReason && (
                              <div className="mt-2 p-2 bg-red-100/50 border border-red-200 rounded-md">
                                <p className="text-xs font-medium text-red-700">Reason for blocking:</p>
                                <p className="text-sm text-red-800">{user.blockReason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2 self-end sm:self-center">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                            onClick={() => handleUnblockUser(user.id)}
                            disabled={toggleBlockUserMutation.isPending}
                          >
                            Unblock User
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="user-roles">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Role Management</CardTitle>
                <CardDescription>
                  Manage user roles and permissions for your community
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    console.log("Forcing fresh user data fetch");
                    refetch();
                    toast({
                      title: "Refreshing",
                      description: "Fetching latest user data"
                    });
                  }}
                  className="flex items-center gap-1"
                  disabled={isLoading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={isLoading ? "animate-spin" : ""}
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 21h5v-5" />
                  </svg>
                  Refresh
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    window.open('/api/users/export', '_blank');
                    toast({
                      title: "Exporting Users",
                      description: "Downloading user data as CSV"
                    });
                  }}
                  className="flex items-center gap-1"
                  disabled={isLoading || safeUsers.length === 0}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="mb-4 relative">
                    <Label htmlFor="search-users" className="mb-2 block text-sm font-medium">Search Users</Label>
                    <div className="relative">
                      <Input
                        id="search-users"
                        type="text"
                        placeholder="Search by name or email..."
                        value={filters.searchTerm}
                        onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                        className="pl-10"
                      />
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                    
                  <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 border rounded-lg bg-muted/20">
                    
                    <div className="flex-1">
                      <Label htmlFor="role-filter" className="mb-2 block text-sm font-medium">User Role</Label>
                      <Select 
                        value={filters.role} 
                        onValueChange={(value) => setFilters({...filters, role: value})}
                      >
                        <SelectTrigger id="role-filter">
                          <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value={UserRole.REGISTERED}>Registered</SelectItem>
                          <SelectItem value={UserRole.BADGE_HOLDER}>Badge Holder</SelectItem>
                          <SelectItem value={UserRole.PAID}>Paid</SelectItem>
                          <SelectItem value={UserRole.MODERATOR}>Moderator</SelectItem>
                          <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex-1">
                      <Label htmlFor="badge-holder-filter" className="mb-2 block text-sm font-medium">Badge Holder Status</Label>
                      <Select 
                        value={filters.badgeHolderStatus} 
                        onValueChange={(value) => setFilters({...filters, badgeHolderStatus: value})}
                      >
                        <SelectTrigger id="badge-holder-filter">
                          <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="resident">Badge Holders</SelectItem>
                          <SelectItem value="non-resident">Non-Badge Holders</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex-1">
                      <Label htmlFor="tag-filter" className="mb-2 block text-sm font-medium">Tag Filter</Label>
                      <Input
                        id="tag-filter"
                        type="text"
                        placeholder="Filter by tag"
                        value={filters.tagFilter}
                        onChange={(e) => setFilters({...filters, tagFilter: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {safeUsers.filter((user: any) => {
                      // Apply name/email search filter
                      if (filters.searchTerm) {
                        const searchTermLower = filters.searchTerm.toLowerCase();
                        const fullName = (user.fullName || '').toLowerCase();
                        const username = (user.username || '').toLowerCase();
                        const email = (user.email || '').toLowerCase();
                        
                        if (!fullName.includes(searchTermLower) && 
                            !username.includes(searchTermLower) && 
                            !email.includes(searchTermLower)) {
                          return false;
                        }
                      }
                      
                      // All users are automatically approved now
                      // No approval filter needed anymore
                      
                      // Apply role filter
                      if (filters.role !== "all" && user.role !== filters.role) return false;
                      
                      // Apply badge holder status filter
                      if (filters.badgeHolderStatus === "resident" && !user.isResident) return false;
                      if (filters.badgeHolderStatus === "non-resident" && user.isResident) return false;
                      
                      // Apply tag filter
                      if (filters.tagFilter && 
                          (!user.residentTags || 
                           !user.residentTags.some((tag: string) => 
                             tag.toLowerCase().includes(filters.tagFilter.toLowerCase())
                           ))
                      ) {
                        return false;
                      }
                      
                      return true;
                    }).map((user: any) => (
                      <div
                        key={user.id}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.username} />
                              <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{user.fullName}</h3>
                              {user.isBlocked && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Blocked</Badge>
                              )}
                              {user.isResident && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Badge Holder</Badge>
                              )}
                              {user.role === UserRole.PAID && user.subscriptionEndDate && (() => {
                                const subscriptionInfo = calculateSubscriptionInfo(
                                  user.subscriptionEndDate,
                                  user.subscriptionType,
                                  user.subscriptionStatus
                                );
                                const badgeVariant = getSubscriptionBadgeVariant(subscriptionInfo);
                                const badgeText = getSubscriptionBadgeText(subscriptionInfo);
                                
                                return (
                                  <Badge 
                                    variant={badgeVariant}
                                    className={`
                                      flex items-center gap-1 text-xs
                                      ${subscriptionInfo.isExpired 
                                        ? 'bg-red-50 text-red-700 border-red-200' 
                                        : subscriptionInfo.isExpiringSoon 
                                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                                        : 'bg-green-50 text-green-700 border-green-200'
                                      }
                                    `}
                                  >
                                    <Clock size={12} />
                                    {badgeText}
                                  </Badge>
                                );
                              })()}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.username}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            {user.residentTags && user.residentTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {user.residentTags.map((tag: string, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between sm:justify-end items-center gap-4 mt-3 sm:mt-0">
                          {user.isBlocked ? (
                            <div className="flex">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => handleUnblockUser(user.id)}
                                disabled={toggleBlockUserMutation.isPending}
                              >
                                Unblock User
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="ml-2 text-red-700 border-red-300 hover:bg-red-100"
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={deleteUserMutation.isPending}
                              >
                                Delete
                              </Button>
                            </div>
                          ) : (
                            <div className="flex">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleBlockUser(user.id)}
                                disabled={toggleBlockUserMutation.isPending}
                              >
                                Block User
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="ml-2 text-red-700 border-red-300 hover:bg-red-100"
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={deleteUserMutation.isPending}
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                          <Select
                            defaultValue={user.role}
                            onValueChange={(value) => handleRoleChange(user.id, value)}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UserRole.REGISTERED}>Registered User</SelectItem>
                              <SelectItem value={UserRole.BADGE_HOLDER}>Badge Holder</SelectItem>
                              <SelectItem value={UserRole.PAID}>Paid User</SelectItem>
                              <SelectItem value={UserRole.MODERATOR}>Moderator</SelectItem>
                              <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          </div>
                        </div>
                        <UserDetailsPanel 
                          userId={user.id}
                          isExpanded={expandedUserId === user.id}
                          onToggle={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        

      </Tabs>
    
      <Dialog open={isBlockingDialogOpen} onOpenChange={setIsBlockingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Block User</DialogTitle>
            <DialogDescription>
              Blocked users cannot create content, post comments, or interact with others. They can still browse public content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="blockReason">Reason for blocking (optional)</Label>
              <Textarea
                id="blockReason"
                placeholder="Explain why this user is being blocked..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmBlockUser}
              disabled={toggleBlockUserMutation.isPending}
            >
              {toggleBlockUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Blocking...
                </>
              ) : (
                "Block User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced User Deletion Dialog */}
      <Dialog 
        open={deletionDialog.isOpen} 
        onOpenChange={(open) => !open && setDeletionDialog({ 
          isOpen: false, 
          userId: null, 
          user: null, 
          dependencies: null, 
          isLoadingDependencies: false 
        })}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete User Account
            </DialogTitle>
            <DialogDescription>
              You are about to permanently delete the user account for{" "}
              <strong>{deletionDialog.user?.fullName || deletionDialog.user?.username}</strong>.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Dependency Analysis Section */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Search className="h-4 w-4" />
                Content Analysis
              </h4>
              
              {deletionDialog.isLoadingDependencies ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing user content and dependencies...
                </div>
              ) : deletionDialog.dependencies ? (
                <div className="space-y-3">
                  {(deletionDialog.dependencies.summary?.totalRecords || 0) > 0 ? (
                    <>
                      <div className="flex items-center gap-2 text-orange-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">
                          {deletionDialog.dependencies.summary?.totalRecords || 0} records will be deleted
                        </span>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>The following content will be permanently removed:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          {Object.entries(deletionDialog.dependencies.summary?.tables || {}).map(([table, count]) => (
                            <li key={table}>
                              {count} record{count !== 1 ? 's' : ''} from {table.replace(/_/g, ' ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>No content found - user can be safely deleted</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-yellow-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Unable to analyze dependencies. Deletion can still proceed.
                </div>
              )}
            </div>

            {/* Warning Section */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium text-red-800">Warning: This action is irreversible</p>
                  <div className="text-sm text-red-700 space-y-1">
                    <p>Deleting this user will:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Permanently remove their account and profile</li>
                      <li>Delete all forum posts, comments, and reactions</li>
                      <li>Remove event interactions and comments</li>
                      <li>Delete vendor interactions and reviews</li>
                      <li>Remove order history and payment records</li>
                      <li>Clear form submissions and analytics data</li>
                      <li>Update content references to remove ownership</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress indicator during deletion */}
            {deleteUserMutation.isPending && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  <div>
                    <p className="font-medium text-blue-800">Deleting user...</p>
                    <p className="text-sm text-blue-700">
                      Processing deletion across all database tables. This may take a few moments.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeletionDialog({ 
                isOpen: false, 
                userId: null, 
                user: null, 
                dependencies: null, 
                isLoadingDependencies: false 
              })}
              disabled={deleteUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                console.log("🔴 DELETE BUTTON CLICKED", deletionDialog.userId);
                if (deletionDialog.userId) {
                  console.log("🔴 CALLING MUTATION WITH USER ID:", deletionDialog.userId);
                  deleteUserMutation.mutate(deletionDialog.userId);
                } else {
                  console.log("🔴 NO USER ID FOUND IN deletionDialog");
                }
              }}
              disabled={deleteUserMutation.isPending || deletionDialog.isLoadingDependencies}
              className="gap-2"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting User...
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4" />
                  Delete User Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}