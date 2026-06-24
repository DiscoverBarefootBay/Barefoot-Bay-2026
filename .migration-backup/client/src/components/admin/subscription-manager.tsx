import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Clock, CreditCard, User, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { calculateSubscriptionInfo, getSubscriptionBadgeVariant, getSubscriptionBadgeText } from '@/utils/subscription';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: string;
  subscriptionId?: string;
  subscriptionType?: 'monthly' | 'annual';
  subscriptionStatus?: 'active' | 'cancelled' | 'past_due' | 'expired';
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  squareCustomerId?: string;
}

export function SubscriptionManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users with subscriptions
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['/api/users/subscriptions'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      const data = await response.json();
      
      // Handle API response structure
      const allUsers = data.success ? data.users : data;
      
      // Filter for users with subscription data (regardless of role)
      return allUsers.filter((user: User) => 
        (user.subscriptionEndDate || user.subscriptionId)
      );
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Filter users based on search and status
  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = !searchTerm || 
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    
    const subscriptionInfo = calculateSubscriptionInfo(
      user.subscriptionEndDate,
      user.subscriptionType,
      user.subscriptionStatus
    );

    switch (statusFilter) {
      case 'active':
        return !subscriptionInfo.isExpired && user.subscriptionStatus === 'active';
      case 'expiring':
        return subscriptionInfo.isExpiringSoon && !subscriptionInfo.isExpired;
      case 'expired':
        return subscriptionInfo.isExpired || user.subscriptionStatus === 'expired';
      default:
        return true;
    }
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, subscriptionData }: { userId: number; subscriptionData: any }) => {
      const response = await apiRequest('PATCH', `/api/users/${userId}/subscription`, subscriptionData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Subscription updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subscription',
        variant: 'destructive',
      });
    },
  });

  const handleEditSubscription = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleUpdateSubscription = (formData: FormData) => {
    if (!selectedUser) return;

    const subscriptionData = {
      subscriptionType: formData.get('subscriptionType'),
      subscriptionStatus: formData.get('subscriptionStatus'),
      subscriptionEndDate: formData.get('subscriptionEndDate'),
    };

    updateSubscriptionMutation.mutate({
      userId: selectedUser.id,
      subscriptionData,
    });
  };

  // Calculate subscription statistics
  const stats = {
    total: users.length,
    active: users.filter(user => {
      const info = calculateSubscriptionInfo(user.subscriptionEndDate, user.subscriptionType, user.subscriptionStatus);
      return !info.isExpired && user.subscriptionStatus === 'active';
    }).length,
    expiring: users.filter(user => {
      const info = calculateSubscriptionInfo(user.subscriptionEndDate, user.subscriptionType, user.subscriptionStatus);
      return info.isExpiringSoon && !info.isExpired;
    }).length,
    expired: users.filter(user => {
      const info = calculateSubscriptionInfo(user.subscriptionEndDate, user.subscriptionType, user.subscriptionStatus);
      return info.isExpired || user.subscriptionStatus === 'expired';
    }).length,
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Error loading subscription data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Subscriptions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <CreditCard className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold text-orange-600">{stats.expiring}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Active Subscriptions</CardTitle>
          <CardDescription>
            Manage user subscriptions and view subscription details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, username, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="w-full sm:w-48">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No subscriptions found</h3>
              <p className="text-muted-foreground max-w-md">
                {searchTerm || statusFilter !== 'all'
                  ? 'No subscriptions match your current filters. Try adjusting your search or filter criteria.'
                  : 'No active subscriptions found. Users with paid memberships will appear here.'}
              </p>
            </div>
          )}

          {/* Subscription List */}
          {!isLoading && filteredUsers.length > 0 && (
            <div className="space-y-4">
              {filteredUsers.map((user) => {
                const subscriptionInfo = calculateSubscriptionInfo(
                  user.subscriptionEndDate,
                  user.subscriptionType,
                  user.subscriptionStatus
                );
                const badgeVariant = getSubscriptionBadgeVariant(subscriptionInfo);
                const badgeText = getSubscriptionBadgeText(subscriptionInfo);

                return (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatarUrl ?? undefined} alt={user.username} />
                        <AvatarFallback>{user.fullName?.[0]?.toUpperCase() || user.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{user.fullName}</h3>
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
                        </div>
                        <p className="text-sm text-muted-foreground">{user.username} • {user.email}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <CreditCard size={12} />
                            {user.subscriptionType === 'monthly' ? 'Monthly' : 'Annual'} Plan
                          </span>
                          {user.subscriptionEndDate && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              Expires: {new Date(user.subscriptionEndDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSubscription(user)}
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Subscription Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              Update subscription details for {selectedUser?.fullName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleUpdateSubscription(formData);
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subscriptionType">Subscription Type</Label>
                <Select name="subscriptionType" defaultValue={selectedUser.subscriptionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subscription type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly ($5/month)</SelectItem>
                    <SelectItem value="annual">Annual ($50/year)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subscriptionStatus">Status</Label>
                <Select name="subscriptionStatus" defaultValue={selectedUser.subscriptionStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subscriptionEndDate">End Date</Label>
                <Input
                  name="subscriptionEndDate"
                  type="date"
                  defaultValue={selectedUser.subscriptionEndDate ? 
                    new Date(selectedUser.subscriptionEndDate).toISOString().split('T')[0] : ''}
                />
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateSubscriptionMutation.isPending}
                >
                  {updateSubscriptionMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Update Subscription
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}