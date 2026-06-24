import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { type CarouselApi } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Settings, Loader2, Plus, ChevronUp, ChevronDown, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BannerSlideEditor } from "./banner-slide-editor";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cacheMedia, getCachedMedia, isMediaUrl, prefetchCriticalMedia, normalizeMediaUrl } from "@/lib/media-cache";
import { convertBannerSlidePaths, getEnvironmentAppropriateUrl } from "@/lib/media-path-utils";
import { BannerVideo } from "./banner-video";
import { BannerErrorBoundary } from "./banner-error-boundary";

// Local memory cache for direct manipulation
const inMemoryMediaCache = new Map<string, string>();

// Helper function to convert any absolute URL to a relative one
function toRelativePath(url: string): string {
  // Return unchanged if not absolute URL
  if (!url) return url;
  if (url.startsWith('/')) return url; // Already relative

  try {
    // Check if it's an absolute URL starting with http(s)://barefootbay.com or //barefootbay.com
    if (url.includes('barefootbay.com')) {
      // Create URL object to extract path, search and hash
      const urlObj = new URL(url.startsWith('//') ? `https:${url}` : url);
      console.log(`Converting absolute URL ${url} to relative path ${urlObj.pathname}${urlObj.search}${urlObj.hash}`);
      return `${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
    }
    return url;
  } catch (e) {
    console.error('Error converting URL:', e);
    return url;
  }
}

// Note: We've moved BannerVideo and BannerImage to their own component files
// and now importing them from "./banner-video" and "./banner-image"

// Define the interface for banner slides
export interface BannerSlide {
  src: string;
  alt: string;
  caption: string;
  link: string;
  customLink?: string; // For storing custom URL when "custom" is selected
  buttonText?: string;
  bgPosition?: string; // CSS background-position value
  mediaType?: 'image' | 'video'; // Type of media - image (default) or video
  autoplay?: boolean; // Whether to autoplay videos when slide is active (default true for videos)
}

// Initial banner slides data
const defaultCommunityImages: BannerSlide[] = [
  {
    src: "/public/banner-placeholder.jpg",
    alt: "Barefoot Bay Golf Course",
    caption: "World-Class Golf Course",
    link: "/banner#slide1",
    buttonText: "Explore Amenities"
  },
  {
    src: "/public/banner-placeholder.jpg",
    alt: "Barefoot Bay Tennis Courts",
    caption: "Premier Tennis & Pickleball Facilities",
    link: "/banner#slide2",
    buttonText: "Explore Amenities"
  },
  {
    src: "/public/banner-placeholder.jpg",
    alt: "Barefoot Bay Community Pool",
    caption: "Resort-Style Swimming Pools",
    link: "/banner#slide3",
    buttonText: "Explore Amenities"
  },
  {
    src: "/public/banner-placeholder.jpg",
    alt: "Barefoot Bay Clubhouse",
    caption: "Elegant Community Clubhouse",
    link: "/banner#slide4",
    buttonText: "Explore Amenities"
  }
];

export function CommunityShowcase() {
  // Critical diagnostic log - confirm component is rendering
  console.log('🔍 [MOBILE DEBUG] CommunityShowcase component is mounting/rendering');
  
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [communityImages, setCommunityImages] = useState<BannerSlide[]>(defaultCommunityImages);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Enhanced logging for mobile debugging - track state changes
  useEffect(() => {
    console.log("🔍 [MOBILE DEBUG] communityImages state updated:", {
      count: communityImages.length,
      isArray: Array.isArray(communityImages),
      firstThree: communityImages.slice(0, 3).map(slide => ({
        src: slide.src?.substring(0, 50) + (slide.src?.length > 50 ? '...' : ''),
        alt: slide.alt,
        caption: slide.caption
      }))
    });
  }, [communityImages]);

  useEffect(() => {
    console.log("🔍 [MOBILE DEBUG] current slide index changed to:", current);
  }, [current]);

  useEffect(() => {
    console.log("🔍 [MOBILE DEBUG] autoAdvanceEnabled state:", autoAdvanceEnabled);
  }, [autoAdvanceEnabled]);

  // Function to handle saving edited slide
  const handleSaveSlide = async (index: number, updatedSlide: BannerSlide) => {
    setIsSaving(true);

    try {
      const newSlides = [...communityImages];

      // Check if the slide has a blob: URL (from URL.createObjectURL) and replace with actual URL
      if (updatedSlide.src.startsWith('blob:')) {
        console.log("Slide has blob URL, using previous URL until upload completes");
        // The actual upload is handled in the banner-slide-editor.tsx
        // It will call this function again after uploading with the real URL
      }

      // Clear this media from cache to ensure we fetch fresh content
      if (typeof window !== 'undefined') {
        const mediaKey = `media-cache:${updatedSlide.src}`;
        const mediaLoadedKey = `media-cache:${updatedSlide.src}-loaded`;

        // Clear from localStorage
        localStorage.removeItem(mediaKey);
        localStorage.removeItem(mediaLoadedKey);
        localStorage.removeItem(`${mediaKey}-timestamp`);
        localStorage.removeItem(`${mediaLoadedKey}-timestamp`);

        // Clear from in-memory cache
        if (inMemoryMediaCache) {
          inMemoryMediaCache.delete(updatedSlide.src);
          inMemoryMediaCache.delete(`${updatedSlide.src}-loaded`);
        }

        console.log(`Cleared cache for updated media: ${updatedSlide.src}`);
      }

      newSlides[index] = updatedSlide;

      // Save to backend
      await saveBannerSlidesToBackend(newSlides);

      // Fetch fresh content from backend after saving to ensure consistency
      try {
        const response = await apiRequest("GET", "/api/pages/banner-slides");
        if (response.ok) {
          const data = await response.json();
          if (data && data.content) {
            const parsedSlides = JSON.parse(data.content);
            if (Array.isArray(parsedSlides) && parsedSlides.length > 0) {
              // Use fresh data from server
              console.log("Using fresh banner slides data from server");
              setCommunityImages(parsedSlides);
              localStorage.setItem('communityBannerSlides', JSON.stringify(parsedSlides));
            } else {
              // Fall back to local updates
              setCommunityImages(newSlides);
              localStorage.setItem('communityBannerSlides', JSON.stringify(newSlides));
            }
          } else {
            setCommunityImages(newSlides);
            localStorage.setItem('communityBannerSlides', JSON.stringify(newSlides));
          }
        } else {
          setCommunityImages(newSlides);
          localStorage.setItem('communityBannerSlides', JSON.stringify(newSlides));
        }
      } catch (error) {
        console.error("Error fetching fresh banner slides:", error);
        setCommunityImages(newSlides);
        localStorage.setItem('communityBannerSlides', JSON.stringify(newSlides));
      }

      // Force a cache refresh for the React Query cache
      queryClient.invalidateQueries({ queryKey: ["/api/pages/banner-slides"] });
      queryClient.refetchQueries({ queryKey: ["/api/pages/banner-slides"] });

      toast({
        title: "Success",
        description: "Banner slide updated successfully",
      });
    } catch (error) {
      console.error("Error saving banner slide:", error);
      toast({
        title: "Error",
        description: "Failed to save banner slide changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setEditingSlideIndex(null);
    }
  };

  // Function to delete a banner slide
  const handleDeleteSlide = async (index: number) => {
    setIsSaving(true);

    try {
      if (communityImages.length <= 1) {
        toast({
          title: "Error",
          description: "Cannot delete the last banner slide. At least one slide must exist.",
          variant: "destructive",
        });
        return;
      }

      // Get the slide being deleted to clear its cache
      const slideToDelete = communityImages[index];
      if (slideToDelete && slideToDelete.src) {
        // Clear this media from cache
        if (typeof window !== 'undefined') {
          const mediaKey = `media-cache:${slideToDelete.src}`;
          const mediaLoadedKey = `media-cache:${slideToDelete.src}-loaded`;

          // Clear from localStorage
          localStorage.removeItem(mediaKey);
          localStorage.removeItem(mediaLoadedKey);
          localStorage.removeItem(`${mediaKey}-timestamp`);
          localStorage.removeItem(`${mediaLoadedKey}-timestamp`);

          // Clear from in-memory cache
          if (inMemoryMediaCache) {
            inMemoryMediaCache.delete(slideToDelete.src);
            inMemoryMediaCache.delete(`${slideToDelete.src}-loaded`);
          }

          console.log(`Cleared cache for deleted media: ${slideToDelete.src}`);
        }
      }

      const newSlides = [...communityImages];
      newSlides.splice(index, 1);

      // Save to backend
      await saveBannerSlidesToBackend(newSlides);

      // Update local state
      setCommunityImages(newSlides);

      // Update localStorage
      localStorage.setItem('communityBannerSlides', JSON.stringify(newSlides));

      // Force a cache refresh for the React Query cache
      queryClient.invalidateQueries({ queryKey: ["/api/pages/banner-slides"] });
      queryClient.refetchQueries({ queryKey: ["/api/pages/banner-slides"] });

      toast({
        title: "Success",
        description: "Banner slide deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting banner slide:", error);
      toast({
        title: "Error",
        description: "Failed to delete banner slide",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setEditingSlideIndex(null);
    }
  };

  // Function to add a new banner slide
  const handleAddSlide = async () => {
    setIsSaving(true);

    try {
      // Create a new blank slide
      const newSlide: BannerSlide = {
        src: "/public/banner-placeholder.jpg", // Use a reliable placeholder image
        alt: "New Banner Slide",
        caption: "New Banner Slide",
        link: "/",
        buttonText: "Learn More",
        bgPosition: "center"
      };

      const newSlides = [...communityImages, newSlide];

      // Save to backend
      await saveBannerSlidesToBackend(newSlides);

      // Update local state
      setCommunityImages(newSlides);

      // Update localStorage
      localStorage.setItem('communityBannerSlides', JSON.stringify(newSlides));

      // Open the editor for the new slide
      setEditingSlideIndex(newSlides.length - 1);

      toast({
        title: "Success",
        description: "New banner slide added",
      });
    } catch (error) {
      console.error("Error adding banner slide:", error);
      toast({
        title: "Error",
        description: "Failed to add new banner slide",
        variant: "destructive",
      });
      setIsSaving(false);
    }
  };

  // Function to reorder banner slides
  const handleReorderSlides = async (fromIndex: number, toIndex: number) => {
    setIsSaving(true);

    try {
      const newSlides = [...communityImages];

      // Remove the slide from its current position
      const [movedSlide] = newSlides.splice(fromIndex, 1);

      // Insert it at the new position
      newSlides.splice(toIndex, 0, movedSlide);

      // Save to backend
      await saveBannerSlidesToBackend(newSlides);

      // Update local state
      setCommunityImages(newSlides);

      // Update localStorage
      localStorage.setItem('communityBannerSlides', JSON.stringify(newSlides));

      // Update the editing index to match the new position
      setEditingSlideIndex(toIndex);

      toast({
        title: "Success",
        description: `Banner slide moved to position ${toIndex + 1}`,
      });
    } catch (error) {
      console.error("Error reordering banner slides:", error);
      toast({
        title: "Error",
        description: "Failed to reorder banner slides",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Save slides to backend
  const saveBannerSlidesToBackend = async (slides: BannerSlide[]) => {
    try {
      // Normalize slides based on environment using our utility function
      const normalizedSlides = convertBannerSlidePaths(slides);

      // Always save to localStorage first for non-admin users
      localStorage.setItem('communityBannerSlides', JSON.stringify(normalizedSlides));

      // Only try API calls if the user is logged in and admin (to avoid 401 errors)
      if (!user || !isAdmin) {
        console.log("User not authenticated as admin, banner slide changes saved to localStorage only");
        return { ok: true, status: 200 }; // Return a mock successful response
      }

      // First try to get the existing content
      let existingContent;
      try {
        const getResponse = await apiRequest("GET", "/api/pages/banner-slides");
        existingContent = await getResponse.json();
      } catch (err) {
        // Check if it's an auth error (401)
        if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
          console.log("Not authorized to get banner slides, using localStorage only");
          return { ok: true, status: 200 }; // Return a mock successful response
        }
        console.log("Banner slides content doesn't exist yet, will create new one");
        existingContent = null;
      }

      const contentData = {
        slug: "banner-slides",
        title: "Homepage Banner Slides",
        content: JSON.stringify(normalizedSlides)
      };

      let response;

      if (existingContent && existingContent.id) {
        // Update existing content with explicit versioning
        console.log(`Updating existing banner slides content with ID: ${existingContent.id}`);

        // Add a trigger for versioning in the payload
        const updateData = {
          ...contentData,
          createVersion: true, // Signal to the backend that we want to create a version
          versionNotes: "Banner slide update" // Optional notes for the version
        };

        response = await apiRequest("PATCH", `/api/pages/${existingContent.id}`, updateData);
      } else {
        // Create new content
        console.log("Creating new banner slides content");
        response = await apiRequest("POST", "/api/pages", contentData);
      }

      // Invalidate any cached queries for banner slides
      queryClient.invalidateQueries({ queryKey: ["/api/pages/banner-slides"] });

      // Also invalidate the content versions query
      if (existingContent && existingContent.id) {
        queryClient.invalidateQueries({ queryKey: ['content-versions', existingContent.id] });
        queryClient.invalidateQueries({ queryKey: ['content-versions-by-slug', 'banner-slides'] });
      }

      return response;
    } catch (error) {
      // Check if it's an authentication error
      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        console.log("Not authorized to save banner slides, using localStorage only");
        return { ok: true, status: 200 }; // Return a mock successful response
      }

      // For other errors, log and rethrow
      console.error("Error saving banner slides:", error);
      throw error;
    }
  };

  // Default banner slides to use when none exist.
  // A single neutral welcome slide pointing at the bundled placeholder asset
  // (`public/banner-placeholder.jpg`) so that an empty backend response can
  // never render references to missing files.
  const defaultBannerSlides: BannerSlide[] = [
    {
      src: "/banner-placeholder.jpg",
      alt: "Welcome to Barefoot Bay",
      caption: "Welcome to Barefoot Bay",
      link: "/",
      buttonText: "Explore",
      bgPosition: "center"
    }
  ];

  // Helper function to normalize URLs in banner slides (convert /amenities to /banner and handle absolute URLs)
  const normalizeSlideUrls = (slides: BannerSlide[]): BannerSlide[] => {
    return slides.map(slide => {
      // First convert any absolute barefootbay.com URL to relative path
      let normalizedLink = toRelativePath(slide.link);

      // Check if the link is to old amenities format with hash
      if (normalizedLink.startsWith('/amenities#')) {
        // Extract the hash part and convert to /banner#slide format
        const hash = normalizedLink.split('#')[1];
        if (hash) {
          // If it's already a numbered slide format, keep it
          if (hash.startsWith('slide')) {
            normalizedLink = `/banner#${hash}`;
          } else {
            // Otherwise, it's a named section like "golf" - convert to slide number
            const sectionToSlideMap: Record<string, string> = {
              "golf": "slide1",
              "tennis": "slide2",
              "pools": "slide3",
              "clubhouse": "slide4"
            };

            const slideNumber = sectionToSlideMap[hash] || "slide1";
            normalizedLink = `/banner#${slideNumber}`;
          }
        }
      }

      // Normalize the media src URL
      let normalizedSrc = slide.src;

      // Use our path utils to normalize the URL
      if (normalizedSrc) {
        try {
          // Import from media-path-utils for consistency
          normalizedSrc = getEnvironmentAppropriateUrl(normalizedSrc, 'banner-slides');
          console.log(`Normalized banner slide src from ${slide.src} to ${normalizedSrc}`);
        } catch (e) {
          console.error('Error normalizing banner slide src:', e);
        }
      }

      return { 
        ...slide, 
        link: normalizedLink,
        src: normalizedSrc
      };
    });
  };

  // Prefetch initial critical media on component mount
  useEffect(() => {
    // Find all banner slide media URLs
    const criticalMediaUrls = communityImages
      .map(slide => slide.src)
      .filter(url => !!url && isMediaUrl(url));

    // Prefetch the critical media
    if (criticalMediaUrls.length > 0) {
      prefetchCriticalMedia(criticalMediaUrls);
    }
  }, [communityImages]);

  // Load slides - first try from backend, then from localStorage, finally use defaults
  useEffect(() => {
    const fetchBannerContent = async () => {
      console.log("🔍 [MOBILE DEBUG] Starting banner slide data fetch process");
      setIsLoading(true);

      try {
        // First try to fetch from backend with cache-busting
        console.log("🔍 [MOBILE DEBUG] Attempting to fetch from backend API: /api/pages/banner-slides");
        const cacheBuster = `?t=${Date.now()}`;
        const response = await apiRequest("GET", `/api/pages/banner-slides${cacheBuster}`);
        console.log("🔍 [MOBILE DEBUG] API Response status:", response.status, "OK:", response.ok);

        try {
          const data = await response.json();
          console.log("🔍 [MOBILE DEBUG] API Response data received:", data ? "YES" : "NO");
          console.log("🔍 [MOBILE DEBUG] API Response data.content exists:", data?.content ? "YES" : "NO");

          if (data && data.content) {
            try {
              const parsedContent = JSON.parse(data.content);
              console.log("🔍 [MOBILE DEBUG] Parsed content type:", Array.isArray(parsedContent) ? "ARRAY" : typeof parsedContent);
              console.log("🔍 [MOBILE DEBUG] Parsed content length:", Array.isArray(parsedContent) ? parsedContent.length : "N/A");
              
              if (Array.isArray(parsedContent) && parsedContent.length > 0) {
                console.log("🔍 [MOBILE DEBUG] Backend slides data (first 3):", parsedContent.slice(0, 3).map(slide => ({
                  src: slide.src,
                  alt: slide.alt,
                  caption: slide.caption
                })));
                
                // Normalize URLs before setting the state
                const normalizedSlides = normalizeSlideUrls(parsedContent);
                console.log("🔍 [MOBILE DEBUG] Normalized slides count:", normalizedSlides.length);

                // Save the normalized slides back to the database if they've changed
                if (JSON.stringify(normalizedSlides) !== JSON.stringify(parsedContent)) {
                  console.log("🔍 [MOBILE DEBUG] Updating banner slides with normalized URLs");
                  saveBannerSlidesToBackend(normalizedSlides);
                }

                console.log("🔍 [MOBILE DEBUG] Setting community images from backend data");
                setCommunityImages(normalizedSlides);
                setIsLoading(false);
                return;
              } else {
                console.log("🔍 [MOBILE DEBUG] Backend data invalid - not array or empty length");
              }
            } catch (error) {
              console.error("🔍 [MOBILE DEBUG] Error parsing banner slides content:", error);
            }
          } else {
            console.log("🔍 [MOBILE DEBUG] Backend response missing data or content field");
          }
        } catch (error) {
          console.error("🔍 [MOBILE DEBUG] Error parsing JSON response:", error);
        }

        // If backend fetch fails, try localStorage
        console.log("🔍 [MOBILE DEBUG] Backend fetch failed, trying localStorage fallback");
        const savedSlides = localStorage.getItem('communityBannerSlides');
        console.log("🔍 [MOBILE DEBUG] localStorage data exists:", savedSlides ? "YES" : "NO");
        if (savedSlides) {
          try {
            const parsedSlides = JSON.parse(savedSlides);
            console.log("🔍 [MOBILE DEBUG] localStorage parsed slides type:", Array.isArray(parsedSlides) ? "ARRAY" : typeof parsedSlides);
            console.log("🔍 [MOBILE DEBUG] localStorage parsed slides length:", Array.isArray(parsedSlides) ? parsedSlides.length : "N/A");
            
            if (Array.isArray(parsedSlides) && parsedSlides.length > 0) {
              console.log("🔍 [MOBILE DEBUG] localStorage slides data (first 3):", parsedSlides.slice(0, 3).map(slide => ({
                src: slide.src,
                alt: slide.alt,
                caption: slide.caption
              })));
              
              // Normalize URLs before setting the state
              const normalizedSlides = normalizeSlideUrls(parsedSlides);
              console.log("🔍 [MOBILE DEBUG] localStorage normalized slides count:", normalizedSlides.length);

              // Update localStorage if necessary
              if (JSON.stringify(normalizedSlides) !== JSON.stringify(parsedSlides)) {
                console.log("🔍 [MOBILE DEBUG] Updating localStorage banner slides with normalized URLs");
                localStorage.setItem('communityBannerSlides', JSON.stringify(normalizedSlides));
              }

              console.log("🔍 [MOBILE DEBUG] Setting community images from localStorage data");
              setCommunityImages(normalizedSlides);
              return;
            } else {
              console.log("🔍 [MOBILE DEBUG] localStorage data invalid - not array or empty length");
            }
          } catch (error) {
            console.error("🔍 [MOBILE DEBUG] Error parsing saved banner slides:", error);
          }
        } else {
          console.log("🔍 [MOBILE DEBUG] No localStorage data found");
        }

        // If both backend and localStorage fail, use defaults
        console.log("Using default banner slides");
        setCommunityImages(defaultBannerSlides);

        // Save defaults to localStorage for next time
        localStorage.setItem('communityBannerSlides', JSON.stringify(defaultBannerSlides));

        // Also save to backend if admin - IMPORTANT: Create the content in the database
        if (isAdmin) {
          try {
            console.log("Admin user detected, creating banner slides in database");
            console.log("Default banner slides to save:", defaultBannerSlides);

            const contentData = {
              slug: "banner-slides",
              title: "Homepage Banner Slides",
              content: JSON.stringify(defaultBannerSlides)
            };

            console.log("Sending to backend:", contentData);

            // Create new content directly
            const response = await apiRequest("POST", "/api/pages", contentData);
            console.log("API Response status:", response.status);

            if (response.ok) {
              console.log("Default banner slides saved to backend");

              // Invalidate queries to ensure fresh data is fetched next time
              queryClient.invalidateQueries({ queryKey: ["/api/pages/banner-slides"] });
            } else {
              const errorText = await response.text();
              console.error("Failed to save banner slides:", errorText);
            }
          } catch (error) {
            console.error("Failed to save default banner slides to backend:", error);
          }
        }
      } catch (error) {
        console.error("Error fetching banner slides:", error);

        // Try localStorage as fallback
        const savedSlides = localStorage.getItem('communityBannerSlides');
        if (savedSlides) {
          try {
            const parsedSlides = JSON.parse(savedSlides);
            if (Array.isArray(parsedSlides) && parsedSlides.length > 0) {
              // Normalize URLs before setting the state
              const normalizedSlides = normalizeSlideUrls(parsedSlides);

              // Update localStorage if necessary
              if (JSON.stringify(normalizedSlides) !== JSON.stringify(parsedSlides)) {
                console.log("Updating localStorage banner slides with normalized URLs (fallback)");
                localStorage.setItem('communityBannerSlides', JSON.stringify(normalizedSlides));
              }

              setCommunityImages(normalizedSlides);
              return;
            }
          } catch (error) {
            console.error("Error parsing saved banner slides:", error);
          }
        }

        // If that still fails, use defaults
        console.log("Using default banner slides after all other methods failed");
        setCommunityImages(defaultBannerSlides);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBannerContent();
  }, [isAdmin]);

  // Function to preload the slide images for better performance
  const preloadAdjacentSlides = useCallback((currentIndex: number) => {
    const slidesToPreload: number[] = [];
    const totalSlides = communityImages.length;

    // Add current slide
    slidesToPreload.push(currentIndex);

    // Add next slide (with wraparound)
    const nextIndex = (currentIndex + 1) % totalSlides;
    slidesToPreload.push(nextIndex);

    // Add previous slide (with wraparound)
    const prevIndex = (currentIndex - 1 + totalSlides) % totalSlides;
    slidesToPreload.push(prevIndex);

    // Preload the media for upcoming slides using our cache system
    slidesToPreload.forEach(slideIndex => {
      const slide = communityImages[slideIndex];
      if (!slide) return;

      // Skip current slide as it's already loaded
      if (slideIndex === currentIndex) return;

      // Check for video media type or video file extension
      const isVideoSlide = slide.mediaType === 'video' || 
                         (slide.src && slide.src.match(/\.(mp4|webm|ogg|mov)$/i));

      if (isVideoSlide && slide.src) {
        // For videos, use a hidden video element to preload
        console.log('Preloading video slide:', slide.src, 'mediaType:', slide.mediaType || 'detected from extension');

        if (!getCachedMedia(`${slide.src}-loaded`)) {
          // Create temporary video element to preload in background
          const tempVideo = document.createElement('video');
          const normalizedSrc = normalizeMediaUrl(slide.src);
          console.log('Using normalized video src:', normalizedSrc);

          tempVideo.src = normalizedSrc;
          tempVideo.preload = 'metadata'; // Start with just metadata
          tempVideo.muted = true;
          tempVideo.style.display = 'none';

          // When metadata is loaded, add it to cache
          tempVideo.addEventListener('loadedmetadata', () => {
            cacheMedia(`${slide.src}-loaded`, 'metadata');
          });

          // Append temporarily to document to start loading
          document.body.appendChild(tempVideo);

          // Remove after a moment
          setTimeout(() => {
            document.body.removeChild(tempVideo);
          }, 5000);
        }
      } else if (slide.src && isMediaUrl(slide.src)) {
        // For images, preload using Image object
        if (!getCachedMedia(slide.src)) {
          const img = new Image();
          img.src = slide.src;

          img.onload = () => {
            try {
              // Add to our cache system
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;

              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                // Lower quality for cache to save space
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                cacheMedia(slide.src, dataUrl);
              }
            } catch (e) {
              console.error('Error caching image:', e);
            }
          };
        }
      }
    });
  }, [communityImages]);

  useEffect(() => {
    if (!api) return;

    const handleSelect = () => {
      const selectedIndex = api.selectedScrollSnap();
      setCurrent(selectedIndex);
      preloadAdjacentSlides(selectedIndex);
    };

    preloadAdjacentSlides(current);
    api.on("select", handleSelect);

    // Auto-advance timer, gated on tab visibility so the Replit mobile app
    // doesn't keep the carousel hot while the preview tab is backgrounded.
    // Previously this 5s interval ran regardless of visibility and was a
    // major contributor to the mobile reload loop.
    let autoAdvance: ReturnType<typeof setInterval> | null = null;
    const startTimer = () => {
      if (!autoAdvanceEnabled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      if (autoAdvance) return;
      autoAdvance = setInterval(() => {
        api.scrollNext();
      }, 5000);
    };
    const stopTimer = () => {
      if (autoAdvance) {
        clearInterval(autoAdvance);
        autoAdvance = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) stopTimer();
      else startTimer();
    };
    startTimer();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      stopTimer();
      api.off("select", handleSelect);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [api, autoAdvanceEnabled, preloadAdjacentSlides, current]);

  // When editing starts, pause auto-advance
  useEffect(() => {
    if (editingSlideIndex !== null) {
      setAutoAdvanceEnabled(false);
    } else {
      setAutoAdvanceEnabled(true);
    }
  }, [editingSlideIndex]);

  const instantScrollTo = useCallback((index: number) => {
    if (!api) return;
    api.scrollTo(index);
    // Don't manually set current - let the carousel's select event handler do it
  }, [api]);

  if (isLoading) {
    return (
      <div className="w-full min-h-[300px] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4">
      {/* Mobile-only direct carousel implementation with swipe navigation */}
      <div className="md:hidden relative">
        <div 
          className="relative overflow-hidden rounded-xl shadow-xl touch-pan-y"
          onTouchStart={(e) => {
            const touchStartX = e.touches[0].clientX;
            e.currentTarget.dataset.touchStartX = touchStartX.toString();
          }}
          onTouchEnd={(e) => {
            const touchStartX = parseFloat(e.currentTarget.dataset.touchStartX || '0');
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            const threshold = 50; // minimum swipe distance
            
            if (Math.abs(diff) > threshold) {
              if (diff > 0) {
                // Swipe left - next slide
                const nextSlide = current >= communityImages.length - 1 ? 0 : current + 1;
                setCurrent(nextSlide);
              } else {
                // Swipe right - previous slide
                const prevSlide = current <= 0 ? communityImages.length - 1 : current - 1;
                setCurrent(prevSlide);
              }
            }
          }}
        >
          <div className="relative aspect-[4/3] max-h-[400px] min-h-[250px] w-full overflow-hidden">
            {communityImages.map((image: BannerSlide, index: number) => (
              <div
                key={`mobile-slide-${index}`}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  current === index ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                {image.mediaType === 'video' ? (
                  <div className="w-full h-full relative">
                    <BannerErrorBoundary>
                      <BannerVideo 
                        src={image.src}
                        currentSlide={current === index}
                        alt={image.alt}
                      />
                    </BannerErrorBoundary>
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <img
                      src={image.src}
                      alt={image.alt || image.caption}
                      className="w-full h-full object-cover"
                      onLoad={() => {
                        console.log(`🔍 [MOBILE DIRECT] Successfully loaded slide ${index}: ${image.src}`);
                      }}
                    />
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 via-black/60 to-transparent">
                  <p className="text-3xl font-bold text-white text-center drop-shadow-lg mb-6">
                    {image.caption}
                  </p>
                  {image.link && (
                    <a
                      href={image.link.startsWith('http') ? image.link : `/${image.link}`}
                      className="px-6 py-3 bg-white/90 text-sm md:text-lg font-semibold rounded-lg hover:bg-coral hover:!text-white transition-colors duration-200 shadow-lg"
                      style={{ color: '#47759a' }}
                      target={image.link.startsWith('http') ? '_blank' : '_self'}
                      rel={image.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {image.buttonText || 'Learn More'}
                    </a>
                  )}
                </div>
                
                {/* Edit Button for Mobile - Only visible to admin users */}
                {isAdmin && current === index && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingSlideIndex(index);
                    }}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-20"
                    title="Edit banner slide"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Settings className="w-4 h-4 text-white" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Desktop Embla Carousel */}
      <Carousel 
        className="relative hidden md:block"
        opts={{
          align: "start",
          loop: true,
          watchDrag: true,
          skipSnaps: false,
          containScroll: "trimSnaps",
          dragFree: false,
        }}
        setApi={setApi}
      >
        <CarouselContent>
          {communityImages.map((image: BannerSlide, index: number) => {
            // CRITICAL DEBUG: Log what content is actually being rendered
            console.log(`🔍 [VISUAL DEBUG] Rendering slide ${index}:`, {
              src: image.src,
              caption: image.caption,
              alt: image.alt,
              isCurrentSlide: current === index,
              mediaType: image.mediaType || 'image'
            });
            
            // FORCE RERENDER by adding timestamp
            const forceRerender = Date.now();
            
            return (
            <CarouselItem key={`${index}-${forceRerender}`}>
              <div className="relative overflow-hidden rounded-xl shadow-xl transition-all hover:shadow-2xl">
                <div className="relative md:aspect-[16/9] aspect-[4/3] max-h-[400px] md:min-h-[400px] min-h-[250px] w-full overflow-hidden">

                  
                  {image.mediaType === 'video' ? (
                    <div data-slide-index={index} className="absolute inset-0 flex items-center justify-center transform scale-110">
                      <BannerErrorBoundary className="w-full h-full">
                        <BannerVideo 
                          src={image.src}
                          currentSlide={current === index}
                          alt={image.alt}
                          bgPosition={image.bgPosition}
                          onError={(e) => {
                            console.error("Video error:", e);
                            const target = e.target as HTMLVideoElement;
                            // We could set a fallback image here if needed
                          }}
                        />
                      </BannerErrorBoundary>
                    </div>
                  ) : (
                    <div className="w-full h-full relative">
                      <img
                        src={image.src}
                        alt={image.alt || image.caption}
                        className="w-full h-full object-cover"
                        style={{
                          objectPosition: image.bgPosition || 'center',
                        }}
                        onError={(e) => {
                          console.log(`🔍 [BANNER DEBUG] Failed to load: ${image.src}`);
                        }}
                        onLoad={() => {
                          console.log(`🔍 [BANNER DEBUG] Successfully loaded: ${image.src}`);
                        }}
                      />
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 via-black/60 to-transparent">
                    <p className="text-3xl font-bold text-white text-center drop-shadow-lg mb-6">
                      {image.caption}
                    </p>
                    {/* Handle links with proper detection of external URLs */}
                    <div>
                      {(() => {
                        // Determine the final URL to use
                        let finalUrl = '';
                        let isExternal = false;

                        // Handle the custom link case first
                        if (image.link === "custom" && image.customLink) {
                          // For custom links, use the customLink value
                          finalUrl = image.customLink;
                          // Check if it's an external URL
                          isExternal = finalUrl.startsWith('http://') || finalUrl.startsWith('https://');
                        } else {
                          // For predefined links, use the link value converted to relative path
                          finalUrl = toRelativePath(image.link);
                        }

                        // Additional check for any URL starting with http or https regardless of link type
                        if (!isExternal && (image.link.startsWith('http://') || image.link.startsWith('https://'))) {
                          isExternal = true;
                          finalUrl = image.link;
                        }

                        // Render as a real, crawlable anchor styled like a button.
                        // (Wrapping a <button> inside <a> is invalid HTML and is
                        // flagged by Lighthouse's "Links are not crawlable" audit.)
                        const anchorClassName =
                          "inline-flex items-center justify-center rounded-md border bg-white/90 text-sm md:text-lg font-medium px-3 py-1 md:px-4 md:py-2 hover:bg-coral hover:!text-white transition-colors shadow-sm";
                        const anchorStyle = { color: '#47759a' as const };
                        const label = image.buttonText || "Explore Amenities";
                        if (isExternal) {
                          return (
                            <a
                              href={finalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={anchorClassName}
                              style={anchorStyle}
                            >
                              {label}
                            </a>
                          );
                        } else {
                          return (
                            <Link to={finalUrl} className={anchorClassName} style={anchorStyle}>
                              {label}
                            </Link>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {/* Edit Button - Only visible to admin users */}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingSlideIndex(index);
                      }}
                      className="absolute top-2 right-2 sm:top-3 sm:right-3 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-20"
                      title="Edit banner slide"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-spin" />
                      ) : (
                        <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </CarouselItem>
            );
          })}
        </CarouselContent>

        {/* Add New Slide Button - Only visible to admin users */}
        {isAdmin && (
          <div className="absolute -bottom-14 right-0 z-10">
            <Button 
              onClick={handleAddSlide}
              className="flex items-center gap-2 hidden"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add New Banner Slide
            </Button>
          </div>
        )}
        {/* Navigation dots - responsive for both desktop and mobile */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 z-10">
          {communityImages.map((_: BannerSlide, index: number) => (
            <button
              key={index}
              className={`w-4 h-4 md:w-3 md:h-3 rounded-full transition-colors ${
                current === index ? "bg-white" : "bg-white/60 hover:bg-white"
              }`}
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => {
                console.log("🔍 [MOBILE DEBUG] Navigation dot clicked for slide:", index);
                instantScrollTo(index);
              }}
            />
          ))}
        </div>
      </Carousel>

      {/* Banner Slide Editor */}
      {editingSlideIndex !== null && (
        <BannerSlideEditor 
          slide={communityImages[editingSlideIndex]}
          index={editingSlideIndex}
          isOpen={editingSlideIndex !== null}
          onClose={() => setEditingSlideIndex(null)}
          onSave={handleSaveSlide}
          onDelete={handleDeleteSlide}
          onAdd={handleAddSlide}
          onReorder={handleReorderSlides}
          allSlides={communityImages}
        />
      )}
    </div>
  );
}