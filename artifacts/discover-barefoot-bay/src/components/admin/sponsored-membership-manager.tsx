import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Search, Plus, AlertTriangle, XCircle, CheckCircle, CreditCard, ExternalLink } from 'lucide-react';

// Types for subscription data
type UserSubscription = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  subscriptionId: string;
  subscriptionType: string;
  subscriptionStatus: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  squareCustomerId?: string;
};

type PaymentTransaction = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  description?: string;
};

export function SponsoredMembershipManager() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [subscribedUsers, setSubscribedUsers] = useState<UserSubscription[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [customDuration, setCustomDuration] = useState('');
  const [sponsorshipReason, setSponsorshipReason] = useState('');
  const [immediateRevoke, setImmediateRevoke] = useState(false);
  const [revocationReason, setRevocationReason] = useState('');
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<UserSubscription | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load subscribed users on component mount
  useEffect(() => {
    loadSubscribedUsers();
  }, []);

  // Function to load all subscribed users
  const loadSubscribedUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/membership-processing/subscribed-users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching subscribed users: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSubscribedUsers(data.users || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error loading subscriptions',
          description: data.message || 'Failed to load subscribed users',
        });
      }
    } catch (error) {
      console.error('Error loading subscribed users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while loading subscriptions',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle user search for adding a sponsored membership
  const handleUserSearch = async () => {
    if (!userSearchTerm || userSearchTerm.length < 2) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?term=${encodeURIComponent(userSearchTerm)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error searching users: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setUserSearchResults(data.users || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Search Failed',
          description: data.message || 'Failed to find users',
        });
      }
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while searching users',
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Create a sponsored membership for a user
  const createSponsoredMembership = async () => {
    if (!selectedUserId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No user selected',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/membership-processing/sponsored-membership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedUserId,
          planType: selectedPlan,
          durationMonths: customDuration ? parseInt(customDuration) : undefined,
          reason: sponsorshipReason
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error creating sponsored membership: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Membership Added',
          description: `Successfully added a sponsored ${selectedPlan} membership for user`,
        });
        
        // Refresh the list and close the dialog
        setShowAddDialog(false);
        resetAddForm();
        loadSubscribedUsers();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Adding Membership',
          description: data.message || 'Failed to add sponsored membership',
        });
      }
    } catch (error) {
      console.error('Error creating sponsored membership:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while creating the sponsored membership',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Revoke a user's membership
  const revokeMembership = async () => {
    if (!selectedUserId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No user selected',
      });
      return;
    }

    setIsLoading(true);
    try {
      // For DELETE requests with a body, we need to use the fetch API directly
      const response = await fetch(`/api/membership-processing/membership/${selectedUserId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          immediate: immediateRevoke,
          reason: revocationReason
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error revoking membership: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Membership Revoked',
          description: immediateRevoke 
            ? 'Membership has been immediately revoked' 
            : 'Membership has been cancelled but will remain active until the end of the billing period',
        });
        
        // Refresh the list and close the dialog
        setShowRevokeDialog(false);
        resetRevokeForm();
        loadSubscribedUsers();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Revoking Membership',
          description: data.message || 'Failed to revoke membership',
        });
      }
    } catch (error) {
      console.error('Error revoking membership:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while revoking the membership',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter subscribed users based on search term
  const filteredUsers = subscribedUsers.filter((user) => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchTermLower) ||
      user.email.toLowerCase().includes(searchTermLower) ||
      (user.fullName && user.fullName.toLowerCase().includes(searchTermLower))
    );
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Fetch payment history for a user
  const fetchPaymentHistory = async (user: UserSubscription) => {
    if (!user.squareCustomerId) {
      setPaymentHistory([]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const response = await apiRequest(`/api/square/payment-history/${user.squareCustomerId}`);
      if (response.success) {
        setPaymentHistory(response.transactions || []);
      } else {
        setPaymentHistory([]);
        toast({
          variant: 'destructive',
          title: 'Error Loading Payment History',
          description: response.message || 'Failed to load payment history',
        });
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setPaymentHistory([]);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while loading payment history',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle payment history view
  const handleViewPaymentHistory = (user: UserSubscription) => {
    setSelectedUserForHistory(user);
    setShowPaymentHistory(true);
    fetchPaymentHistory(user);
  };

  // Reset add form
  const resetAddForm = () => {
    setSelectedUserId(null);
    setUserSearchTerm('');
    setUserSearchResults([]);
    setSelectedPlan('monthly');
    setCustomDuration('');
    setSponsorshipReason('');
  };

  // Reset revoke form
  const resetRevokeForm = () => {
    setSelectedUserId(null);
    setImmediateRevoke(false);
    setRevocationReason('');
  };

  // Status badge renderer
  const renderStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'cancelled':
        return <Badge variant="warning">Cancelled</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subscribed users..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Add Sponsored Membership
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && subscribedUsers.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center text-muted-foreground">
              <p>No subscribers found.</p>
              <p className="text-sm mt-2">Click "Add Sponsored Membership" to get started.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Payment History</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No subscribers match your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.subscriptionType === 'monthly'
                            ? 'Monthly ($5/mo)'
                            : user.subscriptionType === 'annual'
                            ? 'Annual ($50/yr)'
                            : user.subscriptionType}
                        </TableCell>
                        <TableCell>{renderStatusBadge(user.subscriptionStatus)}</TableCell>
                        <TableCell>{formatDate(user.subscriptionStartDate)}</TableCell>
                        <TableCell>{formatDate(user.subscriptionEndDate)}</TableCell>
                        <TableCell>
                          {user.squareCustomerId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPaymentHistory(user)}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              View History
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No Square payments
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setShowRevokeDialog(true);
                            }}
                            disabled={user.subscriptionStatus !== 'active'}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Sponsored Membership Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Sponsored Membership</DialogTitle>
            <DialogDescription>
              Create a sponsored membership for a user without requiring payment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label htmlFor="userSearch">Find User</Label>
              <div className="flex gap-2">
                <Input
                  id="userSearch"
                  placeholder="Search by username, email, or name"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleUserSearch}
                  disabled={isSearching || userSearchTerm.length < 2}
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {userSearchResults.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  <Table>
                    <TableBody>
                      {userSearchResults.map((user) => (
                        <TableRow
                          key={user.id}
                          className={`cursor-pointer ${
                            selectedUserId === user.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          <TableCell>
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            {selectedUserId === user.id && (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {userSearchResults.length === 0 && userSearchTerm && !isSearching && (
                <p className="text-sm text-muted-foreground">No users found</p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="planType">Membership Plan</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Membership ($5/mo)</SelectItem>
                    <SelectItem value="annual">Annual Membership ($50/yr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customDuration">
                  Custom Duration (months, optional)
                </Label>
                <Input
                  id="customDuration"
                  type="number"
                  min="1"
                  max="60"
                  placeholder="Leave blank for standard duration"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Standard durations are 1 month for monthly and 12 months for annual plans
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">Reason for Sponsorship</Label>
                <Textarea
                  id="reason"
                  placeholder="E.g., Community contribution, special arrangement, etc."
                  value={sponsorshipReason}
                  onChange={(e) => setSponsorshipReason(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={createSponsoredMembership}
              disabled={isLoading || !selectedUserId}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Create Sponsored Membership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Membership Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Membership</DialogTitle>
            <DialogDescription>
              Confirm membership revocation for this user
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="immediateRevoke"
                checked={immediateRevoke}
                onCheckedChange={setImmediateRevoke}
              />
              <Label htmlFor="immediateRevoke" className="cursor-pointer">
                Revoke immediately
              </Label>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {immediateRevoke ? (
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p>
                    The user will lose access immediately and their role will change from "paid" 
                    to "registered" right away.
                  </p>
                </div>
              ) : (
                <p>
                  The user will maintain access until the end of their current billing period, 
                  but their subscription will not renew.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="revocationReason">Reason for Revocation (optional)</Label>
              <Textarea
                id="revocationReason"
                placeholder="Reasons for administrative record"
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={revokeMembership}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {immediateRevoke ? 'Revoke Immediately' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={showPaymentHistory} onOpenChange={setShowPaymentHistory}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              Square transaction history for {selectedUserForHistory?.username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payment transactions found</p>
                <p className="text-sm mt-2">
                  {selectedUserForHistory?.squareCustomerId 
                    ? 'This user has no recorded payments in Square'
                    : 'This user does not have a Square customer ID'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-sm">
                          {transaction.id}
                        </TableCell>
                        <TableCell>
                          ${(transaction.amount / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={transaction.status === 'COMPLETED' ? 'default' : 'secondary'}>
                            {transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDate(transaction.createdAt)}
                        </TableCell>
                        <TableCell>
                          {transaction.description || 'Membership payment'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentHistory(false)}>
              Close
            </Button>
            {selectedUserForHistory?.squareCustomerId && (
              <Button 
                variant="outline" 
                onClick={() => window.open(`https://squareup.com/dashboard/transactions/customer/${selectedUserForHistory.squareCustomerId}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View in Square Dashboard
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}