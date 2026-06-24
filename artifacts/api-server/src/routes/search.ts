import express from 'express';
import { storage } from '../storage';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { isVendorPage, extractVendorCategory } from '../shared-compat/vendor-url-utils';
// AI backup search for punctuation variations and fuzzy matching
import { performAIBackupSearch } from '../ai-backup-search';

const router = express.Router();

// Convert database slug to public URL format (server-side version)
function dbSlugToPublicUrl(slug: string): string {
  if (!slug) return 'vendors';
  if (!slug.startsWith('vendors-')) return `vendors/${slug}`;
  
  // Remove the 'vendors-' prefix
  const withoutPrefix = slug.substring(8);
  
  // Handle compound categories
  const compoundCategories = [
    'home-services', 'food-dining', 'health-wellness', 'professional-services',
    'technology-and-electronics', 'retail-shops', 'beauty-personal',
    'insurance-financial', 'real-estate', 'hvac-and-air-quality',
    'automotive-golf-carts', 'anchor-vapor-barrier'
  ];
  
  // Check for compound categories first
  for (const compound of compoundCategories) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      const uniqueIdentifier = withoutPrefix.substring(compound.length + 1);
      return `vendors/${compound}/${uniqueIdentifier}`;
    }
  }
  
  // For non-compound categories, split by first hyphen
  const parts = withoutPrefix.split('-');
  if (parts.length === 1) {
    return `vendors/${parts[0]}`;
  }
  
  const category = parts[0];
  const uniqueIdentifier = parts.slice(1).join('-');
  return `vendors/${category}/${uniqueIdentifier}`;
}

// Search result interface matching the expected unified format
interface SearchResult {
  type: 'event' | 'forum' | 'real-estate' | 'vendor' | 'community-page' | 'weather' | 'rocket-launch';
  id: string | number;
  title: string;
  excerpt: string;
  url: string;
  score: number;
  metadata?: Record<string, any>;
}

