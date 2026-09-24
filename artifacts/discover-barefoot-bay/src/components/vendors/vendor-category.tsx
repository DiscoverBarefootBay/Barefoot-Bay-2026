import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';
import type { PageContent, VendorCategory } from '@shared/schema';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/hooks/use-auth';
import {
  VendorBrowse,
  vendorDescriptionSnippet,
  vendorFirstImage,
  type VendorItem,
} from './vendor-browse';

interface VendorCategoryPageProps {
  category: string;
}

export const VendorCategoryPage: React.FC<VendorCategoryPageProps> = ({ category }) => {
  const [vendors, setVendors] = useState<PageContent[]>([]);
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  
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
      return pathParts[1];
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

  // Fetch vendor categories so the toolbar dropdown can navigate between them
  const { data: dbCategories } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories'],
    queryFn: async () => {
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

  const vendorCategories = useMemo(
    () =>
      (dbCategories ?? [])
        .filter(cat => isAdmin || !cat.isHidden)
        .map(cat => ({ slug: cat.slug, label: cat.name })),
    [dbCategories, isAdmin],
  );

  const categoryLabel = useMemo(() => {
    const match = vendorCategories.find(cat => cat.slug === actualCategory);
    if (match) return match.label;
    // Fallback: title-case the slug
    return actualCategory
      .split('-')
      .map(word => word && word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [vendorCategories, actualCategory]);

  // Filter vendor pages for this category
  useEffect(() => {
    if (!allPages) return;
    
    // Ensure allPages is an array
    if (!Array.isArray(allPages)) {
      console.error("Expected allPages to be an array, but got:", typeof allPages);
      return;
    }
    
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
      
      return isMatch;
    });

    setVendors(categoryVendors);
  }, [allPages, category, actualCategory, isAdmin]);

  // Map the matched pages to browse items (name/URL extraction preserved from
  // the previous table layout)
  const vendorItems = useMemo<VendorItem[]>(() => {
    return vendors.map(vendor => {
      // Extract vendor name from slug, handling both dash-separated and space formats
      let vendorName: string;
      
      // Special case for our problem vendors
      if (vendor.slug === 'vendors-landscaping-tst vendor') {
        vendorName = 'tst vendor';
      } 
      // Special case for the Computer Healthcare in technology-and-electronics
      else if (vendor.slug === 'vendors-technology-and-electronics-computer-healthcare') {
        vendorName = 'computer-healthcare';
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
        // Dynamic compound category detection - automatically adapts to new categories
        vendorName = '';
        
        // Dynamically determine if this is a compound category by checking if actualCategory contains hyphens
        const isCompoundCategory = actualCategory.includes('-');
        
        if (isCompoundCategory) {
          // For compound categories, extract the part after the full compound category
          const compoundPrefix = `vendors-${actualCategory}-`;
          if (vendor.slug.startsWith(compoundPrefix)) {
            vendorName = vendor.slug.substring(compoundPrefix.length);
          } else {
            // ROBUST FALLBACK: Handle all types of malformed slugs
            // Examples to handle:
            // - "vendors-retail-shops-and-shops-blues-clues-x" → "blues-clues-x"
            // - "vendors-retail-shops-retail-shops-blues-clues-x" → "blues-clues-x"
            // - "vendors-retail-shops-shops-blues-clues-x" → "blues-clues-x"
            
            const slugParts = vendor.slug.split('-');
            const categoryParts = actualCategory.split('-'); // ["retail", "shops"]
            
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
              vendorStartIndex++;
            }
            
            // Method 3: Skip common malformed patterns like "and"
            if (vendorStartIndex < slugParts.length && slugParts[vendorStartIndex] === 'and') {
              vendorStartIndex++;
              
              // Skip any category words that come after "and"
              while (vendorStartIndex < slugParts.length && categoryParts.includes(slugParts[vendorStartIndex])) {
                vendorStartIndex++;
              }
            }
            
            vendorName = slugParts.slice(vendorStartIndex).join('-');
          }
        } else {
          // Handle normal single-word categories (e.g., "vendors-landscaping-test-vendor")
          const slugParts = vendor.slug.split('-');
          vendorName = slugParts.slice(2).join('-');
        }
      }
      
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
      const isCompoundCategoryForURL = actualCategory.includes('-');
      
      if (isCompoundCategoryForURL && vendorURLName.startsWith(`${actualCategory}-`)) {
        // Remove the compound category prefix + hyphen from the vendorURLName
        vendorURLName = vendorURLName.substring(actualCategory.length + 1);
      }

      // Special case: Computer Healthcare from Technology & Electronics
      const href = vendor.slug === 'vendors-technology-and-electronics-computer-healthcare'
        ? '/vendors/technology-and-electronics/computer-healthcare'
        : `/vendors/${actualCategory}/${encodeURIComponent(vendorURLName)}`;

      return {
        slug: vendor.slug,
        title: vendor.slug === 'vendors-technology-and-electronics-computer-healthcare'
          ? 'Computer Healthcare'
          : (vendor.title || vendorDisplayName),
        description: vendorDescriptionSnippet(vendor.content),
        href,
        image: vendorFirstImage(vendor.content),
        categorySlug: actualCategory,
        categoryLabel,
        isUnvisited: !!(user && unvisitedSlugs.has(vendor.slug)),
        isHidden: !!vendor.isHidden,
        createdAt: vendor.createdAt ?? null,
        contentVisibility: (vendor as any).contentVisibility,
      };
    });
  }, [vendors, actualCategory, categoryLabel, user, unvisitedSlugs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[130px] rounded-xl" />
        <Skeleton className="h-[130px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-navy capitalize">{categoryLabel} Vendors</h2>
      <VendorBrowse
        vendors={vendorItems}
        categories={vendorCategories}
        selectedCategorySlug={actualCategory}
        onCategoryChange={(slug) => {
          navigate(slug ? `/vendors/${slug}` : '/vendors');
        }}
        showAdminBadge={isAdmin}
      />
    </div>
  );
};
