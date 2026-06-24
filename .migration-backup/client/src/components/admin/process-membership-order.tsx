import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function ProcessMembershipOrder() {
  const [orderId, setOrderId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const queryClient = useQueryClient();
  
  // Fetch membership orders
  const { data: membershipOrders, isLoading } = useQuery({
    queryKey: ['/api/orders/memberships'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/orders', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching orders: ${response.status}`);
        }
        
        const data = await response.json();
        // In a real implementation, we would filter for membership products here
        // For demonstration, we'll show recent orders
        return data?.orders || [];
      } catch (error) {
        console.error('Error fetching membership orders:', error);
        return [];
      }
    },
    // Only fetch on component mount
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  
  // Fetch pending approval users
  const { data: pendingUsers } = useQuery({
    queryKey: ['/api/users/pending'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/users', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching users: ${response.status}`);
        }
        
        const data = await response.json();
        // Filter for unapproved users who might have purchased memberships
        // Filter users who need subscription status updates
        return data?.filter(user => 
          (user.role === 'badge_holder' && !user.subscriptionStatus)) || [];
      } catch (error) {
        console.error('Error fetching pending approval users:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  
  const processMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest(`/api/admin/membership-processing/${orderId}`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Order processed successfully',
          description: data.message || 'User role has been upgraded to paid status',
          variant: 'default',
        });
        
        // Invalidate relevant queries to refresh the data
        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        queryClient.invalidateQueries({ queryKey: ['/api/users/pending'] });
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/orders/memberships'] });
        
        // Clear the order ID input
        setOrderId('');
      } else {
        toast({
          title: 'Processing failed',
          description: data.message || 'Failed to process the membership order',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error processing order',
        description: error.message || 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  });
  
  const handleProcessOrder = () => {
    if (!orderId || orderId.trim() === '') {
      toast({
        title: 'Invalid order ID',
        description: 'Please enter a valid Square order ID',
        variant: 'destructive',
      });
      return;
    }
    
    processMutation.mutate(orderId.trim());
  };
  
  // Filter pending users based on search input
  const filteredUsers = pendingUsers?.filter(user => 
    username ? user.username.toLowerCase().includes(username.toLowerCase()) : true
  ) || [];
  
  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Process Membership Order</CardTitle>
          <CardDescription>
            Manually process a completed membership order to upgrade a user's role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                id="orderId"
                placeholder="Enter Square Order ID (e.g. order_XXX...)"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                type="text"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleProcessOrder}
            disabled={processMutation.isPending}
          >
            {processMutation.isPending ? 'Processing...' : 'Process Order'}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Users with pending membership status */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Users Needing Membership Activation</CardTitle>
          <CardDescription>
            These users may have purchased a membership but haven't been automatically upgraded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                id="username"
                placeholder="Search by username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                type="text"
              />
            </div>
            
            <div className="border rounded-md">
              <div className="divide-y">
                {filteredUsers?.length > 0 ? (
                  filteredUsers.map(user => (
                    <div key={user.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-muted-foreground">{user.fullName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {/* Badge for role status */}
                          <Badge variant={user.role === "paid" ? "default" : "outline"}>
                            {user.role}
                          </Badge>
                        </div>
                      </div>
                      {user.role !== "paid" && (
                        <div className="text-sm text-muted-foreground flex items-center">
                          <span>Enter this user's order ID above to upgrade to paid</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    {isLoading ? "Loading users..." : "No users need membership activation"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}