// Search query validation schema
const searchQuerySchema = z.object({
  q: z.string().min(1, 'Query is required').max(200, 'Query too long'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
  types: z.string().optional() // comma-separated list of types to search
});

// Calculate similarity score between two strings (0-100) - STRICT VERSION
// Enhanced text normalization for better phrase matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Remove common punctuation that shouldn't affect matching
    .replace(/[''`]/g, '') // Remove apostrophes and quotes
    .replace(/[.,!?;:()\[\]{}]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim();
}

// Calculate fuzzy word similarity for partial matches
function wordSimilarity(word1: string, word2: string): number {
  if (word1 === word2) return 1.0;
  
  // Check if one word contains the other
  if (word1.includes(word2) || word2.includes(word1)) {
    const shorter = Math.min(word1.length, word2.length);
    const longer = Math.max(word1.length, word2.length);
    return shorter / longer;
  }
  
  // Levenshtein distance for close matches
  const distance = levenshteinDistance(word1, word2);
  const maxLength = Math.max(word1.length, word2.length);
  
  // Only consider similar if distance is small relative to word length
  if (distance <= maxLength * 0.3) {
    return 1 - (distance / maxLength);
  }
  
  return 0;
}

// Simple Levenshtein distance implementation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // substitution
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function calculateSimilarity(queryText: string, targetText: string): number {
  const normalizedQuery = normalizeText(queryText);
  const normalizedTarget = normalizeText(targetText);
  
  // Exact match gets 100%
  if (normalizedQuery === normalizedTarget) return 100;
  
  // Check if query is completely contained in target
  if (normalizedTarget.includes(normalizedQuery)) {
    const coverage = normalizedQuery.length / normalizedTarget.length;
    return Math.min(98, 80 + (coverage * 18));
  }
  
  // Check if target is completely contained in query
  if (normalizedQuery.includes(normalizedTarget)) {
    return 95;
  }
  
  // Enhanced word-based matching with fuzzy logic
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'this', 'that', 'these', 'those', 'from', 'into', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once'];
  
  const queryWords = normalizedQuery.split(/\s+/).filter(word => 
    word.length > 2 && !commonWords.includes(word)
  );
  const targetWords = normalizedTarget.split(/\s+/).filter(word => 
    word.length > 2 && !commonWords.includes(word)
  );
  
  if (queryWords.length === 0 || targetWords.length === 0) return 0;
  
  // Enhanced matching: exact matches get full weight, fuzzy matches get partial weight
  let totalScore = 0;
  let matchedWords = 0;
  
  for (const queryWord of queryWords) {
    let bestMatch = 0;
    
    for (const targetWord of targetWords) {
      const similarity = wordSimilarity(queryWord, targetWord);
      bestMatch = Math.max(bestMatch, similarity);
    }
    
    // Accept matches above threshold (0.7 for high accuracy)
    if (bestMatch >= 0.7) {
      totalScore += bestMatch;
      matchedWords++;
    }
  }
  
  if (matchedWords === 0) return 0;
  
  // Calculate final score based on coverage and match quality
  const coverage = matchedWords / queryWords.length;
  const avgMatchQuality = totalScore / matchedWords;
  
  // Require good coverage for high scores, but allow partial matches
  let finalScore = coverage * avgMatchQuality * 85;
  
  // Bonus for complete coverage
  if (coverage === 1.0) {
    finalScore += 10;
  }
  
  // Penalty for poor coverage to maintain accuracy
  if (coverage < 0.6) {
    finalScore *= 0.7;
  }
  
  return Math.round(Math.min(95, finalScore));
}

// Create excerpt from content
function createExcerpt(content: string, maxLength: number = 150): string {
  if (!content) return '';
  
  // Remove HTML tags
  const textContent = content.replace(/<[^>]*>/g, '');
  
  if (textContent.length <= maxLength) {
    return textContent;
  }
  
  // Find the last space before maxLength to avoid cutting words
  const truncated = textContent.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

// Enhanced event search with smart filtering for time, category, badge, and location
async function searchEvents(query: string): Promise<SearchResult[]> {
  try {
    const events = await storage.getEvents();
    
    // Count how many events we're processing
    let processedCount = 0;
    let scoreAbove30 = 0;
    let scoreAbove0 = 0;
    
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase().trim();
    
    // Date filtering logic
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Calculate date ranges for different queries
    const getDateRanges = (query: string) => {
      const ranges = {
        startDate: null as Date | null,
        endDate: null as Date | null,
        useRange: false,
        specificDate: null as Date | null,
        hasDateQuery: false
      };
      
      // For demo purposes, since events are in 2025, we'll use those dates
      const demoYear = 2025;
      const demoToday = new Date(demoYear, now.getMonth(), now.getDate());
      const demoTomorrow = new Date(demoToday);
      demoTomorrow.setDate(demoTomorrow.getDate() + 1);
      
      // Simplified date patterns - focus on "April 30th 2025" format first
      const monthFirstMatch = query.match(/(?:on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i);
      const numericDateMatch = query.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      
      let specificDateMatch = monthFirstMatch || numericDateMatch;
      
      console.log(`[DATE SEARCH DEBUG] Checking for date patterns in query: "${query}"`);
      console.log(`[DATE SEARCH DEBUG] Regex match result:`, specificDateMatch);
      console.log(`[DATE SEARCH DEBUG] monthFirstMatch:`, monthFirstMatch);
      console.log(`[DATE SEARCH DEBUG] numericDateMatch:`, numericDateMatch);
      
      if (specificDateMatch) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        let day, month, year;
        
        if (monthFirstMatch) {
          // Pattern: "April 30th 2025" or "on April 30th 2025"
          const monthName = monthFirstMatch[1];
          month = monthNames.indexOf(monthName.toLowerCase());
          day = parseInt(monthFirstMatch[2]);
          year = monthFirstMatch[3] ? parseInt(monthFirstMatch[3]) : demoYear;
          
          console.log(`[DATE SEARCH DEBUG] Parsed month-first format: ${monthName} ${day} ${year}`);
        } else if (numericDateMatch) {
          // Pattern: "4/30/2025" or "4/30"
          month = parseInt(numericDateMatch[1]) - 1; // 0-indexed
          day = parseInt(numericDateMatch[2]);
          year = demoYear; // Default to demo year
          
          if (numericDateMatch[3]) {
            const yearStr = numericDateMatch[3];
            year = yearStr.length === 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr);
          }
          
          console.log(`[DATE SEARCH DEBUG] Parsed MM/DD format: ${month + 1}/${day}/${year}`);
        }
        
        if (day && month !== undefined && year) {
          ranges.specificDate = new Date(year, month, day);
          ranges.startDate = new Date(year, month, day);
          ranges.endDate = new Date(year, month, day + 1);
          ranges.useRange = true;
          
          console.log(`[DATE SEARCH DEBUG] Final parsed date: ${ranges.specificDate.toDateString()}`);
          console.log(`[DATE SEARCH DEBUG] Date range: ${ranges.startDate.toISOString()} to ${ranges.endDate.toISOString()}`);
          
          // Mark that date filtering should be applied
          ranges.hasDateQuery = true;
        }
      } else if (/today|this\s+evening|tonight/i.test(query)) {
        ranges.startDate = demoToday;
        ranges.endDate = demoTomorrow;
        ranges.useRange = true;
      } else if (/tomorrow/i.test(query)) {
        ranges.startDate = demoTomorrow;
        ranges.endDate = new Date(demoTomorrow);
        ranges.endDate.setDate(ranges.endDate.getDate() + 1);
        ranges.useRange = true;
      } else if (/weekend|this\s+weekend|saturday|sunday/i.test(query)) {
        console.log(`[DATE DEBUG] WEEKEND condition triggered for query: "${query}"`);
        // Find this weekend (Saturday and Sunday)
        const daysUntilSaturday = (6 - demoToday.getDay()) % 7 || 7;
        const saturday = new Date(demoToday);
        saturday.setDate(saturday.getDate() + (daysUntilSaturday === 0 ? 0 : daysUntilSaturday));
        const monday = new Date(saturday);
        monday.setDate(monday.getDate() + 2);
        ranges.startDate = saturday;
        ranges.endDate = monday;
        ranges.useRange = true;
        ranges.hasDateQuery = true; // Enable text query cleaning for weekend searches
        
        console.log(`[WEEKEND DEBUG] Today: ${demoToday.toDateString()} (day ${demoToday.getDay()})`);
        console.log(`[WEEKEND DEBUG] Days until Saturday: ${daysUntilSaturday}`);
        console.log(`[WEEKEND DEBUG] This weekend: ${saturday.toDateString()} to ${monday.toDateString()}`);
        console.log(`[WEEKEND DEBUG] Setting ranges.startDate to: ${ranges.startDate.toISOString()}`);
        console.log(`[WEEKEND DEBUG] Setting ranges.endDate to: ${ranges.endDate.toISOString()}`);
      } else if (/this\s+week|upcoming\s+events|events\s+this\s+week/i.test(query)) {
        console.log(`[DATE DEBUG] THIS WEEK condition triggered for query: "${query}"`);
        const weekStart = new Date(demoToday);
        const weekEnd = new Date(demoToday);
        weekEnd.setDate(weekEnd.getDate() + 7);
        ranges.startDate = weekStart;
        ranges.endDate = weekEnd;
        ranges.useRange = true;
      } else if (/next\s+week/i.test(query)) {
        const nextWeekStart = new Date(demoToday);
        nextWeekStart.setDate(nextWeekStart.getDate() + (7 - demoToday.getDay()));
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
        ranges.startDate = nextWeekStart;
        ranges.endDate = nextWeekEnd;
        ranges.useRange = true;
      } else if (/this\s+month|events\s+this\s+month/i.test(query)) {
        ranges.startDate = new Date(demoYear, demoToday.getMonth(), 1);
        ranges.endDate = new Date(demoYear, demoToday.getMonth() + 1, 1);
        ranges.useRange = true;
      } else if (/next\s+month/i.test(query)) {
        ranges.startDate = new Date(demoYear, demoToday.getMonth() + 1, 1);
        ranges.endDate = new Date(demoYear, demoToday.getMonth() + 2, 1);
        ranges.useRange = true;
      }
      
      return ranges;
    };
    
    const dateRanges = getDateRanges(lowerQuery);
    
    // Handle text query cleaning for date searches
    let textQuery = query;
    if (dateRanges.hasDateQuery) {
      // Remove date-related terms from the query for text matching
      textQuery = query
        .replace(/\b(?:events?|on|in|at|during|for)\s+/gi, '') // Remove generic event words and prepositions
        .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*(?:\d{4})?\b/gi, '') // Remove month-day-year patterns
        .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '') // Remove MM/DD/YYYY patterns
        .replace(/\b(?:today|tomorrow|tonight|this\s+(?:week|month|year|evening|weekend))\b/gi, '') // Remove relative dates including weekend
        .replace(/\b(?:weekend|saturday|sunday)\b/gi, '') // Remove weekend-specific terms
        .replace(/\s+/g, ' ') // Clean up extra spaces
        .trim();
      
      console.log(`[DATE SEARCH DEBUG] Original query: "${query}"`);
      console.log(`[DATE SEARCH DEBUG] Text query after date removal: "${textQuery}"`);
      
      // If no meaningful text remains after removing date terms, search all events in the date range
      if (!textQuery || textQuery.length < 2) {
        textQuery = ''; // Will match all events in the date range
        console.log(`[DATE SEARCH DEBUG] No text query remaining, will return all events in date range`);
      }
    }
    
    // Debug date range parsing
    console.log(`[DATE SEARCH DEBUG] Final date ranges for query "${lowerQuery}":`, {
      useRange: dateRanges.useRange,
      startDate: dateRanges.startDate?.toISOString(),
      endDate: dateRanges.endDate?.toISOString(),
      specificDate: dateRanges.specificDate?.toISOString()
    });
    
    // Enhanced event search patterns
    const eventPatterns = {
      // Category patterns - more comprehensive
      entertainment: /entertainment|music|concert|show|performance|arts|theater|movie|dance|band|choir|singing|comedy|cultural/i,
      social: /social|meeting|club|community|gathering|group|party|meetup|get\-together|mixer|reception/i,
      government: /government|gov|meeting|council|board|official|administration|municipal|civic|public\s+meeting|town\s+hall/i,
      sports: /sports|game|tournament|athletic|tennis|golf|swimming|pickleball|bocce|fitness|exercise|workout|gym/i,
      recreation: /recreation|rec|pool|pavilion|activities|fun|hobby|leisure|games|cards|bingo/i,
      education: /education|educational|class|workshop|seminar|lecture|learning|training|course/i,
      
      // Badge patterns
      withBadge: /with\s+badge|badge\s+required|members?\s+only|membership|residents?\s+only|badge\s+holders?/i,
      noBadge: /no\s+badge|without\s+badge|open\s+to\s+all|public|everyone|free\s+entry|all\s+welcome|non\-?members?/i,
      
      // Time patterns
      today: /today|this\s+evening|tonight/i,
      tomorrow: /tomorrow/i,
      thisWeek: /this\s+week|upcoming\s+events|events\s+this\s+week/i,
      nextWeek: /next\s+week/i,
      thisMonth: /this\s+month/i,
      nextMonth: /next\s+month/i,
      weekend: /weekend|this\s+weekend|saturday|sunday/i,
      
      // Location patterns
      poolPavilion: /pool\s+pavilion|pavilion|pool\s+area/i,
      buildingC: /building\s+c|bldg\s+c|building\-c/i,
      buildingA: /building\s+a|bldg\s+a|building\-a/i,
      buildingD: /building\s+d|bldg\s+d|building\-d/i,
      lounge: /lounge|bar|social\s+room/i,
      courts: /court|tennis|bocce|pickleball/i
    };
    
    for (const event of events) {
      processedCount++;
      
      // Universal filter: Skip past events (only return today and future events)
      const eventStartDate = new Date(event.startDate);
      const currentDate = new Date();
      const todayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      
      if (eventStartDate < todayStart) {
        console.log(`[EVENT FILTER DEBUG] Skipping past event: "${event.title}" (${eventStartDate.toDateString()})`);
        continue; // Skip events that started before today
      }
      
      // Skip test data and irrelevant entries
      if (event.title?.toLowerCase().includes('tops #') || 
          (event.title?.toLowerCase().includes('test') && !lowerQuery.includes('test'))) {
        continue;
      }
      
      let score = 0;
      let bonusScore = 0;
      
      // Track pickleball events specifically for debugging
      const isPickleballEvent = event.title?.toLowerCase().includes('pickleball');
      if (isPickleballEvent && processedCount <= 3) {
        console.log(`[EVENT SEARCH DEBUG] Processing pickleball event ${processedCount}:`, {
          id: event.id,
          title: event.title,
          description: event.description?.substring(0, 50) + '...'
        });
      }
      
      // Date filtering - skip events outside the date range if specified
      if (dateRanges.useRange && dateRanges.startDate && dateRanges.endDate) {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = event.endDate ? new Date(event.endDate) : eventStartDate;
        
        // Check if event overlaps with the query date range
        const overlaps = eventStartDate < dateRanges.endDate && eventEndDate >= dateRanges.startDate;
        
        // Debug specific dates for troubleshooting
        if (lowerQuery.includes('april 30')) {
          console.log(`[DATE FILTER DEBUG] Event: ${event.title}`);
          console.log(`[DATE FILTER DEBUG] Event start: ${eventStartDate.toISOString()}`);
          console.log(`[DATE FILTER DEBUG] Event end: ${eventEndDate.toISOString()}`);
          console.log(`[DATE FILTER DEBUG] Query range: ${dateRanges.startDate.toISOString()} to ${dateRanges.endDate.toISOString()}`);
          console.log(`[DATE FILTER DEBUG] Overlaps: ${overlaps}`);
        }
        
        if (!overlaps) {
          continue; // Skip this event if it doesn't overlap with the date range
        }
        
        // Give bonus for events that match the date range
        bonusScore += 30;
        
        if (lowerQuery.includes('april 30')) {
          console.log(`[DATE FILTER DEBUG] Event ${event.title} passed date filter with bonus score: ${bonusScore}`);
        }
      }
      
      // Basic text similarity scoring using cleaned text query
      const queryForTextMatching = textQuery || query; // Use cleaned query if available, otherwise original
      
      if (textQuery === '' && dateRanges.useRange) {
        // When textQuery is empty (all date terms removed), give base score for events in date range
        score = 60; // Base score for date-matched events
        console.log(`[DATE SEARCH DEBUG] Empty text query, giving base score ${score} to event: ${event.title}`);
      } else {
        const titleScore = calculateSimilarity(queryForTextMatching, event.title);
        const descriptionScore = event.description ? 
          calculateSimilarity(queryForTextMatching, event.description) * 0.6 : 0;
        const locationScore = event.location ? 
          calculateSimilarity(queryForTextMatching, event.location) * 0.4 : 0;
        
        score = Math.max(titleScore, descriptionScore, locationScore);
      }
      
      // Enhanced scoring based on query patterns
      
      // Category matching bonuses - improved logic
      const eventTitleLower = event.title.toLowerCase();
      const eventCategoryLower = (event.category || '').toLowerCase();
      
      if (eventPatterns.entertainment.test(lowerQuery)) {
        // Check if event is entertainment-related
        if (eventCategoryLower === 'entertainment' || eventCategoryLower === 'arts' || 
            eventPatterns.entertainment.test(eventTitleLower) ||
            eventPatterns.entertainment.test(event.description || '')) {
          bonusScore += 40;
        }
      }
      
      if (eventPatterns.social.test(lowerQuery)) {
        // Check if event is social-related
        if (eventCategoryLower === 'social' || eventCategoryLower === 'community' ||
            eventPatterns.social.test(eventTitleLower) ||
            eventPatterns.social.test(event.description || '')) {
          bonusScore += 40;
        }
      }
      
      if (eventPatterns.government.test(lowerQuery)) {
        // Check if event is government-related
        if (eventCategoryLower === 'government' || eventCategoryLower === 'civic' ||
            eventPatterns.government.test(eventTitleLower) ||
            eventPatterns.government.test(event.description || '')) {
          bonusScore += 45;
        }
      }
      
      if (eventPatterns.sports.test(lowerQuery)) {
        // Check if event is sports-related
        if (eventCategoryLower === 'sports' || eventCategoryLower === 'recreation' ||
            eventPatterns.sports.test(eventTitleLower) ||
            eventPatterns.sports.test(event.description || '')) {
          bonusScore += 40;
        }
      }
      
      if (eventPatterns.recreation.test(lowerQuery)) {
        // Check if event is recreation-related
        if (eventCategoryLower === 'recreation' || eventCategoryLower === 'activities' ||
            eventPatterns.recreation.test(eventTitleLower) ||
            eventPatterns.recreation.test(event.description || '')) {
          bonusScore += 35;
        }
      }
      
      if (eventPatterns.education.test(lowerQuery)) {
        // Check if event is education-related
        if (eventCategoryLower === 'education' || eventCategoryLower === 'educational' ||
            eventPatterns.education.test(eventTitleLower) ||
            eventPatterns.education.test(event.description || '')) {
          bonusScore += 35;
        }
      }
      
      // Badge filtering bonuses
      if (eventPatterns.withBadge.test(lowerQuery)) {
        if (event.badgeRequired === true) {
          bonusScore += 40;
        } else {
          // Penalize events without badge when badge is specifically requested
          score *= 0.3;
        }
      }
      
      if (eventPatterns.noBadge.test(lowerQuery)) {
        if (event.badgeRequired === false) {
          bonusScore += 40;
        } else {
          // Penalize events with badge when no badge is specifically requested
          score *= 0.3;
        }
      }
      
      // Location filtering bonuses
      if (eventPatterns.poolPavilion.test(lowerQuery)) {
        if (event.location?.toLowerCase().includes('pavilion') || event.location?.toLowerCase().includes('pool')) {
          bonusScore += 45;
        }
      }
      
      if (eventPatterns.buildingC.test(lowerQuery)) {
        if (event.location?.toLowerCase().includes('building c') || event.location?.toLowerCase().includes('bldg c')) {
          bonusScore += 40;
        }
      }
      
      // Time-based bonuses (for demo purposes, all events are treated as relevant)
      if (eventPatterns.thisWeek.test(lowerQuery) || eventPatterns.today.test(lowerQuery) || 
          eventPatterns.weekend.test(lowerQuery)) {
        bonusScore += 20; // Bonus for time-based queries
      }
      
      // Specific event name bonuses
      if (lowerQuery.includes('spring festival') && event.title.toLowerCase().includes('spring')) {
        bonusScore += 50;
      }
      
      if (lowerQuery.includes('april 30') && event.title.toLowerCase().includes('april')) {
        bonusScore += 50;
      }
      
      // Calculate final score
      const finalScore = score + bonusScore;
      
      // Track scoring stats for debugging
      if (score > 0) scoreAbove0++;
      if (finalScore > 30) scoreAbove30++;
      
      // Debug pickleball events specifically
      if (isPickleballEvent && processedCount <= 3) {
        console.log(`[EVENT SEARCH DEBUG] Pickleball scoring for event ${event.id}:`, {
          titleScore: calculateSimilarity(query, event.title),
          score: score,
          bonusScore: bonusScore,
          finalScore: finalScore,
          thresholdPassed: finalScore > 75
        });
      }
      
      // Lower threshold to show more relevant results
      if (finalScore > 45) {
        results.push({
          type: 'event',
          id: event.id,
          title: event.title,
          excerpt: createExcerpt(event.description || ''),
          url: `/events/${event.id}`,
          score: Math.round(finalScore),
          metadata: {
            startDate: event.startDate,
            endDate: event.endDate,
            location: event.location,
            category: event.category,
            badgeRequired: event.badgeRequired
          }
        });
      }
    }
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Debug summary
    console.log('[EVENT SEARCH DEBUG] Summary:', {
      totalProcessed: processedCount,
      scoreAbove0: scoreAbove0,
      scoreAbove30: scoreAbove30,
      resultsReturned: results.length
    });
    
    return results;
  } catch (error) {
    logger.error('Error searching events:', error);
    return [];
  }
}

// Search forum posts
async function searchForumPosts(query: string): Promise<SearchResult[]> {
  try {
    const categories = await storage.getForumCategories();
    const results: SearchResult[] = [];
    
    for (const category of categories) {
      const posts = await storage.getForumPosts(category.id);
      
      for (const post of posts) {
        const titleScore = calculateSimilarity(query, post.title);
        const contentScore = post.content ? 
          calculateSimilarity(query, post.content) * 0.7 : 0;
        
        const maxScore = Math.max(titleScore, contentScore);
        
        if (maxScore > 60) {
          results.push({
            type: 'forum',
            id: post.id,
            title: post.title,
            excerpt: createExcerpt(post.content || ''),
            url: `/forum/post/${post.id}`,
            score: maxScore,
            metadata: {
              categoryName: category.name,
              categorySlug: category.slug,
              authorUsername: post.author?.username,
              createdAt: post.createdAt
            }
          });
        }
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error searching forum posts:', error);
    return [];
  }
}

// Search real estate listings
async function searchRealEstate(query: string): Promise<SearchResult[]> {
  try {
    console.log(`[REAL ESTATE SEARCH DEBUG] Starting search for: "${query}"`);
    const listings = await storage.getListings();
    console.log(`[REAL ESTATE SEARCH DEBUG] Retrieved ${listings.length} listings from storage`);
    
    // Filter out draft and expired listings for public search
    const activeListings = listings.filter(listing => 
      listing.status === 'ACTIVE' || listing.status === 'PUBLISHED'
    );
    console.log(`[REAL ESTATE SEARCH DEBUG] ${activeListings.length} active listings after filtering`);
    
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase().trim();
    
    // Enhanced property-specific search patterns
    const propertyTerms = {
      bedroom: /(\d+)\s*(?:bed|bedroom)/i,
      bathroom: /(\d+)\s*(?:bath|bathroom)/i,
      sqft: /(\d+)\s*(?:sq\.?\s*ft\.?|square\s*feet?)/i,
      rent: /rent|rental|for\s*rent/i,
      sale: /sale|sell|for\s*sale|fsbo/i,
      house: /house|home|property/i,
      price: /\$?(\d+(?:,?\d+)*(?:k|000)?)/i
    };
    
    for (const listing of activeListings) {
      let baseScore = 0;
      let bonusScore = 0;
      
      // Calculate basic similarity scores
      const titleScore = calculateSimilarity(query, listing.title);
      const descriptionScore = listing.description ? 
        calculateSimilarity(query, listing.description) * 0.6 : 0;
      const addressScore = listing.address ? 
        calculateSimilarity(query, listing.address) * 0.4 : 0;
      
      baseScore = Math.max(titleScore, descriptionScore, addressScore);
      
      // Enhanced scoring for property-specific queries
      
      // Bedroom filter bonus
      const bedroomMatch = lowerQuery.match(propertyTerms.bedroom);
      if (bedroomMatch && listing.bedrooms !== null && listing.bedrooms !== undefined) {
        const requestedBedrooms = parseInt(bedroomMatch[1]);
        if (listing.bedrooms >= requestedBedrooms) {
          bonusScore += 25; // Significant bonus for bedroom match
          console.log(`[REAL ESTATE SEARCH DEBUG] Bedroom match bonus for listing ${listing.id}: ${requestedBedrooms} bedrooms (has ${listing.bedrooms})`);
        }
      }
      
      // Bathroom filter bonus
      const bathroomMatch = lowerQuery.match(propertyTerms.bathroom);
      if (bathroomMatch && listing.bathrooms !== null && listing.bathrooms !== undefined) {
        const requestedBathrooms = parseInt(bathroomMatch[1]);
        if (listing.bathrooms >= requestedBathrooms) {
          bonusScore += 25; // Significant bonus for bathroom match
          console.log(`[REAL ESTATE SEARCH DEBUG] Bathroom match bonus for listing ${listing.id}: ${requestedBathrooms} bathrooms (has ${listing.bathrooms})`);
        }
      }
      
      // Property type bonus
      if (propertyTerms.house.test(lowerQuery)) {
        if (['FSBO', 'Agent', 'Rent'].includes(listing.listingType)) {
          bonusScore += 25; // Increased from 15 to 25
          console.log(`[REAL ESTATE SEARCH DEBUG] House/property bonus for listing ${listing.id}`);
        }
      }
      
      // Listing type bonus
      if (propertyTerms.rent.test(lowerQuery) && listing.listingType === 'Rent') {
        bonusScore += 30; // Increased from 20 to 30
        console.log(`[REAL ESTATE SEARCH DEBUG] Rental bonus for listing ${listing.id}`);
      }
      if (propertyTerms.sale.test(lowerQuery) && ['FSBO', 'Agent'].includes(listing.listingType)) {
        bonusScore += 30; // Increased from 20 to 30
        console.log(`[REAL ESTATE SEARCH DEBUG] Sale bonus for listing ${listing.id}`);
      }
      
      // Additional contextual bonuses for common real estate queries
      if (lowerQuery.includes('houses for rent') && listing.listingType === 'Rent') {
        bonusScore += 20; // Extra bonus for exact phrase match
        console.log(`[REAL ESTATE SEARCH DEBUG] "Houses for rent" exact phrase bonus for listing ${listing.id}`);
      }
      if (lowerQuery.includes('houses for sale') && ['FSBO', 'Agent'].includes(listing.listingType)) {
        bonusScore += 20; // Extra bonus for exact phrase match
        console.log(`[REAL ESTATE SEARCH DEBUG] "Houses for sale" exact phrase bonus for listing ${listing.id}`);
      }
      
      const finalScore = baseScore + bonusScore;
      
      console.log(`[REAL ESTATE SEARCH DEBUG] Listing "${listing.title}" scores:`, {
        baseScore,
        bonusScore,
        finalScore,
        threshold: 65
      });
      
      if (finalScore > 65) {
        results.push({
          type: 'real-estate',
          id: listing.id,
          title: listing.title,
          excerpt: createExcerpt(listing.description || ''),
          url: `/for-sale/${listing.id}`,
          score: finalScore,
          metadata: {
            price: listing.price,
            listingType: listing.listingType,
            address: listing.address,
            category: listing.category,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            squareFeet: listing.squareFeet
          }
        });
      }
    }
    
    console.log(`[REAL ESTATE SEARCH DEBUG] Found ${results.length} matching real estate listings`);
    return results.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('[REAL ESTATE SEARCH ERROR]', error);
    logger.error('Error searching real estate:', error);
    return [];
  }
}

// Search community pages
async function searchCommunityPages(query: string): Promise<SearchResult[]> {
  try {
    console.log(`[COMMUNITY SEARCH DEBUG] Starting community page search for query: "${query}"`);
    const pages = await storage.getAllPageContents();
    console.log(`[COMMUNITY SEARCH DEBUG] Found ${pages.length} total pages`);
    const results: SearchResult[] = [];
    
    for (const page of pages) {
      // Skip vendor pages - they're handled by searchVendors
      if (page.slug?.includes('vendors-')) {
        continue;
      }
      
      const titleScore = calculateSimilarity(query, page.title);
      const contentScore = page.content ? 
        calculateSimilarity(query, page.content) * 0.7 : 0;
      
      const maxScore = Math.max(titleScore, contentScore);
      
      // Enhanced debug logging for problem queries
      if (query.toLowerCase().includes('bbrd') || query.toLowerCase().includes('palm bay city council comments')) {
        console.log(`[COMMUNITY SEARCH DEBUG] Page "${page.title}" (${page.slug})`);
        console.log(`  - Title: "${page.title}"`);
        console.log(`  - Title score: ${titleScore}`);
        console.log(`  - Content score: ${contentScore}`);
        console.log(`  - Max score: ${maxScore}`);
        console.log(`  - Above threshold (40): ${maxScore > 40}`);
      }
      
      if (maxScore > 70) {
        // Generate proper community URLs based on slug pattern
        let url = `/${page.slug}`;
        
        // Convert government-* slugs to /community/government/* format
        if (page.slug?.startsWith('government-')) {
          url = `/community/government/${page.slug.replace('government-', '')}`;
        }
        // Convert other community page patterns as needed
        else if (page.slug?.startsWith('safety-')) {
          url = `/community/safety/${page.slug.replace('safety-', '')}`;
        }
        else if (page.slug?.startsWith('amenities-')) {
          url = `/community/amenities/${page.slug.replace('amenities-', '')}`;
        }
        else if (page.slug?.startsWith('about-')) {
          url = `/community/about/${page.slug.replace('about-', '')}`;
        }
        
        results.push({
          type: 'community-page',
          id: page.id,
          title: page.title,
          excerpt: createExcerpt(page.content || ''),
          url: url,
          score: maxScore,
          metadata: {
            category: page.category,
            slug: page.slug
          }
        });
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error searching community pages:', error);
    return [];
  }
}

// Search vendor pages and categories with intelligent service classification
async function searchVendors(query: string): Promise<SearchResult[]> {
  try {
    console.log(`🔍 [VENDOR SEARCH DEBUG] Starting vendor search for: "${query}"`);
    const vendorCategories = await storage.getVendorCategories();
    console.log(`🔍 [VENDOR SEARCH DEBUG] Found ${vendorCategories.length} vendor categories`);
    
    const allPages = await storage.getAllPageContents();
    console.log(`🔍 [VENDOR SEARCH DEBUG] Loaded ${allPages.length} total pages`);
    
    const vendorPages = allPages.filter(page => {
      const isVendor = isVendorPage(page.slug, page.title);
      const isNotHidden = !page.isHidden; // Exclude vendors marked as hidden by admin
      return isVendor && isNotHidden;
    });
    console.log(`🔍 [VENDOR SEARCH DEBUG] Filtered to ${vendorPages.length} vendor pages (hidden vendors excluded)`);
    
    const results: SearchResult[] = [];
    
    // Service-based query mapping - map common service queries to vendor categories
    const serviceMapping: Record<string, string[]> = {
      // HVAC & Air Quality
      'hvac': ['hvac-and-air-quality'],
      'air conditioning': ['hvac-and-air-quality'],
      'heating': ['hvac-and-air-quality'],
      'cooling': ['hvac-and-air-quality'],
      'air quality': ['hvac-and-air-quality'],
      
      // Home Services  
      'cleaning': ['home-services'],
      'home cleaning': ['home-services'],
      'clean': ['home-services'],
      'house cleaning': ['home-services'],
      
      // Roofing
      'roofing': ['roofing'],
      'roof': ['roofing'],
      'roofer': ['roofing'],
      
      // Food & Dining
      'food': ['food-dining'],
      'dining': ['food-dining'],
      'restaurant': ['food-dining'],
      'pizza': ['food-dining'],
      'cafe': ['food-dining'],
      'bakery': ['food-dining'],
      
      // Beauty & Personal
      'beauty': ['beauty-personal'],
      'salon': ['beauty-personal'],
      'barber': ['beauty-personal'],
      'hair': ['beauty-personal'],
      'nails': ['beauty-personal'],
      
      // Health and Medical  
      'medical': ['health-and-medical'],
      'healthcare': ['health-and-medical'],
      'clinic': ['health-and-medical'],
      'doctor': ['health-and-medical'],
      'hospital': ['health-and-medical'],
      'med': ['health-and-medical'],
      'health': ['health-and-medical'],
      
      // Pest Control
      'pest': ['pest-control'],
      'pest control': ['pest-control'],
      'exterminator': ['pest-control'],
      
      // Landscaping
      'landscaping': ['landscaping'],
      'lawn': ['landscaping'],
      'lawn care': ['landscaping'],
      'grounds': ['landscaping'],
      
      // Automotive - Golf Carts
      'golf cart': ['automotive-golf-carts'],
      'automotive': ['automotive-golf-carts'],
      'cart': ['automotive-golf-carts'],
      'battery': ['automotive-golf-carts'],
      
      // Plumbing
      'plumbing': ['plumbing'],
      'plumber': ['plumbing'],
      
      // Real Estate & Senior Living
      'real estate': ['real-estate'],
      'property': ['real-estate'],
      'realtor': ['real-estate'],
      'homes': ['real-estate'],
      
      // Insurance & Financial
      'insurance': ['insurance-financial'],
      'financial': ['insurance-financial'],
      
      // Technology & Electronics
      'technology': ['technology-and-electronics'],
      'computer': ['technology-and-electronics'],
      'electronics': ['technology-and-electronics'],
      'tech': ['technology-and-electronics'],
      
      // Retail & Shops
      'retail': ['retail-shops'],
      'shopping': ['retail-shops'],
      'shops': ['retail-shops']
    };
    
    // Check if query matches any service keywords
    const lowerQuery = query.toLowerCase();
    let relevantCategorySlugs: string[] = [];
    
    for (const [keyword, categories] of Object.entries(serviceMapping)) {
      if (lowerQuery.includes(keyword)) {
        relevantCategorySlugs.push(...categories);
      }
    }
    
    // Remove duplicates
    relevantCategorySlugs = [...new Set(relevantCategorySlugs)];
    
    console.log(`🔍 [VENDOR SEARCH DEBUG] Service mapping found categories: ${relevantCategorySlugs.join(', ')}`);
    console.log(`🔍 [VENDOR SEARCH DEBUG] Query: "${query}" -> mapped to: [${relevantCategorySlugs.join(', ')}]`);
    
    // Search vendor categories first (for category-level queries)
    for (const category of vendorCategories) {
      const nameScore = calculateSimilarity(query, category.name);
      const slugScore = calculateSimilarity(query, category.slug) * 0.8;
      
      // Boost score if this category matches service mapping
      let boostScore = 0;
      if (relevantCategorySlugs.includes(category.slug)) {
        boostScore = 80; // HIGH boost for service-based queries to outrank events
        console.log(`🔍 [VENDOR SEARCH DEBUG] Service match boost for "${category.name}" (${category.slug}): +${boostScore}`);
      }
      
      const maxScore = Math.max(nameScore, slugScore) + boostScore;
      
      console.log(`🔍 [VENDOR SEARCH DEBUG] Category "${category.name}": nameScore=${nameScore}, slugScore=${slugScore}, boostScore=${boostScore}, maxScore=${maxScore}`);
      
      // Lower threshold for service-based queries (15 instead of 30)
      const threshold = relevantCategorySlugs.includes(category.slug) ? 15 : 30;
      
      if (maxScore > threshold) {
        results.push({
          type: 'vendor',
          id: `category-${category.id}`,
          title: `${category.name} Services`,
          excerpt: `Browse all ${category.name.toLowerCase()} vendors in Barefoot Bay`,
          url: `/vendors/${category.slug}`,
          score: maxScore,
          metadata: {
            type: 'category',
            categoryName: category.name,
            categorySlug: category.slug,
            serviceMatch: boostScore > 0
          }
        });
      }
    }
    
    // Search individual vendor pages
    for (const page of vendorPages) {
      const titleScore = calculateSimilarity(query, page.title);
      const contentScore = page.content ? 
        calculateSimilarity(query, page.content) * 0.7 : 0;
      
      // Extract vendor category for context
      const vendorCategory = extractVendorCategory(page.slug);
      let categoryBoost = 0;
      
      // Boost score if vendor is in a category that matches service mapping
      if (vendorCategory && relevantCategorySlugs.includes(vendorCategory)) {
        categoryBoost = 60; // Higher boost to outrank events
      }
      
      // Check if vendor page content contains service-related keywords
      let contentBoost = 0;
      if (page.content) {
        const contentLower = page.content.toLowerCase();
        for (const keyword of Object.keys(serviceMapping)) {
          if (contentLower.includes(keyword)) {
            contentBoost = Math.max(contentBoost, 15);
          }
        }
      }
      
      const maxScore = Math.max(titleScore, contentScore) + categoryBoost + contentBoost;
      
      if (maxScore > 70) {
        // Generate vendor URL from slug - convert database format to public URL format
        const vendorUrl = `/${dbSlugToPublicUrl(page.slug)}`;
        
        results.push({
          type: 'vendor',
          id: page.id,
          title: page.title,
          excerpt: createExcerpt(page.content || ''),
          url: vendorUrl,
          score: maxScore,
          metadata: {
            type: 'vendor',
            category: page.category,
            vendorCategory,
            slug: page.slug,
            serviceMatch: categoryBoost > 0 || contentBoost > 0
          }
        });
      }
    }
    
    console.log(`🔍 [VENDOR SEARCH DEBUG] Final results: ${results.length} vendor results found`);
    results.forEach((result, index) => {
      console.log(`🔍 [VENDOR SEARCH DEBUG] Result ${index + 1}: "${result.title}" (score: ${result.score}, url: ${result.url})`);
    });
    
    return results;
  } catch (error) {
    console.error('🔍 [VENDOR SEARCH DEBUG] Error in vendor search:', error);
    logger.error('Error searching vendors:', error);
    return [];
  }
}

// Handle special queries (weather, rocket launches, etc.)
async function handleSpecialQueries(query: string): Promise<SearchResult[]> {
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];
  
  // Weather query detection
  if (lowerQuery.includes('weather') || lowerQuery.includes('temperature') || 
      lowerQuery.includes('forecast') || lowerQuery.includes('rain')) {
    results.push({
      type: 'weather',
      id: 'current-weather',
      title: 'Current Weather in Barefoot Bay',
      excerpt: 'Get current weather conditions and forecast for Barefoot Bay, Florida',
      url: '#weather',
      score: 95,
      metadata: { specialType: 'weather' }
    });
  }
  
  // Rocket launch query detection
  if (lowerQuery.includes('rocket') || lowerQuery.includes('launch') || 
      lowerQuery.includes('spacex') || lowerQuery.includes('kennedy')) {
    results.push({
      type: 'rocket-launch',
      id: 'rocket-launches',
      title: 'Upcoming Rocket Launches',
      excerpt: 'View upcoming SpaceX and other rocket launches from Kennedy Space Center',
      url: '#rocket-launches',
      score: 95,
      metadata: { specialType: 'rocket-launch' }
    });
  }
  
  return results;
}

// Test endpoint to verify router is working
router.get('/test', async (req, res) => {
  try {
    const debugInfo: any = {
      message: 'Search router is working!',
      timestamp: new Date().toISOString()
    };
    
    // Test basic event search
    const events = await storage.getEvents();
    debugInfo.totalEvents = events.length;
    
    // Check first few events for pickleball content
    const pickleballEvents = events.filter(event => 
      event.title?.toLowerCase().includes('pickleball') ||
      event.description?.toLowerCase().includes('pickleball')
    );
    debugInfo.directPickleballEvents = pickleballEvents.length;
    debugInfo.samplePickleballEvents = pickleballEvents.slice(0, 3).map(e => ({
      id: e.id,
      title: e.title,
      description: e.description?.substring(0, 100) + '...'
    }));
    
    // Test detailed scoring for pickleball events
    debugInfo.scoringBreakdown = [];
    let scoreAbove0 = 0;
    let scoreAbove30 = 0;
    let processedCount = 0;
    
    for (let i = 0; i < Math.min(5, pickleballEvents.length); i++) {
      const event = pickleballEvents[i];
      const titleScore = calculateSimilarity('pickleball', event.title);
      const descScore = calculateSimilarity('pickleball', event.description || '');
      const score = Math.max(titleScore, descScore);
      
      // Calculate bonus score (simplified)
      let bonusScore = 0;
      if (event.category === 'sports') bonusScore += 15;
      
      const finalScore = score + bonusScore;
      
      if (score > 0) scoreAbove0++;
      if (finalScore > 30) scoreAbove30++;
      processedCount++;
      
      debugInfo.scoringBreakdown.push({
        eventId: event.id,
        eventTitle: event.title,
        titleScore: titleScore,
        descScore: descScore,
        maxScore: score,
        bonusScore: bonusScore,
        finalScore: finalScore,
        passesThreshold: finalScore > 30
      });
    }
    
    debugInfo.scoringSummary = {
      processedCount: processedCount,
      scoreAbove0: scoreAbove0,
      scoreAbove30: scoreAbove30
    };
    
    // Test searchEvents function directly
    const testResults = await searchEvents('pickleball');
    debugInfo.searchFunctionResults = testResults.length;
    debugInfo.sampleSearchResults = testResults.slice(0, 3);
    
    // Test similarity calculation directly
    const sampleEvent = events.find(e => e.title?.toLowerCase().includes('pickleball'));
    if (sampleEvent) {
      const similarity = calculateSimilarity('pickleball', sampleEvent.title);
      debugInfo.sampleSimilarityTest = {
        query: 'pickleball',
        eventTitle: sampleEvent.title,
        similarity: similarity
      };
    }
    
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({ 
      error: 'Search test failed',
      message: error.message 
    });
  }
});

// Main unified search endpoint
router.get('/', async (req, res) => {
  try {
    const validation = searchQuerySchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid search query',
        details: validation.error.errors
      });
    }
    
    const { q: query, limit, types } = validation.data;
    const searchTypes = types ? types.split(',') : ['event', 'forum', 'real-estate', 'vendor', 'community-page'];
    
    logger.info(`Search query: "${query}" with types: ${searchTypes.join(', ')}`);
    
    // Perform searches in parallel
    const searchPromises: Promise<SearchResult[]>[] = [];
    
    if (searchTypes.includes('event')) {
      searchPromises.push(searchEvents(query));
    }
    
    if (searchTypes.includes('forum')) {
      searchPromises.push(searchForumPosts(query));
    }
    
    if (searchTypes.includes('real-estate')) {
      searchPromises.push(searchRealEstate(query));
    }
    
    if (searchTypes.includes('vendor')) {
      searchPromises.push(searchVendors(query));
    }
    
    if (searchTypes.includes('community-page')) {
      searchPromises.push(searchCommunityPages(query));
    }
    
    // Always check for special queries
    searchPromises.push(handleSpecialQueries(query));
    
    const searchResults = await Promise.all(searchPromises);
    
    // Flatten and sort results by score
    let allResults = searchResults
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Enhanced AI backup search triggering logic
    let aiBackupUsed = false;
    let shouldTriggerAI = false;
    let triggerReason = "";
    
    // Calculate search quality metrics
    const bestScore = allResults.length > 0 ? Math.max(...allResults.map(r => r.score)) : 0;
    const avgScore = allResults.length > 0 ? allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length : 0;
    const queryComplexity = query.trim().split(/\s+/).length; // Number of words
    
    // Trigger AI backup search in multiple scenarios
    if (allResults.length === 0) {
      shouldTriggerAI = true;
      triggerReason = "No results found";
    } else if (bestScore < 75 && queryComplexity >= 2) {
      // Low quality results for multi-word queries (like "big romans pizza")
      shouldTriggerAI = true;
      triggerReason = `Poor quality results (best score: ${bestScore}) for multi-word query`;
    } else if (allResults.length <= 2 && avgScore < 85 && queryComplexity >= 2) {
      // Few results with mediocre scores for complex queries
      shouldTriggerAI = true;
      triggerReason = `Very few results (${allResults.length}) with mediocre scores (avg: ${Math.round(avgScore)})`;
    } else if (query.length > 10 && allResults.length <= 3 && bestScore < 90) {
      // Long queries should typically find good matches
      shouldTriggerAI = true;
      triggerReason = `Long query "${query.substring(0, 20)}..." with insufficient results`;
    }
    
    if (shouldTriggerAI) {
      console.log(`[AI BACKUP DEBUG] Triggering AI backup search: ${triggerReason}`);
      logger.info(`[AI BACKUP SEARCH] Triggering: ${triggerReason} for query "${query}"`);
      
      try {
        console.log(`[AI BACKUP DEBUG] About to call performAIBackupSearch with timeout...`);
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AI backup search timeout after 30 seconds')), 30000);
        });
        
        const aiSearchPromise = performAIBackupSearch(query);
        const aiResults = await Promise.race([aiSearchPromise, timeoutPromise]);
        
        console.log(`[AI BACKUP DEBUG] AI search completed, found ${aiResults.length} AI results`);
        logger.info(`[AI BACKUP SEARCH] Found ${aiResults.length} AI results`);
        
        // Merge AI results with existing results, removing duplicates and ranking by score
        if (aiResults.length > 0) {
          // Combine results and remove duplicates by URL
          const combinedResults = [...allResults, ...aiResults];
          const uniqueResults = combinedResults.filter((result, index, self) => 
            index === self.findIndex(r => r.url === result.url)
          );
          
          // Sort by score and take top results
          allResults = uniqueResults
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
          
          aiBackupUsed = true;
          console.log(`[AI BACKUP DEBUG] Merged results: ${allResults.length} total (${aiResults.length} from AI)`);
        }
      } catch (error) {
        console.error('[AI BACKUP DEBUG] AI search failed:', error);
        logger.error('[AI BACKUP SEARCH] Failed:', error);
        // Continue with existing results if AI search fails
      }
    } else {
      console.log(`[AI BACKUP DEBUG] AI backup not needed: ${allResults.length} results, best score: ${bestScore}`);
    }
    
    logger.info(`Search completed: ${allResults.length} results found`);
    
    res.json({
      query,
      results: allResults,
      totalCount: allResults.length,
      searchTypes,
      aiBackupUsed: aiBackupUsed || (allResults.length > 0 && allResults[0]?.metadata?.aiGenerated === true)
    });
    
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      error: 'Internal server error during search',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;