import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import type { PageContent } from '@shared/schema';
import { usePermissions } from '@/hooks/use-permissions';

interface CommunityCategoryPageProps {
  category: string;
}

export const CommunityCategoryPage: React.FC<CommunityCategoryPageProps> = ({ category }) => {
  const { toast } = useToast();
  const [pages, setPages] = useState<PageContent[]>([]);
  const { isAdmin } = usePermissions();

  // Query for all pages to find pages in this community category
  const { data: allPages, isLoading } = useQuery<PageContent[]>({
    queryKey: ['/api/pages'],
    queryFn: async () => {
      // Fetch pages with includeHidden parameter for admins
      const url = isAdmin 
        ? '/api/pages?includeHidden=true' 
        : '/api/pages';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch pages');
      return res.json();
    }
  });

  // Filter community pages for this category
  useEffect(() => {
    if (!allPages) return;
    
    // Ensure allPages is an array
    if (!Array.isArray(allPages)) {
      console.error("Expected allPages to be an array, but got:", typeof allPages);
      return;
    }
    
    // Log active pages for debugging
    console.log("Current category:", category);
    
    // Find all community pages that match the current category
    const categoryPages = allPages.filter(page => {
      const slug = page.slug;
      
      // Skip non-community pages
      if (!slug.startsWith(`${category}-`)) {
        return false;
      }
      
      // Skip category pages themselves (if they exist)
      if (slug === category) {
        return false;
      }
      
      return true;
    });

    console.log(`Found ${categoryPages.length} pages for category: ${category}`);
    setPages(categoryPages);
  }, [allPages, category, isAdmin]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  // Get a friendly category name from the slug
  const getCategoryDisplayName = () => {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-8">
      {/* Category Table */}
      <div className="rounded-md border shadow-sm overflow-hidden bg-white">
        {/* Table Header */}
        <div className="bg-slate-50 border-b px-4 py-3">
          <h2 className="text-lg font-bold text-slate-800">{getCategoryDisplayName()} Pages</h2>
        </div>
        
        {/* Table Structure */}
        <div className="w-full">
          {/* Table Header Row */}
          <div className="hidden md:flex w-full text-left border-b bg-gray-50">
            <div className="w-3/12 px-4 py-2 font-medium text-slate-500">Name</div>
            <div className="w-7/12 px-4 py-2 font-medium text-slate-500">Description</div>
            <div className="w-2/12 px-4 py-2 text-right font-medium text-slate-500">Actions</div>
          </div>

          {/* Page List Rows */}
          <div className="divide-y divide-gray-200">
            {pages.length > 0 ? (
              pages.map(page => {
                // Extract page name from slug
                const pageName = page.slug.replace(`${category}-`, '');
                
                // Format the page name for display
                const pageDisplayName = page.title || pageName
                  .split('-')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');

                return (
                  <div key={page.slug} className="flex flex-col md:flex-row hover:bg-gray-50 transition-colors">
                    {/* Mobile header (shown only on small screens) */}
                    <div className="md:hidden px-4 pt-3 font-semibold text-slate-800">
                      {pageDisplayName}
                    </div>
                    
                    {/* Page Name (hidden on mobile, shown on desktop) */}
                    <div className="hidden md:block w-3/12 px-4 py-3 font-medium text-slate-800">
                      {pageDisplayName}
                    </div>
                    
                    {/* Description */}
                    <div className="md:w-7/12 px-4 py-2 md:py-3 text-sm text-slate-600">
                      {page.content ? (
                        <div className="line-clamp-2" dangerouslySetInnerHTML={{ 
                          __html: page.content.replace(/<[^>]*>/g, ' ').substring(0, 200) + '...'
                        }} />
                      ) : (
                        <span className="text-slate-400 italic">No description available</span>
                      )}
                    </div>
                    
                    {/* Action Button */}
                    <div className="md:w-2/12 px-4 pb-3 md:py-3 md:text-right">
                      <Link href={`/more/${category}/${pageName}`}>
                        <Button variant="outline" size="sm" className="w-full md:w-auto">View Details</Button>
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500">
                <p>No pages found in this category</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};