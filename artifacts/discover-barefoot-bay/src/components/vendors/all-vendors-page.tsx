import React, { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PageContent, VendorCategory } from "@shared/schema";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import {
  VendorBrowse,
  vendorDescriptionSnippet,
  vendorFirstImage,
  type VendorItem,
} from "./vendor-browse";

export const AllVendorsPage: React.FC = () => {
  // State to store organized vendors by category
  const [vendorsByCategory, setVendorsByCategory] = useState<Record<string, PageContent[]>>({});
  // Category filter for the browse toolbar (null = All Categories)
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  // Get user permissions
  const { isAdmin } = usePermissions();
  const { user } = useAuth();

  // Fetch all pages to find all vendors
  const { data: allPages, isLoading: isLoadingPages } = useQuery<PageContent[]>({
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
  
  // Fetch vendor categories from database
  const { data: dbCategories, isLoading: isLoadingCategories } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories'],
    queryFn: async () => {
      // Fetch categories with includeHidden parameter for admins
      const url = isAdmin 
        ? '/api/vendor-categories?includeHidden=true' 
        : '/api/vendor-categories';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch vendor categories');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch unvisited vendor slugs for the current user
  const { data: unvisitedData } = useQuery<{ unvisitedSlugs: string[] }>({
    queryKey: ['/api/vendors/unvisited'],
    queryFn: async () => {
      const res = await fetch('/api/vendors/unvisited', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch unvisited vendors');
      return res.json();
    },
    enabled: !!user,
    staleTime: 1000 * 30, // 30 seconds
  });

  const unvisitedSlugs = useMemo(
    () => new Set(unvisitedData?.unvisitedSlugs || []),
    [unvisitedData],
  );

  // Format categories to match our interface
  const vendorCategories = useMemo(
    () =>
      (dbCategories ?? [])
        .filter(cat => isAdmin || !cat.isHidden)
        .map(cat => ({ slug: cat.slug, label: cat.name })),
    [dbCategories, isAdmin],
  );

  // Update vendor visit tracking when page loads
  useEffect(() => {
    const updateVisit = async () => {
      try {
        await fetch('/api/vendors/visit', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Failed to update vendor visit tracking:', error);
      }
    };

    updateVisit();
  }, []);

  // Process vendor pages and organize them by category
  useEffect(() => {
    if (!allPages || !dbCategories || dbCategories.length === 0) return;

    // Ensure allPages is an array before filtering
    if (!Array.isArray(allPages)) {
      console.error("Expected allPages to be an array, but got:", typeof allPages);
      return;
    }

    // Get all pages that start with vendors-
    // For non-admin users, filter out hidden vendors
    const vendorPages = allPages.filter(page => {
      // Only include vendor pages
      const isVendorPage = page.slug.startsWith('vendors-');
      
      // For admin users, show all vendors (including hidden ones)
      // For non-admin users, filter out hidden vendors
      return isVendorPage && (isAdmin || !page.isHidden);
    });
    
    // Initialize the organized vendors object
    const organizedVendors: Record<string, PageContent[]> = {};
    
    // Initialize each category with an empty array
    // Filter out hidden categories for non-admin users
    dbCategories
      .filter(category => isAdmin || !category.isHidden)
      .forEach(category => {
        organizedVendors[category.slug] = [];
      });

    // Loop through each vendor page and categorize it
    vendorPages.forEach(page => {
      const slug = page.slug;
      
      // Skip vendor main/index pages
      if (slug === 'vendors-main' || slug === 'vendors') {
        return;
      }
      
      // For vendor slugs, extract the category part
      let vendorCategoryPart = '';
      
      if (slug.includes(' ')) {
        // For slugs with spaces like "vendors-landscaping tst vendor"
        vendorCategoryPart = slug.substring('vendors-'.length, slug.indexOf(' '));
      } else {
        // For slugs with dashes like "vendors-landscaping-company-name" or "vendors-home-services-company-name"
        const slugParts = slug.split('-');
        if (slugParts.length >= 3 && slugParts[0] === 'vendors') {
          // Enhanced slug parsing: Try all possible category combinations from the vendor slug
          // This handles both old pattern (vendors-food-dining-*) and new pattern (vendors-food-and-dining-*)
          const allPossibleCategories: string[] = [];
          
          // Generate all possible category combinations (from 1 to 5 parts after 'vendors-')
          for (let i = 2; i <= Math.min(slugParts.length - 1, 6); i++) {
            const possibleCategory = slugParts.slice(1, i).join('-');
            allPossibleCategories.push(possibleCategory);
          }
          
          // Find the first matching category from database categories
          const matchingCategory = dbCategories.find(cat => 
            allPossibleCategories.includes(cat.slug)
          );
          
          if (matchingCategory) {
            vendorCategoryPart = matchingCategory.slug;
          } else {
            // Fallback pattern matching for specific known cases
            // Handle "food-and-dining" → "food-dining" mapping
            const foodAndDiningMatch = allPossibleCategories.find(cat => cat === 'food-and-dining');
            if (foodAndDiningMatch && dbCategories.find(cat => cat.slug === 'food-dining')) {
              vendorCategoryPart = 'food-dining';
            }
            // Handle other potential "and" pattern mappings
            else {
              // Try to find any category that might match with "and" removed
              for (const possibleCat of allPossibleCategories) {
                // Remove "and" from the middle and see if it matches a database category
                const withoutAnd = possibleCat.replace('-and-', '-');
                const categoryMatch = dbCategories.find(cat => cat.slug === withoutAnd);
                if (categoryMatch) {
                  vendorCategoryPart = categoryMatch.slug;
                  break;
                }
              }
              
              // If still no match, fallback to single word category
              if (!vendorCategoryPart) {
                vendorCategoryPart = slugParts[1];
              }
            }
          }
        } else {
          return; // Skip invalid vendor slugs
        }
      }
      
      // Check against each category
      dbCategories.forEach(category => {
        // Skip hidden categories for non-admin users
        if (!isAdmin && category.isHidden) {
          return;
        }
        
        const categoryId = category.slug;
        
        // Check if this vendor belongs to the current category
        if (
            // Direct match (e.g., vendors-landscaping-abc matches landscaping category)
            vendorCategoryPart === categoryId ||
            
            // Dynamic check: Does the vendor slug directly contain this category?
            slug.includes(`-${categoryId}-`) ||
            
            // Dynamic check: For vendors created with the category pattern like "vendors-pressure-washing-pressure-test"
            // This will ensure that "pressure-washing" vendors appear under the "pressure-washing" category
            (slug.startsWith(`vendors-${categoryId}-`)) ||
            
            // Handle special cases and partial matches
            (categoryId === 'home-services' && vendorCategoryPart === 'home-service') ||
            (categoryId === 'home-services' && vendorCategoryPart === 'homeservices') ||
            (categoryId === 'food-dining' && (vendorCategoryPart === 'food' || vendorCategoryPart === 'dining')) ||
            (categoryId === 'professional-services' && vendorCategoryPart === 'professional')
        ) {
          organizedVendors[categoryId].push(page);
        }
      });
    });
    
    setVendorsByCategory(organizedVendors);
  }, [allPages, dbCategories, isAdmin]);

  // Flatten the categorized vendors into browse items (name/URL extraction
  // preserved from the previous table layout)
  const vendorItems = useMemo<VendorItem[]>(() => {
    const items: VendorItem[] = [];

    vendorCategories.forEach(category => {
      const vendors = vendorsByCategory[category.slug] || [];
      vendors.forEach(vendor => {
        // NOTE: a vendor can match multiple categories in the organizer, and
        // (matching the previous table layout) it is listed once per matching
        // category — each entry keeps that category's own detail URL.

        // Extract vendor name from slug, handling both dash-separated and space formats
        let vendorName: string;
        
        // Special case for our problem vendors
        if (vendor.slug === 'vendors-landscaping-tst vendor') {
          // For this specific vendor with the known issue, preserve the original name
          vendorName = 'tst vendor';
        }
        // Handle the specific Test vendor case
        else if (vendor.slug === 'vendors-landscaping-landscaping') {
          vendorName = 'landscaping';
        }
        else if (vendor.slug.includes(' ')) {
          // Handle slugs with spaces (e.g., "vendors-landscaping tst vendor")
          const spaceIndex = vendor.slug.indexOf(' ');
          vendorName = vendor.slug.substring(spaceIndex + 1);
        } else {
          // Handle normal dash-separated slugs (e.g., "vendors-landscaping-test-vendor")
          const slugParts = vendor.slug.split('-');
          
          // Check if this vendor belongs to a compound category by matching against database categories
          let categorySliceEnd = 2; // Default assumption: single word category
          
          // Find the matching category from our database categories
          const matchingCategory = dbCategories && dbCategories.find(cat => {
            const categoryWords = cat.slug.split('-');
            const slugPrefix = slugParts.slice(1, 1 + categoryWords.length).join('-');
            return slugPrefix === cat.slug;
          });
          
          if (matchingCategory) {
            // Use the actual category length to determine where vendor name starts
            const categoryWords = matchingCategory.slug.split('-');
            categorySliceEnd = 1 + categoryWords.length; // 1 for "vendors" + category length
          }
          
          // Extract vendor name starting after the category
          vendorName = slugParts.slice(categorySliceEnd).join('-');
        }
        
        // Format the vendor name for display
        const vendorDisplayName = vendorName
          .split(/[-\s]/) // Split by both dashes and spaces
          .map(word => word && word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        items.push({
          slug: vendor.slug,
          title: vendor.title || vendorDisplayName,
          description: vendorDescriptionSnippet(vendor.content),
          href: `/vendors/${category.slug}/${encodeURIComponent(vendorName)}`,
          image: vendorFirstImage(vendor.content),
          categorySlug: category.slug,
          categoryLabel: category.label,
          isUnvisited: !!(user && unvisitedSlugs.has(vendor.slug)),
          isHidden: !!vendor.isHidden,
          createdAt: vendor.createdAt ?? null,
        });
      });
    });

    return items;
  }, [vendorCategories, vendorsByCategory, dbCategories, user, unvisitedSlugs]);

  // Display loading state while fetching data
  if (isLoadingPages || isLoadingCategories) {
    return (
      <div className="space-y-6">
        {/* Toolbar skeleton */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 flex-1 min-w-[200px]" />
          <Skeleton className="h-10 w-28 hidden sm:block" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-44" />
        </div>
        {/* Card list skeleton */}
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3, 4].map((_, i) => (
            <Skeleton key={i} className="h-[130px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  
  // If categories loaded but no vendors found
  if (!vendorCategories || vendorCategories.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <p>No vendor categories available. Please check back later.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <VendorBrowse
      vendors={vendorItems}
      categories={vendorCategories}
      selectedCategorySlug={selectedCategorySlug}
      onCategoryChange={setSelectedCategorySlug}
      showAdminBadge={isAdmin}
    />
  );
};
