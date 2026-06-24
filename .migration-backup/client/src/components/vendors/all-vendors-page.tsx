import React, { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import type { PageContent, VendorCategory } from "@shared/schema";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

export const AllVendorsPage: React.FC = () => {
  // State to store organized vendors by category
  const [vendorsByCategory, setVendorsByCategory] = useState<Record<string, PageContent[]>>({});
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  const unvisitedSlugs = new Set(unvisitedData?.unvisitedSlugs || []);
  
  // Format categories to match our interface
  const vendorCategories = dbCategories?.map(cat => ({
    id: cat.slug,
    label: cat.name
  })) || [];

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
    console.log("Processing vendor pages:", vendorPages.map(p => p.slug));
    
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
          console.log(`Categorizing vendor ${slug} with parts:`, slugParts);
          
          // Enhanced slug parsing: Try all possible category combinations from the vendor slug
          // This handles both old pattern (vendors-food-dining-*) and new pattern (vendors-food-and-dining-*)
          const allPossibleCategories: string[] = [];
          
          // Generate all possible category combinations (from 1 to 5 parts after 'vendors-')
          for (let i = 2; i <= Math.min(slugParts.length - 1, 6); i++) {
            const possibleCategory = slugParts.slice(1, i).join('-');
            allPossibleCategories.push(possibleCategory);
          }
          
          console.log(`Possible categories for ${slug}:`, allPossibleCategories);
          
          // Find the first matching category from database categories
          const matchingCategory = dbCategories.find(cat => 
            allPossibleCategories.includes(cat.slug)
          );
          
          if (matchingCategory) {
            vendorCategoryPart = matchingCategory.slug;
            console.log(`✅ Found exact database match: ${vendorCategoryPart} for vendor ${slug}`);
          } else {
            // Fallback pattern matching for specific known cases
            // Handle "food-and-dining" → "food-dining" mapping
            const foodAndDiningMatch = allPossibleCategories.find(cat => cat === 'food-and-dining');
            if (foodAndDiningMatch && dbCategories.find(cat => cat.slug === 'food-dining')) {
              vendorCategoryPart = 'food-dining';
              console.log(`✅ Mapped food-and-dining to food-dining for vendor ${slug}`);
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
                  console.log(`✅ Mapped ${possibleCat} to ${withoutAnd} for vendor ${slug}`);
                  break;
                }
              }
              
              // If still no match, fallback to single word category
              if (!vendorCategoryPart) {
                vendorCategoryPart = slugParts[1];
                console.log(`⚠️ Using fallback single word category: ${vendorCategoryPart} for vendor ${slug}`);
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
          console.log(`Adding vendor ${slug} to category ${categoryId}`);
          organizedVendors[categoryId].push(page);
        }
      });
    });
    
    console.log("Organized vendors by category:", Object.keys(organizedVendors).map(cat => 
      `${cat}: ${organizedVendors[cat].length} vendors`
    ));
    
    setVendorsByCategory(organizedVendors);
  }, [allPages, dbCategories, isAdmin]);

  // Display loading state while fetching data
  if (isLoadingPages || isLoadingCategories) {
    return (
      <div className="space-y-6">
        {/* Category Navigation Skeleton */}
        <div className="overflow-x-auto pb-2">
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map((_, i) => (
              <Skeleton key={i} className="h-10 w-24" />
            ))}
          </div>
        </div>
        
        {/* First Table Category Skeleton */}
        <div className="rounded-md border bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
          
          <div className="hidden md:grid md:grid-cols-12 px-4 py-2 border-b">
            <Skeleton className="h-5 w-16 md:col-span-3" />
            <Skeleton className="h-5 w-24 md:col-span-7" />
            <div className="md:col-span-2 text-right">
              <Skeleton className="h-5 w-16 ml-auto" />
            </div>
          </div>
          
          <div className="divide-y">
            {[1, 2, 3, 4].map((_, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 px-4 py-3 items-center">
                <div className="md:col-span-3 mb-1 md:mb-0">
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="md:col-span-7 mb-2 md:mb-0">
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="md:col-span-2 text-right">
                  <Skeleton className="h-9 w-24 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Second Table Category Skeleton */}
        <div className="rounded-md border bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-9 w-24" />
          </div>
          
          <div className="hidden md:grid md:grid-cols-12 px-4 py-2 border-b">
            <Skeleton className="h-5 w-16 md:col-span-3" />
            <Skeleton className="h-5 w-24 md:col-span-7" />
            <div className="md:col-span-2 text-right">
              <Skeleton className="h-5 w-16 ml-auto" />
            </div>
          </div>
          
          <div className="divide-y">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 px-4 py-3 items-center">
                <div className="md:col-span-3 mb-1 md:mb-0">
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="md:col-span-7 mb-2 md:mb-0">
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="md:col-span-2 text-right">
                  <Skeleton className="h-9 w-24 ml-auto" />
                </div>
              </div>
            ))}
          </div>
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
    <div className="space-y-6">
      {/* Search Bar Section */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search vendors by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Navigation Section */}
      <div className="overflow-x-auto pb-2">
        <div className="flex space-x-2">
          {vendorCategories.map(category => (
            <Link key={category.id} href={`/vendors/${category.id}`}>
              <Button variant="outline" className="whitespace-nowrap">
                {category.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Table-based View of Vendors (Improved) */}
      {vendorCategories.map(category => {
        const allVendors = vendorsByCategory[category.id] || [];
        const searchLower = searchQuery.toLowerCase().trim();
        const categoryMatches = searchLower && (
          category.label.toLowerCase().includes(searchLower) ||
          category.id.toLowerCase().includes(searchLower)
        );
        const vendors = searchQuery.trim()
          ? categoryMatches 
            ? allVendors // Show all vendors in category if category name matches
            : allVendors.filter(vendor => 
                vendor.title?.toLowerCase().includes(searchLower) ||
                vendor.slug.toLowerCase().includes(searchLower)
              )
          : allVendors;
        return vendors.length > 0 ? (
          <div key={category.id} className="rounded-md border shadow-sm overflow-hidden bg-white">
            {/* Category Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 gap-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex-1 min-w-0 pr-2">{category.label}</h2>
              <Link href={`/vendors/${category.id}`} className="flex-shrink-0">
                <Button variant="outline" size="sm" className="whitespace-nowrap text-xs">
                  <span className="hidden sm:inline">View All {category.label}</span>
                  <span className="sm:hidden">View All</span>
                </Button>
              </Link>
            </div>

            {/* Table Structure */}
            <div className="w-full">
              {/* Table Header */}
              <div className="hidden md:flex w-full text-left border-b bg-gray-50">
                <div className="w-3/12 px-4 py-2 font-medium text-slate-500">Name</div>
                <div className="w-7/12 px-4 py-2 font-medium text-slate-500">Description</div>
                <div className="w-2/12 px-4 py-2 text-right font-medium text-slate-500">Actions</div>
              </div>
              
              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {vendors.map(vendor => {
                  // Extract vendor name from slug, handling both dash-separated and space formats
                  let vendorName;
                  
                  // Special case for our problem vendors
                  if (vendor.slug === 'vendors-landscaping-tst vendor') {
                    // For this specific vendor with the known issue, preserve the original name
                    // This is critical - use the exact "tst vendor" with space to match what's in the URL
                    vendorName = 'tst vendor';
                    console.log(`Special case for problematic vendor: ${vendor.slug} → vendorName: ${vendorName}`);
                  }
                  // Handle the specific Test vendor case
                  else if (vendor.slug === 'vendors-landscaping-landscaping') {
                    // Make sure we use the dash format for the "landscaping" vendor created with "Test"
                    vendorName = 'landscaping';
                    console.log(`Special case for Test vendor: ${vendor.slug} → vendorName: ${vendorName}`);
                  }
                  else if (vendor.slug.includes(' ')) {
                    // Handle slugs with spaces (e.g., "vendors-landscaping tst vendor")
                    // Extract everything after the category
                    const spaceIndex = vendor.slug.indexOf(' ');
                    vendorName = vendor.slug.substring(spaceIndex + 1);
                    
                    // Keep spaces in the URL for consistency with how it's stored in the database
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
                      console.log(`Found matching category ${matchingCategory.slug} (${categoryWords.length} words) for vendor ${vendor.slug}`);
                    }
                    
                    // Extract vendor name starting after the category
                    vendorName = slugParts.slice(categorySliceEnd).join('-');
                    console.log(`Extracted vendor name: "${vendorName}" from slug: "${vendor.slug}" (category ends at position ${categorySliceEnd})`);
                  }
                  
                  // Format the vendor name for display
                  const vendorDisplayName = vendorName
                    .split(/[-\s]/) // Split by both dashes and spaces
                    .map(word => word && word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                  // Check if this vendor is unvisited
                  const isUnvisited = user && unvisitedSlugs.has(vendor.slug);

                  return (
                    <div 
                      key={vendor.slug} 
                      className={`flex flex-col md:flex-row hover:bg-gray-50 transition-colors ${
                        isUnvisited ? 'border-l-4 border-red-500 bg-red-50/30' : ''
                      }`}
                    >
                      {/* Mobile header (shown only on small screens) */}
                      <div className="md:hidden px-4 pt-3 font-semibold text-slate-800 flex items-center gap-2">
                        {vendor.title || vendorDisplayName}
                        {isUnvisited && (
                          <Badge className="bg-red-500 text-white text-xs">New</Badge>
                        )}
                      </div>
                      
                      {/* Vendor Name (hidden on mobile, shown on desktop) */}
                      <div className="hidden md:block w-3/12 px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                        {vendor.title || vendorDisplayName}
                        {isUnvisited && (
                          <Badge className="bg-red-500 text-white text-xs">New</Badge>
                        )}
                      </div>
                      
                      {/* Description */}
                      <div className="md:w-7/12 px-4 py-2 md:py-3 text-sm text-slate-600">
                        {vendor.content ? (
                          <div className="line-clamp-2" dangerouslySetInnerHTML={{ 
                            __html: vendor.content.replace(/<[^>]*>/g, ' ').substring(0, 200) + '...'
                          }} />
                        ) : (
                          <span className="text-slate-400 italic">No description available</span>
                        )}
                      </div>
                      
                      {/* Action Button */}
                      <div className="md:w-2/12 px-4 pb-3 md:py-3 md:text-right">
                        <Link href={`/vendors/${category.id}/${encodeURIComponent(vendorName)}`}>
                          <Button variant="outline" size="sm" className="w-full md:w-auto">View Details</Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null;
      })}

      {/* Show message if no vendors match search or no vendors available */}
      {searchQuery.trim() && vendorCategories.every(category => {
        const allVendors = vendorsByCategory[category.id] || [];
        const searchLower = searchQuery.toLowerCase().trim();
        const categoryMatches = category.label.toLowerCase().includes(searchLower) ||
          category.id.toLowerCase().includes(searchLower);
        if (categoryMatches && allVendors.length > 0) return false;
        const filtered = allVendors.filter(vendor => 
          vendor.title?.toLowerCase().includes(searchLower) ||
          vendor.slug.toLowerCase().includes(searchLower)
        );
        return filtered.length === 0;
      }) && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <p>No vendors found matching "{searchQuery}". Try a different search term.</p>
          </CardContent>
        </Card>
      )}
      
      {!searchQuery.trim() && vendorCategories.every(category => (vendorsByCategory[category.id] || []).length === 0) && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <p>No vendors are currently available. Please check back later.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};