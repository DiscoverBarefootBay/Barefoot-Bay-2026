import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPost } from '@/lib/api';
import { Plus, CreditCard, History, Users, DollarSign, Search } from 'lucide-react';
import { format } from 'date-fns';

interface UserCredit {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  credits: number;
  avatarUrl?: string;
}

interface CreditTransaction {
  id: number;
  userId: number;
  username: string;
  fullName: string;
  transactionType: string;
  credits: number;
  description: string;
  amount?: number;
  paymentStatus: string;
  createdAt: string;
}

interface AddCreditsFormData {
  userId: number;
  credits: number;
  description: string;
  isSelectAll?: boolean;
}

export function CreditManagementDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserCredit | null>(null);
  const [addCreditsForm, setAddCreditsForm] = useState<AddCreditsFormData>({
    userId: 0,
    credits: 0,
    description: '',
    isSelectAll: false
  });
  const [showAddCreditsDialog, setShowAddCreditsDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users with their credit balances
  const { data: userCredits = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/admin/credits/users'],
    queryFn: async () => {
      const response = await apiGet('/api/admin/credits/users');
      if (!response.success) throw new Error(response.error || 'Failed to fetch user credits');
      return response.data?.users || [];
    },
  });

  // Fetch credit transaction history
  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['/api/admin/credits/transactions', selectedUserId],
    queryFn: async () => {
      const url = selectedUserId 
        ? `/api/admin/credits/transactions?userId=${selectedUserId}`
        : '/api/admin/credits/transactions';
      const response = await apiGet(url);
      if (!response.success) throw new Error(response.error || 'Failed to fetch transactions');
      return response.data?.transactions || [];
    },
  });

  // Add credits mutation (single user)
  const addCreditsMutation = useMutation({
    mutationFn: async (data: AddCreditsFormData) => {
      const response = await apiPost('/api/admin/credits/add', data);
      if (!response.success) throw new Error(response.error || 'Failed to add credits');
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Credits Added Successfully',
        description: `Added ${addCreditsForm.credits} credits to user account`,
      });
      
      // Reset form and close dialog
      setAddCreditsForm({ userId: 0, credits: 0, description: '', isSelectAll: false });
      setShowAddCreditsDialog(false);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credits/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credits/transactions'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Adding Credits',
        description: error.message || 'Failed to add credits',
        variant: 'destructive',
      });
    }
  });

  // Add credits to all users mutation
  const addCreditsToAllMutation = useMutation({
    mutationFn: async (data: { credits: number; description: string }) => {
      const response = await apiPost('/api/admin/credits/add-all', data);
      if (!response.success) throw new Error(response.error || 'Failed to add credits to all users');
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Credits Added to All Users',
        description: `Added ${addCreditsForm.credits} credits to ${data.usersUpdated} users`,
      });
      
      // Reset form and close dialog
      setAddCreditsForm({ userId: 0, credits: 0, description: '', isSelectAll: false });
      setShowAddCreditsDialog(false);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credits/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credits/transactions'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Adding Credits to All Users',
        description: error.message || 'Failed to add credits to all users',
        variant: 'destructive',
      });
    }
  });

  // Filter users based on search term
  const filteredUsers = userCredits.filter((user: UserCredit) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCredits = (user: UserCredit) => {
    setAddCreditsForm({
      userId: user.userId,
      credits: 0,
      description: `Manual credit addition by admin`,
      isSelectAll: false
    });
    setSelectedUser(user);
    setShowAddCreditsDialog(true);
  };

  const handleAddCreditsToAll = () => {
    setAddCreditsForm({
      userId: 0,
      credits: 0,
      description: `Bulk credit addition to all users by admin`,
      isSelectAll: true
    });
    setSelectedUser(null);
    setShowAddCreditsDialog(true);
  };

  const submitAddCredits = () => {
    if (addCreditsForm.credits <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a positive number of credits',
        variant: 'destructive',
      });
      return;
    }

    if (!addCreditsForm.description.trim()) {
      toast({
        title: 'Description Required',
        description: 'Please provide a description for this credit addition',
        variant: 'destructive',
      });
      return;
    }

    if (addCreditsForm.isSelectAll) {
      // Submit to bulk endpoint
      addCreditsToAllMutation.mutate({
        credits: addCreditsForm.credits,
        description: addCreditsForm.description
      });
    } else {
      // Submit to single user endpoint
      addCreditsMutation.mutate(addCreditsForm);
    }
  };

  const getTransactionBadgeVariant = (type: string) => {
    switch (type) {
      case 'purchase': return 'default';
      case 'use': return 'destructive';
      case 'manual_add': return 'secondary';
      default: return 'outline';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase': return <DollarSign className="h-3 w-3" />;
      case 'use': return <CreditCard className="h-3 w-3" />;
      case 'manual_add': return <Plus className="h-3 w-3" />;
      default: return <History className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCredits.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits Distributed</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userCredits.reduce((sum: number, user: UserCredit) => sum + user.credits, 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            User Credits
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <History className="h-4 w-4 mr-2" />
            Transaction History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Search and filters */}
          <div className="flex items-center justify-between space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, username, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              onClick={handleAddCreditsToAll}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Credits to All Users
            </Button>
          </div>

          {/* Users table */}
          <Card>
            <CardHeader>
              <CardTitle>User Credit Balances</CardTitle>
              <CardDescription>
                Manage credit balances for all users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="text-center py-6">Loading users...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user: UserCredit) => (
                      <TableRow key={user.userId}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {user.avatarUrl && (
                              <img
                                src={user.avatarUrl}
                                alt={user.fullName}
                                className="h-8 w-8 rounded-full"
                              />
                            )}
                            <div>
                              <div className="font-medium">{user.fullName}</div>
                              <div className="text-sm text-muted-foreground">@{user.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={user.credits > 0 ? 'default' : 'secondary'}>
                            {user.credits} credits
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedUserId(user.userId)}
                            >
                              <History className="h-3 w-3 mr-1" />
                              History
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAddCredits(user)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Credits
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          {/* Transaction filters */}
          <div className="flex items-center space-x-2">
            <Button
              variant={selectedUserId === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedUserId(null)}
            >
              All Users
            </Button>
            {selectedUserId && (
              <Badge variant="secondary">
                Filtered by User ID: {selectedUserId}
                <button
                  className="ml-2 text-xs hover:text-destructive"
                  onClick={() => setSelectedUserId(null)}
                >
                  ×
                </button>
              </Badge>
            )}
          </div>

          {/* Transactions table */}
          <Card>
            <CardHeader>
              <CardTitle>Credit Transaction History</CardTitle>
              <CardDescription>
                Complete history of all credit transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTransactions ? (
                <div className="text-center py-6">Loading transactions...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction: CreditTransaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{transaction.fullName}</div>
                            <div className="text-sm text-muted-foreground">@{transaction.username}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTransactionBadgeVariant(transaction.transactionType)}>
                            {getTransactionIcon(transaction.transactionType)}
                            <span className="ml-1 capitalize">
                              {transaction.transactionType.replace('_', ' ')}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={transaction.credits > 0 ? 'text-green-600' : 'text-red-600'}>
                            {transaction.credits > 0 ? '+' : ''}{transaction.credits}
                          </span>
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell className="text-right">
                          {transaction.amount ? `$${transaction.amount}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Credits Dialog */}
      <Dialog open={showAddCreditsDialog} onOpenChange={setShowAddCreditsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addCreditsForm.isSelectAll ? 'Add Credits to All Users' : 'Add Credits to User'}
            </DialogTitle>
            <DialogDescription>
              {addCreditsForm.isSelectAll ? (
                <span>
                  Adding credits to all {userCredits.length} users in the system
                </span>
              ) : selectedUser ? (
                <span>
                  Adding credits to {selectedUser.fullName} (@{selectedUser.username})
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credits">Number of Credits</Label>
              <Input
                id="credits"
                type="number"
                min="1"
                placeholder="Enter number of credits"
                value={addCreditsForm.credits || ''}
                onChange={(e) => setAddCreditsForm({
                  ...addCreditsForm,
                  credits: parseInt(e.target.value) || 0
                })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Reason for adding credits..."
                value={addCreditsForm.description}
                onChange={(e) => setAddCreditsForm({
                  ...addCreditsForm,
                  description: e.target.value
                })}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowAddCreditsDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={submitAddCredits}
                disabled={addCreditsMutation.isPending || addCreditsToAllMutation.isPending}
              >
                {(addCreditsMutation.isPending || addCreditsToAllMutation.isPending) 
                  ? 'Adding...' 
                  : addCreditsForm.isSelectAll 
                    ? 'Add Credits to All Users' 
                    : 'Add Credits'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}