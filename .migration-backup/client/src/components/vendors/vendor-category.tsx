import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff } from 'lucide-react';
import type { PageContent } from '@shared/schema';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/hooks/use-auth';

interface VendorCategoryPageProps {
  category: string;
}

export const VendorCategoryPage: React.FC<VendorCategoryPageProps> = ({ category }) => {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<PageContent[]>([]);
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const [location] = useLocation();
  
  // Ensure we have a valid category from URL parameters
  // Extract from location if category prop is empty (handles direct URLs like /vendors/pressure-washing)
  const actualCategory = useMemo(() => {
    if (category && category.trim() !== "") {
      return category;
    }
    
    // Extract from URL path if category prop is empty
    // Format should be /vendors/category-name
    const pathParts = location.split('/').filter(Boolean);
    if (pathParts.length >= 2 && pathParts[0] === 'vendors') {
      const extractedCategory = pathParts[1];
      console.log(`Extracted category from URL path: "${extractedCategory}"`);
      return extractedCategory;
    }
    
    return "";
  }, [category, location]);

  // Query for all pages to find vendors in this category
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

  // Filter vendor pages for this category
  useEffect(() => {
    if (!allPages) return;
    
    // Ensure allPages is an array
    if (!Array.isArray(allPages)) {
      console.error("Expected allPages to be an array, but got:", typeof allPages);
      return;
    }
    
    // Log active vendors for debugging
    const vendorPages = allPages.filter(page => page.slug.startsWith('vendors-'));
    console.log("All vendor pages:", vendorPages.map(p => p.slug));
    console.log("Current category:", category);
    console.log("Using actual category:", actualCategory);
    
    // Debug vendors with "pressure-washing" in their slug
    const pressureWashingVendors = vendorPages.filter(page => 
      page.slug.includes('pressure-washing')
    );
    console.log("Pressure washing vendors found:", pressureWashingVendors.map(p => p.slug));
    
    // Find all vendor pages that match the current category
    // Handle different naming patterns for vendor slug formats
    const categoryVendors = allPages.filter(page => {
      const slug = page.slug;
      
      // Basic condition: vendor detail page belonging to this category
      // Must be a vendor page and have at least 3 parts for vendors-category-name
      // Skip the category page itself (which has only 2 parts: vendors-category)
      const parts = slug.split('-');
      
      if (parts.length < 3 || parts[0] !== 'vendors') {
        return false;
      }
      
      // Skip category pages themselves (e.g., vendors-landscaping)
      if (slug === `vendors-${actualCategory}`) {
        return false;
      }
      
      // Match specific patterns for various slug formats, handling spaces in slugs
      const isMatch = (
        // Main format: vendors-category-name (with or without spaces in name)
        slug.startsWith(`vendors-${actualCategory}-`) || // e.g., vendors-landscaping-some-vendor
        
        // Handle vendors with spaces after the main prefix for all categories
        slug.startsWith(`vendors-${actualCategory} `) || // e.g., "vendors-landscaping tst vendor"
        
        // Special case for vendors with spaces in the middle of the slug
        slug.includes(`vendors-${actualCategory}-`) && slug.includes(' ') ||
        
        // Special cases specifically for the known problematic vendors
        (actualCategory === 'landscaping' && (
          slug === 'vendors-landscaping-tst vendor' ||
          slug === 'vendors-landscaping tst vendor'
        )) ||
        
        // Support for 'home-service' and 'home-services' category variants
        (actualCategory === 'home-service' && (
          slug.startsWith('vendors-home-service-') || 
          slug.startsWith('vendors-home-services-') ||
          slug.startsWith('vendors-homeservice-') ||
          slug.startsWith('vendors-homeservices-') ||
          slug.startsWith('vendors-home-service ') || 
          slug.startsWith('vendors-home-services ')
        )) ||
        
        // Handle other way around too
        (actualCategory === 'home-services' && (
          slug.startsWith('vendors-home-service-') || 
          slug.startsWith('vendors-home-services-') ||
          slug.startsWith('vendors-homeservice-') ||
          slug.startsWith('vendors-homeservices-') ||
          slug.startsWith('vendors-home-service ') || 
          slug.startsWith('vendors-home-services ')
        )) ||
        
        // Handle special case where "services-" got incorrectly added to the vendor slug
        // Example: vendors-home-services-services-dan-hess-antiques (should show in home-services category)
        (actualCategory === 'home-services' && slug.startsWith('vendors-home-services-services-')) ||
        
        // Handle general "services-" prefix issues for any category
        (slug.startsWith(`vendors-${actualCategory}-services-`)) ||
        
        // Enhanced slug pattern handling for "and" mismatches 
        // Handle "food-and-dining" pattern matching to "food-dining" category
        (actualCategory === 'food-dining' && (
          slug.startsWith('vendors-food-and-dining-') ||
          slug.startsWith('vendors-food-and-dining ')
        )) ||
        
        // General pattern: Handle any category with "-and-" pattern  
        // Example: "vendors-home-and-services-*" should match "home-services" category
        (slug.startsWith(`vendors-${actualCategory.replace('-', '-and-')}-`)) ||
        (slug.startsWith(`vendors-${actualCategory.replace('-', '-and-')} `))
      );
      
      console.log(`Checking vendor: ${slug}, matches: ${isMatch}`);
      return isMatch;
    });

    console.log(`Found ${categoryVendors.length} vendors for category: ${actualCategory}`);
    setVendors(categoryVendors);
  }, [allPages, category, actualCategory, isAdmin]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Category Table */}
      <div className="rounded-md border shadow-sm overflow-hidden bg-white">
        {/* Table Header */}
        <div className="bg-slate-50 border-b px-4 py-3">
          <h2 className="text-lg font-bold text-slate-800 capitalize">{actualCategory.replace('-', ' ')} Vendors</h2>
        </div>
        
        {/* Table Structure */}
        <div className="w-full">
          {/* Table Header Row */}
          <div className="hidden md:flex w-full text-left border-b bg-gray-50">
            <div className="w-3/12 px-4 py-2 font-medium text-slate-500">Name</div>
            <div className="w-7/12 px-4 py-2 font-medium text-slate-500">Description</div>
            <div className="w-2/12 px-4 py-2 text-right font-medium text-slate-500">Actions</div>
          </div>

          {/* Vendor List Rows */}
          <div className="divide-y divide-gray-200">
            {vendors.length > 0 ? (
              vendors.map(vendor => {
                // Extract vendor name from slug, handling both dash-separated and space formats
                let vendorName;
                
                // Special case for our problem vendors
                if (vendor.slug === 'vendors-landscaping-tst vendor') {
                  // For this specific vendor with the known issue, preserve the original name
                  // This is critical - use the exact "tst vendor" with space to match what's in the URL
                  vendorName = 'tst vendor';
                  console.log(`Special case for problematic vendor: ${vendor.slug} → vendorName: ${vendorName}`);
                } 
                // Special case for the Computer Healthcare in technology-and-electronics
                else if (vendor.slug === 'vendors-technology-and-electronics-computer-healthcare') {
                  // Hard-code the correct vendor name for this problematic one
                  vendorName = 'computer-healthcare';
                  console.log(`Special case for Computer Healthcare vendor: ${vendor.slug} → vendorName: ${vendorName}`);
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
                  
                  // Keep the space format for consistent URL handling
                } else {
                  // Dynamic compound category detection - automatically adapts to new categories
                  // Initialize vendorName with a default value to avoid 'undefined' TS errors
                  vendorName = '';
                  
                  // Dynamically determine if this is a compound category by checking if actualCategory contains hyphens
                  const isCompoundCategory = actualCategory.includes('-');
                  
                  if (isCompoundCategory) {
                    console.log("Processing compound category vendor:", vendor.slug, "actualCategory:", actualCategory);
                    
                    // For compound categories, extract the part after the full compound category
                    const compoundPrefix = `vendors-${actualCategory}-`;
                    if (vendor.slug.startsWith(compoundPrefix)) {
                      vendorName = vendor.slug.substring(compoundPrefix.length);
                      console.log(`Extracted vendorName from compound category: ${vendorName}`);
                    } else {
                      // ROBUST FALLBACK: Handle all types of malformed slugs
                      // Examples to handle:
                      // - "vendors-retail-shops-and-shops-blues-clues-x" → "blues-clues-x"
                      // - "vendors-retail-shops-retail-shops-blues-clues-x" → "blues-clues-x"
                      // - "vendors-retail-shops-shops-blues-clues-x" → "blues-clues-x"
                      
                      const slugParts = vendor.slug.split('-');
                      const categoryParts = actualCategory.split('-'); // ["retail", "shops"]
                      
                      console.log(`Debug: slugParts = [${slugParts.join(', ')}]`);
                      console.log(`Debug: categoryParts = [${categoryParts.join(', ')}]`);
                      
                      // Start after "vendors"
                      let vendorStartIndex = 1;
                      
                      // Method 1: Skip the exact category sequence
                      let categoryMatchIndex = 0;
                      for (let i = 1; i < slugParts.length && categoryMatchIndex < categoryParts.length; i++) {
                        if (slugParts[i] === categoryParts[categoryMatchIndex]) {
                          categoryMatchIndex++;
                          vendorStartIndex = i + 1;
                        } else if (categoryMatchIndex > 0) {
                          // We were matching but broke sequence, reset
                          categoryMatchIndex = 0;
                          if (slugParts[i] === categoryParts[0]) {
                            categoryMatchIndex = 1;
                            vendorStartIndex = i + 1;
                          }
                        }
                      }
                      
                      // Method 2: Skip any remaining individual category words that appear later
                      while (vendorStartIndex < slugParts.length && categoryParts.includes(slugParts[vendorStartIndex])) {
                        console.log(`Skipping duplicate category word: ${slugParts[vendorStartIndex]}`);
                        vendorStartIndex++;
                      }
                      
                      // Method 3: Skip common malformed patterns like "and"
                      if (vendorStartIndex < slugParts.length && slugParts[vendorStartIndex] === 'and') {
                        console.log(`Skipping malformed "and" connector`);
                        vendorStartIndex++;
                        
                        // Skip any category words that come after "and"
                        while (vendorStartIndex < slugParts.length && categoryParts.includes(slugParts[vendorStartIndex])) {
                          console.log(`Skipping category word after "and": ${slugParts[vendorStartIndex]}`);
                          vendorStartIndex++;
                        }
                      }
                      
                      vendorName = slugParts.slice(vendorStartIndex).join('-');
                      console.log(`🔧 Robust extraction: ${vendor.slug} → ${vendorName} (startIndex: ${vendorStartIndex})`);
                    }
                  } else {
                    // Handle normal single-word categories (e.g., "vendors-landscaping-test-vendor")
                    const slugParts = vendor.slug.split('-');
                    vendorName = slugParts.slice(2).join('-');
                    console.log(`Processing simple category: ${actualCategory} → ${vendorName}`);
                  }
                }
                
                console.log(`Processing vendor: ${vendor.slug} → vendorName: ${vendorName}`);
                
                // Format the vendor name for display
                const vendorDisplayName = vendorName
                  .split(/[-\s]/) // Split by both dashes and spaces
                  .map(word => word && word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
                
                // Ensure we don't include category duplications in the URL
                let vendorURLName = vendorName || '';
                
                // Fix for compound categories to avoid duplication in URL
                if (vendorName.startsWith('services-')) {
                  vendorURLName = vendorName.substring('services-'.length);
                }
                
                // Dynamic compound category detection for URL generation
                // Use the same logic as above to determine if this is a compound category
                
                // Dynamic compound category detection for URL generation
                const isCompoundCategoryForURL = actualCategory.includes('-');
                
                // Debug the slug and URL generation
                console.log(`Debug URL generation:`, {
                  slug: vendor.slug,
                  actualCategory,
                  initialVendorURLName: vendorURLName,
                  isCompoundCategory: isCompoundCategoryForURL
                });
                
                if (isCompoundCategoryForURL && vendorURLName.startsWith(`${actualCategory}-`)) {
                  // Remove the compound category prefix + hyphen from the vendorURLName
                  const oldName = vendorURLName;
                  vendorURLName = vendorURLName.substring(actualCategory.length + 1);
                  console.log(`Fixed compound category URL: ${vendor.slug} → from:${oldName} to:${vendorURLName}`);
                }

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
                    <div className="md:hidden px-4 pt-3 font-semibold text-slate-800">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          {vendor.slug === 'vendors-technology-and-electronics-computer-healthcare' ? (
                            <Link href="/vendors/technology-and-electronics/computer-healthcare" className="text-blue-600 hover:underline">
                              Computer Healthcare
                            </Link>
                          ) : (
                            vendor.title || vendorDisplayName
                          )}
                          {isUnvisited && (
                            <Badge className="bg-red-500 text-white text-xs">New</Badge>
                          )}
                        </div>
                        {/* Show "Admin Only" badge for hidden vendors on mobile */}
                        {isAdmin && vendor.isHidden && (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300 w-fit">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Admin Only
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Vendor Name (hidden on mobile, shown on desktop) */}
                    <div className="hidden md:block w-3/12 px-4 py-3 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        {vendor.slug === 'vendors-technology-and-electronics-computer-healthcare' ? (
                          <Link href="/vendors/technology-and-electronics/computer-healthcare" className="text-blue-600 hover:underline">
                            Computer Healthcare
                          </Link>
                        ) : (
                          vendor.title || vendorDisplayName
                        )}
                        {isUnvisited && (
                          <Badge className="bg-red-500 text-white text-xs">New</Badge>
                        )}
                        {/* Show "Admin Only" badge for hidden vendors */}
                        {isAdmin && vendor.isHidden && (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Admin Only
                          </Badge>
                        )}
                      </div>
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
                      {vendor.slug === 'vendors-technology-and-electronics-computer-healthcare' ? (
                        // Special case: Computer Healthcare from Technology & Electronics
                        <Link href="/vendors/technology-and-electronics/computer-healthcare">
                          <Button variant="outline" size="sm" className="w-full md:w-auto">View Details</Button>
                        </Link>
                      ) : (
                        <Link href={`/vendors/${actualCategory}/${encodeURIComponent(vendorURLName)}`}>
                          <Button variant="outline" size="sm" className="w-full md:w-auto">View Details</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500">
                <p>No vendors found in this category</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};