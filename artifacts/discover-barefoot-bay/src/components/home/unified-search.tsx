import { useState, useRef, useEffect } from "react";
import { Search, X, Calendar, MessageSquare, Home, Store, FileText, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { type Event } from "@shared/schema";

interface SearchResult {
  id: number | string;
  title: string;
  type: 'event' | 'forum' | 'listing' | 'vendor' | 'page';
  link: string;
  subtitle?: string;
  date?: string;
  isTitleMatch: boolean;
}

/**
 * Convert database community page slug to public URL format
 * Slugs are stored as either:
 *   - "{category}" for category index pages
 *   - "{category}-{page-name}" for regular pages
 * Examples:
 *   "social" -> "/community/social"
 *   "social-pickleball-club" -> "/community/social/pickleball-club"
 *   "community-snowbirds" -> "/community/community/snowbirds"
 *   "government-board-meeting" -> "/community/government/board-meeting"
 */
const convertCommunitySlugToPublicUrl = (slug: string): string => {
  if (!slug) {
    return '/community'; // Default fallback
  }
  
  // Split on the FIRST hyphen only to separate category from page name
  const firstHyphenIndex = slug.indexOf('-');
  
  if (firstHyphenIndex === -1) {
    // No hyphen found - this is likely a category index page
    // Return as /community/{category}
    return `/community/${slug}`;
  }
  
  const category = slug.substring(0, firstHyphenIndex);
  const pageName = slug.substring(firstHyphenIndex + 1);
  
  // Return the properly formatted URL
  return `/community/${category}/${pageName}`;
};

/**
 * Convert database vendor slug to public URL format
 * Example: "vendors-home-services-kellys-house-cleaning" -> "/vendors/home-services/kellys-house-cleaning"
 * Example: "vendors-pro-shop" -> "/vendors/general/pro-shop"
 */
const convertVendorSlugToPublicUrl = (slug: string): string => {
  if (!slug || !slug.startsWith('vendors-')) {
    return `/vendors/general/${slug}`; // Default to general category if not a vendor slug
  }
  
  // Remove the "vendors-" prefix
  const withoutPrefix = slug.substring(8); // Remove "vendors-"
  
  if (!withoutPrefix) {
    return '/vendors'; // Just the vendors page
  }
  
  // Find the first hyphen after removing prefix - this separates category from vendor name
  const parts = withoutPrefix.split('-');
  
  if (parts.length < 2) {
    // Only one part means it's just a vendor name without category
    // Default to "general" category
    return `/vendors/general/${withoutPrefix}`;
  }
  
  // Handle compound categories (like "home-services", "technology-and-electronics")
  const compoundCategories = [
    'home-services', 'technology-and-electronics', 'automotive-golf-carts',
    'hvac-and-air-quality', 'new-homes', 'food-and-dining', 'beauty-personal',
    'health-and-medical', 'real-estate', 'insurance-financial', 'retail-shops'
  ];
  
  let category = parts[0];
  let vendorNameStartIndex = 1;
  
  // Check for compound categories
  for (const compound of compoundCategories) {
    const compoundParts = compound.split('-');
    if (compoundParts.length > 1 && parts.length >= compoundParts.length) {
      const candidateCategory = parts.slice(0, compoundParts.length).join('-');
      if (candidateCategory === compound) {
        category = candidateCategory;
        vendorNameStartIndex = compoundParts.length;
        break;
      }
    }
  }
  
  // Join remaining parts as vendor name
  const vendorName = parts.slice(vendorNameStartIndex).join('-');
  
  // Handle edge case where there's no vendor name after the category
  if (!vendorName) {
    return `/vendors/${category}`;
  }
  
  return `/vendors/${category}/${vendorName}`;
};

export function UnifiedSearch() {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Fetch all data
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: listings = [] } = useQuery<any[]>({
    queryKey: ["/api/listings"],
  });

  const { data: forumCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/forum/categories"],
  });

  const { data: pages = [] } = useQuery<any[]>({
    queryKey: ["/api/pages"],
  });

  const { data: vendorCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/vendor-categories"],
  });

  // Fetch forum posts using useQueries for all categories in parallel
  const forumPostQueries = useQueries({
    queries: (forumCategories as any[]).map((category) => ({
      queryKey: ["/api/forum/categories", category.id, "posts"],
      queryFn: async () => {
        const response = await fetch(`/api/forum/categories/${category.id}/posts`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error(`Failed to fetch posts for category ${category.id}`);
        const posts = await response.json();
        return posts.map((post: any) => ({
          ...post,
          categoryName: category.name,
          categorySlug: category.slug
        }));
      },
      enabled: !!category.id,
    })),
  });

  // Combine all forum posts from all categories
  const forumPosts = forumPostQueries
    .filter(query => query.data)
    .flatMap(query => query.data || []);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search function
  const searchContent = (): SearchResult[] => {
    if (!query.trim()) return [];

    const searchTerm = query.toLowerCase().trim();
    const results: SearchResult[] = [];
    const maxPerCategory = 5;
    const now = new Date();

    // 1. Search community pages FIRST (filter out vendor pages and hidden pages)
    const communityPages = pages.filter((page: any) => 
      !page.slug?.startsWith('vendors-') && 
      !page.slug?.startsWith('banner-') && 
      !page.isHidden
    );
    
    const matchedPages = communityPages
      .filter((page: any) => {
        const titleMatch = page.title?.toLowerCase().includes(searchTerm);
        const contentMatch = page.content?.toLowerCase().includes(searchTerm);
        return titleMatch || contentMatch;
      })
      .map((page: any) => ({
        id: page.id,
        title: page.title,
        type: 'page' as const,
        link: convertCommunitySlugToPublicUrl(page.slug),
        subtitle: 'Community Page',
        date: '',
        isTitleMatch: page.title?.toLowerCase().includes(searchTerm)
      }))
      .sort((a, b) => {
        if (a.isTitleMatch && !b.isTitleMatch) return -1;
        if (!a.isTitleMatch && b.isTitleMatch) return 1;
        return 0;
      })
      .slice(0, maxPerCategory);
    results.push(...matchedPages);

    // 2. Search events SECOND (filter out past events, prioritize title matches, sort chronologically within groups)
    const filteredEvents = events
      .filter(event => {
        const eventDate = new Date(event.startDate);
        const isNotPast = eventDate >= now;
        const titleMatch = event.title.toLowerCase().includes(searchTerm);
        const descriptionMatch = event.description?.toLowerCase().includes(searchTerm);
        const locationMatch = event.location?.toLowerCase().includes(searchTerm);
        return isNotPast && (titleMatch || descriptionMatch || locationMatch);
      })
      .map(event => ({
        event,
        isTitleMatch: event.title.toLowerCase().includes(searchTerm)
      }));
    
    // Sort: title matches first (chronologically), then content matches (chronologically)
    const titleMatchEvents = filteredEvents
      .filter(e => e.isTitleMatch)
      .sort((a, b) => new Date(a.event.startDate).getTime() - new Date(b.event.startDate).getTime());
    
    const contentMatchEvents = filteredEvents
      .filter(e => !e.isTitleMatch)
      .sort((a, b) => new Date(a.event.startDate).getTime() - new Date(b.event.startDate).getTime());
    
    const sortedEvents = [...titleMatchEvents, ...contentMatchEvents];
    
    const matchedEvents = sortedEvents
      .slice(0, maxPerCategory)
      .map(({ event, isTitleMatch }) => ({
        id: event.id,
        title: event.title,
        type: 'event' as const,
        link: `/events/${event.id}`,
        subtitle: event.location || '',
        date: format(new Date(event.startDate), 'MMM d, yyyy'),
        isTitleMatch
      }));
    results.push(...matchedEvents);

    // 3. Search forum posts
    const matchedForum = forumPosts
      .filter(post => {
        const titleMatch = post.title?.toLowerCase().includes(searchTerm);
        const contentMatch = post.content?.toLowerCase().includes(searchTerm);
        return titleMatch || contentMatch;
      })
      .map(post => ({
        id: post.id,
        title: post.title,
        type: 'forum' as const,
        link: `/forum/post/${post.id}`,
        subtitle: post.categoryName || '',
        date: format(new Date(post.createdAt), 'MMM d, yyyy'),
        isTitleMatch: post.title?.toLowerCase().includes(searchTerm)
      }))
      .sort((a, b) => {
        if (a.isTitleMatch && !b.isTitleMatch) return -1;
        if (!a.isTitleMatch && b.isTitleMatch) return 1;
        return 0;
      })
      .slice(0, maxPerCategory);
    results.push(...matchedForum);

    // 4. Search listings
    const matchedListings = listings
      .filter((listing: any) => {
        const titleMatch = listing.title?.toLowerCase().includes(searchTerm);
        const descriptionMatch = listing.description?.toLowerCase().includes(searchTerm);
        const addressMatch = listing.address?.toLowerCase().includes(searchTerm);
        return titleMatch || descriptionMatch || addressMatch;
      })
      .map((listing: any) => ({
        id: listing.id,
        title: listing.title,
        type: 'listing' as const,
        link: `/for-sale/${listing.id}`,
        subtitle: listing.address || `${listing.listingType}`,
        date: listing.price ? `$${listing.price.toLocaleString()}` : '',
        isTitleMatch: listing.title?.toLowerCase().includes(searchTerm)
      }))
      .sort((a, b) => {
        if (a.isTitleMatch && !b.isTitleMatch) return -1;
        if (!a.isTitleMatch && b.isTitleMatch) return 1;
        return 0;
      })
      .slice(0, maxPerCategory);
    results.push(...matchedListings);

    // 5. Search vendor pages (filter out hidden pages and banners)
    const vendorPages = pages.filter((page: any) => 
      page.slug?.startsWith('vendors-') && !page.isHidden
    );
    
    // Helper function to extract category slug from vendor slug using dynamic category matching
    const extractCategoryFromSlug = (slug: string): string => {
      if (!slug.startsWith('vendors-')) return '';
      const withoutPrefix = slug.substring(8); // Remove "vendors-"
      if (!withoutPrefix) return '';
      
      // Use longest-prefix match against actual vendor categories for accurate extraction
      let matchedCategory = '';
      for (const cat of vendorCategories) {
        const catSlug = cat.slug;
        // Check if the slug starts with this category followed by a dash or end
        if (withoutPrefix === catSlug || withoutPrefix.startsWith(catSlug + '-')) {
          // Use longest match to handle compound categories correctly
          if (catSlug.length > matchedCategory.length) {
            matchedCategory = catSlug;
          }
        }
      }
      
      // Fallback to first segment if no category match found
      if (!matchedCategory) {
        const parts = withoutPrefix.split('-');
        return parts[0] || '';
      }
      
      return matchedCategory;
    };
    
    const matchedVendors = vendorPages
      .filter((page: any) => {
        // Only include vendors whose slug maps to a valid, known vendor category
        const categorySlug = extractCategoryFromSlug(page.slug);
        const categoryInfo = vendorCategories.find((cat: any) => cat.slug === categorySlug);
        if (!categoryInfo) return false;

        const titleMatch = page.title?.toLowerCase().includes(searchTerm);
        const contentMatch = page.content?.toLowerCase().includes(searchTerm);
        
        // Also check if the search term matches the vendor's category
        const categoryNameMatch = categoryInfo.name?.toLowerCase().includes(searchTerm);
        const categorySlugMatch = categorySlug.toLowerCase().includes(searchTerm);
        
        return titleMatch || contentMatch || categoryNameMatch || categorySlugMatch;
      })
      .map((page: any) => {
        const categorySlug = extractCategoryFromSlug(page.slug);
        const categoryInfo = vendorCategories.find((cat: any) => cat.slug === categorySlug);
        return {
          id: page.id,
          title: page.title,
          type: 'vendor' as const,
          link: convertVendorSlugToPublicUrl(page.slug),
          subtitle: categoryInfo?.name || 'Vendor',
          date: '',
          isTitleMatch: page.title?.toLowerCase().includes(searchTerm)
        };
      })
      .sort((a, b) => {
        if (a.isTitleMatch && !b.isTitleMatch) return -1;
        if (!a.isTitleMatch && b.isTitleMatch) return 1;
        return 0;
      })
      .slice(0, maxPerCategory);
    results.push(...matchedVendors);

    return results;
  };

  const results = searchContent();
  
  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const getIcon = (type: string) => {
    switch (type) {
      case 'event': return <Calendar className="h-4 w-4" />;
      case 'forum': return <MessageSquare className="h-4 w-4" />;
      case 'listing': return <Home className="h-4 w-4" />;
      case 'vendor': return <Store className="h-4 w-4" />;
      case 'page': return <FileText className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'event': return 'Events';
      case 'forum': return 'Extra!!!';
      case 'listing': return 'On The Market';
      case 'vendor': return 'Vendors';
      case 'page': return 'Pages';
      default: return type;
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search clubs, events, vendors, news, on the market, etc."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => query.trim() && setShowDropdown(true)}
          className="w-full h-14 pl-12 pr-12 text-lg"
          data-testid="input-search-homepage"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setShowDropdown(false);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            data-testid="button-clear-search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Dropdown suggestions */}
      {showDropdown && query.trim() && (
        <div className="absolute z-[9999] w-full mt-2 bg-white border rounded-lg shadow-lg max-h-[500px] overflow-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedResults).map(([type, items]) => (
                <div key={type} className="mb-2 last:mb-0">
                  <div className="px-4 py-2 bg-gray-50 flex items-center gap-2 sticky top-0 z-10">
                    {getIcon(type)}
                    <span className="text-sm font-semibold text-gray-700">
                      {getTypeLabel(type)}
                    </span>
                    <span className="text-xs text-gray-500">({items.length})</span>
                  </div>
                  {items.filter((result) => typeof result.link === 'string' && result.link.length > 0).map((result) => (
                    <Link 
                      key={`${result.type}-${result.id}`} 
                      href={result.link}
                      onClick={() => {
                        setShowDropdown(false);
                        setQuery("");
                      }}
                    >
                      <div 
                        className={`px-4 py-3 hover:bg-blue-50 transition-colors cursor-pointer border-b last:border-b-0 ${
                          result.isTitleMatch ? 'bg-gradient-to-r from-blue-50/50 to-transparent' : ''
                        }`}
                        data-testid={`search-result-${result.type}-${result.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900 flex-1">{result.title}</div>
                          {result.isTitleMatch && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm">
                              <Star className="h-3 w-3 fill-current" />
                              Direct Match
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          {result.subtitle && <span>{result.subtitle}</span>}
                          {result.subtitle && result.date && <span>•</span>}
                          {result.date && <span>{result.date}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
