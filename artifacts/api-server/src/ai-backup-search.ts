/**
 * AI Backup Search using Gemini 2.5 Flash
 * 
 * This module provides intelligent search capabilities when exact matching fails.
 * It handles punctuation variations, fuzzy matching, and natural language understanding.
 */

import { GoogleGenAI } from "@google/genai";
import * as storage from './storage';
// Note: logger import removed since it doesn't exist - using console.log instead

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AISearchResult {
  type: string;
  id: number;
  title: string;
  excerpt: string;
  url: string;
  score: number;
  metadata?: any;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Perform AI-powered backup search when regular search fails
 */
export async function performAIBackupSearch(query: string): Promise<AISearchResult[]> {
  console.log(`[AI BACKUP SEARCH] Starting search for: "${query}"`);
  console.log(`[AI BACKUP SEARCH] API Key available: ${process.env.GEMINI_API_KEY ? 'YES' : 'NO'}`);
  try {
    console.log(`[AI BACKUP SEARCH] Starting AI search for: "${query}"`);
    
    // Get all available content from the database
    const [events, vendors, forumPosts, realEstate, communityPages] = await Promise.all([
      getAllEvents(),
      getAllVendors(),
      getAllForumPosts(),
      getAllRealEstate(),
      getAllCommunityPages()
    ]);

    console.log(`[AI BACKUP SEARCH] Data summary: ${events.length} events, ${vendors.length} vendors, ${forumPosts.length} forum posts, ${realEstate.length} real estate, ${communityPages.length} community pages`);
    
    // Check if we have any Roman's Pizza vendors for debugging
    const romanVendors = vendors.filter(v => 
      v.title.toLowerCase().includes('roman') || 
      v.content.toLowerCase().includes('roman')
    );
    console.log(`[AI BACKUP SEARCH] Roman-related vendors found: ${romanVendors.length}`);
    romanVendors.forEach(v => {
      console.log(`[AI BACKUP SEARCH] - ${v.title} (ID: ${v.id}, Category: ${v.category})`);
    });

    // Prepare content summary for AI analysis
    const contentSummary = createContentSummary({
      events,
      vendors,
      forumPosts,
      realEstate,
      communityPages
    });

    // Use Gemini to find relevant matches
    console.log(`[AI BACKUP SEARCH] Calling AI with content summary...`);
    const aiMatches = await findMatchesWithAI(query, contentSummary);
    
    console.log(`[AI BACKUP SEARCH] Found ${aiMatches.length} AI matches`);
    if (aiMatches.length > 0) {
      console.log(`[AI BACKUP SEARCH] AI matches:`, aiMatches.map(m => ({
        type: m.type,
        title: m.title,
        confidence: m.confidence,
        reason: m.reason
      })));
    }
    return aiMatches;

  } catch (error) {
    console.error('[AI BACKUP SEARCH] Error:', error);
    return [];
  }
}

/**
 * Get all events for AI analysis
 */
async function getAllEvents() {
  try {
    const events = await storage.getEvents();
    return events.map(event => ({
      type: 'event',
      id: event.id,
      title: event.title,
      description: event.description || '',
      location: event.location || '',
      category: event.category,
      url: `/calendar/event/${event.id}`
    }));
  } catch (error) {
    console.error('[AI BACKUP SEARCH] Error getting events:', error);
    return [];
  }
}

/**
 * Get all vendor pages for AI analysis
 */
async function getAllVendors() {
  try {
    const vendors = await storage.getPages('vendors');
    return vendors.map(vendor => ({
      type: 'vendor',
      id: vendor.id,
      title: vendor.title,
      content: vendor.content || '',
      category: vendor.category,
      slug: vendor.slug,
      url: `/${vendor.slug.replace(/^vendors-/, '').replace(/-/g, '/')}`
    }));
  } catch (error) {
    console.error('[AI BACKUP SEARCH] Error getting vendors:', error);
    return [];
  }
}

/**
 * Get all forum posts for AI analysis
 */
async function getAllForumPosts() {
  try {
    const categories = await storage.getForumCategories();
    const allPosts = [];
    
    for (const category of categories) {
      const posts = await storage.getForumPosts(category.id);
      for (const post of posts) {
        allPosts.push({
          type: 'forum',
          id: post.id,
          title: post.title,
          content: post.content || '',
          categoryName: category.name,
          categorySlug: category.slug,
          url: `/forum/post/${post.id}`
        });
      }
    }
    
    return allPosts;
  } catch (error) {
    console.error('[AI BACKUP SEARCH] Error getting forum posts:', error);
    return [];
  }
}

/**
 * Get all real estate listings for AI analysis
 */
async function getAllRealEstate() {
  try {
    const listings = await storage.getListings();
    return listings
      .filter(listing => listing.status === 'ACTIVE' || listing.status === 'PUBLISHED')
      .map(listing => ({
        type: 'real-estate',
        id: listing.id,
        title: listing.title,
        description: listing.description || '',
        price: listing.price,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        squareFootage: listing.squareFootage,
        url: `/for-sale/${listing.id}`
      }));
  } catch (error) {
    console.error('[AI BACKUP SEARCH] Error getting real estate:', error);
    return [];
  }
}

/**
 * Get all community pages for AI analysis
 */
async function getAllCommunityPages() {
  try {
    const pages = await storage.getPages();
    return pages
      .filter(page => !page.slug.startsWith('vendors-'))
      .map(page => ({
        type: 'community-page',
        id: page.id,
        title: page.title,
        content: page.content || '',
        category: page.category,
        slug: page.slug,
        url: `/${page.slug}`
      }));
  } catch (error) {
    console.error('[AI BACKUP SEARCH] Error getting community pages:', error);
    return [];
  }
}

/**
 * Create a content summary for AI analysis
 */
function createContentSummary(content: any) {
  const summary = {
    events: content.events.slice(0, 50), // Limit to avoid token limits
    vendors: content.vendors.slice(0, 50),
    forumPosts: content.forumPosts.slice(0, 30),
    realEstate: content.realEstate.slice(0, 30),
    communityPages: content.communityPages.slice(0, 30)
  };
  
  return summary;
}

/**
 * Use Gemini AI to find relevant matches
 */
async function findMatchesWithAI(query: string, contentSummary: any): Promise<AISearchResult[]> {
  try {
    const prompt = `You are a search assistant for the Barefoot Bay community platform. A user searched for "${query}" but got no exact matches.

Your task is to analyze the available content and find the most relevant matches, even if there are punctuation differences, spelling variations, or fuzzy matches.

Available content:
${JSON.stringify(contentSummary, null, 2)}

Please find up to 3 most relevant matches for the query "${query}". Consider:
- Similar names with different punctuation (e.g., "Big Romans" vs "Big Roman's")
- Spelling variations
- Related concepts
- Business names that might be shortened or expanded

Respond with a JSON array of matches. Each match should include:
- contentId: the ID from the content
- contentType: the type (event, vendor, forum, real-estate, community-page)
- title: the title from the content
- confidence: "high", "medium", or "low"
- reason: brief explanation of why this matches
- url: the URL from the content

If no relevant matches found, return an empty array.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              contentId: { type: "number" },
              contentType: { type: "string" },
              title: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              reason: { type: "string" },
              url: { type: "string" }
            },
            required: ["contentId", "contentType", "title", "confidence", "reason", "url"]
          }
        }
      },
      contents: prompt,
    });

    const rawResponse = response.text;
    if (!rawResponse) {
      return [];
    }

    const aiMatches = JSON.parse(rawResponse);
    
    // Convert AI matches to standardized search results
    return aiMatches.map((match: any, index: number) => ({
      type: match.contentType,
      id: match.contentId,
      title: match.title,
      excerpt: `AI found: ${match.reason}`,
      url: match.url,
      score: match.confidence === 'high' ? 95 : match.confidence === 'medium' ? 85 : 75,
      confidence: match.confidence,
      reason: match.reason,
      metadata: {
        aiGenerated: true,
        originalQuery: query,
        matchReason: match.reason
      }
    }));

  } catch (error) {
    console.error('[AI BACKUP SEARCH] Error with Gemini AI:', error);
    return [];
  }
}

