import React, { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditableContent } from "@/components/shared/editable-content";
import { useLocation } from "wouter";
import type { PageContent } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { VendorCategoryPage } from "@/components/vendors/vendor-category";
import { AllVendorsPage } from "@/components/vendors/all-vendors-page";
import { VendorComments } from "@/components/vendors/vendor-comments";
import { VendorLikes } from "@/components/vendors/vendor-likes";
import { CommunityCategoryPage } from "@/components/community/community-category";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ShareButton } from "@/components/shared/share-button";
import { DisclaimerLink } from "@/components/shared/filter-sort-drawer";
import type { DetailsDisclosureState } from "@/lib/details-disclosure-state";

// Need to include RouteComponentProps to properly handle wouter route params
import { RouteComponentProps } from "wouter";

// Base props that may be passed directly 
interface BaseProps {
  slug?: string;
  title?: string;
}

// Props that come from wouter route params
type RouteParams = {
  category?: string;
  page?: string;
  vendor?: string;
}

// Combined props
type GenericContentPageProps = RouteComponentProps<RouteParams> | BaseProps;

export default function GenericContentPage(props: GenericContentPageProps) {
  // Extract params and slug depending on how the component was called
  const params = 'params' in props ? props.params : undefined;
  const propSlug = 'slug' in props ? props.slug : undefined;
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Extract category, page, and vendor from the URL, decode if URL-encoded
  // Get path parts from location
  const pathParts = location.split('/').filter(Boolean);

  // Handle special case for compound categories with dashes (like "home-services")
  let category = params?.category || '';
  let currentPage = params?.page || '';
  let vendorParam = params?.vendor ? decodeURIComponent(params.vendor) : '';

  // If not from route params, extract from URL path
  if (!params) {
    if (pathParts.length >= 1) {
      // First part of path is the section (vendors, community, etc.)
      // For vendors URLs specifically, handle compound categories
      if (pathParts[0] === 'vendors' && pathParts.length >= 2) {
        // Check if we have a compound category like "home-services" or "pest-control"
        // That would be in format /vendors/home-services/vendor-name
        if (pathParts.length >= 3) {
          // If the second path part contains a hyphen, treat it as a compound category
          if (pathParts[1].includes('-')) {
            category = pathParts[1]; // e.g., "home-services", "pest-control"
            vendorParam = pathParts.length >= 3 ? decodeURIComponent(pathParts[2]) : '';
          } else {
            // Handle malformed URLs for compound categories
            if (pathParts.length >= 4) {
              // For cases like /vendors/pest/control/all-county -> should be /vendors/pest-control/all-county
              // Check if parts[1] + "-" + parts[2] might be a compound category
              const potentialCompoundCategory = `${pathParts[1]}-${pathParts[2]}`;
              console.log(`Checking potential compound category: ${potentialCompoundCategory}`);
              
              // Reconstruct as compound category
              category = potentialCompoundCategory;
              vendorParam = pathParts.length >= 4 ? decodeURIComponent(pathParts[3]) : '';
              console.log(`Reconstructed compound category URL: category=${category}, vendor=${vendorParam}`);
            } else if (pathParts.length >= 3) {
              // For cases like /vendors/home/services-vendor-name
              // Reconstruct the proper category if the third part starts with "services-"
              if (pathParts[2].startsWith('services-')) {
                console.log(`Fixing malformed URL: /vendors/${pathParts[1]}/services-*`);
                category = `${pathParts[1]}-services`; // Create compound category like "home-services"
                vendorParam = pathParts[2].substring('services-'.length); // Remove services- prefix
              } 
              // Handle any other compound category with hyphen
              else if (pathParts[2].includes('-') && pathParts[2].split('-')[0] === pathParts[1]) {
                console.log(`Fixing malformed URL with repeated prefix: /vendors/${pathParts[1]}/${pathParts[1]}-*`);
                category = pathParts[2].split('-').slice(0, 2).join('-'); // Take first two parts for category 
                vendorParam = pathParts[2].split('-').slice(2).join('-'); // Rest is vendor name
              } else {
                // Standard single-word category
                category = pathParts[1];
                vendorParam = decodeURIComponent(pathParts[2]);
              }
            } else {
              // Standard single-word category
              category = pathParts[1];
              vendorParam = pathParts.length >= 3 ? decodeURIComponent(pathParts[2]) : '';
            }
          }
        } else {
          // /vendors/category with no vendor
          category = pathParts[1];
        }
      } else {
        // Standard routing
        category = pathParts.length >= 2 ? pathParts[1] : '';
        currentPage = pathParts.length >= 3 ? pathParts[2] : '';
        vendorParam = pathParts.length >= 4 ? decodeURIComponent(pathParts[3]) : '';
      }
    }
  }

  console.log(`🔍 Path analysis: category=${category}, page=${currentPage}, vendor=${vendorParam}`);

  // Track if the content has been loaded initially
  const [hasLoaded, setHasLoaded] = useState(false);

  // Track if content is being edited to prevent cache restoration during edit sessions
  const [isEditing, setIsEditing] = useState(false);

  // REMOVED: persistedVendorContent state - causes stale data issues
  // React Query handles caching naturally without manual intervention

  // Track the last slug we processed to detect navigation changes
  const lastProcessedSlugRef = useRef<string | null>(null);

  // Keep track of title state to prevent flashing old titles during navigation
  const [titleReset, setTitleReset] = useState(false);

  // Extract the slug from the URL path if not provided as a prop
  // Format: /community/category/page -> category-page or /vendors/page -> vendors-page 
  const derivedSlug = propSlug || (() => {
    const pathParts = location.split('/').filter(part => part);

    // Detect navigation to a new page
    const currentPath = location;
    if (lastProcessedSlugRef.current !== currentPath) {
      console.log(`🔄 [GenericContentPage] Path changed from "${lastProcessedSlugRef.current}" to "${currentPath}"`);
      lastProcessedSlugRef.current = currentPath;

      // Reset title state when navigating to a new page
      // This prevents flashing of old titles during navigation
      console.log(`✨ [GenericContentPage] Triggering title reset for navigation to ${currentPath}`);
      setTitleReset(true);
      // Use a longer timeout to ensure the title reset has time to be processed
      setTimeout(() => {
        console.log(`✅ [GenericContentPage] Resetting titleReset flag after navigation`);
        setTitleReset(false);
      }, 200);
    }

    // Log URL parts for debugging
    console.log("URL parts:", pathParts);

    // Handle vendor URL patterns specially
    if (pathParts[0] === 'vendors') {
      // Main vendors page (/vendors)
      if (pathParts.length === 1) {
        console.log("Mapping /vendors to vendors-main slug");
        return 'vendors-main';
      }

      // Vendor category page (/vendors/landscaping)
      if (pathParts.length === 2) {
        console.log(`Mapping /vendors/${pathParts[1]} to vendors-${pathParts[1]} slug`);
        return `vendors-${pathParts[1]}`;
      }

      // Specific vendor page (/vendors/landscaping/test-vendor)
      // This is critical - we need to construct the correct slug
      if (pathParts.length === 3) {
        let vendorName = decodeURIComponent(pathParts[2]); // Decode URL-encoded vendor names
        let categoryPrefix = pathParts[1];

        // Handle undefined vendor names universally for all categories
        if (vendorName === 'undefined') {
          console.log('⚠️ Undefined vendor name detected for category:', categoryPrefix);
          
          // Redirect to vendor category page when vendor name is undefined
          console.log('⚠️ Redirecting to vendor category page due to undefined vendor');
          return `vendors-${categoryPrefix}`;
        }

        // Handle special case for compound categories that weren't properly parsed in the URL
        // If we're at a URL like /vendors/home/services-dan-hess-antiques-estate-sales
        if (!categoryPrefix.includes('-') && vendorName.startsWith('services-')) {
          // This is a case where the category should be "home-services"
          categoryPrefix = `${categoryPrefix}-services`;
          vendorName = vendorName.substring('services-'.length);
          console.log(`🔍 Reconstructed category from services- prefix: category=${categoryPrefix}, vendorName=${vendorName}`);
        }

        // Special handling for technology/and-electronics category
        if (categoryPrefix === 'technology' && (vendorName.startsWith('and-electronics-') || vendorName.startsWith('and-electronics/'))) {
          console.log('🔍 Detected technology/and-electronics compound category path');
          categoryPrefix = 'technology-and-electronics';

          if (vendorName.startsWith('and-electronics-')) {
            vendorName = vendorName.substring('and-electronics-'.length);
          } else if (vendorName.startsWith('and-electronics/')) {
            vendorName = vendorName.substring('and-electronics/'.length);
          }

          console.log(`🔍 Reconstructed technology category: category=${categoryPrefix}, vendorName=${vendorName}`);
        }

        // Apply a general, consistent rule for all vendor pages
        console.log(`🔍 Processing vendor path: category=${categoryPrefix}, vendorName=${vendorName}`);

        // Use database-friendly slug format that consistently follows the format:
        // vendors-[category-slug]-[vendor-name-as-slug]
        const normalizedCategorySlug = categoryPrefix.toLowerCase()
          .replace(/&/g, 'and')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();

        const normalizedVendorNameSlug = vendorName.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();

        const vendorSlug = `vendors-${normalizedCategorySlug}-${normalizedVendorNameSlug}`;
        console.log(`✅ Generated consistent vendor slug: ${vendorSlug}`);
        
        // Pre-fetch the content to ensure it's available
        // This helps avoid refresh issues when redirecting between different slug formats
        try {
          // Check if we already have cached data first
          const cachedContent = queryClient.getQueryData(["/api/pages", vendorSlug]) as PageContent;
          if (cachedContent) {
            console.log(`📌 Using cached data for ${vendorSlug}`);
            return vendorSlug;
          }
            
          // Only pre-fetch if not already cached
          console.log(`🔍 Pre-fetching content for consistent slug: "${vendorSlug}"`);
          fetch(`/api/pages/${encodeURIComponent(vendorSlug)}`)
            .then(res => res.json())
            .then(content => {
              if (content) {
                console.log(`✅ Pre-fetched vendor content for ${vendorSlug}`);
                queryClient.setQueryData(["/api/pages", vendorSlug], content);
              }
            })
            .catch(err => console.error(`Error pre-fetching ${vendorSlug}:`, err));
        } catch (e) {
          console.error(`Error in pre-fetch for ${vendorSlug}:`, e);
        }
        
        return vendorSlug;
      }
    }

    // Handle /community routes (previously /more) for community sections
    if (pathParts[0] === 'community' && pathParts.length >= 3) {
      const slug = `${pathParts[1]}-${pathParts[2]}`;
      console.log(`🔍 Converting /community path to slug: ${slug}`);
      return slug;
    }

    // Legacy support for /more routes - redirect handled in App.tsx, but this is a fallback
    if (pathParts[0] === 'more' && pathParts.length >= 3) {
      const slug = `${pathParts[1]}-${pathParts[2]}`;
      console.log(`🔍 Converting legacy /more path to slug: ${slug}`);
      return slug;
    }

    // Handle additional cases where params might be from wouter route params
    if (params) {
      if (params.vendor && params.category) {
        const decodedVendor = decodeURIComponent(params.vendor);
        const vendorSlug = `vendors-${params.category}-${decodedVendor}`;
        console.log(`Using route params: category=${params.category}, vendor=${decodedVendor}, slug=${vendorSlug}`);
        return vendorSlug;
      }

      if (params.category && params.page) {
        return `${params.category}-${params.page}`;
      }
    }

    // Handle standard /category/page pattern using URL parts
    if (category && currentPage) {
      return `${category}-${currentPage}`;
    }

    // If vendor parameter exists, this is a specific vendor page
    if (vendorParam) {
      console.log(`Using vendor parameter: category=${category}, vendor=${vendorParam}`);
      return `vendors-${category}-${vendorParam}`;
    }

    return pathParts[0] || 'page-not-found';
  })();

  // Keep native contact-disclosure state above EditableContent so a transient
  // loading branch can remove and recreate that child without losing the
  // visitor's first click. Reset naturally when navigation changes the slug.
  const detailsDisclosureStateRef = useRef<{
    slug: string;
    state: DetailsDisclosureState;
  } | null>(null);
  if (
    !detailsDisclosureStateRef.current ||
    detailsDisclosureStateRef.current.slug !== derivedSlug
  ) {
    detailsDisclosureStateRef.current = {
      slug: derivedSlug,
      state: new Map(),
    };
  }

  // Get available pages for this category to display tabs based on the navbar dropdown structure
  const getRelatedPages = useCallback(() => {
    switch (category) {
      case 'government':
        return [
          { id: 'bbrd', label: 'BBRD' },
          { id: 'bot', label: 'BOT' },
          { id: 'restrictions', label: 'Rules' },
          { id: 'budget', label: 'Budget' },
          { id: 'voting', label: 'Voting' }
        ];
      case 'safety':
        return [
          { id: 'contacts', label: 'Important Contacts' },
          { id: 'crime', label: 'Crime' },
          { id: 'pet-rules', label: 'Pet Rules/Safety' }
        ];
      case 'community':
        return [
          { id: 'history', label: 'History' },
          { id: 'demographics', label: 'Demographics' },
          { id: 'snowbirds', label: 'Snowbirds' }
        ];
      case 'services':
        return [
          { id: 'stores', label: 'Local Stores' },
          { id: 'restaurants', label: 'Restaurants' },
          { id: 'hospitals', label: 'Hospitals/Clinics' },
          { id: 'pharmacies', label: 'Pharmacies' },
          { id: 'utilities', label: 'Utilities' },
          { id: 'insurance', label: 'Insurance' },
          { id: 'tattler', label: 'The Tattler' }
        ];
      case 'nature':
        return [
          { id: 'wildlife', label: 'Wildlife/Dangers' },
          { id: 'weather', label: 'Weather' },
          { id: 'beaches', label: 'Beaches' }
        ];
      case 'transportation':
        return [
          { id: 'cart', label: 'Golf Cart Use' },
          { id: 'shuttle', label: 'Shuttle/Bus' },
          { id: 'homestead', label: 'Homestead' }
        ];
      case 'vendors':
        return [
          { id: 'home-services', label: 'Home Services' },
          { id: 'landscaping', label: 'Landscaping' },
          { id: 'contractors', label: 'Contractors' }
        ];
      default:
        return [{ id: currentPage, label: currentPage.charAt(0).toUpperCase() + currentPage.slice(1) }];
    }
  }, [category, currentPage]);

  const relatedPages = getRelatedPages();

  // Generate a title from the slug for default display
  const generateDefaultTitle = useCallback(() => {
    if (!derivedSlug) return 'Page Not Found';

    // Check if we have a matching page in our relatedPages
    const matchingPage = relatedPages.find(page => page.id === currentPage);
    if (matchingPage) {
      return matchingPage.label;
    }

    // Convert something like 'community-history' to 'History of the Community'
    const parts = derivedSlug.split('-');
    if (parts.length >= 2) {
      const category = parts[0];
      const page = parts.slice(1).join(' ');
      return page.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }

    return derivedSlug.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }, [derivedSlug, currentPage, relatedPages]);

  // Query for community categories to get the proper display name
  const { data: communityCategories } = useQuery({
    queryKey: ['/api/community-categories'],
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data: any) => {
      if (!Array.isArray(data)) {
        return [];
      }
      return data;
    },
  });

  // Query for the content
  const { 
    data: content,
    isLoading,
    isError,
    refetch
  } = useQuery<PageContent | null>({
    queryKey: ["/api/pages", derivedSlug],
    queryFn: async () => {
      if (!derivedSlug) return null;

      const response = await fetch(
        `/api/pages/${encodeURIComponent(derivedSlug)}`,
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(
          `Failed to load page content (${response.status} ${response.statusText})`,
        );
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    // Phase 3: Dynamic staleTime based on content type
    staleTime: derivedSlug?.startsWith('vendors-') && derivedSlug.split('-').length >= 3 
      ? 0 // No caching for vendor detail pages to prevent stale data
      : 30000, // 30 second cache for other pages
    gcTime: derivedSlug?.startsWith('vendors-') 
      ? 5 * 60 * 1000 // 5 minutes for vendor pages
      : 30 * 60 * 1000, // 30 minutes for other pages
    retry: 3, // Retry failed requests
    retryDelay: 1000, // Wait 1 second between retries,
    enabled: !!derivedSlug, // Only run the query when we have a valid slug
    placeholderData: (previousData) => previousData, // Keep previous data during refetch to prevent flashing
  });

  // Special effect for vendor pages - handle custom events for version restoration
  useEffect(() => {
    if (!derivedSlug || !derivedSlug.startsWith('vendors-')) return;

    // Handler for editing state changes from the EditableContent component
    const handleVendorEditingStateChanged = (event: CustomEvent) => {
      const { slug, isEditing: newEditingState } = event.detail;

      // Only process events for the current slug
      if (slug === derivedSlug) {
        console.log(`🔄 [GenericContentPage] Vendor editing state changed for ${slug}: ${newEditingState}`);
        setIsEditing(newEditingState);
      }
    };

    const handleVendorContentRefreshed = (event: CustomEvent) => {
      // CRITICAL FIX: Don't refresh content during active editing sessions
      // This prevents overwriting user edits when they're working on the content
      if (isEditing) {
        console.log(`🔒 [GenericContentPage] BLOCKED vendor content refresh during active editing for slug: ${derivedSlug}`);
        return;
      }

      // Check if this is the problematic vendor page that's causing refresh issues
      if (derivedSlug === 'vendors-landscaping-landscaping') {
        console.log(`⚠️ [GenericContentPage] Detected special vendor page ${derivedSlug} - limiting refresh`);

        // Skip automatic refreshes for this problematic page to prevent interference with editing
        if (event.detail.forceRefresh !== true) {
          console.log(`🛑 [GenericContentPage] Blocked auto-refresh for special vendor page ${derivedSlug}`);
          return;
        }
      }

      // Check if this event might be coming from an EditableContent component that's editing
      if (event.detail.isEditing === true) {
        console.log(`🔒 [GenericContentPage] Ignoring refresh during editing session for ${derivedSlug}`);
        return;
      }

      // REMOVED: localStorage cache clearing for image deletions
      // React Query handles cache invalidation naturally

      // Only process if this component's slug matches the refreshed content
      if (event.detail.slug === derivedSlug) {
        console.log(`📢 [GenericContentPage] Received vendor-content-refreshed event for slug: ${derivedSlug}`);

        // Force a direct fetch to get the latest content
        fetch(`/api/pages/${derivedSlug}`)
          .then(response => {
            if (response.ok) return response.json();
            return null;
          })
          .then(freshContent => {
            if (freshContent) {
              console.log(`✅ [GenericContentPage] Got fresh vendor content from API:`, freshContent);

              // Update the React Query cache with this content
              queryClient.setQueryData(["/api/pages", derivedSlug], freshContent);

              // REMOVED: localStorage persistence - React Query handles caching

              // Only force a refetch if it's explicitly requested and not editing
              if (event.detail.forceRefetch !== false && !isEditing) {
                queryClient.invalidateQueries({ queryKey: ["/api/pages", derivedSlug] });
                refetch();
              }
            }
          })
          .catch(err => console.error("Error fetching refreshed vendor content:", err));
      }
    };

    // Add event listeners
    window.addEventListener('vendor-content-refreshed', handleVendorContentRefreshed as EventListener);
    window.addEventListener('vendor-editing-state-changed', handleVendorEditingStateChanged as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('vendor-content-refreshed', handleVendorContentRefreshed as EventListener);
      window.removeEventListener('vendor-editing-state-changed', handleVendorEditingStateChanged as EventListener);
    };
  }, [derivedSlug, queryClient, refetch, isEditing]);

  // REMOVED: Cache restoration - Let React Query handle caching naturally
  // This prevents wrong vendor data from being displayed during navigation

  // REMOVED: localStorage persistence - causes stale data conflicts
  // React Query handles content persistence automatically

  // Track refresh status to prevent loops
  const [isContentRefreshing, setIsContentRefreshing] = useState(false);
  const [isSpecialPageRefreshing, setIsSpecialPageRefreshing] = useState(false);
  const lastRefreshTimestamp = useRef<number>(0);
  const lastSpecialRefreshTimestamp = useRef<number>(0);
  const REFRESH_THROTTLE = 1000; // 1 second throttle to prevent excessive refreshes
  const SPECIAL_REFRESH_THROTTLE = 1000; // 1 second throttle for special pages

  // Listen for content cache refresh events (triggered by EditableContent)
  useEffect(() => {
    const handleContentCacheRefreshed = (event: CustomEvent) => {
      // Check if this event is for our current slug
      if (event.detail && event.detail.slug === derivedSlug) {
        // CRITICAL FIX: Don't refresh content during active editing sessions
        // This prevents overwriting user edits when they're working on the content
        if (isEditing) {
          console.log(`🔒 [GenericContentPage] BLOCKED content refresh during active editing for slug: ${derivedSlug}`);
          return;
        }

        // Prevent refresh loops by checking if we're already refreshing
        if (isContentRefreshing) {
          console.log(`⏭️ [GenericContentPage] Skipping redundant refresh for "${derivedSlug}" - already in progress`);
          return;
        }

        // Throttle refreshes to prevent excessive notifications
        const now = Date.now();
        if (now - lastRefreshTimestamp.current < REFRESH_THROTTLE) {
          console.log(`⏭️ [GenericContentPage] Throttling refresh for "${derivedSlug}" - too frequent`);
          return;
        }

        // Update the timestamp
        lastRefreshTimestamp.current = now;

        console.log(`📢 [GenericContentPage] Received content-cache-refreshed event for "${derivedSlug}"`);
        setIsContentRefreshing(true);

        // Update cache if content is provided in the event
        if (event.detail.content) {
          console.log(`📥 [GenericContentPage] Updating cache with provided content for "${derivedSlug}"`);
          queryClient.setQueryData(["/api/pages", derivedSlug], event.detail.content);
          // Reset the refreshing state after a short delay
          setTimeout(() => setIsContentRefreshing(false), 300);
        } else {
          // Otherwise, force a refetch if requested
          console.log(`🔄 [GenericContentPage] Force refetching content for "${derivedSlug}"`);
          refetch().finally(() => {
            // Reset the refreshing state when done
            setTimeout(() => setIsContentRefreshing(false), 300);
          });
        }
      }
    };

    // Listen for special page update events for nature/amenities pages
    const handleSpecialPageUpdate = (event: CustomEvent) => {
      // CRITICAL FIX: Don't refresh content during active editing sessions
      // This prevents overwriting user edits when they're working on the content
      if (isEditing) {
        console.log(`🔒 [GenericContentPage] BLOCKED special page update during active editing for slug: ${derivedSlug}`);
        return;
      }

      // Prevent refresh loops by checking if we're already refreshing
      if (isSpecialPageRefreshing || isContentRefreshing) {
        console.log(`⏭️ [GenericContentPage] Skipping special page update - refresh already in progress`);
        return;
      }

      // Throttle refreshes to prevent excessive notifications
      const now = Date.now();
      if (now - lastSpecialRefreshTimestamp.current < SPECIAL_REFRESH_THROTTLE) {
        console.log(`⏭️ [GenericContentPage] Throttling special page update - too frequent`);
        return;
      }

      // Update the timestamp
      lastSpecialRefreshTimestamp.current = now;

      // Debug log all special page update events
      console.log(`🌿 [GenericContentPage] Received special-page-update event:`, {
        eventSlug: event.detail?.slug,
        currentDerivedSlug: derivedSlug,
        currentPath: location,
        detail: event.detail
      });

      // For /more routes with nature-* or amenities-* slugs, ensure proper updates
      if (event.detail && event.detail.slug &&
          (event.detail.slug.startsWith('nature-') || event.detail.slug.startsWith('amenities-'))) {

        setIsSpecialPageRefreshing(true);

        // Extract the category and page from the slug (e.g., "nature-beaches" -> ["nature", "beaches"])
        const slugParts = event.detail.slug.split('-');
        const slugCategory = slugParts[0]; // "nature" or "amenities"

        // Get the current URL parts
        const urlParts = location.split('/').filter(Boolean);
        console.log(`🔍 [GenericContentPage] Current URL parts:`, urlParts);
        // CASE 1: Direct slug match - highest priority
        if (derivedSlug === event.detail.slug) {
          console.log(`[GenericContentPage] Direct slug match for "${derivedSlug}"`);

          // Update the cache with the updated content
          if (event.detail.content) {
            console.log(`📥 [GenericContentPage] Updating cache with provided content for "${derivedSlug}"`);
            queryClient.setQueryData(["/api/pages", derivedSlug], event.detail.content);

            // Reset the refreshing status after a delay
            setTimeout(() => setIsSpecialPageRefreshing(false), 300);
            return;
          }

          // Always force a refetch after cache update to ensure fresh content
          console.log(`🔄 [GenericContentPage] Invalidating cache and refetching for "${derivedSlug}"`);
          queryClient.invalidateQueries({ queryKey: ["/api/pages", derivedSlug] });
          refetch().finally(() => {
            // Reset the refreshing flag when done
            setTimeout(() => setIsSpecialPageRefreshing(false), 300);
          });
          return;
        }

        // CASE 2: We're on a /community/nature or /community/amenities route - check if category matches
        if ((urlParts[0] === 'community' || urlParts[0] === 'more') && urlParts[1] === slugCategory) {
          console.log(`🌿 [GenericContentPage] On a /${urlParts[0]}/${slugCategory} route, checking for category match`);

          // We need to update the navigation menus since they show all pages in this category
          queryClient.invalidateQueries({ queryKey: ["/api/pages"] });

          // If we're showing the exact page being updated
          if (urlParts.length > 2) {
            // If we're showing a specific page (e.g., /community/nature/beaches)
            const currentPageSlug = `${slugCategory}-${urlParts[2]}`;

            if (currentPageSlug === event.detail.slug) {
              console.log(`✅ [GenericContentPage] Match found for current page: ${currentPageSlug}`);

              // Update the cache with the updated content
              if (event.detail.content) {
                queryClient.setQueryData(["/api/pages", currentPageSlug], event.detail.content);

                // Reset the refreshing status after a delay
                setTimeout(() => setIsSpecialPageRefreshing(false), 300);
                return;
              }

              // Force a refetch to ensure fresh content
              queryClient.invalidateQueries({ queryKey: ["/api/pages", currentPageSlug] });
              refetch().finally(() => {
                // Reset the refreshing flag when done
                setTimeout(() => setIsSpecialPageRefreshing(false), 300);
              });
              return;
            }
          }
        }

        // Reset refreshing flag for cases that didn't match
        setIsSpecialPageRefreshing(false);
      }
    };

    // Add event listeners
    window.addEventListener('content-cache-refreshed', handleContentCacheRefreshed as EventListener);
    window.addEventListener('special-page-update', handleSpecialPageUpdate as EventListener);

    // Clean up
    return () => {
      window.removeEventListener('content-cache-refreshed', handleContentCacheRefreshed as EventListener);
      window.removeEventListener('special-page-update', handleSpecialPageUpdate as EventListener);
    };
  }, [derivedSlug, queryClient, refetch, location, isContentRefreshing, isSpecialPageRefreshing, isEditing]);

  // Clear any cached queries when derivedSlug changes
  // This is critical to prevent the issue with stale content between page switches
  useEffect(() => {
    console.log(`🔄 [GenericContentPage] Slug changed to "${derivedSlug}"`);

    // Skip if no slug is defined
    if (!derivedSlug) return;

    // CRITICAL FIX: Immediately clear the cache for the current slug to prevent stale content flash
    // This ensures we don't briefly show outdated content from a previous navigation
    queryClient.removeQueries({ queryKey: ["/api/pages", derivedSlug] });

    // Reset version history access flag across components using a custom event
    // This fixes the issue where version history content briefly shows before current content
    const resetVersionHistoryEvent = new CustomEvent('reset-version-history', {
      detail: { slug: derivedSlug }
    });
    window.dispatchEvent(resetVersionHistoryEvent);

    // Special handling for legal pages to ensure content is properly displayed
    if (derivedSlug === "terms-and-agreements" || derivedSlug === "privacy-policy") {
      console.log(`📜 [GenericContentPage] Handling legal page: ${derivedSlug}`);

      // Force prefetch the content to ensure it's in cache with proper slug
      fetch(`/api/pages/${derivedSlug}`)
        .then(res => res.json())
        .then(content => {
          if (content) {
            console.log(`✅ [GenericContentPage] Got legal page content for ${derivedSlug}:`, content);
            // Ensure the slug is explicitly set
            const enhancedContent = {
              ...content,
              slug: derivedSlug // Enforce the correct slug
            };
            // Update the cache with enhanced content
            queryClient.setQueryData(["/api/pages", derivedSlug], enhancedContent);

            // Dispatch an event to notify components about the updated content
            const contentRefreshEvent = new CustomEvent('content-cache-refreshed', {
              detail: { 
                slug: derivedSlug,
                content: enhancedContent
              }
            });
            window.dispatchEvent(contentRefreshEvent);
          }
        })
        .catch(err => console.error(`Error fetching legal page content for ${derivedSlug}:`, err));
    }

    // Clear caches for community pages with similar patterns to prevent cross-contamination
    if (derivedSlug.includes('-') && 
        (derivedSlug.startsWith('government-') || 
         derivedSlug.startsWith('safety-') || 
         derivedSlug.startsWith('community-') || 
         derivedSlug.startsWith('services-') ||
         derivedSlug.startsWith('nature-') ||
         derivedSlug.startsWith('transportation-'))) {
      const categoryPrefix = derivedSlug.split('-')[0]; // Get 'government', 'safety', etc.
      console.log(`🧹 [GenericContentPage] Cleaning cache for ${categoryPrefix}* to prevent stale data`);
      queryClient.removeQueries({ predicate: (query) => {
        // Only remove queries that match the old category prefix but aren't the current slug
        const queryKey = query.queryKey;
        if (Array.isArray(queryKey) && queryKey.length >= 2 && typeof queryKey[1] === 'string') {
          return queryKey[1].startsWith(`${categoryPrefix}-`) && queryKey[1] !== derivedSlug;
        }
        return false;
      }});

      // Also force clear any content versions cache that might be lingering
      if (Array.isArray(queryClient.getQueryData(['content-versions-by-slug', derivedSlug]))) {
        console.log(`🧹 [GenericContentPage] Clearing content versions cache for ${derivedSlug}`);
        queryClient.removeQueries({ queryKey: ['content-versions-by-slug', derivedSlug] });
      }
    }

    // Skip auto-refresh for the problematic vendors-landscaping-landscaping page
    if (derivedSlug === 'vendors-landscaping-landscaping') {
      console.log(`🔒 [GenericContentPage] Skipping auto-refresh for special vendor page ${derivedSlug}`);
      // REMOVED: Fallback to persisted content - using React Query cache only
      return;
    }
    
    // Enhanced approach for all vendor pages - Phase 2: React Query invalidation
    if (derivedSlug.startsWith('vendors-') && derivedSlug.split('-').length >= 3) {
      console.log(`⚡ [GenericContentPage] Phase 2 cache invalidation for vendor page: ${derivedSlug}`);
      
      // Step 1: Clear potentially stale vendor cache entries
      queryClient.removeQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          if (Array.isArray(queryKey) && queryKey.length >= 2 && typeof queryKey[1] === 'string') {
            // Remove other vendor pages in same category to prevent cross-contamination
            const currentCategory = derivedSlug.split('-')[1]; // e.g., 'food-and-dining'
            const querySlug = queryKey[1];
            return querySlug.startsWith('vendors-') && 
                   querySlug.includes(currentCategory) && 
                   querySlug !== derivedSlug;
          }
          return false;
        }
      });

      // Step 2: Invalidate current query to force fresh fetch
      queryClient.invalidateQueries({ queryKey: ["/api/pages", derivedSlug] });
      
      // Step 3: Force immediate refetch with cache bypassing
      refetch();
      
      console.log(`✅ [GenericContentPage] Phase 2 invalidation complete for ${derivedSlug}`);
      return;
    }

    // Create a function that handles the forced refetch in a controlled way
    const forceRefetch = () => {
      console.log(`Debug: Force refetching content for slug "${derivedSlug}"`);

      // Check if we have persisted content to use
      // REMOVED: persistedVendorContent fallback - relying on React Query cache

      // Only invalidate the specific slug query, not all page queries
      queryClient.invalidateQueries({ queryKey: ["/api/pages", derivedSlug] });

      // Finally, trigger the refetch to get the latest data
      refetch();
    };

    // Set a short initial delay for component mount
    const initialTimer = setTimeout(forceRefetch, 100);

    // Only use visibility change handler for initial page load, not for editing workflows
    // This prevents content from being refreshed unexpectedly during editing
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !hasLoaded) {
        console.log("Page became visible for first time, loading initial content");
        forceRefetch();
        setHasLoaded(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [derivedSlug, queryClient, refetch, hasLoaded]);

  // Track vendor page visits for individual vendor pages
  useEffect(() => {
    // Only track for vendor detail pages (vendors- with at least 3 parts in slug)
    const isVendorDetail = derivedSlug && 
      derivedSlug.startsWith('vendors-') && 
      derivedSlug.split('-').length >= 3;

    if (isVendorDetail && content && user) {
      console.log(`🔖 [VENDOR PAGE VISIT] Tracking visit to vendor page: ${derivedSlug}`);
      
      // Mark this vendor page as visited
      fetch(`/api/vendors/mark-visited/${encodeURIComponent(derivedSlug)}`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(response => {
          if (response.ok) {
            console.log(`✅ [VENDOR PAGE VISIT] Successfully marked ${derivedSlug} as visited`);
            // Invalidate the unvisited vendors query to update UI
            queryClient.invalidateQueries({ queryKey: ['/api/vendors/unvisited'] });
          } else {
            console.error(`❌ [VENDOR PAGE VISIT] Failed to mark ${derivedSlug} as visited`);
          }
        })
        .catch(error => {
          console.error(`❌ [VENDOR PAGE VISIT] Error marking vendor as visited:`, error);
        });
    }
  }, [derivedSlug, content, user, queryClient]);

  // Determine if this is a vendor category page without a specific vendor
  const isVendorCategoryPage = 
    location.startsWith('/vendors/') && 
    location.split('/').filter(Boolean).length === 2 && 
    !vendorParam && 
    category !== 'main';

  // Determine if this is the main vendors page
  const isMainVendorsPage = 
    location === '/vendors' || 
    (location.startsWith('/vendors') && location.split('/').filter(Boolean).length === 1);

  // Determine if this is a specific vendor detail page
  const isVendorDetailPage =
    location.startsWith('/vendors/') &&
    location.split('/').filter(Boolean).length === 3 &&
    derivedSlug.startsWith('vendors-');

  // Determine if this is a community category page (like /community/government)
  const isCommunityCategoryPage =
    location.startsWith('/community/') &&
    location.split('/').filter(Boolean).length === 2 &&
    !currentPage;

  console.log(`Page type: isVendorCategoryPage=${isVendorCategoryPage}, isMainVendorsPage=${isMainVendorsPage}, isVendorDetailPage=${isVendorDetailPage}, isCommunityCategoryPage=${isCommunityCategoryPage}, category=${category}`);

  // CRITICAL FIX: Prevent phantom vendor pages from being displayed
  // For vendor detail pages, if no content exists after loading, show 404 instead of creating phantom pages
  if (isVendorDetailPage && !isLoading && !content && !isError) {
    console.log(`🚫 [GenericContentPage] Vendor page "${derivedSlug}" not found in database - preventing phantom page creation`);
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden bg-white">
          <CardContent className="p-6 text-center">
            <h1 className="text-3xl font-bold mb-4 text-slate-800">Vendor Not Found</h1>
            <p className="text-gray-600 mb-6">
              The vendor page you're looking for doesn't exist.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">This might happen if:</p>
              <ul className="text-sm text-gray-500 list-disc list-inside space-y-1">
                <li>The vendor page was moved or removed</li>
                <li>There's a typo in the URL</li>
                <li>The vendor hasn't been added to our directory yet</li>
              </ul>
            </div>
            <div className="mt-6">
              <Link href="/vendors" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Browse All Vendors
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state for initial content fetch to prevent 404 flashing
  if (isLoading && !content) {
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden bg-white">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="h-24 bg-gray-200 rounded"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if this is a hidden vendor page and user is admin
  const isAdmin = user?.role === 'admin';
  const isHiddenVendorPage = isVendorDetailPage && content?.isHidden && isAdmin;

  return (
    <div className="space-y-6">
      {/* Admin-only notice for hidden vendor pages */}
      {isHiddenVendorPage && (
        <Alert className="border-orange-200 bg-orange-50">
          <EyeOff className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">
                Admin Only
              </Badge>
              <span>This vendor page is hidden from public view and only visible to administrators.</span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Secondary navigation menu removed as requested */}

      <Card className="overflow-hidden bg-white">
        <CardContent className="p-6">
          {isMainVendorsPage ? (
            <>
              <h1 className="text-3xl font-bold mb-6 text-slate-800">
                Barefoot Bay Preferred Vendors
              </h1>
              
              {/* Compact disclaimer links */}
              <div className="flex flex-wrap gap-4 -mt-4 mb-6">
                <Dialog>
                  <DialogTrigger asChild>
                    <DisclaimerLink label="User Disclaimer" data-testid="link-user-disclaimer" />
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto p-4 sm:p-6 mt-4">
                    <DialogHeader className="pb-2">
                      <DialogTitle className="text-base sm:text-lg font-semibold">User Disclaimer</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        These vendors have supported The Tattler newspaper and have provided quality services to the Barefoot Bay community. The vendors included in this list must have a proven track record of quality service, reliability, and be recommended by multiple community residents to be considered.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <DisclaimerLink label="Vendor Disclaimer" data-testid="link-vendor-disclaimer" />
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto p-4 sm:p-6 mt-4">
                    <DialogHeader className="pb-2">
                      <DialogTitle className="text-base sm:text-lg font-semibold">Vendor Disclaimer</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        You can be included in this exclusive list by contacting The Tattler newspaper, emailing team@barefootbay.com, or by messaging Rob Allan (ADMIN) on this platform.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <AllVendorsPage />
            </>
          ) : isVendorCategoryPage ? (
            <>
              <h1 className="text-3xl font-bold mb-6 text-slate-800">
                {generateDefaultTitle()}
              </h1>
              <p className="mb-6 text-gray-600">
                Browse {generateDefaultTitle()} vendors available to Barefoot Bay residents.
              </p>
              <VendorCategoryPage category={currentPage} />
            </>
          ) : isCommunityCategoryPage ? (
            <>
              {(() => {
                // Find the matching community category from the database
                const matchingCategory = communityCategories?.find((cat: any) => 
                  cat.slug.startsWith(category) || cat.slug.split('-')[0] === category
                );
                
                // Use the category name from database, or fall back to capitalizing the slug
                const categoryTitle = matchingCategory?.name || 
                  (category.charAt(0).toUpperCase() + category.slice(1));
                
                return (
                  <>
                    <h1 className="text-3xl font-bold mb-6 text-slate-800">
                      {categoryTitle}
                    </h1>
                    <p className="mb-6 text-gray-600">
                      Browse {categoryTitle} available to Barefoot Bay residents.
                    </p>
                  </>
                );
              })()}
              <CommunityCategoryPage category={category} />
            </>
          ) : (
            <EditableContent
              slug={derivedSlug}
              content={content ?? undefined}
              defaultTitle={generateDefaultTitle()}
              defaultContent={``}
              detailsDisclosureState={detailsDisclosureStateRef.current.state}
              // Pass the titleReset flag to EditableContent to prevent title flashing
              titleReset={titleReset}
            />
          )}
        </CardContent>
      </Card>

      {/* Share Button - Available for vendor and community pages with content */}
      {content && !isMainVendorsPage && !isVendorCategoryPage && !isCommunityCategoryPage && (
        <div className="flex justify-center sm:justify-start">
          <ShareButton
            title={content.title || generateDefaultTitle()}
            text={`Check out this page: ${content.title || generateDefaultTitle()}`}
            url={window.location.href}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            buttonText={isVendorDetailPage ? "Share Vendor" : "Share Page"}
            dialogTitle={isVendorDetailPage ? "Share Vendor" : "Share Page"}
            dialogDescription={isVendorDetailPage ? "Share this vendor with your friends and community" : "Share this page with your friends and community"}
          />
        </div>
      )}

      {/* Render Vendor Likes and Comments only on vendor detail pages */}
      {isVendorDetailPage && (
        <div className="space-y-6">
          {/* Vendor Likes Section */}
          <VendorLikes pageSlug={derivedSlug} />

          {/* Vendor Comments Section */}
          <VendorComments pageSlug={derivedSlug} />
        </div>
      )}
    </div>
  );
}