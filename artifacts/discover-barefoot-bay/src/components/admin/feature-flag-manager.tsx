import { useState, useEffect } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
// Removed tabs imports as we're no longer using tabs
import { Button } from "@/components/ui/button";

// Feature flag types from the API
interface ApiFeatureFlag {
  id: number;
  name: string;
  displayName: string;
  enabledForRoles: string[];
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// UI representation of a feature flag
interface UiFeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: {
    admin: boolean;
    moderator: boolean;
    paid: boolean;
    badge_holder: boolean;
    registered: boolean;
    guest: boolean;
  };
  isNavigation: boolean;
}

export function FeatureFlagManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // No longer using tabs
  const [transformedFlags, setTransformedFlags] = useState<UiFeatureFlag[]>([]);
  
  // Feature flags query
  const featureFlagsQuery = useQuery<ApiFeatureFlag[]>({
    queryKey: ['/api/feature-flags'],
    enabled: !!user && user.role === 'admin',
  });

  // Transform API flags to UI flags whenever data changes
  useEffect(() => {
    if (featureFlagsQuery.data) {
      try {
        console.log("Original feature flags data:", featureFlagsQuery.data);
        
        // Transform API flags to our UI structure with expanded role system
        const transformed = featureFlagsQuery.data.map(flag => ({
          id: flag.name, // Use name as ID since it's unique
          name: flag.displayName || flag.name,
          description: flag.description || '',
          isNavigation: flag.name.startsWith('nav-'),
          enabled: {
            admin: flag.enabledForRoles.includes('admin'),
            moderator: flag.enabledForRoles.includes('moderator'),
            paid: flag.enabledForRoles.includes('paid'),
            badge_holder: flag.enabledForRoles.includes('badge_holder'),
            registered: flag.enabledForRoles.includes('registered'),
            guest: flag.enabledForRoles.includes('guest'),
          }
        }));
        
        console.log("Transformed feature flags:", transformed);
        setTransformedFlags(transformed);
      } catch (error) {
        console.error("Error transforming feature flags:", error);
        toast({
          title: "Error processing feature flags",
          description: "There was a problem processing the feature flags data.",
          variant: "destructive",
        });
      }
    }
    
    if (featureFlagsQuery.error) {
      const error = featureFlagsQuery.error as Error;
      console.error("Error loading feature flags:", error);
      toast({
        title: "Error loading feature flags",
        description: error.message || "Failed to load feature flags. Please try again.",
        variant: "destructive",
      });
    }
  }, [featureFlagsQuery.data, featureFlagsQuery.error, toast]);
  
  // Update feature flag mutation
  const updateFeatureFlagMutation = useMutation({
    mutationFn: async (data: { id: string, role: string, enabled: boolean }) => {
      console.log("Debug: Making PATCH request to /api/feature-flags/" + data.id + "/role/" + data.role + " with data:", 
        JSON.stringify({ enabled: data.enabled }));
      
      return apiRequest({
        url: `/api/feature-flags/${data.id}/role/${data.role}`,
        method: 'PATCH',
        // The apiRequest function already stringifies the body, so we pass the object directly
        body: { enabled: data.enabled },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags'] });
      toast({
        title: "Feature flag updated",
        description: "The feature flag has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Feature flag update error:", error);
      toast({
        title: "Error updating feature flag",
        description: error.message || "Failed to update feature flag. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Reset feature flags mutation
  const resetFeatureFlagsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: '/api/feature-flags/reset',
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags'] });
      toast({
        title: "Feature flags reset",
        description: "All feature flags have been reset to their default values.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error resetting feature flags",
        description: error.message || "Failed to reset feature flags. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter flags by category
  const navigationFlags = transformedFlags.filter(flag => flag.isNavigation);
  const featureFlags = transformedFlags.filter(flag => !flag.isNavigation);
  
  // Define permission controls
  const permissionControls = [
    { id: "comments", name: "Comments", description: "Allow commenting throughout the site (forum, calendar, etc.)" },
    { id: "reactions", name: "Like/Going/Interested", description: "Allow clicking reaction buttons throughout the site" },
    { id: "calendar_post", name: "Post Event on Calendar", description: "Allow creating new calendar events" },
    { id: "forum_post", name: "Create Forum Topic", description: "Allow creating new forum topics" },
    { id: "for_sale_post", name: "Create For Sale Listing", description: "Allow posting items for sale" },
    { id: "vendor_page", name: "Create Vendor/Community Page", description: "Allow creating vendor or community pages" },
    { id: "admin_access", name: "Access Admin Dashboard", description: "Allow access to the admin dashboard" },
    { id: "admin_forum", name: "Access Admin-only Forums", description: "Allow access to admin-only forum categories" },
    { id: "featured_content", name: "Create Featured Content", description: "Allow creating featured banner content for the homepage" },
    { id: "weather_rocket_icons", name: "Navigation Icons", description: "Show weather temperature, rocket launch, and live chat icons in the navigation bar" },
    { id: "messages", name: "Private Messages", description: "Enable private messaging between users" },
  ];
  
  const handleToggle = (flagId: string, role: string, enabled: boolean) => {
    updateFeatureFlagMutation.mutate({ id: flagId, role, enabled });
  };
  
  // Define role descriptions for tooltips
  const roleDescriptions = {
    admin: "Full control: Approve users, manage listings, refunds, and all moderation actions",
    moderator: "Block users and delete inappropriate comments - cannot unblock users",
    paid: "Paid Sponsors ($5/mo or $50/yr): Full access to like, comment, post in forums",
    badge_holder: "Badge Holders: Can interact with events/vendors/clubs and comment on content",
    registered: "Registered: Can purchase and post For Sale listings",
    guest: "Guest: Can only browse the site and view content"
  };

  return (
    <Card className="border-teal-500/20">
      <CardHeader>
        <CardTitle className="flex items-center text-teal-600">
          Permissions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h3 className="text-sm font-medium mb-2">🔐 User Roles & Permissions:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-2 bg-white rounded border">
              <span className="font-semibold">Admin:</span> {roleDescriptions.admin}
            </div>
            <div className="p-2 bg-white rounded border">
              <span className="font-semibold">Moderator:</span> {roleDescriptions.moderator}
            </div>
            <div className="p-2 bg-white rounded border">
              <span className="font-semibold">Paid Sponsors:</span> {roleDescriptions.paid}
            </div>
            <div className="p-2 bg-white rounded border">
              <span className="font-semibold">Badge Holders:</span> {roleDescriptions.badge_holder}
            </div>
            <div className="p-2 bg-white rounded border">
              <span className="font-semibold">Registered:</span> {roleDescriptions.registered}
            </div>
            <div className="p-2 bg-white rounded border">
              <span className="font-semibold">Guest:</span> {roleDescriptions.guest}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div></div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetFeatureFlagsMutation.mutate()}
            disabled={resetFeatureFlagsMutation.isPending}
          >
            Reset to Defaults
          </Button>
        </div>
          
        {featureFlagsQuery.isLoading ? (
          <div className="py-4 text-center">Loading permission controls...</div>
        ) : (
          <div className="space-y-8">
            {/* Permissions Table */}
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Permission</TableHead>
                    <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                      <div className="font-medium">Admin</div>
                      <div className="text-[10px] text-slate-500">Full Control</div>
                    </TableHead>
                    <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                      <div className="font-medium">Moderator</div>
                      <div className="text-[10px] text-slate-500">Content Moderation</div>
                    </TableHead>
                    <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                      <div className="font-medium">Paid</div>
                      <div className="text-[10px] text-slate-500">$5/mo Members</div>
                    </TableHead>
                    <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                      <div className="font-medium">Badge Holder</div>
                      <div className="text-[10px] text-slate-500">React & Comment</div>
                    </TableHead>
                    <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                      <div className="font-medium">Registered</div>
                      <div className="text-[10px] text-slate-500">Basic Access</div>
                    </TableHead>
                    <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                      <div className="font-medium">Guest</div>
                      <div className="text-[10px] text-slate-500">View Only</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionControls.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell className="font-medium">
                        {permission.name}
                        <div className="text-xs text-muted-foreground">{permission.description}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          id={`${permission.id}-admin`}
                          checked={true} // Always enabled for admins
                          disabled={true}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          id={`${permission.id}-moderator`}
                          checked={
                            // Find this permission in the feature flags - this takes precedence over hardcoded values
                            transformedFlags.find(f => f.id === permission.id) 
                              ? transformedFlags.find(f => f.id === permission.id)?.enabled.moderator 
                              : // Only use fallback if flag doesn't exist at all
                                permission.id === 'admin_access' || permission.id === 'admin_forum'
                          }
                          onCheckedChange={(checked) => handleToggle(permission.id, 'moderator', checked)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          id={`${permission.id}-paid`}
                          checked={
                            // Find this permission in the feature flags - this takes precedence over hardcoded values
                            transformedFlags.find(f => f.id === permission.id) 
                              ? transformedFlags.find(f => f.id === permission.id)?.enabled.paid 
                              : // Only use fallback if flag doesn't exist at all
                                ['comments', 'reactions', 'calendar_post', 'forum_post', 'for_sale_post'].includes(permission.id)
                          }
                          onCheckedChange={(checked) => handleToggle(permission.id, 'paid', checked)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          id={`${permission.id}-badge_holder`}
                          checked={
                            // Find this permission in the feature flags - this takes precedence over hardcoded values
                            transformedFlags.find(f => f.id === permission.id) 
                              ? transformedFlags.find(f => f.id === permission.id)?.enabled.badge_holder 
                              : // Only use fallback if flag doesn't exist at all
                                ['comments', 'reactions'].includes(permission.id)
                          }
                          onCheckedChange={(checked) => handleToggle(permission.id, 'badge_holder', checked)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          id={`${permission.id}-registered`}
                          checked={
                            // Find this permission in the feature flags - this takes precedence over hardcoded values
                            transformedFlags.find(f => f.id === permission.id) 
                              ? transformedFlags.find(f => f.id === permission.id)?.enabled.registered 
                              : // Only use fallback if flag doesn't exist at all
                                ['for_sale_post'].includes(permission.id)
                          }
                          onCheckedChange={(checked) => handleToggle(permission.id, 'registered', checked)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          id={`${permission.id}-guest`}
                          checked={
                            // Find this permission in the feature flags - this takes precedence over hardcoded values
                            transformedFlags.find(f => f.id === permission.id) 
                              ? transformedFlags.find(f => f.id === permission.id)?.enabled.guest 
                              : // Only use fallback if flag doesn't exist at all
                                false
                          }
                          onCheckedChange={(checked) => handleToggle(permission.id, 'guest', checked)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Navigation Items Section */}
            <div>
              <h3 className="font-medium text-sm mb-3">Navigation Items</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Feature</TableHead>
                      <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                        <div className="font-medium">Admin</div>
                        <div className="text-[10px] text-slate-500">Full Control</div>
                      </TableHead>
                      <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                        <div className="font-medium">Moderator</div>
                        <div className="text-[10px] text-slate-500">Content Moderation</div>
                      </TableHead>
                      <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                        <div className="font-medium">Paid</div>
                        <div className="text-[10px] text-slate-500">$5/mo Members</div>
                      </TableHead>
                      <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                        <div className="font-medium">Badge Holder</div>
                        <div className="text-[10px] text-slate-500">React & Comment</div>
                      </TableHead>
                      <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                        <div className="font-medium">Registered</div>
                        <div className="text-[10px] text-slate-500">Basic Access</div>
                      </TableHead>
                      <TableHead className="text-center bg-slate-50 border-b-2 border-slate-200">
                        <div className="font-medium">Guest</div>
                        <div className="text-[10px] text-slate-500">View Only</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Define navigation items */}
                    {[
                      { id: 'nav-forum', name: 'Forum', description: 'Access to community forum' },
                      { id: 'nav-store', name: 'Store', description: 'Access to community store' },
                      { id: 'nav-calendar', name: 'Calendar', description: 'Access to community calendar features' },
                      { id: 'nav-community', name: 'Community', description: 'Access to community information pages' },
                      { id: 'nav-for-sale', name: 'For Sale', description: 'Access to marketplace listings' },
                      { id: 'nav-vendors', name: 'Vendors', description: 'Access to preferred vendors' }
                    ].map((navItem) => (
                      <TableRow key={navItem.id}>
                        <TableCell className="font-medium">
                          {navItem.name}
                          <div className="text-xs text-muted-foreground">{navItem.description}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            id={`${navItem.id}-admin`}
                            checked={
                              transformedFlags.find(f => f.id === navItem.id)
                                ? transformedFlags.find(f => f.id === navItem.id)?.enabled.admin
                                : true // Default to enabled
                            }
                            onCheckedChange={(checked) => handleToggle(navItem.id, 'admin', checked)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            id={`${navItem.id}-moderator`}
                            checked={
                              transformedFlags.find(f => f.id === navItem.id)
                                ? transformedFlags.find(f => f.id === navItem.id)?.enabled.moderator
                                : true // Default to enabled
                            }
                            onCheckedChange={(checked) => handleToggle(navItem.id, 'moderator', checked)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            id={`${navItem.id}-paid`}
                            checked={
                              transformedFlags.find(f => f.id === navItem.id)
                                ? transformedFlags.find(f => f.id === navItem.id)?.enabled.paid
                                : true // Default to enabled
                            }
                            onCheckedChange={(checked) => handleToggle(navItem.id, 'paid', checked)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            id={`${navItem.id}-badge_holder`}
                            checked={
                              transformedFlags.find(f => f.id === navItem.id)
                                ? transformedFlags.find(f => f.id === navItem.id)?.enabled.badge_holder
                                : true // Default to enabled
                            }
                            onCheckedChange={(checked) => handleToggle(navItem.id, 'badge_holder', checked)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            id={`${navItem.id}-registered`}
                            checked={
                              transformedFlags.find(f => f.id === navItem.id)
                                ? transformedFlags.find(f => f.id === navItem.id)?.enabled.registered
                                : true // Default to enabled
                            }
                            onCheckedChange={(checked) => handleToggle(navItem.id, 'registered', checked)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            id={`${navItem.id}-guest`}
                            checked={
                              transformedFlags.find(f => f.id === navItem.id)
                                ? transformedFlags.find(f => f.id === navItem.id)?.enabled.guest
                                : true // Default to enabled
                            }
                            onCheckedChange={(checked) => handleToggle(navItem.id, 'guest', checked)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}