import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditableContent } from "@/components/shared/editable-content";
import type { PageContent } from "@shared/schema";

export default function AmenitiesPage() {
  const queryClient = useQueryClient();
  const [currentSection, setCurrentSection] = useState<string>("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [numSlides, setNumSlides] = useState(4);  // Default to 4 slides initially

  // Create a callback function for handling content restoration events
  const handleContentRestoration = useCallback((event: CustomEvent) => {
    console.log("🎯 Received amenities-content-restored event:", event.detail);
    
    const { slug, section } = event.detail;
    
    if (section) {
      console.log(`🔄 Updating current section to "${section}" after restoration`);
      setCurrentSection(section);
      
      // Force a controlled refresh without clearing entire cache
      console.log(`🔄 Performing targeted cache invalidation for ${slug}`);
      
      // Only invalidate the specific content that was restored
      queryClient.invalidateQueries({ queryKey: ['/api/pages', slug] });
      
      // Use a minimal refresh approach
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/pages', slug] });
        console.log('🔄 Completed targeted refresh after restoration');
      }, 100);
    }
  }, [queryClient]);

  // Initialize the page based on hash
  useEffect(() => {
    // Function to process URL hash and set current section
    function processHash() {
      // Get the current hash from URL
      const hash = window.location.hash.slice(1); // Remove the # symbol
      
      // Check if the hash starts with "slide" and has a number after it
      const slideMatch = hash.match(/^slide(\d+)$/);
      
      let slideIndex = 1; // Default to first slide
      if (slideMatch && slideMatch[1]) {
        const slideNum = parseInt(slideMatch[1], 10);
        if (!isNaN(slideNum) && slideNum > 0 && slideNum <= numSlides) {
          slideIndex = slideNum;
        }
      }
      
      // Convert slide number to old section format (for backward compatibility)
      const sectionMap = {
        1: "golf",
        2: "tennis", 
        3: "pools",
        4: "clubhouse"
      };
      
      // Use the mapped section if available, otherwise use "golf" as default
      const section = slideIndex <= Object.keys(sectionMap).length ? sectionMap[slideIndex as keyof typeof sectionMap] : `slide${slideIndex}`;
      
      console.log(`Debug: Initial hash=${hash}, using section="${section}", slideIndex=${slideIndex}`);
      
      setCurrentSection(section);
      
      // Update URL to use the slide format
      const newHash = `slide${slideIndex}`;
      if (newHash !== hash) {
        console.log(`Debug: Correcting URL hash from "${hash}" to "${newHash}"`);
        // Use replace state to avoid triggering more history events
        window.history.replaceState(null, "", `#${newHash}`);
      }
    }
    
    // Process hash immediately on page load
    processHash();

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1);
      
      // Check if the hash starts with "slide" and has a number after it
      const slideMatch = newHash.match(/^slide(\d+)$/);
      
      let slideIndex = 1; // Default to first slide
      if (slideMatch && slideMatch[1]) {
        const slideNum = parseInt(slideMatch[1], 10);
        if (!isNaN(slideNum) && slideNum > 0 && slideNum <= numSlides) {
          slideIndex = slideNum;
        }
      }
      
      // Convert slide number to old section format (for backward compatibility)
      const sectionMap = {
        1: "golf",
        2: "tennis", 
        3: "pools",
        4: "clubhouse"
      };
      
      // Use the mapped section if available, otherwise use slide format directly
      const newSection = slideIndex <= Object.keys(sectionMap).length ? sectionMap[slideIndex as keyof typeof sectionMap] : `slide${slideIndex}`;
      
      console.log(`Debug: Hash changed to "${newHash}", using section="${newSection}"`);
      
      // Only update if needed to avoid infinite loops
      if (currentSection !== newSection) {
        setCurrentSection(newSection);
      }
      
      // Update URL if needed using history API to avoid triggering more events
      const formattedHash = `slide${slideIndex}`;
      if (formattedHash !== newHash) {
        console.log(`Debug: Correcting URL hash from "${newHash}" to "${formattedHash}"`);
        window.history.replaceState(null, "", `#${formattedHash}`);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [currentSection, numSlides]);

  // Get banner slides to determine how many slides there are
  useEffect(() => {
    const fetchBannerSlides = async () => {
      try {
        const response = await fetch("/api/pages/banner-slides");
        if (response.ok) {
          const data = await response.json();
          if (data && data.content) {
            try {
              const slides = JSON.parse(data.content);
              if (Array.isArray(slides)) {
                setNumSlides(slides.length);
              }
            } catch (error) {
              console.error("Error parsing banner slides:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching banner slides:", error);
      }
    };

    fetchBannerSlides();
  }, []);

  // ALWAYS use dash format for consistency across the app (amenities-golf, not amenities#golf)
  const pageSlug = `amenities-${currentSection}`;

  // Query for the content - ONLY use dash format going forward
  const { 
    data: content,
    isLoading,
    refetch
  } = useQuery<PageContent>({
    queryKey: ["/api/pages", pageSlug],
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Always fetch fresh data
    retry: 3, // Retry failed requests
    retryDelay: 1000, // Wait 1 second between retries
    enabled: currentSection !== ""
  });

  // Force refetch when hash changes or when the component mounts
  useEffect(() => {
    // Skip if no current section is set yet
    if (!currentSection) return;
    
    console.log(`Debug: Setting up content refresh for section "${currentSection}"`);
    
    // Create a function that handles the forced refetch
    const forceRefetch = () => {
      console.log(`Debug: Force refetching content for section "${currentSection}"`);
      
      // Clear specific slug query instead of all pages
      queryClient.invalidateQueries({ queryKey: ["/api/pages", pageSlug] });
      
      // For backwards compatibility, also invalidate any hash format entries in the cache
      const hashFormat = `amenities#${currentSection}`;
      queryClient.invalidateQueries({ queryKey: ["/api/pages", hashFormat] });
      
      // Finally, trigger the refetch to get the latest data
      refetch();
      
      console.log(`Debug: Force refetch completed for section "${currentSection}"`);
    };
    
    // Set a short initial delay for component mount
    const initialTimer = setTimeout(forceRefetch, 100);
    
    // Only use visibility change handler for initial page load, not for editing workflows
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !hasLoaded) {
        console.log("Page became visible for first time, loading initial content");
        forceRefetch();
        setHasLoaded(true);
      }
    };
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('amenities-content-restored', handleContentRestoration as EventListener);
    
    return () => {
      clearTimeout(initialTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('amenities-content-restored', handleContentRestoration as EventListener);
    };
  }, [currentSection, pageSlug, refetch, queryClient, hasLoaded, handleContentRestoration]);

  const getDefaultTitle = () => {
    // Default section titles based on hash
    switch (currentSection) {
      case "golf":
        return "Golf Course";
      case "tennis":
        return "Tennis & Pickleball Facilities";
      case "pools":
        return "Swimming Pools";
      case "clubhouse":
        return "Community Clubhouse";
      default:
        return "Barefoot Bay Amenities";
    }
  };

  const getDefaultContent = () => {
    // Default section content based on hash
    return `<p>Welcome to the ${getDefaultTitle()} at Barefoot Bay. This content is editable by administrators.</p>`;
  };

  // Generate a stable key that doesn't change unless the specific content we're looking at changes
  // This will prevent unnecessary remounts which can lose editing state
  const key = content ? 
    `amenities-${currentSection}-${content.id}` : 
    // If no content yet, use stable key for this section
    `amenities-${currentSection}`;
  
  console.log(`Debug: Generated component key: ${key} for section "${currentSection}"`);

  // Convert section to slide number for tab display
  const getSectionSlideNumber = (section: string): number => {
    const sectionToSlideMap: Record<string, number> = {
      "golf": 1,
      "tennis": 2,
      "pools": 3,
      "clubhouse": 4
    };
    
    // Check if it's one of our mapped sections
    if (section in sectionToSlideMap) {
      return sectionToSlideMap[section];
    }
    
    // Check if it's already in slide format (like "slide5")
    const slideMatch = section.match(/^slide(\d+)$/);
    if (slideMatch && slideMatch[1]) {
      return parseInt(slideMatch[1], 10);
    }
    
    // Default to slide 1
    return 1;
  };

  // Show loading state while content is being fetched
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-gray-200 rounded w-3/4 mb-6"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Generate tab buttons dynamically based on number of slides
  const generateTabButtons = () => {
    const buttons = [];
    for (let i = 1; i <= numSlides; i++) {
      buttons.push(
        <Button
          key={`slide-${i}`}
          variant={getSectionSlideNumber(currentSection) === i ? "default" : "outline"}
          onClick={() => window.location.hash = `slide${i}`}
        >
          Slide {i}
        </Button>
      );
    }
    return buttons;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-center mb-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-2 flex flex-wrap gap-2">
          {generateTabButtons()}
        </div>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8">
          <EditableContent
            key={key}
            slug="amenities"
            section={currentSection}
            content={content}
            defaultTitle={getDefaultTitle()}
            defaultContent={getDefaultContent()}
          />
        </CardContent>
      </Card>
    </div>
  );
}