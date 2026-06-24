import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SponsoredMembershipManager } from '@/components/admin/sponsored-membership-manager';
import { SubscriptionManager } from '@/components/admin/subscription-manager';
import { CreditManagementDashboard } from '@/components/admin/credit-management-dashboard';
import AdminLayout from '@/components/layouts/admin-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Layers, Users, Award } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Assuming Button is in ui

export default function MembershipManagementPage() {
  const [showAddCreditsDialog, setShowAddCreditsDialog] = React.useState(false); // added state to mock the button. this line might not be neccesary

  return (
    <AdminLayout>
      <div className="container py-6">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold">Membership Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage user subscriptions and membership orders
            </p>
          </div>

          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Subscription Processing System</AlertTitle>
            <AlertDescription>
              When users purchase memberships through Square, their role should automatically upgrade to "paid." 
              If automatic processing fails, use these tools to manually process orders or troubleshoot subscription issues.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="subscriptions" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-lg">
              <TabsTrigger value="subscriptions">
                <Layers className="h-4 w-4 mr-2" /> 
                Subscriptions
              </TabsTrigger>
              <TabsTrigger value="sponsored">
                <Award className="h-4 w-4 mr-2" /> 
                Sponsored
              </TabsTrigger>
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" /> 
                Credits
              </TabsTrigger>
            </TabsList>

            <TabsContent value="subscriptions" className="pt-4">
              <SubscriptionManager />
            </TabsContent>

            <TabsContent value="sponsored" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sponsored Memberships</CardTitle>
                  <CardDescription>
                    Manually create and manage sponsored memberships
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SponsoredMembershipManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="pt-4">
              <CreditManagementDashboard />
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Troubleshooting Guide</CardTitle>
              <CardDescription>
                How to handle common membership issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Order Not Processed Automatically</h3>
                  <p className="text-sm text-muted-foreground">
                    If a user has completed checkout but their role hasn't changed to "paid":
                  </p>
                  <ol className="list-decimal list-inside text-sm pl-4 space-y-1">
                    <li>Verify the user has completed checkout in Square (check email confirmation)</li>
                    <li>Check the user's subscription status in the "Subscriptions" tab</li>
                    <li>If needed, create a sponsored membership for immediate access</li>
                    <li>Verify the user's role changed to "paid" in User Management</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Expired Subscriptions</h3>
                  <p className="text-sm text-muted-foreground">
                    When a subscription expires, users will automatically return to their previous role 
                    (badge_holder or registered) after 30 days for monthly plans or 365 days for annual plans.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Manual Permission Downgrades</h3>
                  <p className="text-sm text-muted-foreground">
                    To manually downgrade a user from "paid" to their previous role, use the User Management page
                    and select their previous role from the dropdown.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Sponsored Memberships</h3>
                  <p className="text-sm text-muted-foreground">
                    Sponsored memberships can be added for users who should receive paid access without payment:
                  </p>
                  <ol className="list-decimal list-inside text-sm pl-4 space-y-1">
                    <li>Use the "Sponsored" tab to create and manage sponsored memberships</li>
                    <li>Search for a user by username, email, or name</li>
                    <li>Select a membership plan and optional custom duration</li>
                    <li>Add a reason for sponsorship for administrative records</li>
                    <li>Sponsored memberships can be revoked immediately or allowed to expire naturally</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}