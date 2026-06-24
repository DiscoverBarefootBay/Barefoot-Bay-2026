/**
 * LEGACY SEARCH CODE - DO NOT USE
 * 
 * This file contains the old Fuse.js-style search implementation that was
 * replaced with a unified search API. The code is preserved here for reference
 * during the migration to the new /api/search endpoint.
 * 
 * Original location: client/src/components/home/search-bar.tsx
 * Migration date: July 12, 2025
 * 
 * NOTE: This code is commented out and should not be imported or used.
 * It's kept for historical reference and debugging purposes only.
 */

/*
// ========== ORIGINAL SEARCH INTERFACES ==========

interface Event {
  id: number;
  title: string;
  startDate: string | Date;
  endDate?: string | Date;
  description?: string;
  location?: string;
  category?: string;
  recurrence?: string;
  mediaUrls?: string[];
  organizer?: string;
  contactInfo?: string;
  price?: string;
  [key: string]: any;
}

// ========== ORIGINAL MULTIPLE DATA FETCHING ==========

// Individual API calls for each data type
const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
  queryKey: ["/api/events"],
  queryFn: async () => {
    const response = await fetch("/api/events");
    if (!response.ok) throw new Error("Failed to fetch events");
    const data = await response.json();
    return data as Event[];
  }
});

const { data: listings, isLoading: listingsLoading } = useQuery({
  queryKey: ["/api/listings"],
  queryFn: async () => {
    const response = await fetch("/api/listings");
    if (!response.ok) throw new Error("Failed to fetch listings");
    return response.json();
  }
});

const { data: forumCategories } = useQuery({
  queryKey: ["/api/forum/categories"],
  queryFn: async () => {
    const response = await fetch("/api/forum/categories");
    if (!response.ok) throw new Error("Failed to fetch forum categories");
    return response.json();
  }
});

const { data: communityPages } = useQuery({
  queryKey: ["/api/pages"],
  queryFn: async () => {
    const response = await fetch("/api/pages");
    if (!response.ok) throw new Error("Failed to fetch community pages");
    return response.json();
  }
});

// Complex forum posts fetching across categories
const [forumDiscussions, setForumDiscussions] = useState<any[]>([]);
const fetchForumPosts = async () => {
  if (!forumCategories || !Array.isArray(forumCategories)) return;
  
  const posts: any[] = [];
  for (const category of forumCategories) {
    try {
      const response = await fetch(`/api/forum/categories/${category.id}/posts`);
      if (response.ok) {
        const categoryPosts = await response.json();
        if (Array.isArray(categoryPosts)) {
          posts.push(...categoryPosts.map(post => ({
            ...post,
            categoryName: category.name,
            categorySlug: category.slug
          })));
        }
      }
    } catch (error) {
      console.error(`Error fetching posts for category ${category.id}:`, error);
    }
  }
  
  posts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  setForumDiscussions(posts);
};

// ========== ORIGINAL SIMILARITY CALCULATION FUNCTIONS ==========

const calculateTitleSimilarity = (queryText: string, eventTitle: string): number => {
  const query = queryText.toLowerCase().trim();
  const title = eventTitle.toLowerCase().trim();
  
  // Exact match gets 100%
  if (query === title) return 100;
  
  // Check if query is completely contained in title
  if (title.includes(query)) {
    // Calculate how much of the title the query represents
    const coverage = query.length / title.length;
    return Math.min(98, 80 + (coverage * 18)); // 80-98% for containment
  }
  
  // Check if title is completely contained in query (user typed more than title)
  if (query.includes(title)) {
    return 95; // High match if title is subset of query
  }
  
  // Word-based matching
  const queryWords = query.split(/\s+/).filter(word => word.length > 2);
  const titleWords = title.split(/\s+/).filter(word => word.length > 2);
  
  if (queryWords.length === 0 || titleWords.length === 0) return 0;
  
  // Count matching words
  let matchingWords = 0;
  for (const queryWord of queryWords) {
    for (const titleWord of titleWords) {
      if (titleWord.includes(queryWord) || queryWord.includes(titleWord)) {
        matchingWords++;
        break;
      }
    }
  }
  
  const wordMatchRatio = matchingWords / Math.max(queryWords.length, titleWords.length);
  
  // Character-based similarity (simplified Levenshtein-like approach)
  const maxLength = Math.max(query.length, title.length);
  const minLength = Math.min(query.length, title.length);
  let commonChars = 0;
  
  for (let i = 0; i < minLength; i++) {
    if (query[i] === title[i]) commonChars++;
  }
  
  const charSimilarity = commonChars / maxLength;
  
  // Combine word and character similarities
  const finalScore = (wordMatchRatio * 0.7 + charSimilarity * 0.3) * 100;
  
  return Math.round(finalScore);
}

// Alias for forum posts compatibility
const calculateSimilarity = calculateTitleSimilarity;

// ========== ORIGINAL FUSE.JS-STYLE MATCHING LOGIC ==========

// Pre-classification similarity matching for forum posts
const handleForumQuery = async () => {
  // PRE-CLASSIFICATION CHECK: Direct title matching with 95%+ similarity
  if (forumDiscussions && forumDiscussions.length > 0) {
    const matchedPosts = forumDiscussions.filter(post => {
      if (!post.title) return false;
      const similarity = calculateSimilarity(query.toLowerCase().trim(), post.title.toLowerCase());
      return similarity >= 95;
    }).sort((a, b) => {
      const simA = calculateSimilarity(query.toLowerCase().trim(), a.title.toLowerCase());
      const simB = calculateSimilarity(query.toLowerCase().trim(), b.title.toLowerCase());
      return simB - simA;
    });
    
    if (matchedPosts.length > 0) {
      // Generate direct match result HTML
      // ... complex HTML generation logic
    }
  }
  
  // ... more complex logic for AI analysis and fallback
};

// Event query handling with similarity scoring
const handleEventQuery = async () => {
  // PRIORITY 1: Check for high-similarity title matches (95%+) first
  if (events && events.length > 0) {
    const eventMatches = events.map(event => ({
      event,
      similarity: calculateTitleSimilarity(queryText, event.title)
    }))
    .filter(item => item.similarity >= 95)
    .sort((a, b) => b.similarity - a.similarity);

    if (eventMatches.length > 0) {
      // Generate detailed response for the high-similarity matches
      // ... complex HTML generation and formatting logic
    }
  }
  
  // ... more complex logic for AI analysis, date parsing, filtering
};

// ========== ORIGINAL SPECIALIZED QUERY HANDLERS ==========

// Allan Family Legacy special handler
const handleAllanFamilyQuery = async () => {
  // First try to find by ID 208
  let allanPost = forumDiscussions?.find(post => post.id === 208);
  
  // If not found by ID, look for any post with "Allan Family Legacy" in the title 
  if (!allanPost) {
    allanPost = forumDiscussions?.find(post => 
      post.title?.toLowerCase().includes('allan family legacy'));
  }
  
  if (allanPost) {
    // Complex HTML generation for Allan Family Legacy post
    // ... specialized formatting logic
  }
  
  return false;
};

// Weather query handler
const handleWeatherQuery = async () => {
  try {
    const response = await fetch('/api/weather/current');
    if (!response.ok) throw new Error('Weather data unavailable');
    
    const weatherData = await response.json();
    // ... complex weather data formatting
  } catch (error) {
    // ... error handling and fallback
  }
};

// Rocket launch query handler  
const handleRocketLaunchQuery = async () => {
  try {
    const response = await fetch('/api/rocket-launches');
    if (!response.ok) throw new Error('Launch data unavailable');
    
    const launchData = await response.json();
    // ... complex launch data formatting
  } catch (error) {
    // ... error handling and fallback
  }
};

// Real estate query handler
const handleRealEstateQuery = async () => {
  if (!listings || listings.length === 0) {
    // Fallback response
    return;
  }
  
  // Complex filtering and similarity matching logic
  // ... extensive real estate specific logic
};

// ========== ORIGINAL MAIN SEARCH HANDLER ==========

const handleSearch = async () => {
  if (!query.trim()) return;
  
  setIsSearching(true);
  setSearchResult(null);
  
  const queryText = query.toLowerCase().trim();
  
  // Complex intent classification and routing logic
  // Multiple pre-classification checks with similarity scoring
  // AI-based intent analysis with Gemini
  // Fallback mechanisms and error handling
  
  // PRIORITY 0A: Check for high-similarity forum title matches BEFORE intent classification
  if (forumDiscussions && forumDiscussions.length > 0) {
    const highSimilarityMatches = forumDiscussions.map(post => ({
      post,
      similarity: calculateSimilarity(queryText, post.title || ''),
    }))
    .filter(item => item.similarity >= 95)
    .sort((a, b) => b.similarity - a.similarity);

    if (highSimilarityMatches.length > 0) {
      // Bypass AI intent classification for high-similarity matches
      await handleForumQuery();
      return;
    }
  }
  
  // PRIORITY 0B: Check for high-similarity event title matches BEFORE intent classification  
  if (events && events.length > 0) {
    const highSimilarityMatches = events.map(event => ({
      event,
      similarity: calculateTitleSimilarity(queryText, event.title),
    }))
    .filter(item => item.similarity >= 95)
    .sort((a, b) => b.similarity - a.similarity);

    if (highSimilarityMatches.length > 0) {
      // Bypass AI intent classification for high-similarity matches
      await handleEventQuery();
      return;
    }
  }
  
  // AI Intent Classification using Gemini
  try {
    const intentResponse = await fetch('/api/ai/classify-search-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText })
    });
    
    if (intentResponse.ok) {
      const intentData = await intentResponse.json();
      
      // Route to specific handlers based on classified intent
      switch (intentData.intent) {
        case 'forum':
          await handleForumQuery();
          break;
        case 'events':
          await handleEventQuery();
          break;
        case 'real_estate':
          await handleRealEstateQuery();
          break;
        case 'weather':
          await handleWeatherQuery();
          break;
        case 'rocket_launches':
          await handleRocketLaunchQuery();
          break;
        // ... more intent handlers
        default:
          // Generic search fallback
          break;
      }
    }
  } catch (error) {
    // Fallback to manual classification
    // ... complex fallback logic
  }
  
  setIsSearching(false);
};

// ========== ORIGINAL UTILITY FUNCTIONS ==========

const isSpecificDateQuery = (rangeType: string): boolean => {
  return rangeType.includes(',') && !rangeType.includes('week') && !rangeType.includes('weekend');
};

const analyzeEventQuery = async (userQuery: string) => {
  // Complex AI analysis for event queries
  // ... extensive Gemini prompting and parsing logic
};

// ... many more utility functions for parsing, formatting, etc.

*/