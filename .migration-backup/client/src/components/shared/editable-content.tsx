import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PageContent } from "@shared/schema";
import { ContentVersionHistory } from "@/components/shared/content-version-history";
import { useContentVersions } from "@/hooks/use-content-versions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Code, RefreshCw, FormInput } from "lucide-react";
import { EmbeddedForm } from "@/components/forms/embedded-form";
import WysiwygEditor from "./wysiwyg-editor-direct";
import { normalizeMediaUrl } from "@/lib/media-cache";

// Using an enhanced HTML editor without TinyMCE

interface EditableContentProps {
  slug: string;
  section?: string;
  content?: PageContent;
  defaultTitle?: string;
  defaultContent?: string;
  titleReset?: boolean; // Add this flag to control title reset during navigation
}

export function EditableContent({ slug, section = "", content, defaultTitle = "", defaultContent = "", titleReset = false }: EditableContentProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
  
  // Check if user is admin for permission-based rendering
  const isAdmin = user?.role === "admin";

  // Track if we have initially loaded content
  const [initialContentLoaded, setInitialContentLoaded] = useState(false);

  // Store the section we're currently editing to maintain consistency
  // This is crucial - we "freeze" the section at mount time to prevent URL changes
  // from affecting what content we're editing
  const [editSection] = useState(section);

  // Always use the dash format for consistency (amenities-golf, not amenities#golf)
  // For the main page, use the base slug without any section
  const pageSlug = editSection && editSection !== "overview" 
    ? `${slug}-${editSection}` 
    : slug;

  // Track the last saved content to prevent losing it after saving
  // We're now using React Query's cache as the source of truth instead of localStorage
  // This is more reliable in environments where localStorage may not be available
  const [lastSavedContent, setLastSavedContent] = useState<PageContent | null>(null);

  // Initialize lastSavedContent after pageSlug is defined
  useEffect(() => {
    try {
      // First check if React Query already has this content in cache
      const cachedContent = queryClient.getQueryData(["/api/pages", pageSlug]) as PageContent;
      if (cachedContent) {
        console.log(`📥 Using cached content from React Query for "${pageSlug}"`, cachedContent);
        setLastSavedContent(cachedContent);
      }
    } catch (error) {
      console.error("Error getting cached content:", error);
    }
  }, [pageSlug, queryClient]);

  console.log(`EditableContent: Using pageSlug="${pageSlug}" from slug="${slug}" and editSection="${editSection}" (current section="${section}")`);

  // Initialize with default values first
  const [title, setTitle] = useState(content?.title || defaultTitle || "");
  const [editorContent, setEditorContent] = useState(content?.content || "");

  // Update title and content when lastSavedContent changes
  useEffect(() => {
    if (lastSavedContent) {
      setTitle(lastSavedContent.title || "");
      setEditorContent(lastSavedContent.content || "");
    }
  }, [lastSavedContent]);
  
  // Helper functions to manage edit mode and notify the parent components
  const enterEditMode = () => {
    setIsEditing(true);
    // Notify parent components about editing state change
    notifyEditingStateChange(true);
  };
  
  const exitEditMode = () => {
    setIsEditing(false);
    // Notify parent components about editing state change
    notifyEditingStateChange(false);
  };
  
  // Notify parent components about the editing state change
  const notifyEditingStateChange = (isEditingState: boolean) => {
    if (pageSlug && pageSlug.startsWith('vendors-')) {
      console.log(`🔄 [EditableContent] Broadcasting vendor editing state: ${isEditingState}`);
      const event = new CustomEvent('vendor-editing-state-changed', {
        detail: { 
          slug: pageSlug,
          isEditing: isEditingState 
        }
      });
      window.dispatchEvent(event);
    }
  };

  // Always call the hook (useContentVersions) regardless of isAdmin
  // This ensures hooks are always called in the same order
  const contentVersions = useContentVersions(content?.id, pageSlug);
  
  // If not admin, we'll just ignore the results later
  
  // Destructure safely
  const {
    versions,
    isLoading: isLoadingVersions,
    selectedVersion,
    setSelectedVersion,
    restoreVersion,
    isRestoring
  } = contentVersions;

  // Detect if content is JSON
  const isJsonContent = useMemo(() => {
    // Banner slides and other known JSON content types
    if (pageSlug === "banner-slides") return true;

    // Try to detect JSON content by structure
    const content = editorContent.trim();
    return content.startsWith('[') && content.endsWith(']');
  }, [editorContent, pageSlug]);

  // Format and validate JSON
  const formatJson = (jsonString: string): string => {
    try {
      setJsonError(null);
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      console.error("Error formatting JSON:", e);
      setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
      return jsonString; // Return original on error
    }
  };

  // Format content based on type
  useEffect(() => {
    if (isJsonContent && isEditing && editorMode === "code") {
      // Try to pretty-print the JSON in code mode
      try {
        setEditorContent(formatJson(editorContent));
      } catch (e) {
        console.error("Failed to format JSON:", e);
      }
    }
  }, [isJsonContent, isEditing, editorMode]);

  // Track if we have accessed version history
  const [versionHistoryAccessed, setVersionHistoryAccessed] = useState(false);
  
  // Listen for vendor content refresh events
  useEffect(() => {
    const handleVendorContentRefreshed = (event: CustomEvent) => {
      console.log(`📢 Received vendor-content-refreshed event:`, event.detail);
      
      // Skip refreshing content if we're currently editing
      if (isEditing) {
        console.log(`🔒 [EditableContent] Ignoring refresh event during editing session for ${pageSlug}`);
        return;
      }
      
      // Only process if this component's slug matches the refreshed content
      if (event.detail.slug === pageSlug) {
        console.log(`🔄 [EditableContent] Refreshing vendor content for ${pageSlug}`);
        
        // Directly refresh content without relying on the refreshContent function
        setIsRefreshing(true);
        
        // Invalidate the cache
        queryClient.invalidateQueries({ queryKey: ['/api/pages', pageSlug] });
        
        // Fetch fresh content
        fetch(`/api/pages/${pageSlug}`)
          .then(response => response.json())
          .then(freshContent => {
            if (freshContent) {
              setTitle(freshContent.title || "");
              setEditorContent(freshContent.content || "");
              // Update cache
              queryClient.setQueryData(["/api/pages", pageSlug], freshContent);
              
              toast({
                title: "Content Refreshed",
                description: "The latest vendor content has been loaded.",
              });
            }
          })
          .catch(err => console.error("Error refreshing vendor content:", err))
          .finally(() => {
            setIsRefreshing(false);
          });
      }
    };
    
    // Add event listener
    window.addEventListener('vendor-content-refreshed', handleVendorContentRefreshed as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('vendor-content-refreshed', handleVendorContentRefreshed as EventListener);
    };
  }, [pageSlug, isEditing, queryClient, toast]);
  
  // Reset internal state when pageSlug changes
  useEffect(() => {
    // Clear lastSavedContent when pageSlug changes to prevent stale content
    setLastSavedContent(null);
    
    // Reset version history access flag to prevent showing stale content
    // This is critical to fix the issue where old version content briefly shows
    setVersionHistoryAccessed(false);
    
    // Re-fetch content from API or cache
    const cachedContent = queryClient.getQueryData(["/api/pages", pageSlug]) as PageContent;
    if (cachedContent) {
      console.log(`📥 [EditableContent] Found cached content for new slug "${pageSlug}"`, cachedContent);
      setTitle(cachedContent.title || "");
      setEditorContent(cachedContent.content || "");
      setInitialContentLoaded(true);
    } else {
      console.log(`🔍 [EditableContent] No cached content for "${pageSlug}", will wait for query result`);
      setTitle("");
      setEditorContent("");
      setInitialContentLoaded(false);
    }
    
    // Exit edit mode when changing pages
    exitEditMode();
    
    // Reset any error state
    setJsonError(null);
    
  }, [pageSlug, queryClient]);

  // Define refreshContent function before using it in any useEffect

  // Force refresh content from server
  const refreshContent = async () => {
    setIsRefreshing(true);
    try {
      // Clear the lastSavedContent state
      setLastSavedContent(null);

      // Invalidate and immediately refetch the content
      console.log(`Forcing content refresh for ${pageSlug}`);

      // Special handling for vendors-landscaping-landscaping case
      if (pageSlug === 'vendors-landscaping-landscaping') {
        console.log(`🔍 Special case handling for ${pageSlug}`);
        
        // Try direct fetch first to get the latest content
        try {
          const response = await fetch(`/api/pages/${pageSlug}`);
          if (response.ok) {
            const directContent = await response.json();
            console.log(`✅ Direct fetch success for ${pageSlug}:`, directContent);
            
            // Update React Query cache and component state
            queryClient.setQueryData(["/api/pages", pageSlug], directContent);
            setTitle(directContent.title || "");
            setEditorContent(directContent.content || "");
            
            toast({
              title: "Content Refreshed",
              description: "The latest content has been loaded from the server.",
            });
            
            setIsRefreshing(false);
            return; // Exit early after successful direct fetch
          }
        } catch (directError) {
          console.error(`⚠️ Direct fetch failed for ${pageSlug}:`, directError);
          // Continue with standard approach
        }
      }

      // Standard approach for other cases
      // First invalidate all queries that might contain this content
      await queryClient.invalidateQueries({ queryKey: ['/api/pages'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/pages', pageSlug] });

      // Create hash equivalent for backwards compatibility
      const hashEquivalent = pageSlug.includes('-') ? pageSlug.replace('-', '#') : pageSlug;
      await queryClient.invalidateQueries({ queryKey: ['/api/pages', hashEquivalent] });

      // For vendor pages, also invalidate any alternate slug format
      if (pageSlug.startsWith('vendors-')) {
        // Handle the space vs dash format issue
        const parts = pageSlug.split('-');
        if (parts.length >= 3) {
          const category = parts[1];
          const name = parts.slice(2).join('-');
          const altSlug = `vendors-${category} ${name}`;
          console.log(`Also invalidating alternate vendor slug: ${altSlug}`);
          await queryClient.invalidateQueries({ queryKey: ['/api/pages', altSlug] });
        }
      }

      // Force immediate refetch
      const freshContent = await queryClient.fetchQuery<PageContent>({ 
        queryKey: ['/api/pages', pageSlug] 
      });

      // Update our local state with this content
      if (freshContent) {
        console.log("Fresh content fetched:", freshContent);
        setTitle(freshContent.title || "");
        setEditorContent(freshContent.content || "");
      }

      toast({
        title: "Content Refreshed",
        description: "The latest content has been loaded from the server.",
      });
    } catch (e) {
      console.error("Error refreshing content:", e);
      
      // Try a direct fetch as a fallback when React Query fails
      try {
        console.log(`🔄 Attempting direct fetch fallback for ${pageSlug}`);
        const fallbackResponse = await fetch(`/api/pages/${pageSlug}`);
        
        if (fallbackResponse.ok) {
          const fallbackContent = await fallbackResponse.json();
          console.log(`✅ Fallback fetch success for ${pageSlug}:`, fallbackContent);
          
          // Update React Query cache and component state
          queryClient.setQueryData(["/api/pages", pageSlug], fallbackContent);
          setTitle(fallbackContent.title || "");
          setEditorContent(fallbackContent.content || "");
          
          toast({
            title: "Content Refreshed",
            description: "The latest content has been loaded from the server.",
          });
          
          setIsRefreshing(false);
          return; // Exit early after successful fallback
        }
      } catch (fallbackError) {
        console.error(`❌ Fallback fetch also failed for ${pageSlug}:`, fallbackError);
      }
      
      // If we get here, both primary and fallback approaches failed
      toast({
        title: "Refresh Failed",
        description: "Could not refresh content from server.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle content and title reset during navigation to prevent content flashing
  useEffect(() => {
    // Always reset content when slug changes to prevent flashing old content
    console.log(`🔄 [EditableContent] Content reset check for ${pageSlug}`);
    
    // CRITICAL FIX: First, immediately clear any stale content
    setLastSavedContent(null);
    setVersionHistoryAccessed(false);
    
    // Force refresh content from the server or React Query cache
    const cachedContent = queryClient.getQueryData(["/api/pages", pageSlug]) as PageContent;
    
    if (cachedContent) {
      console.log(`🔄 [EditableContent] Using cached content for ${pageSlug}: "${cachedContent.title}"`);
      // Update content immediately from cache to avoid flashing old content
      setLastSavedContent(cachedContent);
      setTitle(cachedContent.title || defaultTitle || "");
      setEditorContent(cachedContent.content || "");
    } else {
      // If no cache, use the default title/content without showing old cached content
      setTitle(defaultTitle || "");
      setEditorContent("");
      
      // Also force clear any content versions cache that might be lingering
      if (queryClient.getQueryData(['content-versions-by-slug', pageSlug])) {
        console.log(`🧹 [EditableContent] Clearing content versions cache for ${pageSlug}`);
        queryClient.removeQueries({ queryKey: ['content-versions-by-slug', pageSlug] });
      }
    }
  }, [pageSlug, defaultTitle, queryClient, toast, setEditorContent]);

  // Add a specific effect to handle titleReset for BBRD page title flash issue
  useEffect(() => {
    // Only run this effect when titleReset is true
    if (titleReset) {
      console.log(`🔄 [EditableContent] Title reset triggered for ${pageSlug}`);
      
      // For the specific BBRD page issue
      if (pageSlug === 'government-bbrd') {
        console.log(`🎯 [EditableContent] Handling title reset for BBRD page`);
        
        // Force fetch from the server to get the latest title
        fetch(`/api/pages/${pageSlug}`)
          .then(response => response.json())
          .then(freshContent => {
            console.log(`✅ [EditableContent] Got fresh BBRD content with title: "${freshContent.title}"`);
            // Immediately update title with fresh data
            setTitle(freshContent.title || "");
            // Update the cache to ensure consistency
            queryClient.setQueryData(["/api/pages", pageSlug], freshContent);
          })
          .catch(err => console.error("Error fetching fresh content:", err));
      }
      
      // Check if we have cached content
      const cachedContent = queryClient.getQueryData(["/api/pages", pageSlug]) as PageContent;
      if (cachedContent) {
        console.log(`📥 [EditableContent] Using cached content during title reset for ${pageSlug}: "${cachedContent.title}"`);
        // Update title from cache during reset
        setTitle(cachedContent.title || defaultTitle || "");
      }
    }
  }, [titleReset, pageSlug, queryClient, defaultTitle]);

  // Update state when content from query changes, but only on initial load or content change
  useEffect(() => {
    // If we've just saved content, don't let the API response overwrite it
    // This is critical to prevent the content from disappearing after saving
    if (lastSavedContent && lastSavedContent.slug === pageSlug) {
      console.log("📌 [EditableContent] Using lastSavedContent to prevent UI flicker for", pageSlug);

      // Also ensure this content is in the React Query cache
      queryClient.setQueryData(["/api/pages", pageSlug], lastSavedContent);

      // Directly use the last saved content to update UI
      setTitle(lastSavedContent.title || "");
      setEditorContent(lastSavedContent.content || "");

      // Update editor mode based on content type
      if (lastSavedContent.slug === "banner-slides" || 
         (lastSavedContent.content && lastSavedContent.content.startsWith('[') && lastSavedContent.content.endsWith(']'))) {
        setEditorMode("code");
      } else {
        setEditorMode("visual");
      }

      // Mark that we've loaded initial content to prevent default template
      setInitialContentLoaded(true);
      
      return; // Skip updating from API response
    }

    // Always update state when content changes, even during editing
    // This ensures data is fresh from API responses
    if (content) {
      // Make sure the content is valid for this component's pageSlug
      // This prevents content from disappearing due to mismatched content
      // Allow content to be used if either:
      // 1. The content.slug matches pageSlug (strict match), or
      // 2. The content.slug is undefined but we have a valid pageSlug and content.title exists, or
      // 3. Special handling for legal pages: terms-and-agreements and privacy-policy
      if (content.slug === pageSlug || 
          (content.slug === undefined && pageSlug && content.title) ||
          // Special case for legal pages that might have version history but no slug
          ((pageSlug === "terms-and-agreements" || pageSlug === "privacy-policy") && content.title)) {
        console.log("🔄 Content updated from API, refreshing local state with:", content);
        console.log(`📄 Content for "${pageSlug}" - title: "${content.title}", length: ${content.content?.length || 0} chars`);

        // Explicitly prioritize content from database over defaults
        setTitle(content.title || "");
        setEditorContent(content.content || "");
        
        // Mark that we've loaded initial content to prevent default template
        setInitialContentLoaded(true);

        // Set editor mode based on content type
        if (content.slug === "banner-slides" || 
           (content.content && content.content.startsWith('[') && content.content.endsWith(']'))) {
          setEditorMode("code");
        } else {
          setEditorMode("visual");
        }

        // Also update the React Query cache with this content
        // If content.slug is undefined, use pageSlug when updating the cache
        const cacheSlug = content.slug || pageSlug;
        queryClient.setQueryData(["/api/pages", cacheSlug], {
          ...content,
          slug: cacheSlug // Ensure the slug is consistent for future lookups
        });
      } else {
        console.log(`⚠️ Received content with slug "${content.slug}" but this component expects "${pageSlug}". Ignoring...`);
      }
    } else if (!content && !isEditing) {
      // Don't set any default content for empty pages - leave them blank
      if (!initialContentLoaded && !versionHistoryAccessed) {
        console.log("📝 No content available, leaving page blank");
        setTitle(defaultTitle || "");
        setEditorContent(""); // Always keep content empty if none exists
      } else {
        console.log("🔒 Not using default template because we already loaded content or accessed version history");
      }
    }
  }, [content, defaultTitle, defaultContent, isEditing, pageSlug, lastSavedContent, queryClient, initialContentLoaded, versionHistoryAccessed]);

  // Track refresh status to prevent loops
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [isSpecialRefreshing, setIsSpecialRefreshing] = useState(false);
  const lastCacheRefreshTimestamp = useRef<number>(0);
  const lastSpecialRefreshTimestamp = useRef<number>(0);
  const CACHE_REFRESH_THROTTLE = 1000; // 1 second throttle for cache refresh events
  const SPECIAL_REFRESH_THROTTLE = 1000; // 1 second throttle for special page updates
  
  // Listen for version history reset events
  useEffect(() => {
    const handleVersionHistoryReset = (event: CustomEvent) => {
      // Check if this event is for our slug or a global reset
      if (!event.detail.slug || event.detail.slug === pageSlug) {
        console.log(`🔄 [EditableContent] Resetting version history state for ${pageSlug}`);
        setVersionHistoryAccessed(false);
        setLastSavedContent(null);
      }
    };
    
    // Add event listener
    window.addEventListener('reset-version-history', handleVersionHistoryReset as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('reset-version-history', handleVersionHistoryReset as EventListener);
    };
  }, [pageSlug]);

  // Listen for content refresh events
  useEffect(() => {
    const handleContentCacheRefreshed = (event: CustomEvent) => {
      // Prevent refresh loops by checking if we're already refreshing
      if (isRefreshingCache || isSpecialRefreshing || isRefreshing) {
        console.log(`⏭️ [EditableContent] Skipping cache refresh - refresh already in progress for ${pageSlug}`);
        return;
      }
      
      // Throttle refreshes to prevent excessive notifications
      const now = Date.now();
      if (now - lastCacheRefreshTimestamp.current < CACHE_REFRESH_THROTTLE) {
        console.log(`⏭️ [EditableContent] Throttling cache refresh - too frequent for ${pageSlug}`);
        return;
      }
      
      // Update the timestamp
      lastCacheRefreshTimestamp.current = now;
    
      console.log("📢 Received content-cache-refreshed event:", event.detail);

      // Skip refreshing content if we're currently editing
      if (isEditing) {
        console.log(`🔒 [EditableContent] Ignoring cache refresh event during editing session for ${pageSlug}`);
        return;
      }

      // Special case for vendors-landscaping-landscaping to prevent too many refreshes
      if (pageSlug === 'vendors-landscaping-landscaping') {
        console.log(`⚠️ [EditableContent] Blocking auto-refresh for special vendor page ${pageSlug}`);
        return;
      }

      // Only process if this component's slug matches the refreshed content
      if (event.detail.slug === pageSlug || !event.detail.slug) {
        console.log(`🔄 [EditableContent] Refreshing content for ${pageSlug} due to cache refresh event`);
        
        setIsRefreshingCache(true);

        // If event includes content, use it directly
        if (event.detail.content) {
          console.log(`📥 [EditableContent] Using provided content for ${pageSlug}`);
          
          // Update state with this content
          setLastSavedContent(event.detail.content);
          setTitle(event.detail.content.title || "");
          setEditorContent(event.detail.content.content || "");
          
          // Update cache for this content
          queryClient.setQueryData(["/api/pages", pageSlug], event.detail.content);
          
          // Reset the refreshing state after a short delay
          setTimeout(() => setIsRefreshingCache(false), 300);
        } else {
          // Instead of using refreshContent, do a simpler direct content refresh
          // Invalidate the cache entries first
          queryClient.invalidateQueries({ queryKey: ['/api/pages', pageSlug] });
          
          // Then fetch the content directly
          fetch(`/api/pages/${pageSlug}`)
            .then(response => response.json())
            .then(freshContent => {
              if (freshContent) {
                setTitle(freshContent.title || "");
                setEditorContent(freshContent.content || "");
                // Update cache
                queryClient.setQueryData(["/api/pages", pageSlug], freshContent);
              }
            })
            .catch(err => console.error("Error refreshing content:", err))
            .finally(() => {
              // Reset the refreshing flag when done
              setTimeout(() => setIsRefreshingCache(false), 300);
            });
        }
      } else {
        // Reset the refreshing flag if slug doesn't match
        setIsRefreshingCache(false);
      }
    };
    
    // Special handler uses the state and constants declared at component level
    
    // Special handler for nature and amenities pages
    const handleSpecialPageUpdate = (event: CustomEvent) => {
      // Prevent refresh loops by checking if we're already refreshing
      if (isSpecialRefreshing || isRefreshing) {
        console.log(`⏭️ [EditableContent] Skipping special page update - refresh already in progress for ${pageSlug}`);
        return;
      }
      
      // Throttle refreshes to prevent excessive notifications
      const now = Date.now();
      if (now - lastSpecialRefreshTimestamp.current < SPECIAL_REFRESH_THROTTLE) {
        console.log(`⏭️ [EditableContent] Throttling special page update - too frequent for ${pageSlug}`);
        return;
      }
      
      // Update the timestamp
      lastSpecialRefreshTimestamp.current = now;
      
      console.log("🌿 Received special-page-update event:", event.detail);
      
      // Skip refreshing content if we're currently editing
      if (isEditing) {
        console.log(`🔒 [EditableContent] Ignoring special page update during editing for ${pageSlug}`);
        return;
      }
      
      // Only process if this component's slug matches the updated content
      if (event.detail.slug === pageSlug) {
        console.log(`🌿 [EditableContent] Handling special page update for ${pageSlug}`);
        setIsSpecialRefreshing(true);
        
        // If content is provided, update the cache
        if (event.detail.content) {
          console.log(`✅ [EditableContent] Using provided content to update ${pageSlug}`);
          
          // Update state with this content
          setLastSavedContent(event.detail.content);
          setTitle(event.detail.content.title || "");
          setEditorContent(event.detail.content.content || "");
          
          // Update cache for this content
          queryClient.setQueryData(["/api/pages", pageSlug], event.detail.content);
          
          // Also update it in the all pages array
          const allPages = queryClient.getQueryData(["/api/pages"]) as PageContent[] || [];
          const updatedAllPages = allPages.map(p => p.slug === pageSlug ? event.detail.content : p);
          queryClient.setQueryData(["/api/pages"], updatedAllPages);
          
          // Reset the refreshing state after a short delay
          setTimeout(() => setIsSpecialRefreshing(false), 300);
        } else {
          // If no content is provided, refresh from server using direct fetch
          console.log(`🔄 [EditableContent] Forcing refresh for special page ${pageSlug}`);
          
          // First invalidate the cache
          queryClient.invalidateQueries({ queryKey: ['/api/pages', pageSlug] });
          
          // Then fetch fresh content
          fetch(`/api/pages/${pageSlug}`)
            .then(response => response.json())
            .then(freshContent => {
              if (freshContent) {
                setTitle(freshContent.title || "");
                setEditorContent(freshContent.content || "");
                // Update cache
                queryClient.setQueryData(["/api/pages", pageSlug], freshContent);
                
                // Also update it in the all pages array
                const allPages = queryClient.getQueryData(["/api/pages"]) as PageContent[] || [];
                const updatedAllPages = allPages.map(p => p.slug === pageSlug ? freshContent : p);
                queryClient.setQueryData(["/api/pages"], updatedAllPages);
              }
            })
            .catch(err => console.error("Error refreshing special page content:", err))
            .finally(() => {
              // Reset the refreshing flag when done
              setTimeout(() => setIsSpecialRefreshing(false), 300);
            });
        }
      } else {
        // Reset refreshing flag if slug doesn't match
        setIsSpecialRefreshing(false);
      }
    };

    // Add event listeners
    window.addEventListener('content-cache-refreshed', handleContentCacheRefreshed as EventListener);
    window.addEventListener('special-page-update', handleSpecialPageUpdate as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('content-cache-refreshed', handleContentCacheRefreshed as EventListener);
      window.removeEventListener('special-page-update', handleSpecialPageUpdate as EventListener);
    };
  }, [pageSlug, queryClient, toast, isEditing, isRefreshing, isRefreshingCache, isSpecialRefreshing]);

  // Special side effect - force update the content whenever URL changes or props change
  // This handles cases where content may be stale due to hash changes or section changes
  useEffect(() => {
    // Skip force refresh if already in edit mode to prevent losing changes
    if (isEditing) {
      console.log(`🔒 [EditableContent] Skipping force refresh during editing for ${pageSlug}`);
      return;
    }
    
    const forceRefreshContent = async () => {
      try {
        // Run this for specific page types that need direct fetch, excluding the problematic vendor
        if (pageSlug && (
            pageSlug.startsWith('amenities-') || 
            pageSlug.startsWith('government-')
          )) {
          console.log(`🔄 [EditableContent] Special force refresh for ${pageSlug}`);

          // Direct fetch to get the latest content for this slug
          const response = await fetch(`/api/pages/${pageSlug}`);

          if (response.ok) {
            const freshContent = await response.json();
            console.log(`✅ [EditableContent] Got fresh content for ${pageSlug}:`, freshContent);

            // Verify this is the right content for this component
            if (freshContent.slug === pageSlug) {
              // Directly update our state with this content
              setTitle(freshContent.title || "");
              setEditorContent(freshContent.content || "");

              // Also update the cache
              queryClient.setQueryData(["/api/pages", pageSlug], freshContent);
            } else {
              console.warn(`⚠️ Got mismatched content: expected "${pageSlug}", received "${freshContent.slug}"`);
            }
          }
        }
        
        // Special case for the vendor that needs to be fixed - use a more careful approach
        else if (pageSlug === 'vendors-landscaping-landscaping') {
          console.log(`🔍 [EditableContent] Using modified approach for ${pageSlug}`);
          
          // Instead of immediately fetching, check if we have cached data first
          const cachedContent = queryClient.getQueryData(["/api/pages", pageSlug]) as PageContent;
          
          if (cachedContent) {
            console.log(`📌 [EditableContent] Using cached data for ${pageSlug} to prevent refresh issues`);
            setTitle(cachedContent.title || "");
            setEditorContent(cachedContent.content || "");
            return; // Exit early to prevent further fetching
          }
          
          // Only fetch if no cached data is available
          console.log(`❓ [EditableContent] No cached data for ${pageSlug}, attempting careful fetch`);
          
          try {
            const response = await fetch(`/api/pages/${pageSlug}`);
            if (response.ok) {
              const freshContent = await response.json();
              console.log(`✅ [EditableContent] Got fresh content for ${pageSlug}:`, freshContent);
              
              // Update state and cache
              setTitle(freshContent.title || "");
              setEditorContent(freshContent.content || "");
              queryClient.setQueryData(["/api/pages", pageSlug], freshContent);
            }
          } catch (error) {
            console.error(`❌ [EditableContent] Error fetching ${pageSlug}:`, error);
          }
        } 
        // For vendor pages, also check if we need to handle alternate formats
        else if (pageSlug && pageSlug.startsWith('vendors-')) {
          // Check if we need to handle a potential slug format issue
          const parts = pageSlug.split('-');
          if (parts.length >= 3) {
            // Parse out components of the slug
            const category = parts[1];
            const name = parts.slice(2).join('-');
            
            console.log(`🔍 [EditableContent] Checking alternate format for vendor page: ${pageSlug}`);
            
            // Try direct fetch for both formats (with dash and with space)
            try {
              // First try the original format
              const response = await fetch(`/api/pages/${pageSlug}`);
              if (response.ok) {
                const directContent = await response.json();
                console.log(`✅ [EditableContent] Direct fetch successful for: ${pageSlug}`);
                
                // Update state and cache
                setTitle(directContent.title || "");
                setEditorContent(directContent.content || "");
                queryClient.setQueryData(["/api/pages", pageSlug], directContent);
              } else {
                // Try alternate format with space
                const altSlug = `vendors-${category} ${name}`;
                console.log(`⚠️ [EditableContent] Trying alternate slug format: ${altSlug}`);
                
                const altResponse = await fetch(`/api/pages/${altSlug}`);
                if (altResponse.ok) {
                  const altContent = await altResponse.json();
                  console.log(`✅ [EditableContent] Found content with alternate slug: ${altSlug}`);
                  
                  // Update state and cache for both formats
                  setTitle(altContent.title || "");
                  setEditorContent(altContent.content || "");
                  queryClient.setQueryData(["/api/pages", pageSlug], altContent);
                  queryClient.setQueryData(["/api/pages", altSlug], altContent);
                }
              }
            } catch (directError) {
              console.error(`❌ [EditableContent] Error fetching vendor content: ${directError}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ [EditableContent] Error in force refresh:`, error);
      }
    };

    // Run the force refresh when the component mounts
    forceRefreshContent();
  }, [pageSlug, slug, section, queryClient, isEditing, setTitle, setEditorContent]);

  useEffect(() => {
    // Log when props change but we maintain our edit section
    if (editSection !== section) {
      console.log(`WARNING: Section changed in props to "${section}" but EditableContent is maintaining edit section "${editSection}"`);
    }
  }, [section, editSection]);

  // Handle JSON content changes
  const handleJsonChange = (value: string) => {
    setEditorContent(value);
    // Validate JSON as user types
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };



  // Mutation for toggling whether the auto-rendered page title is hidden.
  // The PATCH /api/pages/:id endpoint already enforces admin permission.
  const pageQueryKey = ["/api/pages", pageSlug] as const;
  const toggleHideTitleMutation = useMutation({
    mutationFn: async (hideDefaultTitle: boolean) => {
      if (!content?.id) {
        throw new Error("Cannot update title visibility: page has no ID yet.");
      }
      const response = await apiRequest(
        "PATCH",
        `/api/pages/${content.id}`,
        { hideDefaultTitle },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update title visibility");
      }
      return (await response.json()) as PageContent;
    },
    onMutate: async (hideDefaultTitle: boolean) => {
      // Optimistically update so the title hides/shows immediately.
      await queryClient.cancelQueries({ queryKey: pageQueryKey });
      const previous = queryClient.getQueryData<PageContent>(pageQueryKey);
      queryClient.setQueryData<PageContent | undefined>(pageQueryKey, (old) =>
        old ? { ...old, hideDefaultTitle } : old,
      );
      return { previous };
    },
    onError: (
      error: Error,
      _vars: boolean,
      context: { previous: PageContent | undefined } | undefined,
    ) => {
      if (context?.previous) {
        queryClient.setQueryData(pageQueryKey, context.previous);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: (updated: PageContent) => {
      // Use the server's response so the cache is consistent without an
      // extra refetch round-trip (avoids any optimistic-state flicker).
      queryClient.setQueryData<PageContent | undefined>(pageQueryKey, (old) =>
        old ? { ...old, ...updated } : updated,
      );
      queryClient.invalidateQueries({ queryKey: pageQueryKey });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      // Validate JSON content before saving
      if (isJsonContent) {
        try {
          // Parse and re-stringify to ensure it's valid JSON
          const validatedContent = JSON.stringify(JSON.parse(data.content));
          // Update the data to save with validated JSON
          data.content = validatedContent;
        } catch (e) {
          throw new Error(`Invalid JSON content: ${e instanceof Error ? e.message : 'Unknown parsing error'}`);
        }
      }

      try {
        // First check if a page with this slug exists
        console.log(`Debug: Making GET request to /api/pages/${pageSlug} with data:`, null);
        const checkResponse = await apiRequest("GET", `/api/pages/${pageSlug}`);

        if (checkResponse.ok) {
          // If we found an existing page, use PATCH with its ID
          const existingPage = await checkResponse.json();
          console.log(`Debug: Found existing page with slug ${pageSlug}, ID: ${existingPage.id}`);

          const patchResponse = await apiRequest(
            "PATCH",
            `/api/pages/${existingPage.id}`,
            {
              slug: pageSlug,
              title: data.title,
              content: data.content,
              createVersion: true,
              versionNotes: `Updated "${data.title}" content` 
            }
          );

          if (!patchResponse.ok) {
            const errorData = await patchResponse.json();
            throw new Error(errorData.message || 'Failed to update page content');
          }

          return patchResponse.json();
        } else {
          // No page exists with this slug, so create a new one
          console.log(`Debug: No existing page found with slug ${pageSlug}, creating new page`);

          const createResponse = await apiRequest(
            "POST",
            "/api/pages",
            {
              slug: pageSlug,
              title: data.title,
              content: data.content,
            }
          );

          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.message || 'Failed to create page content');
          }

          return createResponse.json();
        }
      } catch (error) {
        console.error(`Debug: Error during GET/create/update for slug ${pageSlug}:`, error);

        // If we have an existing content object with an ID, try to update it
        if (content && content.id) {
          console.log(`Debug: Fallback - updating existing content with ID ${content.id}`);

          const response = await apiRequest(
            "PATCH",
            `/api/pages/${content.id}`,
            {
              slug: pageSlug,
              title: data.title,
              content: data.content,
              createVersion: true,
              versionNotes: `Updated "${data.title}" content (fallback method)`
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update content');
          }

          return response.json();
        } else {
          // Last resort - try to create a new page
          console.log(`Debug: Fallback - creating new page for slug ${pageSlug}`);

          const response = await apiRequest(
            "POST",
            "/api/pages",
            {
              slug: pageSlug,
              title: data.title,
              content: data.content,
              createVersion: true,
              versionNotes: `Initial version of "${data.title}"`
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create content');
          }

          return response.json();
        }
      }
    },
    onSuccess: (updatedContent) => {
      console.log("Content save success, updating with:", updatedContent);

      // IMPORTANT FIX: Store the last saved content to prevent it from disappearing
      // We're using React Query's cache AND component state for redundancy
      setLastSavedContent(updatedContent);
      console.log(`📥 Saved content to lastSavedContent state for "${pageSlug}"`);

      // We now primarily rely on React Query's cache which is more reliable
      // in environments where localStorage is restricted

      // Update local state directly with the response from the server
      setTitle(updatedContent.title);
      setEditorContent(updatedContent.content);

      // Exit edit mode
      exitEditMode();

      // CRITICAL FIX FOR VENDOR PAGES: Clear vendor content from localStorage
      // This prevents deleted media from being restored from localStorage cache
      if (pageSlug.startsWith('vendors-')) {
        console.log(`🧹 Clearing localStorage cache for vendor page "${pageSlug}"`);
        try {
          const storedContent = localStorage.getItem('persistedVendorContent');
          if (storedContent) {
            const parsedContent = JSON.parse(storedContent);
            // Delete this specific vendor page from the cache
            if (parsedContent[pageSlug]) {
              delete parsedContent[pageSlug];
              localStorage.setItem('persistedVendorContent', JSON.stringify(parsedContent));
              console.log(`✅ Successfully removed "${pageSlug}" from persisted vendor content`);
            }
          }
        } catch (e) {
          console.error("Error clearing persisted vendor content:", e);
        }
      }

      // Force a content refresh in the generic-content-page component
      const refreshEvent = new CustomEvent('content-cache-refreshed', {
        detail: { 
          slug: pageSlug,
          forceRefresh: true,
          content: updatedContent
        }
      });
      window.dispatchEvent(refreshEvent);
      
      // Create a hash equivalent for backwards compatibility with existing records
      const hashEquivalent = pageSlug.includes('-') 
        ? pageSlug.replace('-', '#') 
        : pageSlug;

      console.log("🔄 Performing targeted cache updates for saved content");

      // CRITICAL: Update ALL cache entries that might be referenced
      // This prevents the content from disappearing after saving
      // Start with the specific page content
      queryClient.setQueryData(["/api/pages", pageSlug], updatedContent);

      // Also update it in the main pages array to prevent overwriting
      const allPages = queryClient.getQueryData(["/api/pages"]) as PageContent[] || [];
      const updatedAllPages = allPages.map(p => p.slug === pageSlug ? updatedContent : p);
      queryClient.setQueryData(["/api/pages"], updatedAllPages);

      // Only invalidate specific queries instead of clearing the entire cache
      console.log(`🔄 Invalidating queries for: "${pageSlug}"`);

      // Invalidate queries related to this specific content
      const keysToInvalidate = [
        // The specific content
        ["/api/pages", pageSlug],
        ["/api/pages", hashEquivalent],
        ["/api/pages", slug],

        // Version history
        ['content-versions', updatedContent.id],
        ['content-versions-by-slug', pageSlug]
      ];

      // Invalidate each specific key
      keysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key, exact: true });
        console.log(`🔄 Invalidated: ${key.join('/')}`);
      });

      // IMPORTANT: For nature and amenities pages, send a special update event
      // This ensures proper updates for pages in the /more route
      if (pageSlug.startsWith('nature-') || pageSlug.startsWith('amenities-')) {
        console.log(`🌿 Special page type detected (${pageSlug}), sending special update notification`);
        
        // Create a special event for the /more route handlers
        const specialPathEvent = new CustomEvent('special-page-update', {
          detail: { 
            slug: pageSlug,
            content: updatedContent,
            forceUpdate: true
          }
        });
        window.dispatchEvent(specialPathEvent);
      }
      
      // Finally, refresh the main page query but with a delay
      setTimeout(() => {
        // Carefully refetch only what we need
        queryClient.refetchQueries({ queryKey: ['/api/pages', pageSlug] });
        if (updatedContent.id) {
          queryClient.refetchQueries({ queryKey: ['content-versions', updatedContent.id] });
        }
        queryClient.refetchQueries({ queryKey: ['content-versions-by-slug', pageSlug] });

        console.log("✅ Completed content refresh after save");
      }, 200);

      toast({
        title: "Success",
        description: "Content saved successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Error saving content:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle content restoration from version history
  const handleVersionRestore = async () => {
    console.log("🔄 Content restoration triggered, performing immediate refresh");
    
    // Prevent default template usage after restoration
    setVersionHistoryAccessed(true);
    
    // Clear any stale content to prevent UI flickering
    setLastSavedContent(null);
    
    // Detect if we're on an amenities page with hash fragment
    const isAmenitiesHash = pageSlug && pageSlug.startsWith('amenities-');

    if (isAmenitiesHash) {
      console.log("⚠️ Special case for amenities section with hash fragments");
      // For amenities pages, we'll use a different approach
      try {
        // First make a direct fetch to get the freshest data possible
        console.log(`🔍 Directly fetching latest data for ${pageSlug}`);
        const response = await fetch(`/api/pages/${pageSlug}`);

        if (response.ok) {
          const freshContent = await response.json();
          console.log(`✅ Got fresh content directly from server:`, freshContent);

          // Directly update our component state with the fresh data
          setTitle(freshContent.title || "");
          setEditorContent(freshContent.content || "");
          
          // Also update the cache to ensure consistency
          queryClient.setQueryData(["/api/pages", pageSlug], freshContent);

          toast({
            title: "Content Refreshed",
            description: "The restored version is now displayed.",
          });

          return; // Skip the rest of the function
        }
      } catch (error) {
        console.error("Error getting fresh content:", error);
        // Continue with fallback approach below
      }
    }

    // Standard approach for non-amenities pages or if direct fetch failed
    console.log("🔄 Performing targeted content refresh after version restoration");

    // Directly fetch only the specific content we need
    try {
      console.log(`📥 Directly fetching content for ${pageSlug} after restoration`);
      // Target just the specific page content
      const response = await fetch(`/api/pages/${pageSlug}`);
      if (!response.ok) {
        throw new Error("Failed to refresh specific content");
      }

      const restoredContent = await response.json();
      console.log("📤 Received restored content:", restoredContent);

      // Update local state directly with the restored content
      setTitle(restoredContent.title || "");
      setEditorContent(restoredContent.content || "");

      // Save the restored content to lastSavedContent and React Query cache for persistence
      setLastSavedContent(restoredContent);

      // Update React Query cache directly
      queryClient.setQueryData(["/api/pages", pageSlug], restoredContent);
      console.log(`📤 Saved restored content to React Query cache for "${pageSlug}"`, restoredContent);
      
      // Force a content refresh in the generic-content-page component
      const refreshEvent = new CustomEvent('content-cache-refreshed', {
        detail: { 
          slug: pageSlug,
          forceRefresh: true,
          content: restoredContent
        }
      });
      window.dispatchEvent(refreshEvent);
      
      // IMPORTANT: For nature and amenities pages, send a special update event
      // This ensures proper updates for pages in the /more route
      if (pageSlug.startsWith('nature-') || pageSlug.startsWith('amenities-')) {
        console.log(`🌿 Special page type detected during restore (${pageSlug}), sending special update notification`);
        
        // Create a special event for the /more route handlers
        const specialPathEvent = new CustomEvent('special-page-update', {
          detail: { 
            slug: pageSlug,
            content: restoredContent,
            forceUpdate: true
          }
        });
        window.dispatchEvent(specialPathEvent);
      }

    } catch (error) {
      console.error(`Error fetching specific content (${pageSlug}):`, error);

      // Fall back to fetching all pages as a last resort
      try {
        console.log("📥 Falling back to fetching all pages");
        const allPagesResponse = await fetch(`/api/pages`);
        if (allPagesResponse.ok) {
          const allContents = await allPagesResponse.json();
          const fallbackContent = allContents.find((c: any) => c.slug === pageSlug);

          if (fallbackContent) {
            console.log("✅ Found content via fallback method:", fallbackContent);
            setTitle(fallbackContent.title || "");
            setEditorContent(fallbackContent.content || "");

            // Update cache with found content
            queryClient.setQueryData(["/api/pages", pageSlug], fallbackContent);
          }
        }
      } catch (fallbackError) {
        console.error("Fallback content fetch failed:", fallbackError);
      }
    }

    // Only invalidate the specific queries we need
    const keysToInvalidate = [
      ["/api/pages", pageSlug],
      ['content-versions', content?.id],
      ['content-versions-by-slug', pageSlug]
    ];

    // Invalidate each key
    keysToInvalidate.forEach(key => {
      if (key[1]) { // Only if the second parameter exists
        queryClient.invalidateQueries({ queryKey: key });
        console.log(`🔄 Invalidated: ${key.join('/')}`);
      }
    });

    // Refresh just what we need
    queryClient.refetchQueries({ queryKey: ["/api/pages", pageSlug] });

    toast({
      title: "Content Refreshed",
      description: "The restored version is now displayed.",
    });
  };

  // Format content for display
  // Function to normalize media URLs in HTML content
  const normalizeHtmlContent = (html: string): string => {
    if (!html) return html;
    
    // Check if the content contains image tags
    if (!html.includes('<img')) return html;
    
    try {
      // Use regex to find all img tags with src attributes
      return html.replace(
        /<img([^>]*)src=["']([^"']*)["']([^>]*)>/gi, 
        (match, beforeSrc, src, afterSrc) => {
          // Normalize the src URL using our centralized function
          const normalizedSrc = normalizeMediaUrl(src);
          return `<img${beforeSrc}src="${normalizedSrc}"${afterSrc}>`;
        }
      );
    } catch (error) {
      console.error("Error normalizing HTML image URLs:", error);
      return html;
    }
  };

  const renderContent = () => {
    if (isJsonContent) {
      try {
        // For JSON content, display a formatted pre block
        const formatted = JSON.stringify(JSON.parse(editorContent), null, 2);
        return (
          <pre className="p-4 bg-muted rounded-md font-mono text-sm overflow-auto max-h-[600px]">
            {formatted}
          </pre>
        );
      } catch (e) {
        // If there's an error, show the raw content
        return (
          <>
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Invalid JSON</AlertTitle>
              <AlertDescription>
                This content appears to be JSON but is not valid. 
                {e instanceof Error && `: ${e.message}`}
              </AlertDescription>
            </Alert>
            <pre className="p-4 bg-muted rounded-md font-mono text-sm overflow-auto max-h-[600px]">
              {editorContent}
            </pre>
          </>
        );
      }
    }

    // Apply our URL normalization before rendering HTML content
    const normalizedContent = normalizeHtmlContent(editorContent);

    // Log the content being rendered for debugging
    console.log(`Rendering content for ${pageSlug}:`, {
      contentLength: normalizedContent?.length || 0,
      hasImage: normalizedContent?.includes('<img') || false,
      calMapPresent: normalizedContent?.includes('CalMAP-Logo') || false,
      contentPreview: normalizedContent?.substring(0, 150) + '...',
      slug: pageSlug,
      urlsNormalized: normalizedContent !== editorContent
    });
    
    // Render the HTML content with normalized URLs
    return (
      <>
        <div 
          dangerouslySetInnerHTML={{ __html: normalizedContent }} 
          className="vendor-content-container"
        />

        {/* Render embedded form if available and user is admin */}
        {!isEditing && isAdmin && <EmbeddedForm pageSlug={pageSlug} isEditing={false} />}
      </>
    );
  };

  // The hide-default-title flag lives on the cached page content; fall back
  // to the prop so the very first render (before the cache is populated)
  // still respects the saved preference.
  const cachedPage = queryClient.getQueryData<PageContent>(["/api/pages", pageSlug]);
  const hideDefaultTitle = !!(cachedPage?.hideDefaultTitle ?? content?.hideDefaultTitle);

  // For non-admin users, just show the content. When the admin has chosen to
  // hide the default title we still emit an sr-only heading so screen readers
  // and the document outline retain the page's name.
  if (!user || user.role !== "admin") {
    return (
      <div className="prose max-w-none">
        {hideDefaultTitle ? <h1 className="sr-only">{title}</h1> : <h1>{title}</h1>}
        {renderContent()}
      </div>
    );
  }

  // View mode for admin users
  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end items-center gap-2">
          {/* Hide-default-title checkbox - admins only, and only once the
              page has an ID to PATCH against. Useful when the page body
              already includes its own styled headline so the auto-rendered
              title would otherwise show twice. Sits to the left of the
              Edit Page button to mirror Task #86's forum implementation. */}
          {content?.id && (
            <div className="flex items-center gap-2 px-2 h-9 rounded-md border border-input">
              <Checkbox
                id={`hide-default-title-${pageSlug}`}
                checked={hideDefaultTitle}
                disabled={toggleHideTitleMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleHideTitleMutation.mutate(checked === true)
                }
                data-testid="checkbox-hide-default-title"
              />
              <Label
                htmlFor={`hide-default-title-${pageSlug}`}
                className="text-sm cursor-pointer select-none"
              >
                Hide default title
              </Label>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshContent}
            disabled={isRefreshing}
            className="hidden"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* We want the version history button to always show for admin users */}
          <ContentVersionHistory 
            contentId={content?.id}
            slug={pageSlug}
            onRestore={handleVersionRestore}
          />
          
          <Button onClick={() => {
            try {
              // Ensure content is loaded before entering edit mode
              if (pageSlug?.startsWith('amenities-')) {
                console.log(`🔍 Validating content before editing ${pageSlug}`);

                // Make sure we have the content in cache
                const cachedContent = queryClient.getQueryData(["/api/pages", pageSlug]);
                if (!cachedContent) {
                  // If not cached, try to fetch it first
                  console.log(`⚠️ Content not in cache, fetching first`);

                  // Trigger a refresh before entering edit mode
                  refreshContent().then(() => {
                    console.log("✅ Content refreshed, now entering edit mode");
                    enterEditMode();
                  }).catch(error => {
                    console.error("Failed to refresh content:", error);
                    // Still enter edit mode, but warn the user
                    toast({
                      title: "Warning",
                      description: "Could not refresh latest content. You may be editing outdated content.",
                      variant: "destructive",
                    });
                    enterEditMode();
                  });

                  // Don't proceed with setting edit mode yet - wait for the refresh
                  return;
                }
              }

              // If we get here, either it's not an amenities page or the content is cached
              enterEditMode();
            } catch (error) {
              console.error("Error entering edit mode:", error);
              // Still try to enter edit mode even if there was an error
              enterEditMode();
            }
          }}>Edit Page</Button>
        </div>
        <div className="prose max-w-none">
          {hideDefaultTitle ? <h1 className="sr-only">{title}</h1> : <h1>{title}</h1>}
          {renderContent()}
        </div>
      </div>
    );
  }

  // Edit mode for admin users
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-4xl font-bold w-full bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary rounded px-2"
          placeholder="Page Title"
        />
        <div className="flex gap-2 items-center">
          {/* Hide-default-title checkbox - mirrors the view-mode toggle so
              admins can hide the auto-rendered page title without leaving
              the editor. Persists immediately via the same mutation, which
              keeps the React Query cache (and the view-mode checkbox) in
              sync with no extra Save Changes wiring needed. */}
          {content?.id && (
            <div className="flex items-center gap-2 px-2 h-9 rounded-md border border-input">
              <Checkbox
                id={`hide-default-title-edit-${pageSlug}`}
                checked={hideDefaultTitle}
                disabled={toggleHideTitleMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleHideTitleMutation.mutate(checked === true)
                }
                data-testid="checkbox-hide-default-title-edit"
              />
              <Label
                htmlFor={`hide-default-title-edit-${pageSlug}`}
                className="text-sm cursor-pointer select-none whitespace-nowrap"
              >
                Hide default title
              </Label>
            </div>
          )}
          {/* Always show version history button for consistency */}
          <ContentVersionHistory 
            contentId={content?.id} 
            slug={pageSlug}
            onRestore={handleVersionRestore}
          />
          <Button
            variant="outline"
            onClick={exitEditMode}
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate({ 
              title, 
              content: editorContent || "" // No default content, empty string if no content
            })}
            disabled={saveMutation.isPending || (isJsonContent && !!jsonError)}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content" className="my-4">
        <TabsList>
          <TabsTrigger value="content">Page Content</TabsTrigger>
          <TabsTrigger value="form" className="flex items-center gap-1">
            <FormInput className="h-4 w-4" /> 
            Embedded Form
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          {isJsonContent ? (
            <>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-medium">JSON Editor</span>
                  {jsonError && <span className="text-destructive text-sm">({jsonError})</span>}
                </div>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    try {
                      setEditorContent(formatJson(editorContent));
                      toast({
                        title: "JSON Formatted",
                        description: "JSON code has been formatted.",
                      });
                    } catch (e) {
                      toast({
                        title: "Format Error",
                        description: `Could not format JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={!!jsonError}
                >
                  Format JSON
                </Button>
              </div>

              {jsonError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>JSON Error</AlertTitle>
                  <AlertDescription>{jsonError}</AlertDescription>
                </Alert>
              )}

              <Textarea
                className="font-mono min-h-[500px] text-sm"
                value={editorContent}
                onChange={(e) => handleJsonChange(e.target.value)}
                spellCheck={false}
              />
            </>
          ) : (
            <WysiwygEditor 
              editorContent={editorContent}
              setEditorContent={setEditorContent}
              editorContext={{
                // Detect community pages specifically by URL and override section if needed
                section: (() => {
                  const isCommunityPage = window.location.pathname.startsWith('/community/');
                  const sectionValue = isCommunityPage ? 'community' : 
                                     (section || pageSlug?.split('-')?.[0] || 'content');
                  
                  console.log(`[WysiwygEditor] Setting editorContext.section to "${sectionValue}"`, {
                    pathname: window.location.pathname,
                    isCommunityPage,
                    sectionProp: section,
                    pageSlug,
                    derivedSection: pageSlug?.split('-')?.[0] || 'content'
                  });
                  
                  return sectionValue;
                })(),
                slug: pageSlug || slug
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="form">
          {isAdmin && <EmbeddedForm pageSlug={pageSlug} isEditing={true} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}