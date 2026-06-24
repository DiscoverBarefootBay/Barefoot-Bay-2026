import { useState, useEffect } from "react";
import { Search, HelpCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format, addMonths, isBefore, compareAsc, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { createTextPreview } from "@/lib/content-preview";
// Import custom styles for search results
import "./search-bar.css";

// Define interfaces for data types
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
  [key: string]: any; // For any additional properties
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const { toast } = useToast();
  
  // Check for mobile screen size on mount and when window is resized
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Function to copy example text to search input
  const handleExampleClick = (example: string) => {
    setQuery(example);
    setShowHelpModal(false);
    toast({
      title: "Example Copied",
      description: `"${example}" has been copied to search`,
      duration: 2000,
    });
  };
  
  // Search Help Modal Component
  const SearchHelpModal = () => {
    if (!showHelpModal) return null;
    
    const searchExamples = {
      events: [
        "entertainment events this week",
        "social events with badge", 
        "government meetings today",
        "events at pool pavilion",
        "no badge events this weekend",
        "Spring Festival 2025",
        "events on April 30th"
      ],
      vendors: [
        "home cleaning services",
        "roofing contractors",
        "restaurants near me",
        "lawn care services",
        "medical clinics",
        "Barefoot Bay Salon",
        "plumbing repair"
      ],
      realEstate: [
        "3 bedroom houses for sale",
        "rentals under $2000",
        "open houses this weekend",
        "waterfront properties",
        "houses with pool",
        "2 bedroom FSBO",
        "garage sales today"
      ],
      forum: [
        "ballot initiative",
        "DOR ballot",
        "Palm Bay City Council",
        "website update",
        "water quality report",
        "forecast update"
      ],
      weatherSpace: [
        "weather today",
        "weekend forecast",
        "next rocket launch",
        "SpaceX mission",
        "temperature tomorrow"
      ]
    };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Search Tips & Examples</h2>
            </div>
            <button
              onClick={() => setShowHelpModal(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          <div className="p-6">
            
            
            {/* Search Examples by Category */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-6 text-center">Search Examples by Category</h3>
              
              {/* Events */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">📅</span>
                  </div>
                  <h4 className="font-semibold text-gray-900">Events</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchExamples.events.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleClick(example)}
                      className="text-left p-2 text-sm bg-gray-50 hover:bg-blue-50 rounded border hover:border-blue-200 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Vendors */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 font-semibold">🏬</span>
                  </div>
                  <h4 className="font-semibold text-gray-900">Vendors</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchExamples.vendors.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleClick(example)}
                      className="text-left p-2 text-sm bg-gray-50 hover:bg-orange-50 rounded border hover:border-orange-200 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Real Estate */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-semibold">🏠</span>
                  </div>
                  <h4 className="font-semibold text-gray-900">Real Estate</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchExamples.realEstate.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleClick(example)}
                      className="text-left p-2 text-sm bg-gray-50 hover:bg-green-50 rounded border hover:border-green-200 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Forum */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-semibold">💬</span>
                  </div>
                  <h4 className="font-semibold text-gray-900">Forum</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchExamples.forum.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleClick(example)}
                      className="text-left p-2 text-sm bg-gray-50 hover:bg-purple-50 rounded border hover:border-purple-200 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Weather & Space */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-600 font-semibold">🌤️</span>
                  </div>
                  <h4 className="font-semibold text-gray-900">Weather & Space</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchExamples.weatherSpace.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleClick(example)}
                      className="text-left p-2 text-sm bg-gray-50 hover:bg-indigo-50 rounded border hover:border-indigo-200 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Search Features */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Search Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <div>
                    <div className="font-medium">Spell Correction:</div>
                    <div className="text-gray-600">Automatically fixes common misspellings</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <div>
                    <div className="font-medium">Smart Filtering:</div>
                    <div className="text-gray-600">Understands dates, prices, and attributes</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <div>
                    <div className="font-medium">Natural Language:</div>
                    <div className="text-gray-600">Ask questions conversationally</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <div>
                    <div className="font-medium">Multi-Modal:</div>
                    <div className="text-gray-600">Search across all content types at once</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Fetch events data
  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      console.log("Fetching events...");
      const response = await fetch("/api/events");
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      console.log("Fetched events:", data);
      return data as Event[];
    }
  });

  // Fetch for-sale listings data
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["/api/listings"],
    queryFn: async () => {
      console.log("Fetching for-sale listings...");
      const response = await fetch("/api/listings");
      if (!response.ok) throw new Error("Failed to fetch listings");
      const data = await response.json();
      
      // Filter and log Open House listings
      const openHouseListings = data.filter((listing: any) => listing.listingType === "OpenHouse");
      console.log(`Found ${openHouseListings.length} Open House listings:`, 
        openHouseListings.map((listing: any) => listing.title));
      
      console.log("Fetched listings:", data);
      return data;
    }
  });

  // Fetch forum discussions data
  const { data: forumCategories } = useQuery({
    queryKey: ["/api/forum/categories"],
    queryFn: async () => {
      console.log("Fetching forum categories...");
      const response = await fetch("/api/forum/categories");
      if (!response.ok) throw new Error("Failed to fetch forum categories");
      return response.json();
    }
  });

  // Fetch forum posts across all categories
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
    
    // Sort by most recent activity
    posts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setForumDiscussions(posts);
  };

  // Fetch community information pages
  const { data: communityPages } = useQuery({
    queryKey: ["/api/pages"],
    queryFn: async () => {
      console.log("Fetching community pages...");
      const response = await fetch("/api/pages");
      if (!response.ok) throw new Error("Failed to fetch community pages");
      const data = await response.json();
      console.log("Fetched community pages:", data);
      return data;
    }
  });

  // Fetch forum posts when forum categories are loaded
  useEffect(() => {
    if (forumCategories && Array.isArray(forumCategories) && forumCategories.length > 0) {
      fetchForumPosts();
    }
  }, [forumCategories]);
  
  // Add an effect to log forum posts for debugging
  useEffect(() => {
    if (forumDiscussions && forumDiscussions.length > 0) {
      console.log(`Total forum posts loaded: ${forumDiscussions.length}`);
      
      // Log all post IDs and titles for debugging
      console.log('All forum post IDs and titles:', 
        forumDiscussions.map(post => ({ id: post.id, title: post.title })));
      
      // Look specifically for the Allan Family Legacy post
      const allanPost = forumDiscussions.find(post => 
        post.title?.toLowerCase().includes('allan family legacy'));
      
      if (allanPost) {
        console.log('📌 Found Allan Family Legacy post:', {
          id: allanPost.id,
          title: allanPost.title,
          category: allanPost.categoryName
        });
      } else {
        console.log('⚠️ Allan Family Legacy post NOT found in loaded posts.');
        
        // Log all posts that contain "allan" in the title
        const allanRelated = forumDiscussions.filter(post => 
          post.title?.toLowerCase().includes('allan'));
        
        if (allanRelated.length > 0) {
          console.log('Found these Allan-related posts:', 
            allanRelated.map(p => ({ id: p.id, title: p.title })));
        }
      }
    }
  }, [forumDiscussions]);

  /**
   * Special handler for Allan Family Legacy queries
   * This directly renders a special response when the user is asking about the Allan family
   */
  const handleAllanFamilyQuery = async () => {
    console.log("Handling Allan Family query with special handler");
    
    // First try to find by ID 208
    let allanPost = forumDiscussions?.find(post => post.id === 208);
    
    // If not found by ID, look for any post with "Allan Family Legacy" in the title 
    if (!allanPost) {
      allanPost = forumDiscussions?.find(post => 
        post.title?.toLowerCase().includes('allan family legacy'));
      
      if (allanPost) {
        console.log("Found Allan Family Legacy post by title:", allanPost);
      }
    } else {
      console.log("Found Allan Family Legacy post by ID:", allanPost);
    }
    
    if (allanPost) {
      console.log("Using Allan Family Legacy post:", allanPost);
      
      // Format the post date
      const postDate = new Date(allanPost.createdAt);
      const timeAgo = formatDistanceToNow(postDate, { addSuffix: true });
      
      setSearchResult(`
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-1">💬</span>
            <div>
              <h2 class="text-xl font-bold text-navy">Found: Allan Family Legacy</h2>
              <p class="text-gray-600">I found exactly the information you're looking for about the Allan family:</p>
            </div>
          </div>
          
          <div class="bg-blue-50/70 border border-blue-100 rounded-lg p-4 mb-4">
            <h3 class="text-lg font-bold mb-1">
              <a href="/forum/post/${allanPost.id}" class="text-blue-700 hover:text-blue-900 hover:underline">
                Allan Family Legacy
              </a>
            </h3>
            <div class="flex flex-wrap gap-2 text-sm text-gray-500 mb-2">
              <span class="italic">in ${allanPost.categoryName || 'Community History'}</span>
              <span>• by ${allanPost.author?.username || 'BarefootBayAdmin'}</span>
              <span>• ${timeAgo}</span>
            </div>
            <p class="text-gray-600 text-sm mb-3">
              ${createTextPreview(allanPost.content || '', 200)}
            </p>
            <div class="mt-2">
              <a href="/forum/post/${allanPost.id}" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm font-medium">
                Read about the Allan Family
              </a>
            </div>
          </div>
          
          <div class="mt-3 bg-blue-50/30 p-3 rounded-lg text-sm text-gray-600">
            <p>The Allan family has played an important role in Barefoot Bay's history. Click the post above to read the full story.</p>
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return true;
    }
    
    console.log("Allan Family Legacy post not found by ID");
    return false;
  };

  /**
   * Handler for forum-related search queries
   */
  const handleForumQuery = async () => {
    // PRE-CLASSIFICATION CHECK: Direct title matching with 95%+ similarity
    // This bypasses AI analysis for high-confidence title matches
    if (forumDiscussions && forumDiscussions.length > 0) {
      console.log('🔍 [FORUM DIRECT MATCH] Checking for high-similarity title matches...');
      
      const matchedPosts = forumDiscussions.filter(post => {
        if (!post.title) return false;
        const similarity = calculateSimilarity(query.toLowerCase().trim(), post.title.toLowerCase());
        console.log(`🔍 [FORUM MATCH] "${post.title}" vs "${query.trim()}" = ${similarity}%`);
        return similarity >= 95;
      }).sort((a, b) => {
        // Sort by similarity score (highest first)
        const simA = calculateSimilarity(query.toLowerCase().trim(), a.title.toLowerCase());
        const simB = calculateSimilarity(query.toLowerCase().trim(), b.title.toLowerCase());
        return simB - simA;
      });
      
      if (matchedPosts.length > 0) {
        console.log(`🎯 [FORUM DIRECT MATCH] Found ${matchedPosts.length} high-similarity forum post(s), bypassing AI analysis`);
        
        // Generate direct match result HTML
        const postsHTML = matchedPosts.map(post => {
          const postDate = new Date(post.createdAt);
          const timeAgo = formatDistanceToNow(postDate, { addSuffix: true });
          
          // Create content preview using utility function
          const contentPreview = createTextPreview(post.content || '', 150);
          
          return `
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6 shadow-lg">
              <div class="flex items-start justify-between mb-4">
                <h3 class="text-2xl font-bold text-blue-900 leading-tight">
                  <a href="/forum/post/${post.id}" class="hover:text-blue-700 hover:underline transition-colors">
                    ${post.title}
                  </a>
                </h3>
                <span class="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 border">
                  Perfect Match
                </span>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="flex items-center text-gray-700">
                  <span class="text-xl mr-3">📂</span>
                  <div>
                    <div class="font-semibold">${post.categoryName || 'General'}</div>
                    <div class="text-sm text-gray-600">Category</div>
                  </div>
                </div>
                
                <div class="flex items-center text-gray-700">
                  <span class="text-xl mr-3">👤</span>
                  <div>
                    <div class="font-semibold">${post.author?.username || 'Unknown'}</div>
                    <div class="text-sm text-gray-600">Posted ${timeAgo}</div>
                  </div>
                </div>
              </div>
              
              <div class="bg-white bg-opacity-60 rounded-lg p-4 mb-4">
                <p class="text-gray-700 leading-relaxed">${contentPreview}</p>
              </div>
              
              <div class="flex gap-3 mt-4">
                <a href="/forum/post/${post.id}" class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                  <span>💬</span> View Discussion
                </a>
                <a href="/forum" class="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                  <span>📋</span> Browse Forum
                </a>
              </div>
            </div>
          `;
        }).join('');
        
        setSearchResult(`
          <div class="space-y-6">
            <div class="flex items-start gap-4">
              <span class="text-3xl mt-1">🎯</span>
              <div>
                <h2 class="text-2xl font-bold text-blue-900 mb-2">Perfect Match Found!</h2>
                <p class="text-gray-600 text-lg">I found exactly what you're looking for. Here ${matchedPosts.length === 1 ? 'is' : 'are'} the forum post${matchedPosts.length > 1 ? 's' : ''} that match "${query.trim()}":</p>
              </div>
            </div>
            
            <div class="mt-6">
              ${postsHTML}
            </div>
            
            <div class="pt-4">
              <a href="/forum" 
                class="inline-flex items-center px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors w-fit">
                <span class="mr-2">💬</span> Browse all forum discussions
              </a>
            </div>
          </div>
        `);
        
        setIsSearching(false);
        return;
      }
    }
    
    // Check if this is an Allan Family query first and use special handler
    if (query.toLowerCase().includes('allan') || query.toLowerCase().includes('family legacy')) {
      const handled = await handleAllanFamilyQuery();
      if (handled) return;
    }
    
    if (!forumDiscussions || forumDiscussions.length === 0) {
      setSearchResult(`
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-1">💬</span>
            <div>
              <h2 class="text-xl font-bold text-navy">Forum Search</h2>
              <p class="text-gray-600">I couldn't find any forum discussions that match your search.</p>
            </div>
          </div>
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p class="mb-3">Try browsing our forum categories to find discussions that interest you:</p>
            <div class="flex flex-wrap gap-2 mt-2">
              <a href="/forum" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                <span>💬</span> Browse Forums
              </a>
            </div>
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }
    
    // Use Gemini to analyze and generate a personalized forum search response
    try {
      // Simplify forum post data to avoid payload size issues
      const simplifiedPosts = forumDiscussions.slice(0, 12).map(post => ({
        id: post.id,
        title: post.title,
        content: typeof post.content === 'string' ? 
          createTextPreview(post.content, 150) : 
          'No preview available',
        categoryName: post.categoryName,
        categorySlug: post.categorySlug,
        author: post.author ? { 
          username: post.author.username
        } : { username: 'Unknown' },
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      }));
      
      console.log("Forum search payload prepared. Post count:", simplifiedPosts.length);

      const forumSearchPrompt = `
You are a forum search assistant for the Barefoot Bay community platform. The user just searched for: "${query.trim()}"

I have found the following forum posts that might be relevant. Help me create a personalized response that highlights the most relevant posts based on the user's query.

Here are the forum posts available:
${JSON.stringify(simplifiedPosts, null, 2)}

CRITICAL SPECIAL CASE INSTRUCTIONS:
1. HIGHEST PRIORITY: If the user's query mentions "Allan", "family", "legacy", "history", or any combination of these terms, you MUST first search for and prioritize any post with "Allan Family Legacy" in the title.
2. For any post about the Allan Family Legacy, make it the ONLY focus of your response. Display ONLY this post prominently.
3. Link to the correct post ID (check the actual ID in the posts list, don't assume it's ID 208). The URL format should be "/forum/post/{post.id}" with the actual post ID.
4. Explicitly tell the user "I found the information about the Allan Family Legacy" and emphasize this is exactly what they're looking for.
5. Do not include any other posts in your response if this is an Allan Family related query.

The user's query might be one of these patterns:
1. Keyword-Based Search: "Any discussions about [keyword]?", "Forum posts about [keyword]?", "Any news on [keyword]?"
2. Section-Specific Search: "Any new discussions in [category]?", "Latest posts in [category]?", "Topics under [category]?"
3. Specific Topic Title Search: "Find the post about [topic]", "Is there a thread on [topic]?", "Locate discussion on [topic]"
4. Specific Content Search: Questions about specific community topics that might be discussed in forums, like "ballot initiative", "beach bathrooms", "road maintenance", "community governance", or "Allan family legacy"

For specific content searches, the user might not use forum-specific language but is asking about a topic that's discussed in the forum. For example, if they ask about "the ballot initiative passing", "Allan family", or "beach bathrooms" and we have a forum post about these topics, that's a strong match even if they didn't specifically mention forums.

Tailor your response based on the type of query the user has submitted:
- For keyword searches, prioritize posts that contain the keyword in the title or content
- For section-specific searches, filter by the relevant category
- For topic title searches, focus on finding the exact post title that matches
- For specific content searches, deeply analyze post content to find discussions that address the user's query, even if their exact words don't match

For VERY specific queries that match a particular post extremely well:
1. If the user's query directly relates to a specific post (like asking about ballot initiatives and we have a post titled "Ballot Initiative Results"), highlight that post FIRST and prominently
2. Provide a direct link to that post with text like "I found exactly what you're looking for" or "Here's information about [topic]"
3. Include the URL "/forum/post/{post.id}" where {post.id} is the specific post ID

Please generate HTML with:
1. A friendly greeting and context about what they searched for
2. A list of 3-5 most relevant forum posts with:
   - The post title as a link to the post (/forum/post/{id})
   - The category name
   - The author's username
   - A snippet of the post content (truncated to ~70 chars if needed)
   - How long ago it was posted (using days/weeks/months format)
3. A call to action to browse more forum posts or create their own

The response should be formatted with attractive HTML that matches the following styling:
- Use "bg-blue-50/70" for container backgrounds
- Use "text-blue-700" for links and important text
- Use "text-gray-600" for secondary text
- Use "rounded-lg" for containers
- Include appropriate icons using span elements with emoji

Make the response conversational and helpful, as if a knowledgeable community member is guiding them.
`;

      console.log("Forum search query:", query.trim());
      
      let generatedResponse = '';
      
      try {
        const response = await fetch('/api/gemini-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: "gemini-2.0-flash",
            contents: [
              {
                parts: [
                  { text: forumSearchPrompt }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.4,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            }
          })
        });
        
        console.log("Forum search API response status:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Forum search API error response:", errorText);
          throw new Error(`API error: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log("Forum search API response received");
        generatedResponse = result.candidates[0]?.content?.parts[0]?.text || '';
      } catch (fetchError) {
        console.error("Forum search fetch error:", fetchError);
        throw fetchError;
      }
      
      if (!generatedResponse) {
        throw new Error("No response generated");
      }
      
      // Clean up the AI response - remove markdown formatting if present
      let cleanResponse = generatedResponse
        .replace(/```html/g, '')
        .replace(/```/g, '')
        .trim();
      
      setSearchResult(cleanResponse);
      
    } catch (error) {
      console.error("Error generating forum search response:", error);
      
      // Fallback to a basic response with forum posts
      let postsHTML = '';
      const relevantPosts = forumDiscussions.slice(0, 5);
      
      relevantPosts.forEach(post => {
        const postDate = new Date(post.createdAt);
        const timeAgo = formatDistanceToNow(postDate, { addSuffix: true });
        
        postsHTML += `
          <div class="bg-blue-50/70 border border-blue-100 rounded-lg p-4 mb-4">
            <h3 class="text-lg font-bold mb-1">
              <a href="/forum/post/${post.id}" class="text-blue-700 hover:text-blue-900 hover:underline">
                ${post.title}
              </a>
            </h3>
            <div class="flex flex-wrap gap-2 text-sm text-gray-500 mb-2">
              <span class="italic">in ${post.categoryName}</span>
              <span>• by ${post.author?.username || 'Unknown'}</span>
              <span>• ${timeAgo}</span>
            </div>
            <p class="text-gray-600 text-sm mb-3">
              ${createTextPreview(post.content || '', 100)}
            </p>
            <div class="mt-2">
              <a href="/forum/post/${post.id}" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                View discussion
              </a>
            </div>
          </div>
        `;
      });
      
      setSearchResult(`
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-1">💬</span>
            <div>
              <h2 class="text-xl font-bold text-navy">Forum Search Results</h2>
              <p class="text-gray-600">Here are some forum discussions that might be related to your search for "${query.trim()}":</p>
            </div>
          </div>
          
          <div class="mt-3">
            ${postsHTML}
          </div>
          
          <div class="flex justify-center mt-4 gap-3">
            <a href="/forum" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
              <span>💬</span> Browse all forums
            </a>
            <a href="/forum/new" class="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors font-medium">
              <span>✏️</span> Start a new topic
            </a>
          </div>
        </div>
      `);
    }
    
    setIsSearching(false);
  };
  
  /**
   * Convert database vendor slug to public URL format
   * Example: "vendors-home-services-kellys-house-cleaning" -> "/vendors/home-services/kellys-house-cleaning"
   */
  const convertVendorSlugToPublicUrl = (slug: string): string => {
    if (!slug || !slug.startsWith('vendors-')) {
      return slug; // Return as-is if not a vendor slug
    }
    
    // Remove the "vendors-" prefix
    const withoutPrefix = slug.substring(8); // Remove "vendors-"
    
    // Find the first hyphen after removing prefix - this separates category from vendor name
    const parts = withoutPrefix.split('-');
    
    if (parts.length < 2) {
      return slug; // Return original if can't parse
    }
    
    // Handle compound categories (like "home-services", "technology-and-electronics")
    // We need to identify where the category ends and vendor name begins
    // Common compound categories: home-services, technology-and-electronics, automotive-golf-carts, etc.
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
    
    return `/vendors/${category}/${vendorName}`;
  };

  /**
   * Convert database community page slug to public URL format
   * Example: "community-social-pickleball-club" -> "/community/community/social-pickleball-club"
   * Example: "government-board-of-trustees" -> "/community/government/board-of-trustees"
   */
  const convertCommunitySlugToPublicUrl = (slug: string): string => {
    if (!slug) {
      return slug; // Return as-is if empty
    }
    
    // Common community categories
    const communityCategories = [
      'community', 'government', 'transportation', 'religion', 
      'amenities', 'vendors'
    ];
    
    // Find which category this slug starts with
    for (const category of communityCategories) {
      if (slug.startsWith(category + '-')) {
        // Extract the page name after the category
        const pageName = slug.substring(category.length + 1); // +1 for the hyphen
        return `/community/${category}/${pageName}`;
      }
    }
    
    // If no category match found, return as-is
    return slug;
  };

  /**
   * Handler for vendor-related search queries
   */
  const handleVendorQuery = async () => {
    try {
      // Fetch vendors if not already loaded
      const vendorsResponse = await fetch('/api/pages?type=vendors');
      if (!vendorsResponse.ok) {
        throw new Error("Failed to fetch vendor data");
      }
      
      const allPages = await vendorsResponse.json();
      
      // Filter to only return actual vendor pages (pages with slugs starting with "vendors-")
      const vendorPages = allPages.filter(page => 
        page.slug && page.slug.startsWith('vendors-')
      );
      
      console.log(`Filtered ${vendorPages.length} vendor pages from ${allPages.length} total pages`);
      
      if (!vendorPages || vendorPages.length === 0) {
        setSearchResult(`
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <span class="text-xl mt-1">🏢</span>
              <div>
                <h2 class="text-xl font-bold text-navy">Vendor Search</h2>
                <p class="text-gray-600">I couldn't find any vendors that match your search.</p>
              </div>
            </div>
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p class="mb-3">Try browsing our vendor directory to find local businesses and services:</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <a href="/community/vendors" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                  <span>🏢</span> Browse Vendors
                </a>
              </div>
            </div>
          </div>
        `);
        
        setIsSearching(false);
        return;
      }
      
      // Step 1: First use Gemini to analyze the vendor query and determine specific services/categories
      const vendorAnalysisPrompt = `
🧩 Vendor Search Requirements Analysis

Analyze this search query for vendor needs: "${query.trim()}"

📋 Allowed Query Types:
1. Service or Business Type Searches (e.g., "Looking for someone to clean my house", "Need roofing companies")
2. Vendor Category Searches (e.g., "Any home services available?", "Vendors for pest control?")
3. Specific Vendor Name Searches (e.g., "Tell me about Barefoot Bay Salon & Barber", "How to contact DC Roofing?")

🛡️ Match against these precise vendor categories and services:

IMPORTANT: Look for EXACT keyword matches and abbreviated terms. For example:
- "HVAC", "hvac", "air conditioning", "heating", "cooling" → HVAC & Air Quality
- "plumbing", "plumber" → Plumbing  
- "roofing", "roof", "roofer" → Roofing
- "food", "dining", "restaurant", "pizza" → Food & Dining
- "beauty", "salon", "barber", "hair", "nails" → Beauty & Personal
- "medical", "doctor", "clinic", "healthcare" → Health and Medical
- "cleaning", "clean", "house cleaning" → Home Services
- "pest", "pest control", "exterminator" → Pest Control
- "landscaping", "lawn", "lawn care", "grounds" → Landscaping
- "golf cart", "automotive", "cart", "battery" → Automotive - Golf Carts
- "real estate", "property", "realtor", "homes" → Real Estate & Senior Living
- "insurance", "financial" → Insurance & Financial Services
- "technology", "computer", "electronics", "tech" → Technology & Electronics

Home Services:
- Helping Hands (Senior Services)
- Kelly's House Cleaning
- Lyn's Home Help Inc
- Dan Hess - Antiques & Estate Sales
- Anchor and Vapor Barrier

Roofing:
- All Florida Roofs
- AMS - Insulated Aluminum Roof Over
- Comfort Cover Systems
- DC Roofing
- Roofing Specialist

HVAC & Air Quality:
- Barker Air Conditioning and Heating
- Weirich Air

Pest Control:
- All County Pest Control

New Homes - Installation:
- Florida Value Homes
- River Grove Mobile Home Sales

Home Improvement:
- 1 Day Kitchen and Bath Transformations
- Carpet Fashions Inc
- Endeavor Construction Inc
- G & M Painting
- Lighthouse Electric Services
- Mobile Home Depot
- Sebastian Blinds and Shutters
- TBS Construction of Indian River Inc
- Twin Rivers Property Management
- Windows, Doors and Floors - Richard Provencher

Food & Dining:
- Aunt Louise's Pizzeria
- Big Roman's Pizza
- Cafe Latte da
- RJ's Family Restaurant
- Holy Cannoli Bakery and Cafe
- Riverwalk Cafe

Pressure Washing:
- Barefoot Pressure Wash

Automotive - Golf Carts:
- Golf Cart Center
- Redline Battery Supply (Golf Cart Batteries)
- The Cart Guys

Plumbing:
- Harbor Plumbing
- Maxwell and Son Plumbing
- Meeks Plumbing

Landscaping:
- Timber Creek Grounds

Beauty & Personal:
- Barefoot Bay Beauty Salon & Barber - Patty Crockett
- Barefoot Bay Salon & Barber
- Labell Nails & Spa
- Nina's Happy Hair and Nails
- Summit Plaza Barber Shop (NY Barber Nick)
- Wigs By Connie

Health and Medical:
- Cleveland Clinic Indian River Hospital
- Dr. Starleen C. Schaffer, MD
- Iconic Dermatology
- Indian River Podiatry
- Patrick Pirkle, DMD & Associates, PA
- Zudans Eye Surgery

Real Estate & Senior Living:
- Estate Senior Living - Glenbrooke Senior Living
- Glenbrooke Senior Living
- John & Becky Boncek - Re/Max Crown Realty
- Sunshine Rentals & Sales

Funeral and Religious Services:
- Roseland Global Methodist Church
- Strunk Funeral Home and Crematory

Moving and Transportation:
- Airport Transportation - Mike Quinn
- Mr. Small Move Moving and Storage

Insurance & Financial Services:
- Ellen JB Maxson (Medicare Insurance Agent)
- Schneider & Associates Insurance Agencies

Technology & Electronics:
- Computer Healthcare

Please extract the following information from the search query:
- The primary service type or need (what exactly is the user looking for?)
- The most relevant vendor category based on the list above
- Any specific vendor names mentioned
- Required services or features the user needs (e.g., "cleaning", "roofing repair", "tax help")
- Whether this is asking for a specific vendor or for a category overview page

Query Type Detection:
- "individual_vendor": Looking for a specific vendor or specific service provider (e.g., "plumber near me", "Kelly's cleaning service", "home repair contractor")
- "category_overview": Asking for multiple vendors in a category (e.g., "any food vendors?", "all plumbing vendors", "what cleaning services are available?", "list of restaurants")

Respond in JSON format only with no explanatory text:
{
  "primaryServiceNeed": "string describing the main service need",
  "vendorCategory": "one of the exact category names from the list above", 
  "specificVendorName": "name of specific vendor if mentioned or null",
  "requiredServices": ["array", "of", "specific", "services"],
  "queryType": "individual_vendor or category_overview",
  "confidence": 0-100
}
`;

      // Call Gemini API to analyze vendor query
      const analysisResponse = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [
                { text: vendorAnalysisPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1, // Lower temperature for more precise category matching
            topK: 30,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!analysisResponse.ok) {
        throw new Error(`API error: ${analysisResponse.statusText}`);
      }
      
      const analysisResult = await analysisResponse.json();
      const analysisText = analysisResult.candidates[0]?.content?.parts[0]?.text;
      
      if (!analysisText) {
        throw new Error("No vendor analysis response generated");
      }
      
      // Extract the JSON from the response
      const jsonRegex = /{[\s\S]*}/;
      const jsonMatch = analysisText.match(jsonRegex);
      let vendorAnalysis;
      
      if (jsonMatch) {
        try {
          vendorAnalysis = JSON.parse(jsonMatch[0]);
          console.log("Vendor query analysis:", vendorAnalysis);
        } catch (e) {
          console.error("Failed to parse vendor analysis JSON", e);
          // Continue with original approach on error
        }
      }
      
      // Step 2: Now filter vendors based on the analysis
      // Add null/undefined check for vendorPages
      if (!vendorPages || !Array.isArray(vendorPages)) {
        console.error("vendorPages is not an array:", vendorPages);
        setSearchResult(`
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <span class="text-xl mt-1">⚠️</span>
              <div>
                <h2 class="text-xl font-bold text-navy">Vendor Search</h2>
                <p class="text-gray-600">I couldn't find any vendors that match your search.</p>
              </div>
            </div>
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p class="mb-3">Try browsing our vendor categories to find what you're looking for:</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <a href="/vendors" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                  <span>🏢</span> Browse Vendors
                </a>
              </div>
            </div>
          </div>
        `);
        setIsSearching(false);
        return;
      }
      
      let filteredVendors = [...vendorPages];
      let matchedCategories = [];
      let matchedVendorNames = [];
      let matchedServices = [];
      
      // Get all vendor categories from the pages for filtering and display
      const allCategories = new Set();
      vendorPages.forEach(page => {
        if (page.category) {
          allCategories.add(page.category);
        }
      });
      
      console.log("Available vendor categories:", Array.from(allCategories));
      
      // If we have analysis data, apply strict filtering
      if (vendorAnalysis && vendorAnalysis.confidence >= 70) {
        console.log("Applying vendor analysis filters with confidence:", vendorAnalysis.confidence);
        
        // Filter by category if specified
        if (vendorAnalysis.vendorCategory) {
          console.log("Filtering by vendor category:", vendorAnalysis.vendorCategory);
          matchedCategories.push(vendorAnalysis.vendorCategory);
          
          // Map AI category names to URL slugs for matching
          const categorySlugMap: { [key: string]: string } = {
            "HVAC & Air Quality": "hvac-and-air-quality",
            "Home Services": "home-services", 
            "Health and Medical": "health-medical",
            "Real Estate & Senior Living": "real-estate",
            "Funeral and Religious Services": "funeral-religious",
            "Moving and Transportation": "moving-transportation",
            "Insurance & Financial Services": "insurance-financial",
            "Technology & Electronics": "technology-and-electronics",
            "Retail & Shops": "retail-shops",
            "Beauty & Personal": "beauty-personal",
            "New Homes": "new-homes",
            "Food & Dining": "food-dining",
            "Roofing": "roofing",
            "Pest Control": "pest-control",
            "Home Improvement": "home-improvement",
            "Pressure Washing": "pressure-washing",
            "Automotive - Golf Carts": "automotive-golf-carts",
            "Plumbing": "plumbing",
            "Landscaping": "landscaping"
          };
          
          const targetCategorySlug = categorySlugMap[vendorAnalysis.vendorCategory] || 
                                    vendorAnalysis.vendorCategory.toLowerCase().replace(/\s+/g, '-').replace(/[&]/g, 'and');
          
          console.log(`Mapped category "${vendorAnalysis.vendorCategory}" to slug: "${targetCategorySlug}"`);
          
          // Extract category from slug since page.category is often null
          const categoryMatches = vendorPages.filter(page => {
            if (!page.slug || !page.slug.startsWith('vendors-')) return false;
            
            // Extract category from slug: vendors-{category}-{vendor-name}
            const slugWithoutPrefix = page.slug.substring(8); // Remove "vendors-"
            const parts = slugWithoutPrefix.split('-');
            
            // Handle compound categories like "hvac-and-air-quality"
            const compoundCategories = [
              'hvac-and-air-quality', 'home-services', 'technology-and-electronics', 
              'automotive-golf-carts', 'new-homes', 'food-dining', 'beauty-personal',
              'health-medical', 'real-estate', 'insurance-financial', 'retail-shops'
            ];
            
            let extractedCategory = parts[0];
            for (const compound of compoundCategories) {
              const compoundParts = compound.split('-');
              if (parts.length >= compoundParts.length) {
                const candidateCategory = parts.slice(0, compoundParts.length).join('-');
                if (candidateCategory === compound) {
                  extractedCategory = candidateCategory;
                  break;
                }
              }
            }
            
            console.log(`Page "${page.title}" has extracted category: "${extractedCategory}"`);
            return extractedCategory === targetCategorySlug;
          });
          
          if (categoryMatches.length > 0) {
            filteredVendors = categoryMatches;
            console.log(`Found ${filteredVendors.length} vendors in category "${targetCategorySlug}":`, 
              categoryMatches.map(v => v.title));
          } else {
            console.log(`No vendors found for category "${targetCategorySlug}". Trying fuzzy matching...`);
            
            // If no exact matches, try more flexible matching
            const fuzzyMatches = vendorPages.filter(page => {
              const content = page.content ? page.content.toLowerCase() : '';
              const title = page.title ? page.title.toLowerCase() : '';
              const slug = page.slug ? page.slug.toLowerCase() : '';
              const vendorCatLower = vendorAnalysis.vendorCategory.toLowerCase();
              const slugCatLower = targetCategorySlug.toLowerCase();
              
              return content.includes(vendorCatLower) || 
                     title.includes(vendorCatLower) ||
                     slug.includes(slugCatLower) ||
                     content.includes(slugCatLower);
            });
            
            if (fuzzyMatches.length > 0) {
              filteredVendors = fuzzyMatches;
              console.log(`Found ${filteredVendors.length} vendors with fuzzy match:`, 
                fuzzyMatches.map(v => v.title));
            }
          }
        }
        
        // Filter by specific vendor name if specified
        if (vendorAnalysis.specificVendorName) {
          console.log("Filtering by specific vendor name:", vendorAnalysis.specificVendorName);
          matchedVendorNames.push(vendorAnalysis.specificVendorName);
          
          const nameMatches = filteredVendors.filter(page => {
            const title = page.title ? page.title.toLowerCase() : '';
            const vendorNameLower = vendorAnalysis.specificVendorName.toLowerCase();
            
            return title.includes(vendorNameLower);
          });
          
          if (nameMatches.length > 0) {
            filteredVendors = nameMatches;
            console.log(`Found ${filteredVendors.length} vendors matching name: ${vendorAnalysis.specificVendorName}`);
          }
        }
        
        // Filter by required services if specified
        if (vendorAnalysis.requiredServices && vendorAnalysis.requiredServices.length > 0) {
          console.log("Filtering by required services:", vendorAnalysis.requiredServices);
          matchedServices = vendorAnalysis.requiredServices;
          
          // Create a filtered list where at least one required service is mentioned
          const serviceMatches = filteredVendors.filter(page => {
            const content = page.content ? page.content.toLowerCase() : '';
            const title = page.title ? page.title.toLowerCase() : '';
            
            // Check if any required service is mentioned in title or content
            return vendorAnalysis.requiredServices.some(service => {
              const serviceLower = service.toLowerCase();
              return content.includes(serviceLower) || title.includes(serviceLower);
            });
          });
          
          if (serviceMatches.length > 0) {
            filteredVendors = serviceMatches;
            console.log(`Found ${filteredVendors.length} vendors offering required services`);
            
            // For debugging, log which vendors matched which services
            filteredVendors.forEach(vendor => {
              const content = vendor.content ? vendor.content.toLowerCase() : '';
              const title = vendor.title ? vendor.title.toLowerCase() : '';
              
              const matchedServiceList = vendorAnalysis.requiredServices.filter(service => {
                const serviceLower = service.toLowerCase();
                return content.includes(serviceLower) || title.includes(serviceLower);
              });
              
              console.log(`Vendor "${vendor.title}" matched services: ${matchedServiceList.join(', ')}`);
            });
          }
        }
      }
      
      // Step 2.5: Check if this is a category overview query
      if (vendorAnalysis && vendorAnalysis.queryType === "category_overview" && vendorAnalysis.vendorCategory) {
        console.log("Detected category overview query for:", vendorAnalysis.vendorCategory);
        
        // Map category names to their URL slugs
        const categoryUrlMap: { [key: string]: string } = {
          "Food & Dining": "food-dining",
          "Home Services": "home-services", 
          "Health and Medical": "health-medical",
          "Real Estate & Senior Living": "real-estate",
          "Funeral and Religious Services": "funeral-religious",
          "Moving and Transportation": "moving-transportation",
          "Insurance & Financial Services": "insurance-financial",
          "Technology & Electronics": "technology-and-electronics",
          "Retail & Shops": "retail-shops",
          "Beauty & Personal": "beauty-personal",
          "New Homes": "new-homes",
          "HVAC & Air Quality": "hvac-and-air-quality"
        };
        
        const categorySlug = categoryUrlMap[vendorAnalysis.vendorCategory];
        
        if (categorySlug) {
          const categoryUrl = `/vendors/${categorySlug}`;
          const vendorCount = filteredVendors.length;
          
          // Generate a category overview response
          setSearchResult(`
            <div class="space-y-4">
              <div class="flex items-start gap-3">
                <span class="text-xl mt-1">🏢</span>
                <div>
                  <h2 class="text-xl font-bold text-navy">Found ${vendorCount} ${vendorAnalysis.vendorCategory} Vendors</h2>
                  <p class="text-gray-600">I found ${vendorCount} vendors in the ${vendorAnalysis.vendorCategory} category that match your search.</p>
                </div>
              </div>
              <div class="bg-blue-50/70 p-4 rounded-lg border border-blue-100">
                <p class="mb-3">Browse all vendors in this category to see their services, contact information, and more details:</p>
                <div class="flex flex-wrap gap-2 mt-2">
                  <a href="${categoryUrl}" class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
                    <span>📋</span> View All ${vendorAnalysis.vendorCategory} Vendors
                  </a>
                </div>
                <p class="text-sm text-gray-500 mt-3">You'll find complete vendor profiles with descriptions, contact details, and services offered.</p>
              </div>
            </div>
          `);
          setIsSearching(false);
          return;
        }
      }
      
      // Step 3: Generate a user-friendly response with the filtered vendors
      // Use Gemini to create a more personalized response based on our filtering
      const vendorSearchPrompt = `
You are a community platform vendor search assistant for Barefoot Bay. 

The user searched for: "${query.trim()}"

Based on our analysis, we identified:
- Primary service need: ${vendorAnalysis?.primaryServiceNeed || "General vendor search"}
- Vendor category: ${vendorAnalysis?.vendorCategory || "All categories"}
- Specific vendor mentioned: ${vendorAnalysis?.specificVendorName || "None"}
- Required services: ${vendorAnalysis?.requiredServices?.join(', ') || "Not specified"}

I have filtered the vendors based on this analysis and found ${filteredVendors.length} matching vendors.

Here are the filtered vendor pages (showing up to 7 most relevant):
${JSON.stringify(filteredVendors.slice(0, 7).map(vendor => ({
  ...vendor,
  publicUrl: convertVendorSlugToPublicUrl(vendor.slug || '')
})), null, 2)}

Please generate HTML with:
1. A friendly greeting acknowledging their specific search need (mention what they're looking for)
2. A summary of what was found (e.g., "I found 5 vendors in the Home Services category that offer cleaning services")
3. A list of the matching vendors with:
   - The vendor name as a link to the vendor page using the publicUrl field (e.g., href="{vendor.publicUrl}")
   - The vendor category
   - A snippet from the content highlighting any matched services (if applicable)
   - For each vendor that matches specific services from the user's query, add a green badge/tag showing which service they match

4. A call to action to browse more vendors or contact for more information

The response should be formatted with attractive HTML that matches the following styling:
- Use "bg-blue-50/70" for container backgrounds
- Use "text-blue-700" for links and important text
- Use "text-gray-600" for secondary text
- Use "rounded-lg" for containers
- Include appropriate icons using span elements with emoji
- Use "bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium" for service match badges

Make the response conversational and helpful, focusing on accurately matching what the user is looking for.
`;

      const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [
                { text: vendorSearchPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const result = await response.json();
      const generatedResponse = result.candidates[0]?.content?.parts[0]?.text;
      
      if (!generatedResponse) {
        throw new Error("No response generated");
      }
      
      // Clean up the AI response - remove markdown formatting if present
      let cleanResponse = generatedResponse
        .replace(/```html/g, '')
        .replace(/```/g, '')
        .trim();
      
      setSearchResult(cleanResponse);
      
    } catch (error) {
      console.error("Error generating vendor search response:", error);
      
      // Fallback to a basic response
      setSearchResult(`
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-1">🏢</span>
            <div>
              <h2 class="text-xl font-bold text-navy">Local Vendors & Services</h2>
              <p class="text-gray-600">I couldn't generate specific vendor information for your search, but you can browse our vendor directory:</p>
            </div>
          </div>
          
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 class="font-medium text-navy mb-3">Vendor Categories</h3>
            <div class="grid grid-cols-2 gap-2">
              <a href="/community/vendors/home-services" class="px-3 py-2 bg-white rounded border border-gray-200 text-blue-700 hover:bg-blue-50">Home Services</a>
              <a href="/community/vendors/health-wellness" class="px-3 py-2 bg-white rounded border border-gray-200 text-blue-700 hover:bg-blue-50">Health & Wellness</a>
              <a href="/community/vendors/landscaping" class="px-3 py-2 bg-white rounded border border-gray-200 text-blue-700 hover:bg-blue-50">Landscaping</a>
              <a href="/community/vendors/food-dining" class="px-3 py-2 bg-white rounded border border-gray-200 text-blue-700 hover:bg-blue-50">Food & Dining</a>
              <a href="/community/vendors/professional-services" class="px-3 py-2 bg-white rounded border border-gray-200 text-blue-700 hover:bg-blue-50">Professional Services</a>
              <a href="/community/vendors/retail" class="px-3 py-2 bg-white rounded border border-gray-200 text-blue-700 hover:bg-blue-50">Retail</a>
            </div>
            <div class="mt-4">
              <a href="/community/vendors" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                <span>👉</span> Browse all vendors
              </a>
            </div>
          </div>
        </div>
      `);
    }
    
    setIsSearching(false);
  };
  
  /**
   * Handler for community content-related search queries
   */
  const handleCommunityQuery = async () => {
    try {
      // Fetch community pages if not already loaded
      const communityPagesResponse = await fetch('/api/pages?type=community');
      if (!communityPagesResponse.ok) {
        throw new Error("Failed to fetch community content");
      }
      
      const communityContentPages = await communityPagesResponse.json();
      
      if (!communityContentPages || communityContentPages.length === 0) {
        setSearchResult(`
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <span class="text-xl mt-1">🏡</span>
              <div>
                <h2 class="text-xl font-bold text-navy">Community Information</h2>
                <p class="text-gray-600">I couldn't find specific community information that matches your search.</p>
              </div>
            </div>
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p class="mb-3">Try browsing our community information pages:</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <a href="/community/community" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                  <span>🏡</span> Community Info
                </a>
                <a href="/community/government" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                  <span>🏛️</span> Government
                </a>
                <a href="/community/amenities" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                  <span>🏊</span> Amenities
                </a>
              </div>
            </div>
          </div>
        `);
        
        setIsSearching(false);
        return;
      }
      
      // Convert community page slugs to public URLs
      const communityPagesWithUrls = communityContentPages.slice(0, 10).map((page: any) => ({
        ...page,
        publicUrl: convertCommunitySlugToPublicUrl(page.slug || '')
      }));

      // Use Gemini to analyze and generate a personalized community content search response
      const communitySearchPrompt = `
You are a community information assistant for Barefoot Bay. The user just searched for: "${query.trim()}"

I have found the following community information pages that might be relevant. Help me create a personalized response that highlights the most relevant information based on the user's query.

Here are the community pages available (with their public URLs already converted):
${JSON.stringify(communityPagesWithUrls, null, 2)}

Please generate HTML with:
1. A friendly greeting and context about what they searched for
2. A list of 3-5 most relevant community information pages with:
   - The page title as a link using the publicUrl field (e.g., <a href="{publicUrl}">Title</a>)
   - The section/category it belongs to
   - A snippet from the content (truncated to ~100 chars if needed)
3. A call to action to browse more community information

IMPORTANT: Use the "publicUrl" field from the page data for all links. Do NOT construct URLs manually.

The response should be formatted with attractive HTML that matches the following styling:
- Use "bg-blue-50/70" for container backgrounds
- Use "text-blue-700" for links and important text
- Use "text-gray-600" for secondary text
- Use "rounded-lg" for containers
- Include appropriate icons using span elements with emoji (🏡 for community, 🏛️ for government, 🏊 for amenities)

Make the response conversational and helpful, as if a knowledgeable community member is guiding them to the information they need about Barefoot Bay.
`;

      const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [
                { text: communitySearchPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const result = await response.json();
      const generatedResponse = result.candidates[0]?.content?.parts[0]?.text;
      
      if (!generatedResponse) {
        throw new Error("No response generated");
      }
      
      // Clean up the AI response - remove markdown formatting if present
      let cleanResponse = generatedResponse
        .replace(/```html/g, '')
        .replace(/```/g, '')
        .trim();
      
      setSearchResult(cleanResponse);
      
    } catch (error) {
      console.error("Error generating community search response:", error);
      
      // Fallback to a basic response
      setSearchResult(`
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-1">🏡</span>
            <div>
              <h2 class="text-xl font-bold text-navy">Barefoot Bay Community Information</h2>
              <p class="text-gray-600">I couldn't generate specific community information for your search, but you can browse our community pages:</p>
            </div>
          </div>
          
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 class="font-medium text-navy mb-3">Community Information Categories</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div class="p-3 bg-white rounded border border-gray-200">
                <h4 class="font-medium text-navy flex items-center gap-2 mb-2">
                  <span>🏡</span> Community
                </h4>
                <ul class="space-y-1 text-gray-700">
                  <li><a href="/community/community/history" class="text-blue-700 hover:underline">Community History</a></li>
                  <li><a href="/community/community/demographics" class="text-blue-700 hover:underline">Demographics</a></li>
                  <li><a href="/community/community/news" class="text-blue-700 hover:underline">Community News</a></li>
                </ul>
              </div>
              
              <div class="p-3 bg-white rounded border border-gray-200">
                <h4 class="font-medium text-navy flex items-center gap-2 mb-2">
                  <span>🏛️</span> Government
                </h4>
                <ul class="space-y-1 text-gray-700">
                  <li><a href="/community/government/bbrd" class="text-blue-700 hover:underline">BBRD</a></li>
                  <li><a href="/community/government/board" class="text-blue-700 hover:underline">Board of Trustees</a></li>
                  <li><a href="/community/government/meetings" class="text-blue-700 hover:underline">Community Meetings</a></li>
                </ul>
              </div>
              
              <div class="p-3 bg-white rounded border border-gray-200">
                <h4 class="font-medium text-navy flex items-center gap-2 mb-2">
                  <span>🏊</span> Amenities
                </h4>
                <ul class="space-y-1 text-gray-700">
                  <li><a href="/community/amenities/pools" class="text-blue-700 hover:underline">Community Pools</a></li>
                  <li><a href="/community/amenities/golf" class="text-blue-700 hover:underline">Golf Course</a></li>
                  <li><a href="/community/amenities/recreation" class="text-blue-700 hover:underline">Recreation Facilities</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      `);
    }
    
    setIsSearching(false);
  };

  /**
   * Process and handle rocket launch related queries
   */ 
  const handleRocketLaunchQuery = async () => {
    try {
      const response = await fetch('/api/rocket-launches');
      
      if (!response.ok) {
        throw new Error('Failed to fetch rocket launch data');
      }
      
      const launchData = await response.json();
      
      if (!launchData || launchData.length === 0) {
        setSearchResult(`
          Hello, neighbor! 👋
          
          I don't have any information about upcoming rocket launches visible from Barefoot Bay at the moment.
          
          <span class="inline-block">👉<a href="https://www.spacecoastlaunches.com/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-4 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Check Space Coast Launches website</a></span>
          
          Happy to help with more questions! 🌞
        `);
        setIsSearching(false);
        return;
      }
      
      // Format launch data into HTML
      let launchesHTML = '';
      
      launchData.forEach((launch: any, index: number) => {
        const launchDate = launch.window_start 
          ? new Date(launch.window_start).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            }) 
          : launch.est_date
            ? `${launch.est_date.month}/${launch.est_date.day}/${launch.est_date.year}` 
            : "Date TBD";
            
        const launchTime = launch.window_start
          ? new Date(launch.window_start).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', hour12: true
            })
          : "Time TBD";
          
        launchesHTML += `
        ${index > 0 ? '<hr class="my-4 border-gray-200" />' : ''}
        <div class="px-4 py-3 rounded-lg bg-blue-50/70 border border-blue-100 shadow-sm">
          <h3 class="text-xl font-bold text-navy mb-3">🚀 ${launch.name}</h3>
          <div class="space-y-2">
            <p><span class="inline-flex items-center">📅 <span class="ml-2 font-medium">Launch Date:</span></span> <span class="ml-2">${launchDate}</span></p>
            <p><span class="inline-flex items-center">⏰ <span class="ml-2 font-medium">Launch Time:</span></span> <span class="ml-2">${launchTime}</span></p>
            <p><span class="inline-flex items-center">📍 <span class="ml-2 font-medium">Location:</span></span> <span class="ml-2">${launch.pad.location.name}</span></p>
            <p><span class="inline-flex items-center">🛰️ <span class="ml-2 font-medium">Rocket:</span></span> <span class="ml-2">${launch.vehicle.name}</span></p>
            <p><span class="inline-flex items-center">🏢 <span class="ml-2 font-medium">Provider:</span></span> <span class="ml-2">${launch.provider.name}</span></p>
            ${launch.missions && launch.missions.length > 0 
              ? `<p><span class="inline-flex items-center">🔭 <span class="ml-2 font-medium">Mission:</span></span> <span class="ml-2">${launch.missions[0].name || "Not specified"}</span></p>` 
              : ""
            }
            <div class="mt-3">
              <span class="text-xs text-blue-600">This launch will be visible from Barefoot Bay!</span>
            </div>
          </div>
        </div>
        `;
      });
      
      setSearchResult(`
        <div class="space-y-6">
          <div class="flex flex-col space-y-2">
            <h2 class="text-xl font-bold text-navy flex items-center">
              <span class="mr-2">🚀</span> Upcoming Rocket Launches
            </h2>
            <p class="text-gray-600">
              Get ready for an amazing view! Here are the upcoming rocket launches visible from Barefoot Bay, Florida.
            </p>
          </div>
          
          ${launchesHTML}
          
          <div class="pt-4 flex flex-col space-y-3">
            <a href="https://www.spacecoastlaunches.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="inline-flex items-center px-4 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-fit">
              <span class="mr-2">🔭</span> View more launch information
            </a>
            
            <p class="text-sm text-gray-500 italic">
              <span class="mr-1">💡</span> Pro tip: For the best viewing experience, head to Barefoot Bay Community Center's east facing side about 15-20 minutes before launch time!
            </p>
          </div>
        </div>
      `);
      
    } catch (error) {
      console.error('Error fetching rocket launch data:', error);
      setSearchResult(`
        <div class="space-y-6">
          <div class="flex flex-col space-y-2">
            <h2 class="text-xl font-bold text-navy flex items-center">
              <span class="mr-2">🚀</span> Rocket Launch Information
            </h2>
            <div class="p-4 bg-blue-50/70 border border-blue-100 rounded-lg">
              <p class="text-gray-700 mb-3">
                <span class="mr-2">🔍</span> I couldn't retrieve the latest rocket launch information at the moment.
              </p>
              <p class="text-gray-600 mb-4">
                The Space Coast (just east of Barefoot Bay) is one of the best places in the country to view rocket launches, with multiple launches visible each month!
              </p>
              <a href="https://www.spacecoastlaunches.com/" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="inline-flex items-center px-4 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-fit">
                <span class="mr-2">🔭</span> Check Space Coast Launches website
              </a>
            </div>
            
            <div class="mt-3 text-sm text-gray-500 italic">
              <p>
                <span class="mr-1">💡</span> Pro tip: For the best viewing experience of rocket launches, head to Barefoot Bay Community Center's east facing side!
              </p>
            </div>
          </div>
        </div>
      `);
    }
    
    setIsSearching(false);
  };
  
  /**
   * Process and handle real estate related queries
   * Enhanced with improved Gemini understanding of property and classified listing queries
   */
  const handleRealEstateQuery = async () => {
    console.log("Handling real estate/for-sale query:", query, "Available listings:", listings?.length || 0);
    
    // Additional debugging for real estate queries
    // Check if the query contains specific property filter terms
    const propertyTypeTerms = ['house', 'home', 'property', 'bedroom', 'bathroom', 'sqft', 'square feet'];
    const propertyTermMatches = propertyTypeTerms.filter(term => query.toLowerCase().includes(term));
    console.log(`Property term matches found: ${propertyTermMatches.join(', ')}`);
    
    // Check if query is about classifieds
    const classifiedTerms = ['furniture', 'tools', 'electronics', 'garage sale', 'yard sale', 'cash only', 'classified'];
    const classifiedTermMatches = classifiedTerms.filter(term => query.toLowerCase().includes(term));
    console.log(`Classified term matches found: ${classifiedTermMatches.join(', ')}`);
    
    // Check for open house mentions
    const isOpenHouseQuery = query.toLowerCase().includes('open house') || 
                          (query.toLowerCase().includes('open') && query.toLowerCase().includes('house'));
    console.log(`Open house query: ${isOpenHouseQuery}`);
    
    if (!listings || listings.length === 0) {
      setSearchResult(`
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏠</span>
            <p class="font-medium text-xl">No Listings Available</p>
          </div>
          
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p class="mb-3">I don't see any real estate listings at the moment. Check back later for property listings in Barefoot Bay.</p>
            
            <div class="flex justify-center w-full mt-2">
              <a href="/for-sale" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                <span>👉</span> View all listings
              </a>
            </div>
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }
    
    // Check for exact or partial title matches first
    const queryText = query.trim().toLowerCase();
    
    // Find listings with exact title matches
    const exactTitleMatches = listings.filter((listing: any) => 
      listing.title.toLowerCase() === queryText
    );
    
    // Find listings with partial title matches
    const partialTitleMatches = listings.filter((listing: any) => 
      listing.title.toLowerCase().includes(queryText) && 
      !exactTitleMatches.includes(listing)
    );
    
    // If we have exact or partial title matches, prioritize these
    if (exactTitleMatches.length > 0 || partialTitleMatches.length > 0) {
      const matchedListings = [...exactTitleMatches, ...partialTitleMatches];
      const listingLinks = matchedListings.map((listing: any) => {
        // Format currency
        const formattedPrice = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }).format(listing.price);
        
        // Create property details string
        const propertyDetails = [
          listing.bedrooms && `${listing.bedrooms} BD`,
          listing.bathrooms && `${listing.bathrooms} BA`,
          listing.squareFeet && `${listing.squareFeet.toLocaleString()} sqft`
        ].filter(Boolean).join(' • ');
        
        return `
          <div class="bg-blue-50/70 border border-blue-100 rounded-lg p-4 mb-4">
            <h3 class="text-lg font-bold mb-2">
              <a href="/for-sale/${listing.id}" class="text-blue-700 hover:text-blue-900 hover:underline">
                ${listing.title}
              </a>
            </h3>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between sm:gap-4 mb-2">
              <p class="text-green-700 font-semibold text-xl mb-1 sm:mb-0">${formattedPrice}</p>
              <div class="text-sm text-gray-600">${propertyDetails}</div>
            </div>
            ${listing.address ? `<p class="text-sm text-gray-600 mb-2">${listing.address}</p>` : ''}
            <div class="mt-3">
              <a href="/for-sale/${listing.id}" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                View listing details
              </a>
            </div>
          </div>
        `;
      }).join('');
      
      // Create a response with the matched listings
      setSearchResult(`
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-1">🔍</span>
            <div>
              <h2 class="text-xl font-bold text-blue-900">Found ${matchedListings.length} matching listing${matchedListings.length > 1 ? 's' : ''}</h2>
              <p class="text-gray-600">Here ${matchedListings.length > 1 ? 'are' : 'is'} the listing${matchedListings.length > 1 ? 's' : ''} that match${matchedListings.length === 1 ? 'es' : ''} "${query.trim()}":</p>
            </div>
          </div>
          
          <div class="mt-4">
            ${listingLinks}
          </div>
          
          <div class="flex justify-center mt-4">
            <a href="/for-sale" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
              <span>👉</span> View all listings
            </a>
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }

    try {
      // Use enhanced Gemini prompt for real estate and marketplace query analysis
      // This handles a wider range of property and classified scenarios
      const filterAnalysisPrompt = `
🎯 Overall Objective:
You are a specialized real estate and marketplace search assistant for the Barefoot Bay community in Florida. Your task is to ensure EXACT, PRECISE filtering based on user requirements.

📋 CRITICAL FILTERING RULES:
1. For bedrooms and bathrooms, default to EXACT MATCHES unless user explicitly uses phrases like "at least," "more than," or "minimum."
   - Example: "2 bedroom house" means EXACTLY 2 bedrooms, not 2+ bedrooms
   - Example: "at least 2 bedrooms" means 2+ bedrooms

2. For year built, square footage, and price, follow the exact range specified:
   - "Built between 2000-2010" means ONLY show properties from that range
   - "Over 2000 sqft" means strictly > 2000 sq ft
   - "Under $400k" means strictly < $400,000

3. For features like "lake view" or "pool", ONLY match listings that explicitly have that feature. Be precise and strict about features:
   - "Lake view" means the property has a view of the lake but is not necessarily ON the lake
   - "Waterfront" means the property is directly on the water
   - "Pool" means the property has its own swimming pool
   - "Garage" means the property has an enclosed garage structure
   - "Backyard" means the property has a private yard area in the back

4. For listing type, strictly match the requested type (Sale, Rent, FSBO, etc.)

Focus on identifying if this query is about:
1. Properties (houses, homes, real estate listings, rentals)
2. Classifieds/Marketplace (furniture, electronics, tools, garage sales, etc.)
3. Open houses (property listings with open house dates)

For PROPERTIES, extract these requirements:
- Property type (house, apartment, condo, etc.)
- Bedrooms (exact number or minimum) - DEFAULT TO EXACT MATCH unless user specifies otherwise
- Bathrooms (exact number or minimum) - DEFAULT TO EXACT MATCH unless user specifies otherwise
- Square footage (range or minimum)
- Year built (range or minimum)
- Price range (minimum and maximum)
- Special features (pool, garage, lake view, etc.)
- Listing type (for sale by owner, by agent, for rent)

For CLASSIFIEDS (non-real estate items for sale):
- Item category (furniture, electronics, tools, etc.)
- Condition (new, used, etc.)
- Price range
- Seller type (individual, business)

For OPEN HOUSES:
- Timeframe (specific date, this weekend, etc.)
- Property requirements (same as above)

Query: "${query.trim()}"

Respond in this enhanced JSON format only without any explanation:
{
  "queryType": "property" | "classified" | "open_house",
  "propertyType": "string or null",
  "bedroomCount": number or null,
  "bedroomExactMatch": true/false, (true unless query explicitly says "at least" or "minimum" or "more than")
  "bathroomCount": number or null,
  "bathroomExactMatch": true/false, (true unless query explicitly says "at least" or "minimum" or "more than")
  "squareFeet": {"min": number or null, "max": number or null},
  "yearBuilt": {"min": number or null, "max": number or null},
  "price": {"min": number or null, "max": number or null},
  "features": ["array", "of", "features"],
  "listingType": "FSBO" | "Agent" | "Rent" | "OpenHouse" | "Wanted" | null,
  "classifiedCategory": "furniture" | "electronics" | "tools" | "garage_sale" | "other" | null,
  "condition": "new" | "used" | "like_new" | null,
  "openHouseDate": "string or null",
  "confidence": 0-100
}`;

      const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [
                { text: filterAnalysisPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 30,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        console.error('Error from Gemini API proxy:', response.status, response.statusText);
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const result = await response.json();
      const filterAnalysisText = result.candidates[0]?.content?.parts[0]?.text;
      
      if (!filterAnalysisText) {
        throw new Error("No filter analysis response generated");
      }
      
      // Extract JSON from response
      const jsonRegex = /{[\s\S]*}/;
      const jsonMatch = filterAnalysisText.match(jsonRegex);
      let filterData;
      
      if (jsonMatch) {
        try {
          filterData = JSON.parse(jsonMatch[0]);
          console.log("Property filter analysis:", filterData);
        } catch (e) {
          console.error("Failed to parse filter analysis JSON", e);
          throw new Error("Failed to parse property filters");
        }
      } else {
        throw new Error("No valid filter data found");
      }

      // Apply filters to the listings
      let filteredListings = [...listings];
      const lowercaseQuery = query.toLowerCase();
      
      // Create a list of exact matches to prioritize
      let contentMatchedListings = listings.filter((listing: any) => {
        // Check if query terms match the listing title or description
        const titleMatch = listing.title ? 
          listing.title.toLowerCase().includes(lowercaseQuery) : false;
        
        const descriptionMatch = listing.description ? 
          listing.description.toLowerCase().includes(lowercaseQuery) : false;
        
        return titleMatch || descriptionMatch;
      });
      
      // Check if query specifically mentions "for sale by owner" or "fsbo"
      const isFsboQuery = lowercaseQuery.includes("for sale by owner") || 
                          lowercaseQuery.includes("fsbo") ||
                          lowercaseQuery.includes("by owner");
      
      // Check if query specifically mentions "for sale by agent" or similar
      const isAgentQuery = lowercaseQuery.includes("for sale by agent") || 
                           lowercaseQuery.includes("by agent") ||
                           lowercaseQuery.includes("realtor") ||
                           lowercaseQuery.includes("real estate agent");
      
      // Check if query specifically mentions "open house"
      const isOpenHouseQuery = lowercaseQuery.includes("open house") || 
                              (lowercaseQuery.includes("next") && 
                               lowercaseQuery.includes("house"));
      
      // Check if query specifically mentions "for rent" or "rental"
      const isRentalQuery = lowercaseQuery.includes("for rent") || 
                            lowercaseQuery.includes("rental") ||
                            lowercaseQuery.includes("to rent") ||
                            lowercaseQuery.includes("rent") ||
                            lowercaseQuery.includes("places to rent");
      
      console.log("Query intent analysis:", { 
        isRentalQuery, 
        isFsboQuery, 
        isAgentQuery, 
        isOpenHouseQuery, 
        filterData 
      });
                            
      // Use our new enhanced model to detect query types and apply filters
      // Check if the model detected a specific query type from our enhanced analysis
      // The new model should identify queries as property, classified, or open_house
      
      // First, handle explicit query term matches
      if (isFsboQuery) {
        // Filter only for "For Sale By Owner" listings
        filteredListings = filteredListings.filter(listing => listing.listingType === "FSBO");
        console.log("Applied FSBO filter from explicit query terms");
      } else if (isAgentQuery) {
        // Filter only for "For Sale By Agent" listings
        filteredListings = filteredListings.filter(listing => listing.listingType === "Agent");
        console.log("Applied Agent filter from explicit query terms");
      } else if (isOpenHouseQuery) {
        // Filter only for "Open House" listings
        filteredListings = filteredListings.filter(listing => listing.listingType === "OpenHouse");
        console.log("Applied OpenHouse filter from explicit query terms");
      } else if (isRentalQuery) {
        // Filter only for "For Rent" listings
        filteredListings = filteredListings.filter(listing => listing.listingType === "Rent");
        console.log("Applied Rent filter from explicit query terms");
      } else {
        // Use the enhanced Gemini AI analysis for more advanced filtering
        
        // Check the query type from the new model
        const queryType = filterData.queryType; // "property", "classified", or "open_house"
        console.log("Gemini detected query type:", queryType);
        
        // Apply listing type filter from the enhanced model
        if (filterData.listingType) {
          filteredListings = filteredListings.filter(listing => 
            listing.listingType === filterData.listingType
          );
          console.log(`Applied ${filterData.listingType} filter from Gemini analysis`);
        }
        // If no explicit listing type but we have a property type, infer the likely type
        else if (filterData.propertyType) {
          const propertyTypeMap: Record<string, string[]> = {
            "house": ["FSBO", "Agent", "OpenHouse"],
            "apartment": ["Rent"],
            "rental": ["Rent"],
            "condo": ["FSBO", "Agent", "OpenHouse"],
            "for sale": ["FSBO", "Agent", "OpenHouse"],
            "for rent": ["Rent"]
          };
          
          const listingTypes = propertyTypeMap[filterData.propertyType.toLowerCase()] || [];
          if (listingTypes.length > 0) {
            filteredListings = filteredListings.filter(listing => 
              listingTypes.includes(listing.listingType)
            );
            console.log(`Applied listing type filter based on property type: ${filterData.propertyType}`);
          }
        }
        
        // Special handling for classified categories
        if (queryType === "classified" && filterData.classifiedCategory) {
          // For classified searches, look for these categories in the title or description
          const categoryTerms: Record<string, string[]> = {
            "furniture": ["furniture", "chair", "table", "sofa", "couch", "dresser", "cabinet"],
            "electronics": ["electronics", "tv", "television", "computer", "laptop", "phone", "tablet"],
            "tools": ["tools", "drill", "saw", "hammer", "wrench", "mower", "yard equipment"],
            "garage_sale": ["garage sale", "yard sale", "estate sale", "moving sale"],
            "other": []
          };
          
          const searchTerms = categoryTerms[filterData.classifiedCategory] || [];
          if (searchTerms.length > 0) {
            const categoryMatches = filteredListings.filter(listing => {
              const title = listing.title?.toLowerCase() || "";
              const description = listing.description?.toLowerCase() || "";
              
              return searchTerms.some(term => 
                title.includes(term) || description.includes(term)
              );
            });
            
            // Only apply this filter if we found matches
            if (categoryMatches.length > 0) {
              filteredListings = categoryMatches;
              console.log(`Applied classified category filter for: ${filterData.classifiedCategory}`);
            }
          }
        }
        
        // Special handling for open house dates
        if (queryType === "open_house" && filterData.openHouseDate) {
          // This would require having openHouseDate field in the listings
          // For now, we'll just filter to OpenHouse type listings
          filteredListings = filteredListings.filter(listing => 
            listing.listingType === "OpenHouse"
          );
          console.log("Applied open house filter");
        }
      }
      
      // Extract simple numerical ranges from the query for square feet
      const squareFeetRangeMatch = 
        lowercaseQuery.match(/(\d+)(?:\s*-\s*|\s+to\s+|[-–]\s*|between\s+)(\d+)\s*(?:sq\s*ft|square\s*feet|square\s*foot|sf|sq|sqft)/i) ||
        lowercaseQuery.match(/between\s+(\d+)\s+and\s+(\d+)\s*(?:sq\s*ft|square\s*feet|square\s*foot|sf|sq|sqft|$)/i);
      
      if (squareFeetRangeMatch) {
        const minSqFt = parseInt(squareFeetRangeMatch[1], 10);
        const maxSqFt = parseInt(squareFeetRangeMatch[2], 10);
        console.log("Extracted square footage range:", minSqFt, "-", maxSqFt);
        
        if (!isNaN(minSqFt) && !isNaN(maxSqFt)) {
          // Make sure min is actually less than max (in case user entered them backwards)
          const actualMin = Math.min(minSqFt, maxSqFt);
          const actualMax = Math.max(minSqFt, maxSqFt);
          
          // Set these values in filterData for display in summary
          if (!filterData.squareFeet) filterData.squareFeet = {};
          filterData.squareFeet.min = actualMin;
          filterData.squareFeet.max = actualMax;
          
          // Apply the filter
          filteredListings = filteredListings.filter(listing => 
            listing.squareFeet !== null && 
            listing.squareFeet !== undefined && 
            listing.squareFeet >= actualMin &&
            listing.squareFeet <= actualMax
          );
        }
      } else {
        // Look for single values like "1000 square feet" without range syntax
        const singleSquareFeetMatch = lowercaseQuery.match(/(\d+)\s*(?:sq\s*ft|square\s*feet|square\s*foot|sf|sq|sqft)/i);
        if (singleSquareFeetMatch) {
          const sqFt = parseInt(singleSquareFeetMatch[1], 10);
          console.log("Extracted single square footage value:", sqFt);
          
          if (!isNaN(sqFt)) {
            // Set for summary display - since we don't know if this is min/max, assume it's approximate
            if (!filterData.squareFeet) filterData.squareFeet = {};
            filterData.squareFeet.min = sqFt - 100; // Allow some flexibility
            filterData.squareFeet.max = sqFt + 100;
            
            // Apply filter with some flexibility around the mentioned value
            filteredListings = filteredListings.filter(listing => 
              listing.squareFeet !== null && 
              listing.squareFeet !== undefined && 
              listing.squareFeet >= (sqFt - 100) &&
              listing.squareFeet <= (sqFt + 100)
            );
          }
        }
      }
      
      // Filter by bedroom count using AI-analyzed exact vs minimum matching
      if (filterData.bedroomCount !== null && filterData.bedroomCount !== undefined) {
        // Use the AI-determined exact/minimum flag if available
        const useExactMatch = filterData.bedroomExactMatch !== undefined 
          ? filterData.bedroomExactMatch 
          : true; // Default to exact match if not specified
        
        // Log detailed information about the bedroom filter being applied
        console.log("🏠 Bedroom filter:", {
          count: filterData.bedroomCount,
          exactMatch: useExactMatch,
          matchType: useExactMatch ? "EXACT" : "AT LEAST"
        });
        
        if (useExactMatch) {
          // Apply an EXACT match filter (bedrooms === N)
          console.log(`Applying EXACT match filter for ${filterData.bedroomCount} bedrooms`);
          filteredListings = filteredListings.filter(listing => 
            listing.bedrooms !== null && 
            listing.bedrooms !== undefined && 
            listing.bedrooms === filterData.bedroomCount
          );
        } else {
          // Apply an AT LEAST filter (bedrooms >= N)
          console.log(`Applying AT LEAST filter for ${filterData.bedroomCount}+ bedrooms`);
          filteredListings = filteredListings.filter(listing => 
            listing.bedrooms !== null && 
            listing.bedrooms !== undefined && 
            listing.bedrooms >= filterData.bedroomCount
          );
        }
        
        // Log how many properties passed the filter
        console.log(`${filteredListings.length} properties passed the bedroom filter`);
      }
      
      // Filter by bathroom count using AI-analyzed exact vs minimum matching
      if (filterData.bathroomCount !== null && filterData.bathroomCount !== undefined) {
        // Use the AI-determined exact/minimum flag if available
        const useExactMatch = filterData.bathroomExactMatch !== undefined 
          ? filterData.bathroomExactMatch 
          : true; // Default to exact match if not specified
        
        // Log detailed information about the bathroom filter being applied
        console.log("🚿 Bathroom filter:", {
          count: filterData.bathroomCount,
          exactMatch: useExactMatch,
          matchType: useExactMatch ? "EXACT" : "AT LEAST"
        });
        
        if (useExactMatch) {
          // Apply an EXACT match filter (bathrooms === N)
          console.log(`Applying EXACT match filter for ${filterData.bathroomCount} bathrooms`);
          filteredListings = filteredListings.filter(listing => 
            listing.bathrooms !== null && 
            listing.bathrooms !== undefined && 
            listing.bathrooms === filterData.bathroomCount
          );
        } else {
          // Apply an AT LEAST filter (bathrooms >= N)
          console.log(`Applying AT LEAST filter for ${filterData.bathroomCount}+ bathrooms`);
          filteredListings = filteredListings.filter(listing => 
            listing.bathrooms !== null && 
            listing.bathrooms !== undefined && 
            listing.bathrooms >= filterData.bathroomCount
          );
        }
        
        // Log how many properties passed the filter
        console.log(`${filteredListings.length} properties passed the bathroom filter`);
      }
      
      // Extract and apply year built filter from query
      if (!filterData.yearBuilt || (!filterData.yearBuilt.min && !filterData.yearBuilt.max)) {
        // Try different regex patterns to match "built after 2000" and variations
        const yearBuiltMatch = 
          lowercaseQuery.match(/(?:built|year)\s*(?:after|since|>\s*|from)\s*(\d{4})/i) ||
          lowercaseQuery.match(/(?:built|year|from)\s+(\d{4})/i) ||
          lowercaseQuery.match(/(?:after|since)\s+(\d{4})/i);
        
        if (yearBuiltMatch) {
          const yearBuilt = parseInt(yearBuiltMatch[1], 10);
          console.log("Extracted year built:", yearBuilt);
          
          if (!isNaN(yearBuilt)) {
            // Set for summary display
            if (!filterData.yearBuilt) filterData.yearBuilt = {};
            filterData.yearBuilt.min = yearBuilt;
            
            // Apply filter
            filteredListings = filteredListings.filter(listing => 
              listing.yearBuilt !== null && 
              listing.yearBuilt !== undefined && 
              listing.yearBuilt >= yearBuilt
            );
          }
        }
      }
      
      // Filter by square footage from AI
      if (filterData.squareFeet) {
        if (filterData.squareFeet.min !== null && filterData.squareFeet.min !== undefined) {
          filteredListings = filteredListings.filter(listing => 
            listing.squareFeet !== null && 
            listing.squareFeet !== undefined && 
            listing.squareFeet >= filterData.squareFeet.min
          );
        }
        
        if (filterData.squareFeet.max !== null && filterData.squareFeet.max !== undefined) {
          filteredListings = filteredListings.filter(listing => 
            listing.squareFeet !== null && 
            listing.squareFeet !== undefined && 
            listing.squareFeet <= filterData.squareFeet.max
          );
        }
      }
      
      // Filter by year built from AI
      if (filterData.yearBuilt) {
        if (filterData.yearBuilt.min !== null && filterData.yearBuilt.min !== undefined) {
          filteredListings = filteredListings.filter(listing => 
            listing.yearBuilt !== null && 
            listing.yearBuilt !== undefined && 
            listing.yearBuilt >= filterData.yearBuilt.min
          );
        }
        
        if (filterData.yearBuilt.max !== null && filterData.yearBuilt.max !== undefined) {
          filteredListings = filteredListings.filter(listing => 
            listing.yearBuilt !== null && 
            listing.yearBuilt !== undefined && 
            listing.yearBuilt <= filterData.yearBuilt.max
          );
        }
      }
      
      // Filter by price from AI
      if (filterData.price) {
        if (filterData.price.min !== null && filterData.price.min !== undefined) {
          filteredListings = filteredListings.filter(listing => 
            listing.price !== null && 
            listing.price !== undefined && 
            listing.price >= filterData.price.min
          );
        }
        
        if (filterData.price.max !== null && filterData.price.max !== undefined) {
          filteredListings = filteredListings.filter(listing => 
            listing.price !== null && 
            listing.price !== undefined && 
            listing.price <= filterData.price.max
          );
        }
      }
      
      // Enhanced feature filtering to ensure all requested features are present
      if (filterData.features && filterData.features.length > 0) {
        console.log(`🔍 Filtering for special features: ${filterData.features.join(', ')}`);
        
        // First count how many listings we have before applying feature filters
        const preFilterCount = filteredListings.length;
        
        // Create a description filter to look for any of these features 
        // AND log exactly which features matched for debugging
        filteredListings = filteredListings.filter(listing => {
          const description = (listing.description || "").toLowerCase();
          const title = (listing.title || "").toLowerCase();
          
          // Check each requested feature
          const matchedFeatures = [];
          const missingFeatures = [];
          
          // Check each feature against both title and description
          filterData.features.forEach(feature => {
            const featureLower = feature.toLowerCase();
            if (description.includes(featureLower) || title.includes(featureLower)) {
              matchedFeatures.push(feature);
            } else {
              missingFeatures.push(feature);
            }
          });
          
          // For debugging: print which listing matched or failed which features
          if (matchedFeatures.length > 0) {
            console.log(`Listing #${listing.id} matched features: ${matchedFeatures.join(', ')}`);
          }
          
          if (missingFeatures.length > 0) {
            console.log(`Listing #${listing.id} missing features: ${missingFeatures.join(', ')}`);
          }
          
          // The listing must match ALL requested features (strict filtering)
          return missingFeatures.length === 0;
        });
        
        console.log(`Feature filtering reduced listings from ${preFilterCount} to ${filteredListings.length}`);
      }
      
      // Identify if we have any content-matched listings that didn't make it through the filters
      const remainingContentMatches = contentMatchedListings.filter((listing: any) => {
        return !filteredListings.some((filtered: any) => filtered.id === listing.id);
      });
      
      console.log("Content matched listings:", contentMatchedListings.length);
      console.log("Filtered listings:", filteredListings.length);
      console.log("Remaining content matches:", remainingContentMatches.length);
      
      // Combine filtered listings with any remaining content matches
      // Content matches should appear first as they're directly relevant to the query text
      const combinedListings = [
        ...filteredListings,
        ...remainingContentMatches
      ];
      
      // Remove duplicates (in case some content matches also passed the filters)
      const uniqueListings = combinedListings.filter((listing, index, self) =>
        index === self.findIndex((l) => l.id === listing.id)
      );
      
      // Format the listings into card display
      if (uniqueListings.length === 0) {
        setSearchResult(`
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xl">🏠</span>
              <p class="font-medium text-xl">No Matching Properties</p>
            </div>
            
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p class="mb-3">I couldn't find any properties matching your criteria in Barefoot Bay. Try adjusting your search or browse all listings.</p>
              
              <div class="flex justify-center w-full mt-2">
                <a href="/for-sale" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                  <span>👉</span> View all listings
                </a>
              </div>
            </div>
          </div>
        `);
      } else {
        // Sort listings by relevance:
        // 1. First show content matches (those matching title/description)
        // 2. Then show filter matches (those matching criteria)
        // Within each group, sort by newest first
        uniqueListings.sort((a, b) => {
          // First check if one is a content match and the other isn't
          const aIsContentMatch = contentMatchedListings.some((listing: any) => listing.id === a.id);
          const bIsContentMatch = contentMatchedListings.some((listing: any) => listing.id === b.id);
          
          if (aIsContentMatch && !bIsContentMatch) return -1;
          if (!aIsContentMatch && bIsContentMatch) return 1;
          
          // If both or neither are content matches, sort by date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        // Format currency for display
        const formatter = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        });
        
        // Generate search summary based on the filters and listing type
        let searchSummary = "Properties";
        const summaryParts = [];
        
        // Add listing type to summary
        if (isFsboQuery) {
          summaryParts.push("For Sale By Owner");
        } else if (isAgentQuery) {
          summaryParts.push("For Sale By Agent");
        } else if (isOpenHouseQuery) {
          summaryParts.push("Open House");
        } else if (isRentalQuery) {
          summaryParts.push("For Rent");
        }
        
        if (filterData.bedroomCount) {
          // Use the AI-determined exact/minimum flag for display
          const isExactMatch = filterData.bedroomExactMatch !== undefined 
            ? filterData.bedroomExactMatch 
            : true; // Default to exact match if not specified
            
          if (isExactMatch) {
            // Display as exact match (2 bedrooms)
            summaryParts.push(`${filterData.bedroomCount} bedroom${filterData.bedroomCount !== 1 ? 's' : ''}`);
          } else {
            // Display as minimum (2+ bedrooms)
            summaryParts.push(`${filterData.bedroomCount}+ bedroom${filterData.bedroomCount !== 1 ? 's' : ''}`);
          }
        }
        
        if (filterData.bathroomCount) {
          // Use the AI-determined exact/minimum flag for display
          const isExactMatch = filterData.bathroomExactMatch !== undefined 
            ? filterData.bathroomExactMatch 
            : true; // Default to exact match if not specified
            
          if (isExactMatch) {
            // Display as exact match (2 bathrooms)
            summaryParts.push(`${filterData.bathroomCount} bathroom${filterData.bathroomCount !== 1 ? 's' : ''}`);
          } else {
            // Display as minimum (2+ bathrooms)
            summaryParts.push(`${filterData.bathroomCount}+ bathroom${filterData.bathroomCount !== 1 ? 's' : ''}`);
          }
        }
        
        if (filterData.squareFeet) {
          // Display square footage as a range if both min and max are specified
          if (filterData.squareFeet.min && filterData.squareFeet.max) {
            summaryParts.push(`${filterData.squareFeet.min}-${filterData.squareFeet.max} sq ft`);
          } else if (filterData.squareFeet.min) {
            summaryParts.push(`${filterData.squareFeet.min}+ sq ft`);
          } else if (filterData.squareFeet.max) {
            summaryParts.push(`up to ${filterData.squareFeet.max} sq ft`);
          }
        }
        
        if (filterData.yearBuilt && filterData.yearBuilt.min) {
          summaryParts.push(`built after ${filterData.yearBuilt.min}`);
        }
        
        if (filterData.price && filterData.price.min) {
          summaryParts.push(`min price $${filterData.price.min.toLocaleString()}`);
        }
        
        if (filterData.price && filterData.price.max) {
          summaryParts.push(`max price $${filterData.price.max.toLocaleString()}`);
        }
        
        // Add special features to the summary
        if (filterData.features && filterData.features.length > 0) {
          // For a single feature, just add it
          if (filterData.features.length === 1) {
            summaryParts.push(`with ${filterData.features[0]}`);
          } 
          // For two features, join with "and"
          else if (filterData.features.length === 2) {
            summaryParts.push(`with ${filterData.features[0]} and ${filterData.features[1]}`);
          }
          // For more than two features, use commas and "and"
          else {
            const lastFeature = filterData.features[filterData.features.length - 1];
            const otherFeatures = filterData.features.slice(0, -1).join(', ');
            summaryParts.push(`with ${otherFeatures}, and ${lastFeature}`);
          }
        }
        
        if (summaryParts.length > 0) {
          searchSummary = summaryParts.join(", ");
        }
        
        // Generate HTML for property listings (limited to 5 max)
        const listingsToShow = uniqueListings.slice(0, 5);
        let listingsHTML = '';
        
        // Include content match badges
        const isContentMatch = (listing: any) => {
          return contentMatchedListings.some((match: any) => match.id === listing.id);
        };
        
        listingsToShow.forEach((listing, index) => {
          const listingType = listing.listingType;
          let typeLabel;
          let typeColor;
          
          switch (listingType) {
            case 'FSBO':
              typeLabel = 'For Sale By Owner';
              typeColor = 'bg-purple-100 text-purple-800';
              break;
            case 'Agent':
              typeLabel = 'For Sale By Agent';
              typeColor = 'bg-blue-100 text-blue-800';
              break;
            case 'Rent':
              typeLabel = 'For Rent';
              typeColor = 'bg-green-100 text-green-800';
              break;
            case 'OpenHouse':
              typeLabel = 'Open House';
              typeColor = 'bg-yellow-100 text-yellow-800';
              break;
            case 'Wanted':
              typeLabel = 'Wanted';
              typeColor = 'bg-red-100 text-red-800';
              break;
            default:
              typeLabel = 'Classified';
              typeColor = 'bg-gray-100 text-gray-800';
          }
          
          const price = listing.price ? formatter.format(listing.price) : 'Price on request';
          
          // Fix image URL to use storage proxy for real estate media
          let firstPhoto = null;
          if (listing.photos && listing.photos.length > 0) {
            const photoPath = listing.photos[0];
            // Check if it's already a full URL or needs storage proxy
            if (photoPath.startsWith('/real-estate-media/')) {
              // Convert to storage proxy URL
              const filename = photoPath.split('/').pop();
              firstPhoto = `/api/storage-proxy/REAL_ESTATE/${filename}`;
            } else if (photoPath.startsWith('/api/storage-proxy/')) {
              // Already using storage proxy
              firstPhoto = photoPath;
            } else {
              // Use as is for other formats
              firstPhoto = photoPath;
            }
          }
          
          const bedroomsText = listing.bedrooms ? `${listing.bedrooms}` : '-';
          const bathroomsText = listing.bathrooms ? `${listing.bathrooms}` : '-';
          const squareFeetText = listing.squareFeet ? `${listing.squareFeet}` : '-';
          const yearBuiltText = listing.yearBuilt ? `${listing.yearBuilt}` : '-';
          
          listingsHTML += `
            ${index > 0 ? '<hr class="my-4 border-gray-200" />' : ''}
            <div class="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div class="relative">
                <span class="absolute top-2 left-2 px-2 py-1 ${typeColor} text-xs font-medium rounded">
                  ${typeLabel}
                </span>
                <div class="absolute top-2 right-2 px-2 py-1 bg-gray-900/75 text-white text-sm font-bold rounded">
                  ${price}
                </div>
                ${firstPhoto ? `
                  <div class="h-48 w-full">
                    <img src="${firstPhoto}" alt="${listing.title}" class="h-full w-full object-cover" />
                  </div>
                ` : `
                  <div class="h-48 w-full bg-gray-100 flex items-center justify-center">
                    <span class="text-gray-400 text-lg">No image available</span>
                  </div>
                `}
              </div>
              
              <div class="p-4">
                <div>
                  <h3 class="text-lg font-bold leading-tight mb-1">
                    ${listing.title}
                  </h3>
                  ${isContentMatch(listing) ? `
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 mb-1">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                      </svg>
                      Title/Description match
                    </span>
                  ` : ''}
                </div>
                
                <p class="text-sm text-gray-600 mb-2">
                  ${listing.address || 'Address not provided'}
                </p>
                
                <div class="flex flex-wrap gap-3 text-sm text-gray-700 mb-4">
                  <div class="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-bed"><path d="M2 9V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"></path><path d="M2 11v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9"></path><path d="M2 12h20"></path><path d="M4 9h16v3H4z"></path></svg>
                    <span>${bedroomsText}</span>
                  </div>
                  
                  <div class="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-droplet"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                    <span>${bathroomsText}</span>
                  </div>
                  
                  <div class="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-square"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                    <span>${squareFeetText}</span>
                  </div>
                  
                  <div class="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-calendar"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span>${yearBuiltText}</span>
                  </div>
                  
                  ${/* Check if the listing matches any of the user's requested features and display a badge for each match */
                  filterData.features && filterData.features.length > 0 ? 
                    `<!-- Key features found in this listing -->
                    <div class="flex flex-wrap gap-2 mt-1 w-full">
                      ${filterData.features.map(feature => {
                        const featureLower = feature.toLowerCase();
                        const description = (listing.description || "").toLowerCase();
                        const title = (listing.title || "").toLowerCase();
                        
                        // Check if this feature is found in title or description
                        const isFeaturePresent = description.includes(featureLower) || title.includes(featureLower);
                        
                        if (isFeaturePresent) {
                          return `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                            </svg>
                            ${feature}
                          </span>`;
                        }
                        return '';
                      }).join('')}
                    </div>` 
                  : ''}
                </div>
                
                <a href="/for-sale/${listing.id}" class="block w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium text-center rounded transition-colors">
                  View Listing
                </a>
              </div>
            </div>
          `;
        });
        
        setSearchResult(`
          <div class="space-y-6">
            <div class="flex flex-col space-y-2">
              <h2 class="text-xl font-bold text-navy flex items-center">
                <span class="mr-2">🏠</span> ${listingsToShow.length} ${listingsToShow.length === 1 ? 'Property' : 'Properties'} Found
              </h2>
              <p class="text-gray-600">
                ${searchSummary}
              </p>
              ${contentMatchedListings.length > 0 ? `
                <p class="text-sm text-amber-700 mt-1">
                  <span class="inline-flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>
                    Results include listings that match your search text but may not meet all filter criteria.
                  </span>
                </p>
              ` : ''}
            </div>
            
            <div class="space-y-6">
              ${listingsHTML}
            </div>
            
            <div class="pt-4">
              <a href="/for-sale" 
                class="inline-flex items-center px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors w-fit">
                <span class="mr-2">🔍</span> View all listings on the For Sale page
              </a>
            </div>
          </div>
        `);
      }
      
    } catch (error) {
      console.error('Error processing real estate query:', error);
      
      // Fallback response
      setSearchResult(`
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏠</span>
            <p class="font-medium text-xl">Real Estate Listings</p>
          </div>
          
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p class="mb-3">I couldn't process your real estate search at the moment. You can browse all available listings on our For Sale page.</p>
            
            <div class="flex justify-center w-full mt-2">
              <a href="/for-sale" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                <span>👉</span> View all listings
              </a>
            </div>
          </div>
        </div>
      `);
    }
    
    setIsSearching(false);
  };

  /**
   * Calculate similarity score between two strings (0-100)
   * Uses a combination of exact matches, word overlaps, and character similarity
   */
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

  /**
   * Helper function to check if a query is for a specific date
   */
  const isSpecificDateQuery = (rangeType: string): boolean => {
    return rangeType.includes(',') && !rangeType.includes('week') && !rangeType.includes('weekend');
  };

  /**
   * Process and handle event related queries
   */
  /**
   * Analyze a query specifically for event-related details using Gemini AI
   * @param {string} userQuery - The user's search query
   * @returns {Promise<Object>} Event query analysis with category, badge requirements, etc.
   */
  const analyzeEventQuery = async (userQuery: string) => {
    // Default response if analysis fails
    const defaultAnalysis = {
      category: null,
      badgeRequired: null,
      dateRange: null,
      specificLocation: null,
      eventType: null,
      isSpecificDateQuery: false
    };
    
    try {
      // Create a specialized event analysis prompt for Gemini with comprehensive query variations
      const eventAnalysisPrompt = `
You are an AI assistant for a community events platform with these event fields:
- Title: Event name (required)
- Location: Where the event takes places (required)
- Start/End Date: When the event begins/ends (required)
- Category: "entertainment", "government", or "social" (required)
- Badge Required: Whether attendees need a membership badge (defaults to true)
- Description: Detailed information about the event
- Contact Info: Contact details (name, phone, email, website)

The platform also supports these filtering capabilities:
- Category Filtering: entertainment, government, social
- Badge Requirement Filtering: badge required, no badge
- Date Filtering: events on specific dates or date ranges

Your task is to analyze this search query to extract structured information:
"${userQuery.trim()}"

Users may phrase their event-related questions in many different ways:

TIME-BASED VARIATIONS:
- Today: "events today", "what's going on today", "what's happening today", "anything happening today", "any events today"
- Tomorrow: "any events tomorrow", "what's happening tomorrow", "what's planned for tomorrow"
- Yesterday: "what happened yesterday", "events yesterday", "what events were there yesterday"
- Specific Day: "events on Friday", "what's scheduled this Saturday", "any activities on Sunday"
- Specific Date: "events on April 30th", "any events May 1st", "what's on June 15th"
- Weekend: "weekend events", "anything happening this weekend", "what's happening Saturday and Sunday"
- Week-Based: "events this week", "what's happening next week", "anything this week"
- Month-Based: "events this month", "what's in May", "events for June"

ACTIVITY-BASED VARIATIONS:
- Specific Types: "any pickleball games", "dance events", "fitness classes today", "food events this week"
- General Questions: "what's happening at Barefoot Bay", "anything fun happening soon", "what's new"
- Filtered Needs: "morning events tomorrow", "evening events this Friday", "free events this week"

When identifying dates, follow these guidelines:
- Format dates as "YYYY-MM-DD" (e.g., "2025-05-01" for May 1, 2025)
- Be precise with month values (January=01, February=02, March=03, ... December=12)
- For specific date queries, set both start and end to the same date
- Always use ISO format with leading zeros (05 for May, not just 5)
- Use Eastern Standard Time (EST/EDT) for all date interpretations
- Today's date is 2025-04-27 in the Eastern timezone

Respond in this JSON format only:
{
  "category": "entertainment", "government", "social", or null if not specified,
  "badgeRequired": true, false, or null if not specified,
  "eventType": descriptive type of event (e.g., "music", "dance", "meeting") or null,
  "dateRange": {
    "start": "YYYY-MM-DD" or null,
    "end": "YYYY-MM-DD" or null,
    "description": "human readable description of date range"
  },
  "specificLocation": extracted location or null if not specified,
  "isSpecificDateQuery": true/false
}
`;

      // Call Gemini API to analyze event query
      const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [
                { text: eventAnalysisPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1, // Lower temperature for more precise responses
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        console.error('Error from Gemini API proxy:', response.status, response.statusText);
        return defaultAnalysis;
      }
      
      const result = await response.json();
      const analysisText = result.candidates[0]?.content?.parts[0]?.text;
      
      if (!analysisText) {
        console.error("No event analysis response generated");
        return defaultAnalysis;
      }
      
      // Extract the JSON from the response
      const jsonRegex = /{[\s\S]*}/;
      const jsonMatch = analysisText.match(jsonRegex);
      
      if (jsonMatch) {
        try {
          const eventData = JSON.parse(jsonMatch[0]);
          console.log("Event query analysis:", eventData);
          
          // Validate and normalize date formats
          if (eventData.dateRange && eventData.dateRange.start) {
            try {
              // Validate that dates are properly formatted as YYYY-MM-DD
              const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
              
              if (dateRegex.test(eventData.dateRange.start)) {
                // Date is already in correct format, ensure it's not modified by timezone issues
                console.log("Date from AI is already in correct YYYY-MM-DD format:", eventData.dateRange.start);
                
                // For specific date queries where end might be missing, set end = start
                if (eventData.isSpecificDateQuery && !eventData.dateRange.end) {
                  eventData.dateRange.end = eventData.dateRange.start;
                }
              } else {
                // If not in correct format, normalize it
                const startDate = new Date(eventData.dateRange.start);
                if (!isNaN(startDate.getTime())) {
                  // Convert to Eastern Time
                  const options = { 
                    year: 'numeric' as const, 
                    month: '2-digit' as const, 
                    day: '2-digit' as const,
                    timeZone: 'America/New_York'
                  };
                  
                  // Get date components in Eastern Time
                  const formatter = new Intl.DateTimeFormat('en-US', options);
                  const parts = formatter.formatToParts(startDate);
                  
                  // Build the date string in YYYY-MM-DD format
                  const month = parts.find(part => part.type === 'month')?.value || '01';
                  const day = parts.find(part => part.type === 'day')?.value || '01';
                  const year = parts.find(part => part.type === 'year')?.value || '2025';
                  
                  // Format as YYYY-MM-DD
                  eventData.dateRange.start = `${year}-${month}-${day}`;
                  console.log("Converted date from AI to EST:", eventData.dateRange.start);
                  
                  // For specific date queries where end might be missing, set end = start
                  if (eventData.isSpecificDateQuery && !eventData.dateRange.end) {
                    eventData.dateRange.end = eventData.dateRange.start;
                  }
                }
              }
              
              // Process end date if present with the same approach
              if (eventData.dateRange.end && !dateRegex.test(eventData.dateRange.end)) {
                const endDate = new Date(eventData.dateRange.end);
                if (!isNaN(endDate.getTime())) {
                  // Convert to Eastern Time
                  const options = { 
                    year: 'numeric' as const, 
                    month: '2-digit' as const, 
                    day: '2-digit' as const,
                    timeZone: 'America/New_York'
                  };
                  
                  // Get date components in Eastern Time
                  const formatter = new Intl.DateTimeFormat('en-US', options);
                  const parts = formatter.formatToParts(endDate);
                  
                  // Build the date string in YYYY-MM-DD format
                  const month = parts.find(part => part.type === 'month')?.value || '01';
                  const day = parts.find(part => part.type === 'day')?.value || '01';
                  const year = parts.find(part => part.type === 'year')?.value || '2025';
                  
                  // Format as YYYY-MM-DD
                  eventData.dateRange.end = `${year}-${month}-${day}`;
                }
              }
              
              console.log("Normalized dates:", eventData.dateRange);
            } catch (dateError) {
              console.error("Date normalization error:", dateError);
            }
          }
          
          return eventData;
        } catch (e) {
          console.error("Failed to parse event analysis JSON", e);
          return defaultAnalysis;
        }
      } else {
        console.error("No valid event data found");
        return defaultAnalysis;
      }
    } catch (error) {
      console.error("Error with event query analysis:", error);
      return defaultAnalysis;
    }
  };

  const handleEventQuery = async () => {
    console.log("Handling event query:", query, "Available events:", events?.length || 0);
    
    // Check for multiple variations of "today" queries based on the comprehensive list
    const isTodayQuery = /\b(today|happening today|events today|going on today|what( events are|'s|s| is)( on| happening| going on| scheduled)? today|anything( happening| going on)? today|any events( happening| today)|what('s| is| events are) today|activities today|plans( for)? today|schedule( for)? today|calendar( for)? today|showing today|playing today|community events today|planned( for)? today|organized( for)? today|listed( for)? today|available today|today('s| is)? events)\b/i.test(query.trim().toLowerCase());
    
    // Use events data from the query to show upcoming events
    if (!events || events.length === 0) {
      setSearchResult(`
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">📅</span>
            <p class="font-medium text-xl">Hello, neighbor!</p>
          </div>
          
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p class="mb-3">I don't see any upcoming events at the moment. The community calendar will be updated soon with new activities.</p>
            
            <div class="flex justify-center w-full mt-2">
              <a href="/calendar" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                <span>👉</span> View all events
              </a>
            </div>
          </div>
          
          <p class="text-gray-600 flex items-center gap-2">
            <span>🌞</span> Check back later or try searching for something else!
          </p>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }
    
    // PRIORITY 1: Check for high-similarity title matches (95%+) first
    const queryText = query.trim().toLowerCase();
    
    // Calculate similarity scores for all events and find high matches
    const highSimilarityMatches = events
      .map(event => ({
        event,
        similarity: calculateTitleSimilarity(queryText, event.title)
      }))
      .filter(item => item.similarity >= 95)
      .sort((a, b) => b.similarity - a.similarity);
    
    console.log("High similarity title matches (95%+):", highSimilarityMatches.map(item => ({
      title: item.event.title,
      similarity: item.similarity
    })));
    
    // If we have 95%+ matches, prioritize these and return immediately
    if (highSimilarityMatches.length > 0) {
      const matchedEvents = highSimilarityMatches.map(item => item.event);
      const topMatch = highSimilarityMatches[0];
      
      console.log(`Found ${matchedEvents.length} high-similarity event(s), top match: "${topMatch.event.title}" (${topMatch.similarity}%)`);
      
      // Generate detailed response for the high-similarity matches
      const eventDetails = matchedEvents.map(event => {
        const eventDate = new Date(event.startDate);
        const isUpcoming = eventDate >= new Date();
        const formattedDate = eventDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long', 
          day: 'numeric'
        });
        const formattedTime = eventDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        const timeStatus = isUpcoming ? 'Upcoming Event' : 'Past Event';
        const timeStatusColor = isUpcoming ? 'text-green-700 bg-green-50' : 'text-gray-700 bg-gray-50';
        
        return `
          <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6 shadow-lg">
            <div class="flex items-start justify-between mb-4">
              <h3 class="text-2xl font-bold text-blue-900 leading-tight">
                <a href="/events/${event.id}" class="hover:text-blue-700 hover:underline transition-colors">
                  ${event.title}
                </a>
              </h3>
              <span class="px-3 py-1 rounded-full text-sm font-semibold ${timeStatusColor} border">
                ${timeStatus}
              </span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div class="flex items-center text-gray-700">
                <span class="text-xl mr-3">📅</span>
                <div>
                  <div class="font-semibold">${formattedDate}</div>
                  <div class="text-sm text-gray-600">at ${formattedTime}</div>
                </div>
              </div>
              
              ${event.location ? `
                <div class="flex items-center text-gray-700">
                  <span class="text-xl mr-3">📍</span>
                  <div class="font-medium">${event.location}</div>
                </div>
              ` : ''}
              
              ${event.category ? `
                <div class="flex items-center text-gray-700">
                  <span class="text-xl mr-3">🏷️</span>
                  <div class="font-medium capitalize">${event.category}</div>
                </div>
              ` : ''}
              
              ${event.organizer ? `
                <div class="flex items-center text-gray-700">
                  <span class="text-xl mr-3">👤</span>
                  <div class="font-medium">${event.organizer}</div>
                </div>
              ` : ''}
            </div>
            
            ${event.description ? `
              <div class="bg-white bg-opacity-60 rounded-lg p-4 mb-4">
                <p class="text-gray-700 leading-relaxed">${event.description}</p>
              </div>
            ` : ''}
            
            ${event.contactInfo ? `
              <div class="bg-white bg-opacity-60 rounded-lg p-4 mb-4">
                <div class="flex items-center text-gray-700">
                  <span class="text-lg mr-2">📞</span>
                  <div class="font-medium">Contact: ${event.contactInfo}</div>
                </div>
              </div>
            ` : ''}
            
            ${event.price ? `
              <div class="bg-white bg-opacity-60 rounded-lg p-4 mb-4">
                <div class="flex items-center text-gray-700">
                  <span class="text-lg mr-2">💰</span>
                  <div class="font-medium">Price: ${event.price}</div>
                </div>
              </div>
            ` : ''}
            
            <div class="flex gap-3 mt-4">
              <a href="/events/${event.id}" class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                <span>📋</span> View Full Details
              </a>
              <a href="/calendar" class="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                <span>📅</span> View Calendar
              </a>
            </div>
          </div>
        `;
      }).join('');
      
      setSearchResult(`
        <div class="space-y-6">
          <div class="flex items-start gap-4">
            <span class="text-3xl mt-1">🎯</span>
            <div>
              <h2 class="text-2xl font-bold text-blue-900 mb-2">Perfect Match Found!</h2>
              <p class="text-gray-600 text-lg">I found exactly what you're looking for. Here ${matchedEvents.length === 1 ? 'is' : 'are'} the event${matchedEvents.length > 1 ? 's' : ''} that match "${query.trim()}":</p>
            </div>
          </div>
          
          <div class="mt-6">
            ${eventDetails}
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }
    
    // PRIORITY 2: Fall back to traditional exact and partial title matching
    // Find events with exact title matches (exclude past events)
    const exactTitleMatches = events.filter(event => {
      const eventDate = new Date(event.startDate);
      const isNotPast = eventDate >= now;
      return event.title.toLowerCase() === queryText && isNotPast;
    });
    
    // Find events with partial title matches (if no exact matches, exclude past events)
    const partialTitleMatches = events.filter(event => {
      const eventDate = new Date(event.startDate);
      const isNotPast = eventDate >= now;
      return event.title.toLowerCase().includes(queryText) && 
        !exactTitleMatches.includes(event) && isNotPast;
    });
    
    // Check for multiple variations of "tomorrow" queries based on the comprehensive list
    const isTomorrowQuery = /\b(tomorrow|happening tomorrow|events tomorrow|going on tomorrow|what( events are|'s|s| is)( on| happening| going on| scheduled)? tomorrow|anything( happening| going on)? tomorrow|any events( happening| tomorrow)|what('s| is| events are) tomorrow|activities tomorrow|plans( for)? tomorrow|schedule( for)? tomorrow|calendar( for)? tomorrow|showing tomorrow|playing tomorrow|planned( for)? tomorrow|organized( for)? tomorrow|listed( for)? tomorrow|available tomorrow|tomorrow('s| is)? events)\b/i.test(query.trim().toLowerCase());

    // Special case for "today" queries - handle this separately
    if (isTodayQuery) {
      console.log("Handling 'today' event query");
      
      // Get today's date (start and end of day)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      console.log("Today's date range:", {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString()
      });
      
      // Find events happening today
      const todayEvents = events.filter(event => {
        const eventDate = new Date(event.startDate);
        
        // Check if event date is between start and end of today
        const isEventToday = eventDate >= todayStart && eventDate <= todayEnd;
        console.log(`Event '${event.title}' (${eventDate.toISOString()}) today? ${isEventToday}`);
        
        return isEventToday;
      });
      
      console.log(`Found ${todayEvents.length} events for today`);
      
      if (todayEvents.length === 0) {
        setSearchResult(`
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xl">📅</span>
              <p class="font-medium text-xl">Hello, neighbor!</p>
            </div>
            
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p class="mb-3">I don't see any events scheduled for today. Check out the calendar for upcoming activities!</p>
              
              <div class="flex justify-center w-full mt-2">
                <a href="/calendar" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                  <span>👉</span> View community calendar
                </a>
              </div>
            </div>
          </div>
        `);
        
        setIsSearching(false);
        return;
      }
      
      // Sort today's events by start time
      todayEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      // Format the events for display
      const todayEventLinks = todayEvents.map(event => {
        const eventTime = new Date(event.startDate).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        return `
          <div class="bg-blue-50/70 border border-blue-100 rounded-lg p-4 mb-4">
            <h3 class="text-lg font-bold mb-2">
              <a href="/events/${event.id}" class="text-blue-700 hover:text-blue-900 hover:underline">
                ${event.title}
              </a>
            </h3>
            <div class="flex items-center text-sm text-gray-600 mb-2">
              <span class="mr-2">🕒</span>
              Today at ${eventTime}
              ${event.location ? `<span class="ml-3 mr-2">📍</span>${event.location}` : ''}
            </div>
            ${event.description ? `
              <p class="text-gray-600 text-sm mb-2">
                ${event.description.length > 100 ? event.description.substring(0, 100) + '...' : event.description}
              </p>
            ` : ''}
            <div class="mt-3">
              <a href="/events/${event.id}" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                View event details
              </a>
            </div>
          </div>
        `;
      }).join('');
      
      // Create a response with today's events
      setSearchResult(`
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-1">📅</span>
            <div>
              <h2 class="text-xl font-bold text-blue-900">Today's Events</h2>
              <p class="text-gray-600">Here ${todayEvents.length > 1 ? 'are' : 'is'} ${todayEvents.length} event${todayEvents.length > 1 ? 's' : ''} happening today in Barefoot Bay:</p>
            </div>
          </div>
          
          <div class="mt-4">
            ${todayEventLinks}
          </div>
          
          <div class="flex justify-center mt-4">
            <a href="/calendar" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
              <span>👉</span> View complete calendar
            </a>
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }
    
    // Special case for "tomorrow" queries - handle this separately
    if (isTomorrowQuery) {
      console.log("Handling 'tomorrow' event query");
      
      // Get tomorrow's date (start and end of day)
      const tomorrowStart = new Date();
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      tomorrowStart.setHours(0, 0, 0, 0);
      
      const tomorrowEnd = new Date();
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
      tomorrowEnd.setHours(23, 59, 59, 999);
      
      console.log("Tomorrow's date range:", {
        start: tomorrowStart.toISOString(),
        end: tomorrowEnd.toISOString()
      });
      
      // Find events happening tomorrow
      const tomorrowEvents = events.filter(event => {
        const eventDate = new Date(event.startDate);
        
        // Check if event date is between start and end of tomorrow
        const isEventTomorrow = eventDate >= tomorrowStart && eventDate <= tomorrowEnd;
        console.log(`Event '${event.title}' (${eventDate.toISOString()}) tomorrow? ${isEventTomorrow}`);
        
        return isEventTomorrow;
      });
      
      console.log(`Found ${tomorrowEvents.length} events for tomorrow`);
      
      if (tomorrowEvents.length === 0) {
        setSearchResult(`
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xl">📅</span>
              <p class="font-medium text-xl">Hello, neighbor!</p>
            </div>
            
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p class="mb-3">I don't see any events scheduled for tomorrow. Check out the calendar for upcoming activities!</p>
              
              <div class="flex justify-center w-full mt-2">
                <a href="/calendar" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                  <span>👉</span> View community calendar
                </a>
              </div>
            </div>
          </div>
        `);
        
        setIsSearching(false);
        return;
      }
      
      // Sort tomorrow's events by start time
      tomorrowEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      // Format the events for display
      const tomorrowEventLinks = tomorrowEvents.map(event => {
        const eventTime = new Date(event.startDate).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        return `
          <div class="bg-blue-50/70 border border-blue-100 rounded-lg p-4 mb-4">
            <h3 class="text-lg font-bold mb-2">
              <a href="/events/${event.id}" class="text-blue-700 hover:text-blue-900 hover:underline">
                ${event.title}
              </a>
            </h3>
            <div class="flex items-center text-sm text-gray-600 mb-2">
              <span class="mr-2">🕒</span>
              Tomorrow at ${eventTime}
              ${event.location ? `<span class="ml-3 mr-2">📍</span>${event.location}` : ''}
            </div>
            ${event.description ? `
              <p class="text-gray-600 text-sm mb-2">
                ${event.description.length > 100 ? event.description.substring(0, 100) + '...' : event.description}
              </p>
            ` : ''}
            <div class="mt-3">
              <a href="/events/${event.id}" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                View event details
              </a>
            </div>
          </div>
        `;
      }).join('');
      
      // Create a response with tomorrow's events
      setSearchResult(`
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-1">📅</span>
            <div>
              <h2 class="text-xl font-bold text-blue-900">Tomorrow's Events</h2>
              <p class="text-gray-600">Here ${tomorrowEvents.length > 1 ? 'are' : 'is'} ${tomorrowEvents.length} event${tomorrowEvents.length > 1 ? 's' : ''} happening tomorrow in Barefoot Bay:</p>
            </div>
          </div>
          
          <div class="mt-4">
            ${tomorrowEventLinks}
          </div>
          
          <div class="flex justify-center mt-4">
            <a href="/calendar" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
              <span>👉</span> View complete calendar
            </a>
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }
    
    // If we have exact or partial title matches, prioritize these
    if (exactTitleMatches.length > 0 || partialTitleMatches.length > 0) {
      const matchedEvents = [...exactTitleMatches, ...partialTitleMatches];
      const eventLinks = matchedEvents.map(event => {
        const eventDate = new Date(event.startDate);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short', 
          day: 'numeric'
        });
        
        return `
          <div class="bg-blue-50/70 border border-blue-100 rounded-lg p-4 mb-4">
            <h3 class="text-lg font-bold mb-2">
              <a href="/events/${event.id}" class="text-blue-700 hover:text-blue-900 hover:underline">
                ${event.title}
              </a>
            </h3>
            <div class="flex items-center text-sm text-gray-600 mb-2">
              <span class="mr-2">📅</span>
              ${formattedDate} at ${new Date(event.startDate).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </div>
            <div class="mt-3">
              <a href="/events/${event.id}" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                View event details
              </a>
            </div>
          </div>
        `;
      }).join('');
      
      // Create a response with the matched events
      setSearchResult(`
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-xl mt-1">🔍</span>
            <div>
              <h2 class="text-xl font-bold text-blue-900">Found ${matchedEvents.length} matching event${matchedEvents.length > 1 ? 's' : ''}</h2>
              <p class="text-gray-600">Here ${matchedEvents.length > 1 ? 'are' : 'is'} the event${matchedEvents.length > 1 ? 's' : ''} that match${matchedEvents.length === 1 ? 'es' : ''} "${query.trim()}":</p>
            </div>
          </div>
          
          <div class="mt-4">
            ${eventLinks}
          </div>
          
          <div class="flex justify-center mt-4">
            <a href="/calendar" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
              <span>👉</span> View complete calendar
            </a>
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }
    
    // If no title matches, continue with regular analysis
    const eventQueryAnalysis = await analyzeEventQuery(query);

    // Sort events by start date
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    // Check if the query is about past events with a comprehensive list of variations
    const isPastEventQuery = /\b(yesterday|happened|past|previous|last|earlier|finished|completed|over|done|recent|prior|before today)\b/i.test(query.toLowerCase()) ||
                           /\bwhat events (happened|occurred|took place|were there)\b/i.test(query.toLowerCase()) ||
                           /\b(any|what) events yesterday\b/i.test(query.toLowerCase());
    
    // Set current date reference point
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    // Filter events based on query intent - past or future
    let filteredEventsByTime = sortedEvents;
    if (isPastEventQuery) {
      // For past events, get events that happened before today
      filteredEventsByTime = sortedEvents.filter(event => 
        new Date(event.startDate) < now
      );
      // Sort past events from most recent to oldest
      filteredEventsByTime.reverse();
    } else {
      // Default to upcoming events (including today)
      filteredEventsByTime = sortedEvents.filter(event => 
        new Date(event.startDate) >= now
      );
    }
    
    // Handle case when there are no events in the requested time period
    if (filteredEventsByTime.length === 0) {
      const messageContext = isPastEventQuery ? "past events" : "upcoming events";
      setSearchResult(`
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 justify-center">
            <span class="text-xl">📅</span>
            <p class="font-medium text-xl">Hello, neighbor!</p>
          </div>
          
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p class="mb-3">I don't see any ${messageContext} at the moment. The community calendar will be updated soon with new activities.</p>
            
            <div class="flex justify-center w-full mt-2">
              <a href="/calendar" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                <span>👉</span> View all events
              </a>
            </div>
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }

    // Step 1: Parse query intent with comprehensive patterns from user list
    const isNextEventQuery = /\b(next|soon|upcoming|coming( up)?|planned|scheduled|following|future)\b/i.test(query.toLowerCase()) ||
                           /\bwhat('s| is)( the)? next\b/i.test(query.toLowerCase()) ||
                           /\bevents (planned|scheduled|coming up)\b/i.test(query.toLowerCase());
    
    const specificEventType = getSpecificEventType(query);
    
    // Step 2: Extract date range information
    const { dateRange, rangeType } = extractDateRange(query);
    
    // Step 3: Initialize response variables
    let eventsToShow: Event[] = [];
    let responseTitle = "Here's what I found about upcoming events:";
    
    // Step 4: Apply filters based on AI analysis and extracted date range
    let dateFilteredEvents = filteredEventsByTime;
    
    // Apply AI-detected date range if available
    let aiDateRange = null;
    let dateRangeDescription = '';
    
    if (eventQueryAnalysis.dateRange && eventQueryAnalysis.dateRange.start) {
      // Use the AI-detected date range
      dateRangeDescription = eventQueryAnalysis.dateRange.description || '';
      
      // Get the date strings directly from the API response (already in YYYY-MM-DD format)
      const aiStartDateString = eventQueryAnalysis.dateRange.start;
      const aiEndDateString = eventQueryAnalysis.dateRange.end || aiStartDateString;
      
      console.log("Date analysis from AI:", {
        originalQuery: eventQueryAnalysis.dateRange,
        aiStartDateString,
        aiEndDateString
      });
      
      // Helper function to format any date to YYYY-MM-DD in Eastern timezone
      const formatToESTDateString = (date: Date): string => {
        return new Intl.DateTimeFormat('en-CA', {
          year: 'numeric' as const,
          month: '2-digit' as const,
          day: '2-digit' as const,
          timeZone: 'America/New_York'
        }).format(date);
      };
      
      // Create Date objects with proper time boundaries
      const startDate = new Date(`${aiStartDateString}T00:00:00-04:00`); // EST timezone
      const endDate = new Date(`${aiEndDateString}T23:59:59-04:00`); // EST timezone
      
      console.log("Converted to Date objects with EST timezone:", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      dateFilteredEvents = filteredEventsByTime.filter((event: Event) => {
        const eventDate = new Date(event.startDate);
        const eventDateInEST = formatToESTDateString(eventDate);
        
        // For single-day queries, do direct string comparison of dates in YYYY-MM-DD format
        if (eventQueryAnalysis.isSpecificDateQuery) {
          // Log all comparisons for debugging
          console.log("Date comparison (EST-aware):", {
            event: event.title,
            eventDateFull: eventDate.toISOString(),
            eventDateInEST,
            aiDateString: aiStartDateString,
            match: eventDateInEST === aiStartDateString
          });
          
          // Compare the formatted EST date strings directly
          return eventDateInEST === aiStartDateString;
        }
        
        // For date ranges, use start and end
        return eventDate >= startDate && eventDate <= endDate;
      });
      
      // Update the response title to include the date range
      if (eventQueryAnalysis.isSpecificDateQuery) {
        responseTitle = `Here's what I found for events on ${dateRangeDescription || rangeType}:`;
      } else {
        responseTitle = `Here's what I found for events during ${dateRangeDescription || rangeType}:`;
      }
    }
    // If no AI date range but we have traditional date range
    else if (dateRange) {
      // Check if this is a specific date query (like "April 11th")
      const isForSpecificDate = rangeType.includes(',') && !rangeType.includes('week') && !rangeType.includes('weekend');
      
      // Helper function to format any date to YYYY-MM-DD in Eastern timezone
      const formatToESTDateString = (date: Date): string => {
        return new Intl.DateTimeFormat('en-CA', {
          year: 'numeric' as const,
          month: '2-digit' as const,
          day: '2-digit' as const,
          timeZone: 'America/New_York'
        }).format(date);
      };
      
      dateFilteredEvents = filteredEventsByTime.filter((event: Event) => {
        const eventDate = new Date(event.startDate);
        
        // For specific date queries, filter more strictly - just events on that exact day
        if (isForSpecificDate) {
          // Use Eastern timezone-aware date comparison
          const eventDateEST = formatToESTDateString(eventDate);
          const rangeStartEST = formatToESTDateString(dateRange.start);
          
          console.log("Traditional date comparison (EST-aware):", {
            event: event.title,
            eventDateEST,
            rangeStartEST,
            match: eventDateEST === rangeStartEST
          });
          
          // Direct comparison of EST-formatted date strings (YYYY-MM-DD)
          return eventDateEST === rangeStartEST;
        }
        
        // For other date ranges, use the start and end dates
        return eventDate >= dateRange.start && eventDate <= dateRange.end;
      });
      
      // Update the response title to include the date range
      if (isForSpecificDate) {
        responseTitle = `Here's what I found for events on ${rangeType}:`;
      } else {
        responseTitle = `Here's what I found for events during ${rangeType}:`;
      }
    }
    
    // Filter by category if specified in AI analysis
    if (eventQueryAnalysis.category) {
      dateFilteredEvents = dateFilteredEvents.filter((event: Event) => 
        event.category?.toLowerCase() === eventQueryAnalysis.category?.toLowerCase()
      );
      
      // Update the title to reflect the category filter
      const categoryDisplay = eventQueryAnalysis.category.charAt(0).toUpperCase() + eventQueryAnalysis.category.slice(1);
      
      if (dateRangeDescription || rangeType) {
        const timeDescription = dateRangeDescription || rangeType;
        const isSpecificDay = eventQueryAnalysis.isSpecificDateQuery || 
                            (rangeType && rangeType.includes(',') && !rangeType.includes('week'));
                            
        responseTitle = `Here's what I found for ${categoryDisplay} events ${isSpecificDay ? 'on' : 'during'} ${timeDescription}:`;
      } else {
        responseTitle = `Here's what I found for ${categoryDisplay} events:`;
      }
    }
    
    // Filter by location if specified in AI analysis
    if (eventQueryAnalysis.specificLocation) {
      const locationFilteredEvents = dateFilteredEvents.filter((event: Event) => 
        event.location?.toLowerCase().includes(eventQueryAnalysis.specificLocation?.toLowerCase() || '')
      );
      
      // Only use location filter if we found matching events
      if (locationFilteredEvents.length > 0) {
        dateFilteredEvents = locationFilteredEvents;
        
        // Update the response title to include the location
        const locationText = eventQueryAnalysis.specificLocation;
        
        if (responseTitle.includes(':')) {
          // Insert location before the colon
          responseTitle = responseTitle.replace(':', ` at ${locationText}:`);
        } else {
          responseTitle = `Here's what I found for events at ${locationText}:`;
        }
      }
    }
    
    // Filter by badge requirement if specified in AI analysis
    if (eventQueryAnalysis.badgeRequired !== null) {
      dateFilteredEvents = dateFilteredEvents.filter((event: Event) => 
        event.badgeRequired === eventQueryAnalysis.badgeRequired
      );
      
      // Update the title to reflect badge requirement
      const badgeText = eventQueryAnalysis.badgeRequired ? 'badge required' : 'no badge required';
      
      if (eventQueryAnalysis.category) {
        const categoryDisplay = eventQueryAnalysis.category.charAt(0).toUpperCase() + eventQueryAnalysis.category.slice(1);
        responseTitle = `Here's what I found for ${categoryDisplay} events with ${badgeText}:`;
      } else {
        responseTitle = `Here's what I found for events with ${badgeText}:`;
      }
      
      // Add date range descriptor if available
      if (dateRangeDescription || rangeType) {
        const timeDescription = dateRangeDescription || rangeType;
        const isSpecificDay = eventQueryAnalysis.isSpecificDateQuery || 
                            (rangeType && rangeType.includes(',') && !rangeType.includes('week'));
                            
        responseTitle = responseTitle.replace(':', ` ${isSpecificDay ? 'on' : 'during'} ${timeDescription}:`);
      }
    }
    
    // Filter by event type if specified in AI analysis or traditionally extracted
    const eventTypeToUse = eventQueryAnalysis.eventType || specificEventType;
    
    if (eventTypeToUse) {
      const typeFiltered = dateFilteredEvents.filter((event: Event) => 
        event.title?.toLowerCase().includes(eventTypeToUse.toLowerCase()) || 
        event.description?.toLowerCase().includes(eventTypeToUse.toLowerCase())
      );
      
      if (typeFiltered.length > 0) {
        dateFilteredEvents = typeFiltered;
        
        // Update the title to reflect the event type
        if (dateRangeDescription || rangeType) {
          const timeDescription = dateRangeDescription || rangeType;
          const isSpecificDay = eventQueryAnalysis.isSpecificDateQuery || 
                              (rangeType && rangeType.includes(',') && !rangeType.includes('week'));
                              
          responseTitle = `Here's what I found about ${eventTypeToUse} events ${isSpecificDay ? 'on' : 'during'} ${timeDescription}:`;
        } else {
          responseTitle = `Here's what I found about ${eventTypeToUse} events:`;
        }
      }
    }
    
    // Check if we have any events after all filters
    if (dateFilteredEvents.length === 0) {
      // No events found after applying all filters
      const timeContext = dateRangeDescription || rangeType || "the requested time";
      
      let filterDescription = "";
      if (eventQueryAnalysis.category) {
        filterDescription += `${eventQueryAnalysis.category} category`;
      }
      if (eventQueryAnalysis.badgeRequired !== null) {
        filterDescription += filterDescription ? " and " : "";
        filterDescription += eventQueryAnalysis.badgeRequired ? "badge requirement" : "no badge requirement";
      }
      if (eventTypeToUse) {
        filterDescription += filterDescription ? " and " : "";
        filterDescription += `"${eventTypeToUse}" type`;
      }
      
      setSearchResult(`
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 justify-center">
            <span class="text-xl">📅</span>
            <p class="font-medium text-xl">Hello, neighbor!</p>
          </div>
          
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p class="mb-3">I don't see any events matching ${filterDescription ? filterDescription + " for " : ""}${timeContext}. The community calendar will be updated as new activities are added.</p>
            
            <div class="flex justify-center w-full mt-2">
              <a href="/calendar" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                <span>👉</span> View complete calendar
              </a>
            </div>
          </div>
        </div>
      `);
      
      setIsSearching(false);
      return;
    }
    
    // Step 5: Determine which events to display
    if (isNextEventQuery && !dateRange && !eventQueryAnalysis.dateRange) {
      // If asking about "next event" without a date range, just show the very next one
      eventsToShow = [dateFilteredEvents[0]];
      responseTitle = "Here's the next upcoming event:";
    } else {
      // Otherwise show up to 3 upcoming events from the date filtered set
      eventsToShow = dateFilteredEvents.slice(0, 3);
    }
    
    // Generate HTML for each event
    let eventsHTML = '';
    
    eventsToShow.forEach((event: Event) => {
      // Format date
      const eventDate = new Date(event.startDate);
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      
      // Format time
      const formattedTime = eventDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Get category emoji
      const getCategoryEmoji = (category: string | undefined | null): string => {
        const categoryMap: Record<string, string> = {
          'entertainment': '✨',
          'sports': '🏆',
          'community': '🏙️',
          'education': '📚',
          'social': '🎭',
          'celebration': '🎉',
          'meeting': '💼',
          'volunteer': '🤝',
          'health': '❤️',
          'arts': '🎨',
          'outdoors': '🌳',
          'food': '🍽️',
          'music': '🎵',
          'family': '👨‍👩‍👧‍👦',
          'culture': '🌐',
          'technology': '💻',
          'business': '📊',
          'religion': '🙏',
          'political': '🗳️'
        };
        
        const processedCategory = category?.toLowerCase() || '';
        return categoryMap[processedCategory] || '📆';
      };

      const categoryEmoji = getCategoryEmoji(event.category);
      
      // Format event description
      const formatDescription = (description: string | undefined): string => {
        if (!description) return 'No additional details';
        
        // Get first sentence or a reasonable portion of text for display
        let firstSentence = description;
        const sentenceEndMatch = description.match(/[.!?]\s/);
        if (sentenceEndMatch && sentenceEndMatch.index && sentenceEndMatch.index < 150) {
          firstSentence = description.substring(0, sentenceEndMatch.index + 1);
        } else if (description.length > 150) {
          firstSentence = description.substring(0, 147) + '...';
        }
        
        return firstSentence;
      };
      
      const eventDescription = formatDescription(event.description);
      
      eventsHTML += `
        <div class="text-center mb-6">
          <h3 class="text-lg font-semibold text-navy mb-2">${event.title} ${categoryEmoji}</h3>
          
          <div class="flex flex-col items-center space-y-2 text-gray-700">
            <div class="flex items-center">
              <span class="mr-2">📅</span> 
              <span class="font-medium">Date:</span>
              <span class="ml-2">${formattedDate}</span>
            </div>
            
            <div class="flex items-center">
              <span class="mr-2">⏰</span>
              <span class="font-medium">Time:</span>
              <span class="ml-2">${formattedTime}</span>
            </div>
            
            <div class="flex items-center">
              <span class="mr-2">📍</span>
              <span class="font-medium">Location:</span>
              <span class="ml-2">${event.location || 'Barefoot Bay'}</span>
            </div>
            
            <div class="flex items-center">
              <div class="flex-shrink-0 mr-2 mt-0">📝</div>
              <div class="flex flex-col">
                <span class="font-medium">Details:</span>
                <span class="text-left">${eventDescription}</span>
              </div>
            </div>
            
            <div class="flex justify-center mt-3 mb-2">
              <a href="/event/${event.id}" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                <span>👉</span> View event details
              </a>
            </div>
          </div>
          
          ${eventsToShow.indexOf(event) < eventsToShow.length - 1 ? '<hr class="my-4 border-gray-200" />' : ''}
        </div>
      `;
    });
    
    setSearchResult(`
      <div class="flex flex-col gap-6">
        <div class="flex items-center gap-2 justify-center">
          <span class="text-xl">📅</span>
          <p class="font-medium text-xl">Hi there, friend! 👋</p>
        </div>
        
        <p class="text-gray-700 text-center">${responseTitle}</p>
        
        <div class="bg-blue-50/60 p-6 rounded-lg border border-blue-100">
          ${eventsHTML}
          
          <div class="flex justify-center w-full mt-4">
            <a href="/calendar" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
              <span>👉</span> View detailed calendar
            </a>
          </div>
        </div>
        
        <p class="text-gray-600 flex items-center gap-2 justify-center">
          <span>🌞</span> Happy to help with more questions!
        </p>
      </div>
    `);
    
    setIsSearching(false);
  };
  
  /**
   * Helper function to get month name
   */
  const getMonthName = (monthIndex: number): string => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }
  
  /**
   * Helper function to get day of week name
   */
  const getDayName = (dayIndex: number): string => {
    const days = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday'
    ];
    return days[dayIndex];
  };
  
  /**
   * Helper function to get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
   */
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  /**
   * Extract date range information from a search query
   * @param query - The search query to analyze
   * @returns Object with date range and descriptive text
   */
  const extractDateRange = (query: string): { dateRange: { start: Date, end: Date } | null, rangeType: string } => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();
    const currentDay = today.getDay(); // 0 is Sunday, 6 is Saturday
    
    // Default response with no date range
    const defaultResponse = {
      dateRange: null,
      rangeType: "upcoming events"
    };
    
    // Month patterns
    const monthPatterns = [
      { pattern: /\b(january|jan)\b/i, month: 0 },
      { pattern: /\b(february|feb)\b/i, month: 1 },
      { pattern: /\b(march|mar)\b/i, month: 2 },
      { pattern: /\b(april|apr)\b/i, month: 3 },
      { pattern: /\b(may)\b/i, month: 4 },
      { pattern: /\b(june|jun)\b/i, month: 5 },
      { pattern: /\b(july|jul)\b/i, month: 6 },
      { pattern: /\b(august|aug)\b/i, month: 7 },
      { pattern: /\b(september|sep|sept)\b/i, month: 8 },
      { pattern: /\b(october|oct)\b/i, month: 9 },
      { pattern: /\b(november|nov)\b/i, month: 10 },
      { pattern: /\b(december|dec)\b/i, month: 11 }
    ];
    
    // Day of week patterns
    const dayPatterns = [
      { pattern: /\b(sunday|sun)\b/i, day: 0 },
      { pattern: /\b(monday|mon)\b/i, day: 1 },
      { pattern: /\b(tuesday|tue|tues)\b/i, day: 2 },
      { pattern: /\b(wednesday|wed)\b/i, day: 3 },
      { pattern: /\b(thursday|thu|thurs|thur)\b/i, day: 4 },
      { pattern: /\b(friday|fri)\b/i, day: 5 },
      { pattern: /\b(saturday|sat)\b/i, day: 6 }
    ];
    
    // Check for specific date patterns (e.g., "April 11th", "January 1st", etc.)
    const specificDatePattern = /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(st|nd|rd|th)?\b/i;
    const dateMatch = query.match(specificDatePattern);
    
    if (dateMatch) {
      const monthName = dateMatch[1].toLowerCase();
      const dayNumber = parseInt(dateMatch[2]);
      
      // Find the month number
      let monthNumber = -1;
      for (const { pattern, month } of monthPatterns) {
        if (pattern.test(monthName)) {
          monthNumber = month;
          break;
        }
      }
      
      if (monthNumber !== -1 && dayNumber >= 1 && dayNumber <= 31) {
        // Use next year if the month+day has already passed in current year
        const today = new Date();
        const targetDate = new Date(currentYear, monthNumber, dayNumber);
        const year = (targetDate < today && (monthNumber < currentMonth || 
                     (monthNumber === currentMonth && dayNumber < currentDate))) 
                     ? currentYear + 1 : currentYear;
        
        // Create a date range for just this specific day (midnight to 11:59:59 PM)
        const start = new Date(year, monthNumber, dayNumber, 0, 0, 0);
        const end = new Date(year, monthNumber, dayNumber, 23, 59, 59);
        
        return {
          dateRange: { start, end },
          rangeType: `${getMonthName(monthNumber)} ${dayNumber}${getOrdinalSuffix(dayNumber)}, ${year}`
        };
      }
    }
    
    // Check for month-specific queries
    for (const { pattern, month } of monthPatterns) {
      if (pattern.test(query)) {
        // Use next year if the month has already passed in current year
        const year = month < currentMonth ? currentYear + 1 : currentYear;
        
        // Check for specific time periods within that month
        if (/\b(first|1st)\s+(week|days)\b/i.test(query)) {
          // First week of the month (days 1-7)
          const start = new Date(year, month, 1);
          const end = new Date(year, month, 7, 23, 59, 59);
          return {
            dateRange: { start, end },
            rangeType: `the first week of ${getMonthName(month)}`
          };
        } else if (/\b(second|2nd)\s+(week|days)\b/i.test(query)) {
          // Second week of the month (days 8-14)
          const start = new Date(year, month, 8);
          const end = new Date(year, month, 14, 23, 59, 59);
          return {
            dateRange: { start, end },
            rangeType: `the second week of ${getMonthName(month)}`
          };
        } else if (/\b(third|3rd)\s+(week|days)\b/i.test(query)) {
          // Third week of the month (days 15-21)
          const start = new Date(year, month, 15);
          const end = new Date(year, month, 21, 23, 59, 59);
          return {
            dateRange: { start, end },
            rangeType: `the third week of ${getMonthName(month)}`
          };
        } else if (/\b(fourth|4th|last)\s+(week|days)\b/i.test(query)) {
          // Fourth/last week of the month (day 22 to end)
          const start = new Date(year, month, 22);
          const end = new Date(year, month + 1, 0, 23, 59, 59); // Last day of month
          return {
            dateRange: { start, end },
            rangeType: `the last week of ${getMonthName(month)}`
          };
        } else {
          // The entire month
          const start = new Date(year, month, 1);
          const end = new Date(year, month + 1, 0, 23, 59, 59); // Last day of month
          return {
            dateRange: { start, end },
            rangeType: `${getMonthName(month)}`
          };
        }
      }
    }
    
    // Check for this week/next week patterns
    if (/\b(this)\s+(week)\b/i.test(query)) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
      
      // Start date is last Sunday (or today if today is Sunday)
      const start = new Date();
      start.setDate(today.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      
      // End date is next Saturday
      const end = new Date();
      end.setDate(today.getDate() + (6 - dayOfWeek));
      end.setHours(23, 59, 59, 999);
      
      return {
        dateRange: { start, end },
        rangeType: "this week"
      };
    } else if (/\b(next|upcoming|coming)\s+(week)\b/i.test(query)) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
      
      // Start date is next Sunday
      const start = new Date();
      start.setDate(today.getDate() + (7 - dayOfWeek));
      start.setHours(0, 0, 0, 0);
      
      // End date is following Saturday
      const end = new Date();
      end.setDate(today.getDate() + (13 - dayOfWeek));
      end.setHours(23, 59, 59, 999);
      
      return {
        dateRange: { start, end },
        rangeType: "next week"
      };
    }
    
    // Check for "today", "yesterday", or "tomorrow" patterns
    if (/\b(today)\b/i.test(query)) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      
      return {
        dateRange: { start, end },
        rangeType: "today"
      };
    } else if (/\b(yesterday)\b/i.test(query)) {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date();
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      
      return {
        dateRange: { start, end },
        rangeType: "yesterday"
      };
    } else if (/\b(tomorrow)\b/i.test(query)) {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date();
      end.setDate(end.getDate() + 1);
      end.setHours(23, 59, 59, 999);
      
      return {
        dateRange: { start, end },
        rangeType: "tomorrow"
      };
    }
    
    // Check for day of week patterns (e.g., "this Friday", "next Monday", "events on Friday")
    for (const { pattern, day } of dayPatterns) {
      if (pattern.test(query)) {
        const today = new Date();
        const currentDayOfWeek = today.getDay();
        let targetDay = day;
        let daysToAdd = 0;
        let dayDescription = '';
        
        // Check for qualifiers like "this" or "next"
        const isThisWeek = /\b(this)\s+/i.test(query);
        const isNextWeek = /\b(next|coming|upcoming)\s+/i.test(query);
        
        if (isNextWeek) {
          // "Next [day]" means the day in the following week
          daysToAdd = 7 + ((targetDay + 7 - currentDayOfWeek) % 7);
          dayDescription = `next ${getDayName(targetDay)}`;
        } else if (isThisWeek) {
          // "This [day]" means the specified day in the current week
          daysToAdd = (targetDay + 7 - currentDayOfWeek) % 7;
          dayDescription = `this ${getDayName(targetDay)}`;
        } else {
          // If no qualifier, assume the next occurrence of that day
          daysToAdd = (targetDay + 7 - currentDayOfWeek) % 7;
          // If it's the same day and we're looking ahead, we mean today
          if (daysToAdd === 0) {
            dayDescription = `today (${getDayName(targetDay)})`;
          } else {
            dayDescription = `${getDayName(targetDay)}`;
          }
        }
        
        const start = new Date();
        start.setDate(today.getDate() + daysToAdd);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date();
        end.setDate(today.getDate() + daysToAdd);
        end.setHours(23, 59, 59, 999);
        
        return {
          dateRange: { start, end },
          rangeType: dayDescription
        };
      }
    }
    
    // Check for "weekend" patterns
    if (/\b(this weekend|weekend)\b/i.test(query)) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
      
      // Calculate days until Saturday (or 0 if today is Saturday)
      const daysUntilSaturday = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
      // If today is Sunday, weekend is today; otherwise, it's next Saturday
      const daysUntilWeekend = dayOfWeek === 0 ? 0 : daysUntilSaturday;
      
      const start = new Date();
      start.setDate(today.getDate() + daysUntilWeekend);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date();
      end.setDate(today.getDate() + daysUntilWeekend + 1); // Saturday and Sunday
      end.setHours(23, 59, 59, 999);
      
      return {
        dateRange: { start, end },
        rangeType: `this weekend`
      };
    } else if (/\b(next weekend|coming weekend)\b/i.test(query)) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
      
      // Calculate days until next Saturday (add 7 days to get to next week)
      const daysUntilNextSaturday = dayOfWeek === 6 ? 7 : 6 - dayOfWeek + 7;
      
      const start = new Date();
      start.setDate(today.getDate() + daysUntilNextSaturday);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date();
      end.setDate(today.getDate() + daysUntilNextSaturday + 1); // Saturday and Sunday
      end.setHours(23, 59, 59, 999);
      
      return {
        dateRange: { start, end },
        rangeType: `next weekend`
      };
    }
    
    return defaultResponse;
  };

  /**
   * Extract specific event type from a query
   */
  const getSpecificEventType = (query: string): string | null => {
    // Keywords for common event types that might appear in queries
    const eventTypePatterns = [
      { pattern: /\b(taco\s*tuesday|taco\s*night)\b/i, type: 'Taco Tuesday' },
      { pattern: /\b(karaoke)\b/i, type: 'Karaoke' },
      { pattern: /\b(bingo)\b/i, type: 'Bingo' },
      { pattern: /\b(yoga)\b/i, type: 'Yoga' },
      { pattern: /\b(dance|dancing)\b/i, type: 'Dance' },
      { pattern: /\b(art|painting|craft)\b/i, type: 'Art' },
      { pattern: /\b(music|concert|band|performance)\b/i, type: 'Music' },
      { pattern: /\b(movie|film|cinema)\b/i, type: 'Movie' },
      { pattern: /\b(golf|tennis|pickleball|sport|sports)\b/i, type: 'Sports' },
      { pattern: /\b(pool|swimming)\b/i, type: 'Pool' },
      { pattern: /\b(book|reading|library)\b/i, type: 'Book' },
      { pattern: /\b(game|cards|board\s*game)\b/i, type: 'Game' },
      { pattern: /\b(health|fitness|exercise|workout)\b/i, type: 'Health' },
      { pattern: /\b(food|dinner|lunch|breakfast|brunch|meal)\b/i, type: 'Food' },
      { pattern: /\b(market|fair|bazaar)\b/i, type: 'Market' },
      { pattern: /\b(meeting|discussion|talk|lecture)\b/i, type: 'Meeting' },
      { pattern: /\b(prayer|worship|church|religious|spiritual|sermon|bible|devotion|fellowship)\b/i, type: 'Prayer' },
      { pattern: /\b(national\s*day\s*of\s*prayer)\b/i, type: 'National Day of Prayer' }
    ];
    
    for (const eventType of eventTypePatterns) {
      if (eventType.pattern.test(query.toLowerCase())) {
        return eventType.type;
      }
    }
    
    return null;
  };

  /**
   * Get weather emoji based on condition
   */
  const getWeatherEmoji = (condition: string) => {
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('clear') || conditionLower.includes('sun')) return '☀️';
    if (conditionLower.includes('cloud') && conditionLower.includes('scatter')) return '🌤️';
    if (conditionLower.includes('cloud') && conditionLower.includes('broken')) return '⛅';
    if (conditionLower.includes('cloud') && conditionLower.includes('few')) return '🌤️';
    if (conditionLower.includes('cloud')) return '☁️';
    if (conditionLower.includes('rain') && conditionLower.includes('light')) return '🌦️';
    if (conditionLower.includes('rain')) return '🌧️';
    if (conditionLower.includes('storm') || conditionLower.includes('thunder')) return '⛈️';
    if (conditionLower.includes('snow')) return '❄️';
    if (conditionLower.includes('fog') || conditionLower.includes('mist')) return '🌫️';
    return '🌡️';
  };

  /**
   * Process and handle 5-day weather forecast queries
   */
  const handleFiveDayForecastQuery = async () => {
    // Set default forecast data in case API fails
    let forecast = [
      { day: "WED, APR 9", temp: "72", low: "60", condition: "Scattered Clouds", emoji: "🌤️" },
      { day: "THU, APR 10", temp: "75", low: "67", condition: "Light Rain", emoji: "🌦️" },
      { day: "FRI, APR 11", temp: "81", low: "65", condition: "Clear Sky", emoji: "☀️" },
      { day: "SAT, APR 12", temp: "75", low: "63", condition: "Clear Sky", emoji: "☀️" },
      { day: "SUN, APR 13", temp: "73", low: "61", condition: "Partly Cloudy", emoji: "⛅" }
    ];
    
    try {
      // Coordinates for Barefoot Bay, Florida
      const lat = 27.9589;
      const lon = -80.5603;
      
      // Try to get forecast using our proxy endpoint
      const forecastUrl = `/api/weather/forecast?lat=${lat}&lon=${lon}&units=imperial`;
      console.log("Fetching forecast data through server proxy");
      const forecastResponse = await fetch(forecastUrl);
      
      if (forecastResponse.ok) {
        const forecastData = await forecastResponse.json();
        console.log("Forecast data received:", forecastData);
        
        // Get one forecast per day (every 8 items is one day, since it's every 3 hours)
        const dailyForecasts = forecastData.list.filter((_: any, index: number) => index % 8 === 0).slice(0, 5);
        
        // Format the forecast data
        forecast = dailyForecasts.map((day: any, index: number) => {
          const date = new Date(day.dt * 1000);
          const formattedDay = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          }).toUpperCase();
          
          return {
            day: formattedDay,
            temp: Math.round(day.main.temp).toString(),
            low: Math.round(day.main.temp_min).toString(),
            condition: day.weather[0].description,
            emoji: getWeatherEmoji(day.weather[0].main || "")
          };
        });
      }
    } catch (error) {
      console.error("Error fetching forecast:", error);
      // We'll use the default forecast data
    }
    
    // Build forecast cards HTML
    let forecastCardsHTML = '';
    forecast.forEach(day => {
      forecastCardsHTML += `
        <div class="flex flex-col items-center p-4 bg-white/60 rounded-lg border border-blue-100">
          <div class="font-medium mb-2">${day.day}</div>
          <div class="text-4xl mb-2">${day.emoji}</div>
          <div class="text-xs text-gray-600 mb-3">${day.condition}</div>
          <div class="font-bold">${day.temp}°F ${day.low}°F</div>
        </div>
      `;
    });
    
    setSearchResult(`
      <div class="flex flex-col gap-6">
        <div class="flex items-center gap-2">
          <span class="text-xl">🌤️</span>
          <p class="font-medium text-2xl">5-DAY WEATHER FORECAST</p>
        </div>
        
        <p class="text-gray-700">Here's the 5-day weather forecast for Barefoot Bay:</p>
        
        <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
          ${forecastCardsHTML}
        </div>
        
        <div class="flex justify-center w-full mt-2">
          <a href="/weather" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
            <span>👉</span> View detailed weather information
          </a>
        </div>
        
        <p class="text-gray-600 flex items-center gap-2">
          <span>🌞</span> Happy to help with more questions!
        </p>
      </div>
    `);
    
    setIsSearching(false);
  };

  /**
   * Process and handle weather related queries
   */
  const handleWeatherQuery = async () => {
    // Fetch current weather data
    let temperature = "69";
    let condition = "Clouds";
    let description = "scattered clouds";
    let humidity = "69";
    let windSpeed = "19";
    let highTemp = "72";
    let lowTemp = "60";

    try {
      // Coordinates for Barefoot Bay, Florida
      const lat = 27.9589;
      const lon = -80.5603;
      
      console.log("Fetching weather data through server proxy");
      const url = `/api/weather?lat=${lat}&lon=${lon}&units=imperial`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Weather data received:", data);
        
        temperature = Math.round(data.main.temp).toString();
        condition = data.weather[0].main;
        description = data.weather[0].description;
        humidity = data.main.humidity.toString();
        windSpeed = Math.round(data.wind.speed).toString();
        highTemp = Math.round(data.main.temp_max).toString();
        lowTemp = Math.round(data.main.temp_min).toString();
      }
    } catch (error) {
      console.error("Error fetching weather data:", error);
      // Default values are already set
    }

    // Get current date
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      weekday: 'long'
    });

    const weatherEmoji = getWeatherEmoji(condition);

    // Check if query might be asking for 5-day forecast
    if (query.toLowerCase().includes('forecast') || 
        query.toLowerCase().includes('week') || 
        query.toLowerCase().includes('days') || 
        query.toLowerCase().includes('5-day') || 
        query.toLowerCase().includes('5 day')) {
      return await handleFiveDayForecastQuery();
    }

    setSearchResult(`
      <div class="flex flex-col gap-6">
        <div class="flex items-center gap-2">
          <span class="text-xl">${weatherEmoji}</span>
          <p class="font-medium text-2xl">WEATHER FORECAST</p>
        </div>
        
        <p class="text-gray-700">Here's the weather forecast for ${formattedDate}:</p>
        
        <div class="bg-blue-50/70 p-6 rounded-lg border border-blue-100 shadow-sm">
          <div class="flex flex-col items-center space-y-4">
            <div class="flex items-center">
              <span class="text-red-500 mr-2">🌡️</span>
              <span class="font-medium">Temperature:</span>
              <span class="ml-2">${temperature}°F (High: ${highTemp}°F / Low: ${lowTemp}°F)</span>
            </div>
            
            <div class="flex items-center">
              <span class="text-pink-200 mr-2">☁️</span>
              <span class="font-medium">Conditions:</span>
              <span class="ml-2">${description}</span>
            </div>
            
            <div class="flex items-center">
              <span class="text-blue-400 mr-2">💧</span>
              <span class="font-medium">Humidity:</span>
              <span class="ml-2">${humidity}%</span>
            </div>
            
            <div class="flex items-center">
              <span class="text-gray-400 mr-2">🌬️</span>
              <span class="font-medium">Wind:</span>
              <span class="ml-2">${windSpeed} mph</span>
            </div>
            
            <div class="flex justify-center w-full mt-2">
              <a href="/weather" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium">
                <span>👉</span> View detailed weather information
              </a>
            </div>
          </div>
        </div>
        
        <p class="text-gray-600 flex items-center gap-2">
          <span>🌞</span> Happy to help with more questions!
        </p>
      </div>
    `);
    
    setIsSearching(false);
  };

  /**
   * Handle generic queries using AI assistant
   */
  const handleGenericQuery = async () => {
    try {
      // Prepare AI response with community context
      const eventsContext = events?.slice(0, 5) || [];
      const listingsContext = listings?.slice(0, 5) || [];
      const discussionsContext = forumDiscussions?.slice(0, 10) || [];
      
      // Prepare community info context from other content types
      const communityInfoContext = communityPages || [];
      
      // Flag any special query types
      const isRentalQuery = /\b(rent|rental|lease|apartment|tenant)\b/i.test(query);
      const isOwnershipQuery = /\b(tattler|rob allan|allan family|who owns)\b/i.test(query);
      
      // Check if query might be asking about forum content
      const forumContentPatterns = [
        /\bballot initiative\b/i,
        /\bcommunity governance\b/i,
        /\broad maintenance\b/i,
        /\bcommunity decision\b/i,
        /\bvoting\b/i,
        /\bpassing\b/i,
        /\bpassed\b/i,
        /\bdecision\b/i,
        /\bapproved\b/i,
        /\brule\b/i,
        /\bregulation\b/i,
        /\bpolicy\b/i,
        /\bboard\b/i,
        /\bcommittee\b/i,
        /\belection\b/i
      ];
      const mightBeForumQuery = forumContentPatterns.some(pattern => pattern.test(query));
      
      // Check for time-based qualifiers
      const hasTodayKeyword = /\b(today)\b/i.test(query);
      const hasTomorrowKeyword = /\b(tomorrow)\b/i.test(query);
      const hasThisWeekKeyword = /\b(this week|upcoming week|this coming week)\b/i.test(query);
      
      // Check for personal messages addressed to the assistant
      const personalMessagePatterns = [
        /\b(thank you|thanks|appreciate|helpful|good job|well done)\b/i,
        /\b(who are you|what are you|tell me about yourself|your name|how do you work)\b/i,
        /\b(you're smart|you are smart|you're intelligent|you are intelligent|you're clever|you are clever|you're wise|you are wise)\b/i,
        /\b(you're helpful|you are helpful|you're useful|you are useful|you're efficient|you are efficient)\b/i,
        /\b(you're cool|you are cool|you're neat|you are neat|you're interesting|you are interesting)\b/i
      ];
      
      const isPersonalMessage = personalMessagePatterns.some(pattern => 
        pattern.test(query.toLowerCase())
      );
      
      // Prepare the AI query
      const promptText = `You are the friendly Barefoot Bay community assistant. Follow this conversation structure exactly:
      
QUERY ANALYSIS (DO NOT DISPLAY THIS TO USER):
- User query: "${query.trim()}"
- Rental query detected: ${isRentalQuery ? 'YES - THIS IS A RENTAL QUERY!' : 'No'}
- Property search terms: ${/\b(house|property|home|listing|sale|buy|bedroom|bathroom|sqft|square feet|rent|apartment|condo|garage|pool|backyard|furniture|tools|electronics|garage sale|yard sale|open house)\b/i.test(query) ? 'YES - THIS IS A PROPERTY OR LISTING QUERY!' : 'No'}
- Event search terms: ${/\b(event|activity|happening|when|where|club|meeting|game|party|social|festival|class|workshop|entertainment|sport|league|tournament|competition|show)\b/i.test(query) ? 'YES' : 'No'}
- Sport/Activity terms: ${/\b(bowling|yahtzee|golf|tennis|pickleball|swimming|bingo|cards|board game|craft|dance|fitness|yoga)\b/i.test(query) ? 'YES - ACTIVITY SPECIFIC QUERY' : 'No'}
- Time-specific query: ${hasThisWeekKeyword ? 'THIS WEEK' : hasTodayKeyword ? 'TODAY' : hasTomorrowKeyword ? 'TOMORROW' : 'No'}
- Ownership query detected: ${isOwnershipQuery ? 'YES - THIS IS A QUERY ABOUT TATTLER MEDIA OR OWNERS!' : 'No'}
- Personal message detected: ${isPersonalMessage ? 'YES - THIS IS A PERSONAL MESSAGE TO THE BOT!' : 'No'}

Start with a warm, friendly greeting with an emoji:
"Hello, neighbor! 👋" or "Hi there, friend! 👋" or "Greetings from Barefoot Bay! 🏝️"

When responding to search queries, acknowledge what the user is asking about without directly quoting them. For example, if they ask about golf events, you might start with "I found some golf activities coming up!" or if they ask about home sales, you might say "Looking for homes in our community? Here's what I found!"

Review content from these areas:

Upcoming events: ${JSON.stringify(eventsContext)}, sorted chronologically (soonest first).

For-sale listings: ${JSON.stringify(listingsContext)}, sorted by most recent.

Forum discussions: ${JSON.stringify(discussionsContext)}, sorted by most recent activity.

Community information (local organizations, clubs, government news, etc.): ${JSON.stringify(communityInfoContext)}.

IMPORTANT: If the user is specifically looking for events (terms like "events", "activities", "happening", "calendar", "schedule", etc.) and there are no events available, respond with: "I don't see any upcoming events at the moment. The community calendar will be updated soon with new activities. Check back later or try searching for something else! 📅"

VERY IMPORTANT - SPECIAL INFORMATION ABOUT BAREFOOT BAY OWNERSHIP:
If the query is about Rob Allan, Tattler Media, or the Allan family (ownership query detected), include the following information in your response:

"The Tattler is owned by the Allan family who have lived in Barefoot Bay since 2004. Rob Allan, together with his family, purchased The Tattler after selling their Barefoot Bay home in 2022. The Allan family has strong roots in the community - Rob's mother Joan E. McDonald moved to Barefoot Bay in the late 1980s, and over time multiple family members settled in the area. Their story represents several generations of Barefoot Bay residents. They continue to be actively involved in publishing the Tattler monthly and supporting the community."

Be helpful and friendly in all replies. End with an offer to help with anything else or suggest a related topic they might be interested in.

Keep your answers concise, aiming for 2-3 short paragraphs max. If the query seems like a simple greeting or small talk, respond with just a friendly greeting back and brief offer to help.
`;

      const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [
                { text: promptText }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const result = await response.json();
      const aiResponse = result.candidates[0]?.content?.parts[0]?.text;
      
      if (aiResponse) {
        setSearchResult(aiResponse);
      } else {
        // Fallback response if AI fails
        setSearchResult(`
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xl">👋</span>
              <p class="font-medium text-xl">Hello, neighbor!</p>
            </div>
            
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p class="mb-3">I'm not sure I understood your question fully. Here are some things you can ask me about:</p>
              
              <ul class="list-disc pl-5 mb-3 space-y-1.5">
                <li>Upcoming events in Barefoot Bay</li>
                <li>Properties for sale in our community</li>
                <li>Local weather forecast</li>
                <li>Rocket launches visible from Barefoot Bay</li>
              </ul>
              
              <p class="text-blue-700">If you're looking for something specific, try rephrasing your question with more details!</p>
            </div>
          </div>
        `);
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      setSearchResult(`
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">👋</span>
            <p class="font-medium text-xl">Hello, neighbor!</p>
          </div>
          
          <div class="bg-orange-50 p-4 rounded-lg border border-orange-100">
            <p class="mb-3">I had some trouble processing your request. Could you try asking in a different way?</p>
            
            <p class="text-orange-700">You can ask about events, properties, local weather, or other community information!</p>
          </div>
        </div>
      `);
    }
    
    setIsSearching(false);
  };

  /**
   * Main search handler function - Now uses the unified /api/search endpoint
   */
  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchResult(null);

    console.log(`🔍 [SEARCH DEBUG] Starting search for: "${query.trim()}"`);

    try {
      // Use the working unified search API endpoint
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      
      if (!response.ok) {
        throw new Error(`Search API failed: ${response.status}`);
      }
      
      const searchData = await response.json();
      console.log(`🔍 [SEARCH DEBUG] Search API returned:`, searchData);
      
      if (!searchData.results || searchData.results.length === 0) {
        // No results found
        setSearchResult(`
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <span class="text-xl mt-1">🔍</span>
              <div>
                <h2 class="text-xl font-bold text-navy">No Results Found</h2>
                <p class="text-gray-600">I couldn't find anything matching "${query.trim()}".</p>
              </div>
            </div>
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p class="mb-3">Try searching for:</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <a href="/calendar" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                  📅 Events
                </a>
                <a href="/forum" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                  💬 Forum
                </a>
                <a href="/vendors" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                  🏢 Vendors
                </a>
                <a href="/for-sale" class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm">
                  🏠 For Sale
                </a>
              </div>
            </div>
          </div>
        `);
        setIsSearching(false);
        return;
      }

      // Generate HTML for search results
      const resultsHTML = generateSearchResultsHTML(searchData.results, query.trim());
      setSearchResult(resultsHTML);
      setIsSearching(false);

    } catch (error) {
      console.error('🔍 [SEARCH ERROR] Search failed:', error);
      
      // Fallback to old AI-based search if API fails
      console.log('🔍 [SEARCH DEBUG] Falling back to AI-based search...');
      await handleLegacySearch();
    }
  };

  /**
   * Generate HTML for search results from the unified API
   */
  const generateSearchResultsHTML = (results: any[], query: string) => {
    console.log(`🔍 [SEARCH DEBUG] Generating HTML for ${results.length} results`);
    
    let html = `
      <div class="space-y-4">
        <div class="flex items-start gap-3">
          <span class="text-xl mt-1">🔍</span>
          <div>
            <h2 class="text-xl font-bold text-navy">Search Results for "${query}"</h2>
            <p class="text-gray-600">Found ${results.length} result${results.length === 1 ? '' : 's'}</p>
          </div>
        </div>
    `;

    results.forEach((result, index) => {
      const typeIcon = getTypeIcon(result.type);
      const typeLabel = getTypeLabel(result.type);
      
      html += `
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-4 shadow-lg">
          <div class="flex items-start justify-between mb-4">
            <h3 class="text-xl font-bold text-blue-900 leading-tight">
              <a href="${result.url}" class="hover:text-blue-700 hover:underline transition-colors">
                ${result.title}
              </a>
            </h3>
            <span class="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 border">
              ${typeIcon} ${typeLabel}
            </span>
          </div>
          
          <div class="mb-4">
            <p class="text-gray-700 leading-relaxed">${result.excerpt}</p>
          </div>
          
          <div class="flex gap-3 mt-4">
            <a href="${result.url}" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
              View Details
            </a>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  };

  /**
   * Get icon for result type
   */
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vendor': return '🏢';
      case 'event': return '📅';
      case 'forum': return '💬';
      case 'real-estate': return '🏠';
      case 'community-page': return '🏡';
      case 'weather': return '🌤️';
      case 'rocket-launch': return '🚀';
      default: return '📄';
    }
  };

  /**
   * Get label for result type
   */
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'vendor': return 'Vendor';
      case 'event': return 'Event';
      case 'forum': return 'Forum';
      case 'real-estate': return 'Real Estate';
      case 'community-page': return 'Community';
      case 'weather': return 'Weather';
      case 'rocket-launch': return 'Rocket Launch';
      default: return 'Content';
    }
  };

  /**
   * Legacy search handler as fallback (the original AI-based approach)
   */
  const handleLegacySearch = async () => {
    // First, use Gemini AI to analyze the query intent and handle misspellings
    try {
      // Create a specialized intent analysis prompt for Gemini
      const intentAnalysisPrompt = `
Analyze this search query for its core intent. Focus on identifying what the user is looking for, including if it contains:
1. Misspellings or typos (correct them)
2. The primary topic/subject (one of: rocket_launch, weather, event, real_estate, community, forum, vendor, service, classified)
3. Specific details or constraints (time, location, price, etc.)
4. Check if the query appears to be a TITLE of content (event, listing, forum post, vendor, etc.) or part of a title

IMPORTANT: If the query appears to be a full or partial TITLE of content rather than a question or general search,
prioritize detecting this and set titleMatchIntent to true. This helps when users search for exact event names,
property listings, forum topics, or vendor names by their titles.

For event and calendar queries, pay special attention to:
- Event category: entertainment, government, social
- Badge requirements: Does the user want events that require or don't require a badge?
- Date specificity: Is the user looking for events on a specific date/time range?
- Location mentions
- Special event types (business events, community meetings, etc.)

For forum content, pay special attention to:
- Forum category mentions
- Topic keywords
- Author/user mentions
- Recent or popular post indicators

For real estate and classified listings, pay special attention to:
- Listing type: FSBO, Agent, Rent, OpenHouse, Wanted, Classified, GarageSale, Yard Sale
- Property attributes: bedrooms, bathrooms, square footage, year built
- Price range information
- Location specifics
- Amenities or features
- Furniture or home goods: table, sofa, chair, dining set, etc.
- Electronics: TV, computer, smartphone, tablet, etc.
- Tools and equipment: lawn mower, power tools, etc.
- Household items: dishware, silverware, appliances, etc.
- Category of items: If query mentions specific category words like "furniture", "electronics", "tools", etc.

For vendor content, pay special attention to:
- Vendor category: Home Services, Health & Wellness, Landscaping, Food & Dining, Professional Services, Retail, Automotive, Technology
- Service types
- Location mentions
- Business details

For community pages, pay special attention to:
- Community area: Government, Transportation, Religion, Amenities (pools, golf, recreation)
- Specific information types: history, demographics, resources

Query: "${query.trim()}"

Respond in this JSON format only:
{
  "correctedQuery": "corrected version if misspelled",
  "primaryIntent": "the main category/topic",
  "confidence": 0-100,
  "possibleIntents": ["list", "of", "possible", "intents"],
  "detectedKeywords": ["key", "terms", "found"],
  "containsRocketLaunchIntent": true/false,
  "containsWeatherIntent": true/false,
  "containsEventIntent": true/false,
  "containsForumIntent": true/false,
  "containsRealEstateIntent": true/false,
  "containsVendorIntent": true/false,
  "containsCommunityIntent": true/false,
  "isTitleMatchIntent": true/false,
  "eventDetails": {
    "category": "entertainment, government, social, or null if not specified",
    "badgeRequired": true/false/null,
    "specificLocation": "extracted location or null",
    "isSpecificDateQuery": true/false
  },
  "forumDetails": {
    "category": "extracted forum category or null",
    "topicKeywords": ["list", "of", "keywords"],
    "isAuthorQuery": true/false,
    "authorName": "author name if present or null"
  },
  "vendorDetails": {
    "category": "extracted vendor category or null",
    "serviceType": "specific service or null",
    "location": "location if mentioned or null"
  },
  "realEstateDetails": {
    "listingType": "FSBO, Agent, Rent, OpenHouse, Wanted, Classified, GarageSale, or null",
    "minBedrooms": number or null,
    "minBathrooms": number or null,
    "priceRange": {
      "min": number or null,
      "max": number or null
    }
  },
  "communityDetails": {
    "section": "extracted section or null",
    "informationType": "specific information type or null"
  },
  "isTimeSpecific": true/false
}
`;

      // Call Gemini API to analyze intent
      const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [
                { text: intentAnalysisPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1, // Lower temperature for more deterministic/precise responses
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        console.error('Error from Gemini API proxy:', response.status, response.statusText);
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const result = await response.json();
      const intentAnalysisText = result.candidates[0]?.content?.parts[0]?.text;
      
      if (!intentAnalysisText) {
        throw new Error("No intent analysis response generated");
      }
      
      // Extract the JSON from the response
      // The response might have markdown formatting, so we need to clean it
      const jsonRegex = /{[\s\S]*}/;
      const jsonMatch = intentAnalysisText.match(jsonRegex);
      let intentData;
      
      if (jsonMatch) {
        try {
          intentData = JSON.parse(jsonMatch[0]);
          console.log("Intent analysis:", intentData);
        } catch (e) {
          console.error("Failed to parse intent analysis JSON", e);
          // Continue with fallback approach
        }
      }
      
      // If we have valid intent data and high confidence, use it to determine query type
      if (intentData && intentData.confidence >= 70) {
        // Use AI-determined intent for routing
        const isRocketQuery = intentData.containsRocketLaunchIntent || 
                             intentData.primaryIntent === "rocket_launch" ||
                             (intentData.possibleIntents && 
                              intentData.possibleIntents.includes("rocket_launch"));
                              
        const isWeatherQuery = intentData.containsWeatherIntent || 
                              intentData.primaryIntent === "weather" ||
                              (intentData.possibleIntents && 
                               intentData.possibleIntents.includes("weather"));
                               
        const isEventQuery = intentData.containsEventIntent ||
                            intentData.primaryIntent === "event" ||
                            (intentData.possibleIntents && 
                             (intentData.possibleIntents.includes("event") || 
                              intentData.possibleIntents.includes("calendar") ||
                              intentData.possibleIntents.includes("concert") ||
                              intentData.possibleIntents.includes("festival") ||
                              intentData.possibleIntents.includes("show")));
        
        // Forum content intent detection
        const isForumQuery = intentData.containsForumIntent ||
                           intentData.primaryIntent === "forum" ||
                           (intentData.possibleIntents && 
                            (intentData.possibleIntents.includes("forum") ||
                             intentData.possibleIntents.includes("discussion") ||
                             intentData.possibleIntents.includes("topic") ||
                             intentData.possibleIntents.includes("post")));
        
        // Real estate/listings intent detection
        const isRealEstateQuery = intentData.containsRealEstateIntent ||
                                intentData.primaryIntent === "real_estate" ||
                                (intentData.possibleIntents && 
                                 (intentData.possibleIntents.includes("real_estate") ||
                                  intentData.possibleIntents.includes("property") ||
                                  intentData.possibleIntents.includes("house") ||
                                  intentData.possibleIntents.includes("listing") ||
                                  intentData.possibleIntents.includes("classified")));
        
        // Vendor intent detection
        const isVendorQuery = intentData.containsVendorIntent ||
                            intentData.primaryIntent === "vendor" ||
                            (intentData.possibleIntents && 
                             (intentData.possibleIntents.includes("vendor") ||
                              intentData.possibleIntents.includes("service") ||
                              intentData.possibleIntents.includes("business") ||
                              intentData.possibleIntents.includes("contractor")));
        
        // Community content intent detection
        const isCommunityQuery = intentData.containsCommunityIntent ||
                               intentData.primaryIntent === "community" ||
                               (intentData.possibleIntents && 
                                (intentData.possibleIntents.includes("community") ||
                                 intentData.possibleIntents.includes("government") ||
                                 intentData.possibleIntents.includes("amenities") ||
                                 intentData.possibleIntents.includes("information")));
        
        // If AI detected rocket launch intent, process accordingly
        if (isRocketQuery && !isWeatherQuery && !isEventQuery && !isForumQuery && !isRealEstateQuery && !isVendorQuery && !isCommunityQuery) {
          // Proceed with rocket launch query handling
          await handleRocketLaunchQuery();
          return;
        }
        
        // If AI detected weather intent, process accordingly
        if (isWeatherQuery && !isRocketQuery && !isEventQuery && !isForumQuery && !isRealEstateQuery && !isVendorQuery && !isCommunityQuery) {
          // Proceed with weather query handling
          await handleWeatherQuery();
          return;
        }
        
        // If AI detected event intent, process accordingly
        if (isEventQuery && !isRocketQuery && !isWeatherQuery && !isForumQuery && !isRealEstateQuery && !isVendorQuery && !isCommunityQuery) {
          // Proceed with event query handling
          await handleEventQuery();
          return;
        }
        
        // If AI detected forum intent, process accordingly
        if (isForumQuery && !isRocketQuery && !isWeatherQuery && !isEventQuery && !isRealEstateQuery && !isVendorQuery && !isCommunityQuery) {
          // Proceed with forum query handling
          await handleForumQuery();
          return;
        }
        
        // If AI detected real estate intent, process accordingly
        if (isRealEstateQuery && !isRocketQuery && !isWeatherQuery && !isEventQuery && !isForumQuery && !isVendorQuery && !isCommunityQuery) {
          // Proceed with real estate query handling
          await handleRealEstateQuery();
          return;
        }
        
        // If AI detected vendor intent, process accordingly
        if (isVendorQuery && !isRocketQuery && !isWeatherQuery && !isEventQuery && !isForumQuery && !isRealEstateQuery && !isCommunityQuery) {
          // Proceed with vendor query handling
          await handleVendorQuery();
          return;
        }
        
        // If AI detected community intent, process accordingly
        if (isCommunityQuery && !isRocketQuery && !isWeatherQuery && !isEventQuery && !isForumQuery && !isRealEstateQuery && !isVendorQuery) {
          // Proceed with community content query handling
          await handleCommunityQuery();
          return;
        }
      }
    } catch (error) {
      console.error("Error with AI intent analysis:", error);
      // Fall back to keyword-based approach if AI fails
    }
    
    // Fall back to traditional keyword-based approach
    // Check if the search is weather-related
    const weatherKeywords = [
      'weather', 'forecast', 'temperature', 'rain', 'sunny', 'humidity', 'wind', 
      'climate', 'storm', 'hot', 'cold', 'degrees', 'cloudy', 'clouds', 'cloud', 
      'precipitation', 'sunny', 'snow', 'foggy', 'fog', 'misty', 'mist', 'windy',
      'chilly', 'warm', 'heat', 'hail', 'thunder', 'lightning', 'shower', 'drizzle',
      'fahrenheit', 'celsius', 'feels like', 'condition', 'meteorology', 'barometric'
    ];
    
    // Check if the search is rocket launch related
    const rocketKeywords = [
      'rocket', 'launch', 'space', 'spacex', 'nasa', 'satellite', 'falcon', 
      'mission', 'spacecraft', 'orbit', 'cape canaveral', 'kennedy space center', 
      'liftoff', 'countdown', 'booster', 'blastoff', 'starship', 'space coast', 
      'shuttle', 'astronaut', 'space program', 'space flight', 'payload', 'launch pad',
      'rocket launch', 'artemis', 'iss', 'space station', 'space mission'
    ];
    
    // Common misspellings and variations of rocket-related terms
    const rocketMisspellings = [
      'lanch', 'lunch', 'lauch', 'lounche', 'rocketship', 'roket', 'roket', 'spacx', 'nasaa',
      'satelite', 'canavrel', 'ksc', 'kenedy', 'artimis', 'startship', 'space cst'
    ];
    
    // Add keywords for event-related queries
    const eventKeywords = [
      'event', 'calendar', 'schedule', 'happening', 'concert', 'festival', 
      'meetup', 'gathering', 'show', 'performance', 'celebration', 'parade',
      'party', 'social', 'community event', 'workshop', 'seminar', 'class',
      'activity', 'program', 'meeting', 'conference', 'expo', 'fair', 'bazaar',
      'fundraiser', 'gala', 'exhibition', 'tournament', 'game', 'match', 'competition'
    ];
    
    // Add keywords for real estate property queries
    const realEstateKeywords = [
      'house', 'property', 'home', 'listing', 'real estate', 'for sale', 'rent', 'apartment',
      'condo', 'townhouse', 'bedroom', 'bathroom', 'bath', 'bed', 'sqft', 'square feet', 
      'square foot', 'sq ft', 'year built', 'built', 'agent', 'fsbo', 'open house', 
      'garage', 'price', 'pool', 'backyard', 'waterfront', 'lake view', 'barefoot bay home',
      'classified', 'garage sale', 'yard sale'
    ];
    
    // Add keywords for forum content
    const forumKeywords = [
      'forum', 'post', 'topic', 'thread', 'discussion', 'comment', 'reply', 'board',
      'conversation', 'debate', 'chat', 'message', 'category', 'pinned', 'recent posts',
      'popular posts', 'community discussion', 'talk', 'group', 'discussions', 'posts',
      'threads', 'topics', 'conversations', 'news',
      // Community governance and decision-making terms
      'ballot initiative', 'vote', 'voting', 'election', 'community decision', 'board meeting',
      'committee', 'council', 'association', 'resolution', 'ordinance', 'community governance',
      'homeowners', 'hoa', 'residents', 'community meeting', 'amendment', 'proposal', 'measure',
      // Community infrastructure terms
      'road maintenance', 'street repair', 'construction', 'infrastructure', 'project',
      'development', 'improvement', 'maintenance',
      // Community rules and regulations
      'rule', 'regulation', 'policy', 'bylaw', 'restriction', 'guideline', 'requirement',
      'standard', 'code', 'passing', 'passed', 'decision', 'approved'
    ];
    
    // Add keywords for vendors
    const vendorKeywords = [
      'vendor', 'service', 'provider', 'business', 'company', 'professional', 'contractor',
      'home service', 'health', 'wellness', 'landscaping', 'lawn', 'food', 'dining',
      'restaurant', 'professional', 'retail', 'store', 'shop', 'automotive', 'mechanic', 
      'repair', 'technology', 'computer', 'plumbing', 'electrical', 'local business'
    ];
    
    // Add keywords for community content
    const communityKeywords = [
      'community', 'information', 'barefoot bay', 'amenity', 'amenities', 'pool', 'golf',
      'recreation', 'government', 'board', 'trustee', 'BBRD', 'meeting', 'history',
      'about', 'news', 'resource', 'transportation', 'religion', 'church', 'safety',
      'security', 'guideline', 'rule', 'policy', 'demographic', 'statistics', 'info'
    ];
    
    const lowercaseQuery = query.toLowerCase();
    
    // Check if the query includes exact weather keywords
    const isWeatherQuery = weatherKeywords.some(keyword => 
      lowercaseQuery.includes(keyword)
    );
    
    // Check if the query includes exact rocket keywords
    const hasExactRocketKeyword = rocketKeywords.some(keyword => 
      lowercaseQuery.includes(keyword)
    );
    
    // Check if the query includes common misspellings of rocket terms
    const hasMisspelledRocketTerm = rocketMisspellings.some(term => 
      lowercaseQuery.includes(term)
    );
    
    // Additional pattern matching for launch-related queries
    // This helps catch phrases like "when is next launch" or "upcoming lanch"
    const hasLaunchIntent = (
     (lowercaseQuery.includes('when') || 
      lowercaseQuery.includes('next') || 
      lowercaseQuery.includes('upcoming') || 
      lowercaseQuery.includes('schedule')) && 
     (lowercaseQuery.includes('launch') || 
      lowercaseQuery.includes('lanch') || 
      lowercaseQuery.includes('lift') || 
      lowercaseQuery.includes('orb')));
    
    // Check if the query includes event-related keywords
    const isEventQuery = eventKeywords.some(keyword => 
      lowercaseQuery.includes(keyword)
    );
    
    // Check if the query includes real estate related keywords
    const isRealEstateQuery = realEstateKeywords.some(keyword => 
      lowercaseQuery.includes(keyword)
    );
    
    // Check if the query includes forum related keywords
    const isForumQuery = forumKeywords.some(keyword => 
      lowercaseQuery.includes(keyword)
    );
    
    // Check if the query includes vendor related keywords
    const isVendorQuery = vendorKeywords.some(keyword => 
      lowercaseQuery.includes(keyword)
    );
    
    // Check if the query includes community content related keywords
    const isCommunityQuery = communityKeywords.some(keyword => 
      lowercaseQuery.includes(keyword)
    );
    
    // Check if this is an open house query
    const isOpenHouseQuery = lowercaseQuery.includes("open house") || 
                          (lowercaseQuery.includes("next") && 
                           lowercaseQuery.includes("house"));
    
    // Additional pattern matching for event-related queries
    const hasEventIntent = (
      !isOpenHouseQuery && // Don't count open house queries as events
      (lowercaseQuery.includes('when') || 
       lowercaseQuery.includes('next') || 
       lowercaseQuery.includes('upcoming') || 
       lowercaseQuery.includes('today') ||
       lowercaseQuery.includes('tomorrow') ||
       lowercaseQuery.includes('this week') ||
       lowercaseQuery.includes('weekend')) && 
      (lowercaseQuery.includes('happening') || 
       lowercaseQuery.includes('scheduled') || 
       lowercaseQuery.includes('going on') ||
       lowercaseQuery.includes('planned')));
    
    // PRIORITY 0A: Check for high-similarity forum title matches BEFORE intent classification
    // This ensures direct forum title searches bypass AI routing and go straight to forum
    console.log("Pre-intent check: Forum data available:", !!forumDiscussions, "Forum count:", forumDiscussions?.length || 0);
    console.log("Pre-intent check: Query text:", query.trim().toLowerCase());
    
    if (forumDiscussions && forumDiscussions.length > 0) {
      const queryText = query.trim().toLowerCase();
      
      // Calculate similarity scores for all forum posts and find high matches
      const forumSimilarities = forumDiscussions.map(post => ({
        post,
        similarity: calculateSimilarity(queryText, post.title || ''),
        postTitle: post.title || ''
      }));
      
      console.log("Pre-intent all forum similarities:", forumSimilarities.slice(0, 10).map(item => ({
        title: item.postTitle,
        similarity: item.similarity
      })));
      
      const highSimilarityMatches = forumSimilarities
        .filter(item => item.similarity >= 95)
        .sort((a, b) => b.similarity - a.similarity);
      
      console.log("Pre-intent high similarity forum title matches (95%+):", highSimilarityMatches.map(item => ({
        title: item.post.title,
        similarity: item.similarity
      })));
      
      // If we have 95%+ matches, prioritize these and route to forum immediately
      if (highSimilarityMatches.length > 0) {
        console.log(`Pre-intent routing: Found ${highSimilarityMatches.length} high-similarity forum post(s), bypassing AI intent classification`);
        await handleForumQuery();
        return;
      }
      
      // Also check for medium similarity matches (85%+) as a fallback
      const mediumSimilarityMatches = forumSimilarities
        .filter(item => item.similarity >= 85)
        .sort((a, b) => b.similarity - a.similarity);
      
      console.log("Pre-intent medium similarity forum title matches (85%+):", mediumSimilarityMatches.map(item => ({
        title: item.post.title,
        similarity: item.similarity
      })));
      
      if (mediumSimilarityMatches.length > 0) {
        console.log(`Pre-intent routing: Found ${mediumSimilarityMatches.length} medium-similarity forum post(s), bypassing AI intent classification`);
        await handleForumQuery();
        return;
      }
    } else {
      console.log("Pre-intent check: No forum data available, proceeding to event check");
    }

    // PRIORITY 0B: Check for high-similarity event title matches BEFORE intent classification
    // This ensures direct event title searches bypass AI routing and go straight to events
    console.log("Pre-intent check: Events data available:", !!events, "Events count:", events?.length || 0);
    
    if (events && events.length > 0) {
      const queryText = query.trim().toLowerCase();
      
      // Calculate similarity scores for all events and find high matches
      const eventSimilarities = events.map(event => ({
        event,
        similarity: calculateTitleSimilarity(queryText, event.title),
        eventTitle: event.title
      }));
      
      console.log("Pre-intent all event similarities:", eventSimilarities.slice(0, 10).map(item => ({
        title: item.eventTitle,
        similarity: item.similarity
      })));
      
      const highSimilarityMatches = eventSimilarities
        .filter(item => item.similarity >= 95)
        .sort((a, b) => b.similarity - a.similarity);
      
      console.log("Pre-intent high similarity title matches (95%+):", highSimilarityMatches.map(item => ({
        title: item.event.title,
        similarity: item.similarity
      })));
      
      // If we have 95%+ matches, prioritize these and route to events immediately
      if (highSimilarityMatches.length > 0) {
        console.log(`Pre-intent routing: Found ${highSimilarityMatches.length} high-similarity event(s), bypassing AI intent classification`);
        await handleEventQuery();
        return;
      }
      
      // Also check for medium similarity matches (85%+) as a fallback
      const mediumSimilarityMatches = eventSimilarities
        .filter(item => item.similarity >= 85)
        .sort((a, b) => b.similarity - a.similarity);
      
      console.log("Pre-intent medium similarity title matches (85%+):", mediumSimilarityMatches.map(item => ({
        title: item.event.title,
        similarity: item.similarity
      })));
      
      if (mediumSimilarityMatches.length > 0) {
        console.log(`Pre-intent routing: Found ${mediumSimilarityMatches.length} medium-similarity event(s), bypassing AI intent classification`);
        await handleEventQuery();
        return;
      }
    } else {
      console.log("Pre-intent check: No events data available, proceeding with AI classification");
    }

    // Check for specific community topics and known forum post topics first
    const hasSpecificCommunityTopics = 
      lowercaseQuery.includes('beach bathrooms') || 
      lowercaseQuery.includes('bathrooms at the beach') ||
      lowercaseQuery.includes('allan family') ||
      lowercaseQuery.includes('about allan family') ||
      lowercaseQuery.includes('tell me about allan') ||
      lowercaseQuery.includes('who are the allans') ||
      (lowercaseQuery.includes('allan') && lowercaseQuery.includes('family')) ||
      lowercaseQuery.includes('legacy');
      
    // Enhanced pattern matching for real estate and marketplace queries
    // Based on the comprehensive list in the attached documentation
    const propertyTerms = [
      'house', 'property', 'home', 'listing', 'real estate', 'for sale', 'rent', 'apartment',
      'condo', 'bedroom', 'bathroom', 'bath', 'bed', 'sqft', 'square feet', 
      'year built', 'garage', 'pool', 'waterfront', 'lake view', 'barefoot bay home'
    ];
    
    const classifiedTerms = [
      'furniture', 'tools', 'electronics', 'garage sale', 'yard sale', 'cash only', 
      'classified', 'for sale', 'wanted', 'FSBO', 'for sale by owner'
    ];
    
    const openHouseTerms = [
      'open house', 'open houses', 'house with open house', 'houses with open houses',
      'home available for viewing', 'property showing'
    ];
    
    // Check if query contains property-related terms
    const hasPropertyTerms = propertyTerms.some(term => lowercaseQuery.includes(term));
    
    // Check if query contains classified/marketplace-related terms
    const hasClassifiedTerms = classifiedTerms.some(term => lowercaseQuery.includes(term));
    
    // Check if query contains open house terms
    const hasOpenHouseTerms = openHouseTerms.some(term => lowercaseQuery.includes(term));
    
    // Expanded real estate intent detection
    const hasRealEstateIntent = !hasSpecificCommunityTopics && (
      hasPropertyTerms || hasClassifiedTerms || hasOpenHouseTerms || 
      isOpenHouseQuery || (
        (lowercaseQuery.includes('find') || 
        lowercaseQuery.includes('show') || 
        lowercaseQuery.includes('looking for') ||
        lowercaseQuery.includes('search for') ||
        lowercaseQuery.includes('need') ||
        lowercaseQuery.includes('any') ||
        lowercaseQuery.includes('available')) && 
        (lowercaseQuery.includes('bedroom') || 
        (lowercaseQuery.includes('bathroom') && !lowercaseQuery.includes('beach')) || 
        lowercaseQuery.includes('house') ||
        lowercaseQuery.includes('property') ||
        lowercaseQuery.includes('home') ||
        lowercaseQuery.includes('sqft') ||
        lowercaseQuery.includes('square feet') ||
        lowercaseQuery.includes('furniture') ||
        lowercaseQuery.includes('garage sale') ||
        lowercaseQuery.includes('tools') ||
        lowercaseQuery.includes('electronics') ||
        lowercaseQuery.includes('for sale')))
    );
    
    // Log detection for debugging 
    if (hasPropertyTerms || hasClassifiedTerms || hasOpenHouseTerms) {
      console.log('For-sale section detected with terms:', {
        propertyTerms: propertyTerms.filter(term => lowercaseQuery.includes(term)),
        classifiedTerms: classifiedTerms.filter(term => lowercaseQuery.includes(term)),
        openHouseTerms: openHouseTerms.filter(term => lowercaseQuery.includes(term))
      });
    }
    
    // Additional pattern matching for forum content queries based on comprehensive patterns
    const hasForumIntent = (
      // Specific known community topics with forum posts
      hasSpecificCommunityTopics ||
      
      // Keyword-Based Discussion Searches
      (lowercaseQuery.includes('any discussions about') || 
       lowercaseQuery.includes('forum posts about') ||
       lowercaseQuery.includes('any news on') ||
       lowercaseQuery.includes('is anyone talking about') ||
       lowercaseQuery.includes('forum threads mentioning') ||
       lowercaseQuery.includes('any conversations about') ||
       lowercaseQuery.includes('posts related to') ||
       lowercaseQuery.includes('any updates about') ||
       lowercaseQuery.includes('talk about beach bathroom') ||
       lowercaseQuery.includes('discussion about bathroom')) ||
      
      // Section or Category-Specific Searches
      (lowercaseQuery.includes('new discussions in') || 
       lowercaseQuery.includes('latest posts in') ||
       lowercaseQuery.includes('anything posted in') ||
       lowercaseQuery.includes('being discussed in') ||
       lowercaseQuery.includes('forum updates in') ||
       lowercaseQuery.includes('anything new in') ||
       lowercaseQuery.includes('topics under')) ||
      
      // Specific Topic Title Searches
      (lowercaseQuery.includes('find the post about') || 
       lowercaseQuery.includes('find post') ||
       lowercaseQuery.includes('is there a thread on') ||
       lowercaseQuery.includes('locate discussion on') ||
       lowercaseQuery.includes('any thread about')) ||
      
      // Community governance and decision-making patterns
      (lowercaseQuery.includes('ballot initiative') || 
       lowercaseQuery.includes('voting') ||
       lowercaseQuery.includes('board meeting') ||
       lowercaseQuery.includes('election') ||
       lowercaseQuery.includes('community decision') ||
       lowercaseQuery.includes('passing') ||
       lowercaseQuery.includes('passed') ||
       lowercaseQuery.includes('decision') ||
       lowercaseQuery.includes('approved') ||
       lowercaseQuery.includes('committee') ||
       lowercaseQuery.includes('council') ||
       lowercaseQuery.includes('ordinance') ||
       lowercaseQuery.includes('resolution') ||
       lowercaseQuery.includes('policy changes') ||
       lowercaseQuery.includes('rule changes')) ||
      
      // Community facilities patterns - specifically to match beach bathrooms
      (lowercaseQuery.includes('beach bathroom') || 
       lowercaseQuery.includes('beach facilities') ||
       lowercaseQuery.includes('beach amenities') ||
       lowercaseQuery.includes('barefoot bay beach') ||
       lowercaseQuery.includes('christened')) ||
       
      // Road and infrastructure patterns
      (lowercaseQuery.includes('road maintenance') || 
       lowercaseQuery.includes('street repair') ||
       lowercaseQuery.includes('infrastructure') ||
       lowercaseQuery.includes('construction') ||
       lowercaseQuery.includes('community project') ||
       lowercaseQuery.includes('development')) ||
       
      // Status and update patterns
      (lowercaseQuery.includes('what happened with') || 
       lowercaseQuery.includes('any updates on') ||
       lowercaseQuery.includes('status of') ||
       lowercaseQuery.includes('progress on') ||
       lowercaseQuery.includes('decision on') ||
       lowercaseQuery.includes('vote on')) ||
      
      // Generic patterns that combine trigger terms with forum terms
      ((lowercaseQuery.includes('find') || 
        lowercaseQuery.includes('show') || 
        lowercaseQuery.includes('looking for') ||
        lowercaseQuery.includes('search for') ||
        lowercaseQuery.includes('any') ||
        lowercaseQuery.includes('latest')) && 
       (lowercaseQuery.includes('post') || 
        lowercaseQuery.includes('topic') || 
        lowercaseQuery.includes('discussion') ||
        lowercaseQuery.includes('forum') ||
        lowercaseQuery.includes('thread') ||
        lowercaseQuery.includes('news') ||
        lowercaseQuery.includes('conversations'))));
       
    // Additional pattern matching for vendor queries
    const hasVendorIntent = (
      (lowercaseQuery.includes('find') || 
       lowercaseQuery.includes('show') || 
       lowercaseQuery.includes('looking for') ||
       lowercaseQuery.includes('search for') ||
       lowercaseQuery.includes('need')) && 
      (lowercaseQuery.includes('service') || 
       lowercaseQuery.includes('business') || 
       lowercaseQuery.includes('vendor') ||
       lowercaseQuery.includes('contractor') ||
       lowercaseQuery.includes('professional')));
       
    // Additional pattern matching for community content queries
    const hasCommunityIntent = (
      (lowercaseQuery.includes('find') || 
       lowercaseQuery.includes('show') || 
       lowercaseQuery.includes('looking for') ||
       lowercaseQuery.includes('search for') ||
       lowercaseQuery.includes('tell me about')) && 
      (lowercaseQuery.includes('barefoot bay') || 
       lowercaseQuery.includes('community') || 
       lowercaseQuery.includes('government') ||
       lowercaseQuery.includes('amenity') ||
       lowercaseQuery.includes('information')));
    
    // Combine all rocket-related matching approaches
    const isRocketQuery = hasExactRocketKeyword || hasMisspelledRocketTerm || hasLaunchIntent;
    
    // Combine all event-related matching approaches
    const isEventDetected = isEventQuery || hasEventIntent;
    
    // Combine all real estate related matching approaches
    const isRealEstateDetected = isRealEstateQuery || hasRealEstateIntent;
    
    // Combine all forum related matching approaches
    const isForumDetected = isForumQuery || hasForumIntent;
    
    // Combine all vendor related matching approaches
    const isVendorDetected = isVendorQuery || hasVendorIntent;
    
    // Combine all community content related matching approaches
    const isCommunityDetected = isCommunityQuery || hasCommunityIntent;
    
    // First handle rocket launch queries
    if (isRocketQuery && !isWeatherQuery && !isEventDetected && !isRealEstateDetected && !isForumDetected && !isVendorDetected && !isCommunityDetected) {
      await handleRocketLaunchQuery();
      return;
    }
    
    // Then handle weather queries
    if (isWeatherQuery && !isRocketQuery && !isEventDetected && !isRealEstateDetected && !isForumDetected && !isVendorDetected && !isCommunityDetected) {
      await handleWeatherQuery();
      return;
    }
    
    // Then handle event queries
    if (isEventDetected && !isRocketQuery && !isWeatherQuery && !isRealEstateDetected && !isForumDetected && !isVendorDetected && !isCommunityDetected) {
      await handleEventQuery();
      return;
    }
    
    // Then handle real estate queries
    if (isRealEstateDetected && !isRocketQuery && !isWeatherQuery && !isEventDetected && !isForumDetected && !isVendorDetected && !isCommunityDetected) {
      await handleRealEstateQuery();
      return;
    }
    
    // Then handle forum queries
    if (isForumDetected && !isRocketQuery && !isWeatherQuery && !isEventDetected && !isRealEstateDetected && !isVendorDetected && !isCommunityDetected) {
      await handleForumQuery();
      return;
    }
    
    // Then handle vendor queries
    if (isVendorDetected && !isRocketQuery && !isWeatherQuery && !isEventDetected && !isRealEstateDetected && !isForumDetected && !isCommunityDetected) {
      await handleVendorQuery();
      return;
    }
    
    // Then handle community content queries
    if (isCommunityDetected && !isRocketQuery && !isWeatherQuery && !isEventDetected && !isRealEstateDetected && !isForumDetected && !isVendorDetected) {
      await handleCommunityQuery();
      return;
    }
    
    // Special case handling for Allan Family queries - always direct to forum
    if (query.toLowerCase().includes('allan family') || 
        query.toLowerCase().includes('allan') || 
        query.toLowerCase().includes('family legacy') ||
        query.toLowerCase().includes('history of barefoot bay') ||
        query.toLowerCase().includes('community history')) {
      console.log('Special case handling: Allan Family or community history query detected');
      
      // Find the Allan Family Legacy post for debugging
      const allanPost = forumDiscussions?.find(post => 
        post.title?.toLowerCase().includes('allan family legacy'));
      
      if (allanPost) {
        console.log('🚨 Allan Family post detected in search with ID:', allanPost.id);
      } else {
        console.log('⚠️ Allan Family search triggered but no matching post found');
      }
      
      await handleForumQuery();
      return;
    }
    
    // If we reach here, first check if this could be a forum-related query by content
    // even if it doesn't use explicit forum keywords
    if (forumDiscussions && forumDiscussions.length > 0) {
      // Try to find any forum posts that are highly relevant to the query
      const lowercaseQuery = query.toLowerCase();
      
      // Check if the query has potential content matches in forum
      let potentialForumMatch = false;
      
      // Look for content matches in the forum posts with enhanced matching
      for (const post of forumDiscussions) {
        const postTitle = post.title?.toLowerCase() || '';
        const postContent = post.content?.toLowerCase() || '';
        
        // Special title-focused matching for specific posts
        // This specifically helps with queries like "tell me about the allan family" matching "Allan Family Legacy"
        if (postTitle.includes('allan family legacy') && 
            (lowercaseQuery.includes('allan') || lowercaseQuery.includes('allans'))) {
          potentialForumMatch = true;
          console.log('Found Allan Family title match');
          break;
        }
        
        // Generic fuzzy title matching for all forum titles
        // Extract key nouns from both post titles and queries to improve matching
        // This helps match user queries that don't exactly contain the post title
        const postTitleWords = postTitle.split(/\s+/).filter(word => word.length > 3);
        const titleQueryWords = lowercaseQuery.split(/\s+/).filter(word => word.length > 3);
        
        let titleFuzzyMatchCount = 0;
        for (const word of titleQueryWords) {
          // Check if any significant word from the query appears in the post title
          if (postTitleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))) {
            titleFuzzyMatchCount++;
          }
        }
        
        // If we have a significant title word match, consider this a potential forum match
        if (titleFuzzyMatchCount >= 1 && postTitleWords.length >= 1) {
          potentialForumMatch = true;
          console.log('Found title word match:', titleFuzzyMatchCount);
          break;
        }
        
        // 1. Direct phrase match check - for exact phrases in the query that appear in post
        // This helps with specific content like "ballot initiative passing"
        const queryPhrases = [
          lowercaseQuery,
          ...lowercaseQuery.split(/[.,!?;]/).map(phrase => phrase.trim()).filter(phrase => phrase.length > 10)
        ];
        
        // Check for strong phrase matches in title or content
        let hasStrongPhraseMatch = false;
        for (const phrase of queryPhrases) {
          if (phrase.length > 10 && (postTitle.includes(phrase) || postContent.includes(phrase))) {
            hasStrongPhraseMatch = true;
            break;
          }
        }
        
        if (hasStrongPhraseMatch) {
          potentialForumMatch = true;
          break;
        }
        
        // 2. Check for topic-specific keyword matches
        const communityTopics = [
          // General governance and decision-making
          'ballot', 'initiative', 'vote', 'election', 'passing', 'passed', 
          'decision', 'approved', 'committee', 'council', 'ordinance', 
          'resolution', 'maintenance', 'repair', 'infrastructure', 
          'development', 'board', 'meeting', 'community', 'government',
          
          // Beach and facilities 
          'beach', 'bathroom', 'facility', 'amenity', 'christened',
          
          // Family and resident names
          'allan', 'family', 'legacy', 'resident', 'longtime', 'history',
          
          // Community events and celebrations
          'celebration', 'anniversary', 'event', 'ceremony', 'dedication',
          
          // Common discussion topics
          'proposal', 'change', 'update', 'announcement', 'news', 'story'
        ];
        
        // Count how many community-specific terms match between query and post
        const queryCommTerms = communityTopics.filter(term => lowercaseQuery.includes(term));
        const postCommTerms = communityTopics.filter(term => postTitle.includes(term) || postContent.includes(term));
        
        // Check for overlapping community terms
        const commonTerms = queryCommTerms.filter(term => postCommTerms.includes(term));
        if (commonTerms.length >= 1) {
          potentialForumMatch = true;
          break;
        }
        
        // 3. Standard word-based matching (improved from previous version)
        const queryWords = lowercaseQuery.split(/\s+/).filter(word => word.length > 3);
        let matchCount = 0;
        let titleMatchCount = 0;
        
        for (const word of queryWords) {
          if (postTitle.includes(word)) {
            matchCount += 2; // Title matches are weighted higher
            titleMatchCount++;
          } else if (postContent.includes(word)) {
            matchCount++;
          }
        }
        
        // If we have multiple word matches or strong title matches, consider it relevant
        if (matchCount >= 3 || titleMatchCount >= 1 || 
           (queryWords.length === 1 && (postTitle.includes(queryWords[0]) || postContent.includes(queryWords[0])))) {
          potentialForumMatch = true;
          break;
        }
      }
      
      if (potentialForumMatch) {
        // This seems to be asking about content that exists in our forum
        await handleForumQuery();
        return;
      }
    }
    
    // If we reach here, use the AI to generate a contextual response
    await handleGenericQuery();
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-4 px-4">
      <div className="relative">
        {/* Search icon - visible only on desktop/tablet */}
        <div className="absolute inset-y-0 left-4 hidden md:flex items-center pointer-events-none">
          <Search className="w-6 h-6 text-gray-400" />
        </div>
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          placeholder={isMobile ? "Search clubs, events, vendors..." : "Search clubs, events, vendors, news, for sale, etc."}
          className="md:pl-12 pl-4 pr-20 py-6 bg-white border border-gray-200 focus:border-blue-300 rounded-full text-gray-700 shadow-sm text-xs sm:text-sm md:text-base lg:text-lg w-full"
        />
        <button
          onClick={() => setShowHelpModal(true)}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-500 p-1 rounded-full transition-colors"
          title="Search Help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary p-1 rounded-full transition-colors"
        >
          {isSearching && (
            <div className="w-5 h-5 border-2 border-t-transparent border-primary rounded-full animate-spin"></div>
          )}
          {!isSearching && <Search className="w-5 h-5" />}
        </button>
      </div>
      
      {isSearching && (
        <div className="bg-blue-50 p-4 mt-4 rounded-lg text-center">
          <div className="animate-pulse">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-blue-600 mt-2">Searching...</p>
          </div>
        </div>
      )}
      
      {searchResult && !isSearching && (
        <div className="mt-4 p-6 bg-white border border-gray-100 rounded-lg shadow-sm search-results">
          <div 
            className="prose max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: searchResult }} 
          />
        </div>
      )}
      
      {/* No suggestions section as requested */}
      
      {/* Search Help Modal */}
      <SearchHelpModal />
    </div>
  );
}