import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

export type ContentVersion = {
  id: number;
  contentId: number;
  title: string;
  content: string;
  versionNumber: number;
  createdAt: Date;
  createdBy: number;
  slug?: string; // Adding slug to make version restoration more robust
};

export function useContentVersions(contentId?: number, slug?: string) {
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);
  const [restoredVersion, setRestoredVersion] = useState<ContentVersion | null>(null);
  
  // Track if a restoration is in progress
  const [restorationInProgress, setRestorationInProgress] = useState(false);
  
  // Keep references to track changes in contentId and slug
  const previousContentIdRef = useRef<number | undefined>(contentId);
  const previousSlugRef = useRef<string | undefined>(slug);
  
  // Reset selected version when slug or contentId changes
  useEffect(() => {
    // Check if the content identifier has changed
    if (
      (contentId !== previousContentIdRef.current && previousContentIdRef.current !== undefined) || 
      (slug !== previousSlugRef.current && previousSlugRef.current !== undefined)
    ) {
      console.log(`🔄 [useContentVersions] Content identifier changed, resetting state: 
        contentId: ${previousContentIdRef.current} -> ${contentId}
        slug: ${previousSlugRef.current} -> ${slug}`);
      
      // Reset state when navigating between different contents
      setSelectedVersion(null);
      setRestoredVersion(null);
      setRestorationInProgress(false);
    }
    
    // Update refs for next comparison
    previousContentIdRef.current = contentId;
    previousSlugRef.current = slug;
  }, [contentId, slug]);
  
  // Helper function to prefetch content
  const prefetchContent = useCallback(async (contentSlug: string) => {
    try {
      console.log(`🔍 Prefetching content for ${contentSlug}`);
      await queryClient.prefetchQuery({
        queryKey: ['/api/pages', contentSlug],
        queryFn: getQueryFn<any>({ on401: 'returnNull' }),
      });
      console.log(`✅ Successfully prefetched content for ${contentSlug}`);
    } catch (e) {
      console.error(`❌ Failed to prefetch content for ${contentSlug}:`, e);
    }
  }, [queryClient]);
  
  // Define a more targeted refresh function that avoids overly aggressive cache-clearing
  const forceContentRefresh = useCallback((options?: { 
    preserveSelected?: boolean,
    restoredData?: any 
  }) => {
    console.log("🔄 Performing targeted content refresh");
    
    // Clear selected version unless preserveSelected is true
    if (!options?.preserveSelected) {
      setSelectedVersion(null);
    }
    
    // If we have restored data, update the cache immediately
    if (options?.restoredData) {
      const targetSlug = options.restoredData.slug;
      if (targetSlug) {
        console.log(`📝 Directly updating cache for ${targetSlug} with restored data`);
        queryClient.setQueryData(['/api/pages', targetSlug], options.restoredData);
      }
    }
    
    // Only invalidate specific queries instead of clearing entire cache
    console.log("🔄 Invalidating specific content queries");
    
    // Determine all the keys to invalidate and forcefully refetch
    const keys = [
      // Version history queries
      ['content-versions', contentId],
      ['content-versions-by-slug', slug],
      
      // Original slug format queries
      ['page', slug],
      ['/api/pages', slug],
      
      // Also invalidate base queries
      ['/api/pages']
    ];
    
    // Add contentId-based queries if applicable
    if (contentId) {
      keys.push(['page', contentId]);
      keys.push(['/api/pages', contentId]);
    }
    
    // Add hash-equivalent queries for backward compatibility
    if (slug && slug.includes('-')) {
      const hashSlug = slug.replace('-', '#');
      keys.push(['/api/pages', hashSlug]);
    }
    
    // Aggressively try all permutations of the slug
    if (slug) {
      // Try with/without dashes
      const altSlug = slug.includes('-') ? slug.replace(/-/g, '') : slug;
      keys.push(['/api/pages', altSlug]);
      
      // Try parent slugs (for section-specific content)
      if (slug.includes('-')) {
        const baseSlug = slug.split('-')[0];
        keys.push(['/api/pages', baseSlug]);
      }
    }
    
    // Force immediate refetches of all data
    console.log(`🔄 Force refetching ${keys.length} query keys`);
    
    // First invalidate everything
    keys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
      // Also try to force fetch each key
      try {
        queryClient.fetchQuery({ queryKey: key });
      } catch (e) {
        console.log(`Note: Could not pre-fetch ${key}, will rely on component queries`);
      }
    });
    
    // Add more explicit fetches for the most critical data
    console.log(`📊 Explicitly refetching primary content data`);
    
    // Force all page content refetch
    queryClient.fetchQuery({ queryKey: ['/api/pages'] })
      .catch(e => console.log('All pages refresh error (non-critical):', e));
    
    // Force specific content refetch if we have a slug
    if (slug) {
      queryClient.fetchQuery({ queryKey: ['/api/pages', slug] })
        .catch(e => console.log(`Slug content refresh error (will retry): ${e.message}`));
    }
    
    // Force versions refetch if we have a content ID
    if (contentId) {
      queryClient.fetchQuery({ queryKey: ['content-versions', contentId] })
        .catch(e => console.log('Content versions refresh error (non-critical):', e));
    }
    
    // Do double refresh with a delay for versions by slug
    if (slug) {
      queryClient.fetchQuery({ queryKey: ['content-versions-by-slug', slug] })
        .catch(e => console.log('Slug versions refresh error (non-critical):', e));
      
      // Try a secondary refresh after a small delay
      setTimeout(() => {
        console.log('Secondary refresh for slug content');
        queryClient.fetchQuery({ queryKey: ['/api/pages', slug] })
          .catch(e => console.log('Secondary slug content refresh error (non-critical):', e));
      }, 300);
    }
    
    // Instead of forcing a window reload, use a controlled approach
    console.log('🔃 Using controlled cache refresh instead of full page reload');
    
    setTimeout(() => {
      console.log('Pre-refresh: Targeted cache invalidation');
      
      // Only invalidate the specific content queries we need, not the entire cache
      if (slug) {
        queryClient.invalidateQueries({ queryKey: ['/api/pages', slug] });
        queryClient.invalidateQueries({ queryKey: ['content-versions-by-slug', slug] });
        queryClient.refetchQueries({ queryKey: ['/api/pages', slug] });
      }
      
      if (contentId) {
        queryClient.invalidateQueries({ queryKey: ['content-versions', contentId] });
        queryClient.refetchQueries({ queryKey: ['content-versions', contentId] });
      }
      
      // Dispatch a custom event that components can listen for
      const contentRefreshEvent = new CustomEvent('content-cache-refreshed', {
        detail: { slug, contentId }
      });
      window.dispatchEvent(contentRefreshEvent);
      
      console.log('🔄 Targeted cache refresh complete, dispatched content-cache-refreshed event');
    }, 500);
  }, [contentId, slug, queryClient, setSelectedVersion]);
  
  // Query versions by content ID (when editing an existing page)
  const {
    data: versions = [],
    isLoading: isLoadingVersions,
    error: versionsError,
  } = useQuery({
    queryKey: ['content-versions', contentId],
    queryFn: async () => {
      if (!contentId || !isAdmin) return [];
      try {
        const response = await apiRequest('GET', `/api/content-versions/${contentId}`);
        if (response.ok) {
          const data = await response.json();
          return data as ContentVersion[];
        }
        return [];
      } catch (error) {
        console.error('Error fetching content versions:', error);
        return [];
      }
    },
    enabled: !!contentId && isAdmin,
    staleTime: 0, // Always refetch for latest versions
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  // Query versions by slug (when creating or editing a page with a known slug)
  const {
    data: versionsBySlug = [],
    isLoading: isLoadingBySlug,
    error: slugVersionsError,
  } = useQuery({
    queryKey: ['content-versions-by-slug', slug],
    queryFn: async () => {
      if (!slug || !isAdmin) return [];
      try {
        console.log(`Debug: Making GET request to /api/content-versions/by-slug/${slug} with data:`, null);
        const response = await apiRequest('GET', `/api/content-versions/by-slug/${slug}`);
        if (response.ok) {
          const data = await response.json();
          return data as ContentVersion[];
        }
        return [];
      } catch (error) {
        console.error('Error fetching content versions by slug:', error);
        return [];
      }
    },
    enabled: !!slug && isAdmin,
    staleTime: 0, // Always refetch for latest versions
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  // Mutation to restore a specific version
  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      if (!isAdmin) throw new Error('Only administrators can restore content versions');
      
      console.log(`🔄 Making POST request to /api/content-versions/${versionId}/restore to restore content version`);
      const response = await apiRequest('POST', `/api/content-versions/${versionId}/restore`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to restore version');
      }
      return await response.json();
    },
    onSuccess: (restoredContent) => {
      console.log('✅ Restoration successful, received:', restoredContent);
      
      // Store the restored content in React Query cache immediately
      if (restoredContent && restoredContent.slug) {
        console.log(`📥 Updating React Query cache with restored content for slug: ${restoredContent.slug}`);
        queryClient.setQueryData(["/api/pages", restoredContent.slug], restoredContent);
      }
      
      // Enhanced handling for vendors with complex slug patterns
      const isVendorPage = restoredContent.slug && restoredContent.slug.startsWith('vendors-');
      
      if (isVendorPage) {
        console.log(`🔄 Enhanced special handling for vendor page: ${restoredContent.slug}`);
        
        // For vendor pages, trigger a direct fetch to ensure we get the most up-to-date content
        prefetchContent(restoredContent.slug);
        
        // Parse vendor information from the slug
        const parts = restoredContent.slug.split('-');
        
        if (parts.length >= 3) {
          const category = parts[1]; // e.g. "home-services"
          const vendorNameParts = parts.slice(2); // The rest of the slug
          
          // Try different variations of vendor slug formats
          const possibleSlugs = [
            // Original restoration slug
            restoredContent.slug,
            
            // Try with different capitalization
            `vendors-${category.toUpperCase()}-${vendorNameParts.join('-')}`,
            
            // Try removing duplicates if present
            parts.some(p => p === parts[1] && parts.indexOf(p) > 1) ? 
              `vendors-${category}-${vendorNameParts.filter(p => p !== category).join('-')}` : null,
            
            // Try with simplified name if there are many parts
            vendorNameParts.length > 2 ?
              `vendors-${category}-${vendorNameParts[0]}-${vendorNameParts[vendorNameParts.length-1]}` : null 
          ].filter(Boolean) as string[];
          
          console.log(`🔍 Client-side: Will try ${possibleSlugs.length} possible vendor slug variations`);
          
          // Pre-fetch each possible variation
          for (const slugVariation of possibleSlugs) {
            prefetchContent(slugVariation);
          }
          
          // Add a small delay then try the fetch again to update the cache
          setTimeout(() => {
            console.log(`🔄 Secondary fetch for vendor content - attempting direct fetch`);
            // Try direct fetch using a fresh request
            fetch(`/api/pages/${restoredContent.slug}`)
              .then(response => {
                if (response.ok) {
                  return response.json();
                }
                return null;
              })
              .then(freshContent => {
                if (freshContent) {
                  console.log(`✅ Got fresh vendor content via direct fetch: ${freshContent.slug}`);
                  queryClient.setQueryData(["/api/pages", freshContent.slug], freshContent);
                  
                  // Dispatch a custom event to notify the vendor page of the content update
                  const vendorRefreshEvent = new CustomEvent('vendor-content-refreshed', {
                    detail: { slug: freshContent.slug }
                  });
                  window.dispatchEvent(vendorRefreshEvent);
                }
              })
              .catch(err => {
                console.warn('Secondary vendor content fetch failed (non-critical):', err);
              });
          }, 300);
        }
      }
      
      // Handle special case for amenities with hash fragments
      const isAmenitiesSection = restoredContent.slug && restoredContent.slug.startsWith('amenities-');
      
      if (isAmenitiesSection) {
        console.log(`🔄 Special handling for amenities section: ${restoredContent.slug}`);
        
        // Get the section from the slug (e.g., "golf" from "amenities-golf")
        const section = restoredContent.slug.split('-')[1];
        
        // Force reload the browser window with the correct hash
        if (section && window.location.pathname.includes('/amenities')) {
          console.log(`🔄 Will refresh to amenities#${section} after cleaning cache`);
          
          // Store the section to navigate to after cache clearing
          const targetSection = section;
          
          // Set a small timeout to allow the cache clearing to complete
          setTimeout(() => {
            console.log(`🔄 Navigating to #${targetSection}`);
            
            // Update the hash without reloading the page
            window.location.hash = targetSection;
            
            // Create a custom event to notify the amenities page of the forced refresh
            const refreshEvent = new CustomEvent('amenities-content-restored', {
              detail: { slug: restoredContent.slug, section: targetSection }
            });
            window.dispatchEvent(refreshEvent);
            
            console.log(`🎯 Navigation complete, dispatched custom event`);
          }, 100);
        }
      }
      
      // Immediately update the cache with the restored content
      // This ensures we see the correct version right away
      if (restoredContent && restoredContent.slug) {
        queryClient.setQueryData(['/api/pages', restoredContent.slug], restoredContent);
        
        // Also invalidate relevant queries to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['/api/pages', restoredContent.slug] });
        queryClient.invalidateQueries({ queryKey: ['/api/pages'] });
        
        // When restoring a version, we want to update the UI immediately
        console.log('🔄 Updated cache with restored content for immediate UI update');
      }
      
      toast({
        title: 'Version restored',
        description: 'Content has been restored to the selected version.',
      });
      
      // Targeted refresh sequence that doesn't clear entire cache
      console.log('🔄 Performing targeted refresh of content');
      
      // Only invalidate specific queries instead of clearing entire cache
      if (restoredContent && restoredContent.slug) {
        // Invalidate just the specific content that was restored
        queryClient.invalidateQueries({ queryKey: ['/api/pages', restoredContent.slug] });
        
        // Also invalidate version history
        queryClient.invalidateQueries({ queryKey: ['content-versions', restoredContent.id] });
        queryClient.invalidateQueries({ queryKey: ['content-versions-by-slug', restoredContent.slug] });
        
        console.log(`🔄 Invalidated specific queries for ${restoredContent.slug}`);
      }
      
      // Refetch only the necessary queries instead of all
      queryClient.refetchQueries({ queryKey: ['/api/pages', restoredContent?.slug] });
      console.log('🔄 Refetched specific content queries');
      
      // Specifically refetch the content we just restored
      if (restoredContent && restoredContent.slug) {
        console.log('📊 Explicitly refetching primary content data');
        queryClient.fetchQuery({ queryKey: ['/api/pages', restoredContent.slug] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error restoring version',
        description: error.message || 'There was an error restoring the content version.',
        variant: 'destructive',
      });
    }
  });
  
  // For tracking if we're in the middle of a version restoration
  useEffect(() => {
    // When the restoration state changes, update our tracked state
    setRestorationInProgress(restoreVersionMutation.isPending);
  }, [restoreVersionMutation.isPending]);
  
  // Return a consistent interface to maintain compatibility with existing components
  return {
    versions: contentId ? versions : versionsBySlug,
    isLoading: contentId ? isLoadingVersions : isLoadingBySlug,
    error: contentId ? versionsError : slugVersionsError,
    selectedVersion,
    setSelectedVersion,
    restoreVersion: restoreVersionMutation.mutate,
    isRestoring: restoreVersionMutation.isPending,
    restoredVersion,
    restorationInProgress,
    forceContentRefresh, // Expose refresh method for advanced use cases
  };
}