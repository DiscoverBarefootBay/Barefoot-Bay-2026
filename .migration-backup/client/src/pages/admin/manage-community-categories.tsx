import React from 'react';
import ManageCommunityCategories from '@/components/admin/manage-community-categories';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ManageCommunityCategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Community Categories Management</h1>
        <p className="text-muted-foreground">
          Manage the community page categories that appear in navigation and content pages.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>About Community Categories</CardTitle>
          <CardDescription>
            Community categories organize content in the Community section. Each category can have multiple pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              Categories determine how content is organized in the navigation menu and throughout the community pages.
              Each category has a unique slug that forms part of the URL structure.
            </p>
            <p>
              <strong>Important:</strong> Changing a category slug will automatically update all associated page URLs.
              This helps prevent broken links, but may impact any external bookmarks or shared links.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <ManageCommunityCategories />
    </div>
  );
}