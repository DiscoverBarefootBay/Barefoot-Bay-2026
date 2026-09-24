import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { isPubliclyVisible } from './dmca/content-visibility';

// Share previews never expose hidden (DMCA/moderation) content: treat it as not found.
function publicOrUndefined<T>(row: T | undefined | null): T | undefined {
  return row && isPubliclyVisible(row as any) ? row : undefined;
}
import { 
  isSocialMediaCrawler, 
  generateHTMLWithOGTags, 
  stripHtml, 
  truncateText,
  normalizeImageUrl,
  extractFirstImageFromHtml
} from './og-tags-generator';
import { formatInTimeZone } from 'date-fns-tz';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache the base HTML template
let baseHtmlCache: string | null = null;

function getBaseHtml(): string {
  if (baseHtmlCache) {
    return baseHtmlCache;
  }
  
  try {
    const htmlPath = path.join(__dirname, '../client/index.html');
    baseHtmlCache = fs.readFileSync(htmlPath, 'utf-8');
    return baseHtmlCache;
  } catch (error) {
    console.error('Failed to read base HTML:', error);
    // Fallback minimal HTML
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BarefootBay.com</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
  }
}

export async function ogTagsMiddleware(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.get('user-agent') || '';
  
  // Only process for social media crawlers
  if (!isSocialMediaCrawler(userAgent)) {
    return next();
  }
  
  console.log(`🤖 Social media crawler detected: ${userAgent}`);
  console.log(`📍 Requested URL: ${req.path}`);
  
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const fullUrl = `${baseUrl}${req.path}`;
  
  try {
    // Handle Forum Posts: /forum/post/:postId
    const forumPostMatch = req.path.match(/^\/forum\/post\/(\d+)$/);
    if (forumPostMatch) {
      const postId = parseInt(forumPostMatch[1]);
      return await handleForumPost(postId, fullUrl, baseUrl, res, next);
    }
    
    // Handle Calendar Events: /events/:id
    const eventMatch = req.path.match(/^\/events\/(\d+)$/);
    if (eventMatch) {
      const eventId = parseInt(eventMatch[1]);
      return await handleCalendarEvent(eventId, fullUrl, baseUrl, res, next);
    }
    
    // Handle For Sale Listings: /for-sale/:id
    const forSaleMatch = req.path.match(/^\/for-sale\/(\d+)$/);
    if (forSaleMatch) {
      const listingId = parseInt(forSaleMatch[1]);
      return await handleForSaleListing(listingId, fullUrl, baseUrl, res, next);
    }
    
    // Handle Real Estate Listings: /real-estate/:id
    const realEstateMatch = req.path.match(/^\/real-estate\/(\d+)$/);
    if (realEstateMatch) {
      const listingId = parseInt(realEstateMatch[1]);
      return await handleRealEstateListing(listingId, fullUrl, baseUrl, res, next);
    }
    
    // Handle Vendor Pages: /vendors/:category/:vendor
    const vendorMatch = req.path.match(/^\/vendors\/([^\/]+)\/([^\/]+)$/);
    if (vendorMatch) {
      const category = vendorMatch[1];
      const vendor = vendorMatch[2];
      const fullSlug = `vendors-${category}-${vendor}`;
      console.log(`🤖 OG Tags: Vendor page detected - Category: ${category}, Vendor: ${vendor}, Full slug: ${fullSlug}`);
      return await handleVendorPage(fullSlug, fullUrl, baseUrl, res, next);
    }
    
    // Handle Community Pages: /community/:category/:page
    const communityMatch = req.path.match(/^\/community\/([^\/]+)\/([^\/]+)$/);
    if (communityMatch) {
      const category = communityMatch[1];
      const page = communityMatch[2];
      const fullSlug = `${category}-${page}`;
      console.log(`🤖 OG Tags: Community page detected - Category: ${category}, Page: ${page}, Full slug: ${fullSlug} (no 'community-' prefix)`);
      return await handleCommunityPage(fullSlug, fullUrl, baseUrl, res, next);
    }
    
    // Handle main pages with generic OG tags
    if (req.path === '/calendar') {
      return sendHtmlWithOGTags({
        title: 'Community Calendar - BarefootBay.com',
        description: 'Stay up-to-date with community events, activities, and gatherings in Barefoot Bay',
        url: fullUrl,
        image: `${baseUrl}/assets/DiscoverBFBText.png`,
      }, res);
    }
    
    if (req.path === '/forum') {
      return sendHtmlWithOGTags({
        title: 'Community Forum - BarefootBay.com',
        description: 'Join discussions and connect with your neighbors in the Barefoot Bay community forum',
        url: fullUrl,
        image: `${baseUrl}/assets/DiscoverBFBText.png`,
      }, res);
    }
    
    if (req.path === '/for-sale') {
      return sendHtmlWithOGTags({
        title: 'On The Market - BarefootBay.com',
        description: 'Browse items for sale in the Barefoot Bay community marketplace',
        url: fullUrl,
        image: `${baseUrl}/assets/DiscoverBFBText.png`,
      }, res);
    }
    
    if (req.path === '/vendors' || req.path.startsWith('/vendors/')) {
      return sendHtmlWithOGTags({
        title: 'Local Vendors - BarefootBay.com',
        description: 'Discover trusted local vendors and service providers in the Barefoot Bay area',
        url: fullUrl,
        image: `${baseUrl}/assets/DiscoverBFBText.png`,
      }, res);
    }
    
  } catch (error) {
    console.error('Error generating OG tags:', error);
  }
  
  // Continue to regular handler if no match
  next();
}

async function handleForumPost(postId: number, fullUrl: string, baseUrl: string, res: Response, next: NextFunction) {
  try {
    const post = publicOrUndefined(await storage.getForumPost(postId));
    
    if (!post) {
      console.log(`❌ OG Tags: Forum post ${postId} not found`);
      return next();
    }
    
    console.log(`✅ OG Tags: Found forum post - Title: "${post.title}", Media URLs: ${post.mediaUrls?.length || 0}`);
    
    // Get post content preview
    const contentPreview = stripHtml(post.content || '');
    const description = truncateText(contentPreview, 160);
    
    // Get first image from HTML content, then media URLs, then fallback
    let imageUrl: string | undefined;
    
    // First, try to extract image from HTML content
    const extractedImage = extractFirstImageFromHtml(post.content || '');
    if (extractedImage) {
      imageUrl = normalizeImageUrl(extractedImage, baseUrl);
      console.log(`🖼️ OG Tags: Using first image from HTML content: ${imageUrl}`);
    }
    
    // If no image in content, check mediaUrls
    if (!imageUrl && post.mediaUrls && post.mediaUrls.length > 0) {
      imageUrl = normalizeImageUrl(post.mediaUrls[0], baseUrl);
      console.log(`🖼️ OG Tags: Using first media URL: ${imageUrl}`);
    }
    
    // Final fallback to logo
    if (!imageUrl) {
      imageUrl = `${baseUrl}/assets/DiscoverBFBText.png`;
      console.log(`🖼️ OG Tags: Using fallback logo (no images found)`);
    }
    
    return sendHtmlWithOGTags({
      title: `${post.title} - Barefoot Bay Community Forum`,
      description: description || 'Join the discussion in the Barefoot Bay community forum',
      url: fullUrl,
      image: imageUrl,
      type: 'article',
      publishedTime: post.createdAt?.toISOString(),
    }, res);
  } catch (error) {
    console.error(`Error fetching forum post ${postId}:`, error);
    next();
  }
}

async function handleCalendarEvent(eventId: number, fullUrl: string, baseUrl: string, res: Response, next: NextFunction) {
  try {
    const event = publicOrUndefined(await storage.getEvent(eventId));
    
    if (!event) {
      return next();
    }
    
    // Format event date and time for OG tags using Florida timezone (America/New_York)
    // This matches exactly how the event page displays times
    const timezone = 'America/New_York';
    
    const eventDate = formatInTimeZone(
      new Date(event.startDate), 
      timezone, 
      'EEEE, MMMM d, yyyy'
    );
    
    const eventTime = formatInTimeZone(
      new Date(event.startDate), 
      timezone, 
      'h:mm a'
    );
    
    // Shorter date format for title (e.g., "Wed, Nov 5")
    const shortDate = formatInTimeZone(
      new Date(event.startDate), 
      timezone, 
      'EEE, MMM d'
    );
    
    // Full description with date, time, and location
    let description = `${eventDate} at ${eventTime}`;
    if (event.location) {
      description += ` • ${event.location}`;
    }
    if (event.description) {
      const descPreview = stripHtml(event.description);
      description += ` • ${truncateText(descPreview, 100)}`;
    }
    
    // Get event image
    let imageUrl: string | undefined;
    if (event.mediaUrls && event.mediaUrls.length > 0) {
      imageUrl = normalizeImageUrl(event.mediaUrls[0], baseUrl);
    }
    
    return sendHtmlWithOGTags({
      title: `${event.title} - ${shortDate} at ${eventTime}`,
      description: truncateText(description, 160),
      url: fullUrl,
      image: imageUrl,
      type: 'article',
      publishedTime: event.createdAt?.toISOString(),
    }, res);
  } catch (error) {
    console.error(`Error fetching event ${eventId}:`, error);
    next();
  }
}

async function handleForSaleListing(listingId: number, fullUrl: string, baseUrl: string, res: Response, next: NextFunction) {
  try {
    const listing = publicOrUndefined(await storage.getListing(listingId));
    
    if (!listing || (listing.listingType !== 'Classified' && listing.listingType !== 'GarageSale')) {
      console.log(`❌ OG Tags: For-sale listing ${listingId} not found or wrong type (listingType: ${listing?.listingType})`);
      return next();
    }
    
    console.log(`✅ OG Tags: Found for-sale listing - Title: "${listing.title}", Photos: ${listing.photos?.length || 0}`);
    
    // Format listing description
    let description = '';
    if (listing.price) {
      description = `$${listing.price}`;
    }
    if (listing.description) {
      const descPreview = stripHtml(listing.description);
      description += ` • ${truncateText(descPreview, 120)}`;
    }
    
    // Get listing image, use fallback if not available
    let imageUrl: string | undefined;
    if (listing.photos && listing.photos.length > 0) {
      imageUrl = normalizeImageUrl(listing.photos[0], baseUrl);
      console.log(`🖼️ OG Tags: Using first photo from gallery: ${imageUrl}`);
    } else {
      imageUrl = `${baseUrl}/assets/DiscoverBFBText.png`;
      console.log(`🖼️ OG Tags: Using fallback logo (no photos): ${imageUrl}`);
    }
    
    return sendHtmlWithOGTags({
      title: `${listing.title} - On The Market in Barefoot Bay`,
      description: truncateText(description, 160) || 'Item for sale in Barefoot Bay community',
      url: fullUrl,
      image: imageUrl,
      type: 'product',
      publishedTime: listing.createdAt?.toISOString(),
    }, res);
  } catch (error) {
    console.error(`Error fetching for-sale listing ${listingId}:`, error);
    next();
  }
}

async function handleRealEstateListing(listingId: number, fullUrl: string, baseUrl: string, res: Response, next: NextFunction) {
  try {
    const listing = publicOrUndefined(await storage.getListing(listingId));
    
    const realEstateTypes = ['FSBO', 'Agent', 'Rent', 'OpenHouse', 'Wanted'];
    if (!listing || !realEstateTypes.includes(listing.listingType)) {
      console.log(`❌ OG Tags: Real estate listing ${listingId} not found or wrong type (listingType: ${listing?.listingType})`);
      return next();
    }
    
    console.log(`✅ OG Tags: Found real estate listing - Title: "${listing.title}", Photos: ${listing.photos?.length || 0}`);
    
    // Format listing description
    let description = '';
    if (listing.price) {
      description = `$${listing.price.toLocaleString()}`;
    }
    if (listing.bedrooms || listing.bathrooms) {
      description += ` • ${listing.bedrooms || 0} bed, ${listing.bathrooms || 0} bath`;
    }
    if (listing.description) {
      const descPreview = stripHtml(listing.description);
      description += ` • ${truncateText(descPreview, 100)}`;
    }
    
    // Get listing image, use fallback if not available
    let imageUrl: string | undefined;
    if (listing.photos && listing.photos.length > 0) {
      imageUrl = normalizeImageUrl(listing.photos[0], baseUrl);
      console.log(`🖼️ OG Tags: Using first photo from gallery: ${imageUrl}`);
    } else {
      imageUrl = `${baseUrl}/assets/DiscoverBFBText.png`;
      console.log(`🖼️ OG Tags: Using fallback logo (no photos): ${imageUrl}`);
    }
    
    return sendHtmlWithOGTags({
      title: `${listing.title} - Real Estate in Barefoot Bay`,
      description: truncateText(description, 160) || 'Property for sale in Barefoot Bay',
      url: fullUrl,
      image: imageUrl,
      type: 'product',
      publishedTime: listing.createdAt?.toISOString(),
    }, res);
  } catch (error) {
    console.error(`Error fetching real estate listing ${listingId}:`, error);
    next();
  }
}

async function handleVendorPage(vendorSlug: string, fullUrl: string, baseUrl: string, res: Response, next: NextFunction) {
  try {
    console.log(`🔍 OG Tags: Looking up vendor page with slug: "${vendorSlug}"`);
    
    // Fetch the vendor page content
    const pageContent = publicOrUndefined(await storage.getPageContent(vendorSlug, true));
    
    if (!pageContent) {
      console.log(`❌ OG Tags: Vendor page not found for slug: "${vendorSlug}"`);
      return next();
    }
    
    console.log(`✅ OG Tags: Found vendor page - Title: "${pageContent.title}", Has content: ${!!pageContent.content}, Media URLs: ${pageContent.mediaUrls?.length || 0}`);
    
    // Extract title and description
    const title = pageContent.title || vendorSlug.replace(/-/g, ' ');
    const contentPreview = stripHtml(pageContent.content || '');
    const description = truncateText(contentPreview, 160) || 'Local vendor in Barefoot Bay community';
    
    // Try to extract first image from HTML content
    let imageUrl: string | undefined;
    const extractedImage = extractFirstImageFromHtml(pageContent.content || '');
    
    if (extractedImage) {
      // Normalize the extracted image URL
      imageUrl = normalizeImageUrl(extractedImage, baseUrl);
      console.log(`🖼️ OG Tags: Using extracted image from content: ${imageUrl}`);
    } else if (pageContent.mediaUrls && pageContent.mediaUrls.length > 0) {
      // Fall back to mediaUrls if available
      imageUrl = normalizeImageUrl(pageContent.mediaUrls[0], baseUrl);
      console.log(`🖼️ OG Tags: Using mediaUrls image: ${imageUrl}`);
    } else {
      // Final fallback to logo
      imageUrl = `${baseUrl}/assets/DiscoverBFBText.png`;
      console.log(`🖼️ OG Tags: Using fallback logo: ${imageUrl}`);
    }
    
    console.log(`📤 OG Tags: Sending response with title="${title}", image="${imageUrl}"`);
    
    return sendHtmlWithOGTags({
      title: `${title} - Barefoot Bay Vendors`,
      description,
      url: fullUrl,
      image: imageUrl,
      type: 'website',
    }, res);
  } catch (error) {
    console.error(`❌ OG Tags: Error fetching vendor page ${vendorSlug}:`, error);
    next();
  }
}

async function handleCommunityPage(pageSlug: string, fullUrl: string, baseUrl: string, res: Response, next: NextFunction) {
  try {
    console.log(`🔍 OG Tags: Looking up community page with slug: "${pageSlug}"`);
    
    // Fetch the community page content
    const pageContent = publicOrUndefined(await storage.getPageContent(pageSlug, true));
    
    if (!pageContent) {
      console.log(`❌ OG Tags: Community page not found for slug: "${pageSlug}"`);
      return next();
    }
    
    console.log(`✅ OG Tags: Found community page - Title: "${pageContent.title}", Has content: ${!!pageContent.content}, Media URLs: ${pageContent.mediaUrls?.length || 0}`);
    
    // Extract title and description
    const title = pageContent.title || pageSlug.replace(/-/g, ' ');
    const contentPreview = stripHtml(pageContent.content || '');
    const description = truncateText(contentPreview, 160) || 'Community information for Barefoot Bay residents';
    
    // Try to extract first image from HTML content
    let imageUrl: string | undefined;
    const extractedImage = extractFirstImageFromHtml(pageContent.content || '');
    
    if (extractedImage) {
      // Normalize the extracted image URL
      imageUrl = normalizeImageUrl(extractedImage, baseUrl);
      console.log(`🖼️ OG Tags: Using extracted image from content: ${imageUrl}`);
    } else if (pageContent.mediaUrls && pageContent.mediaUrls.length > 0) {
      // Fall back to mediaUrls if available
      imageUrl = normalizeImageUrl(pageContent.mediaUrls[0], baseUrl);
      console.log(`🖼️ OG Tags: Using mediaUrls image: ${imageUrl}`);
    } else {
      // Final fallback to logo
      imageUrl = `${baseUrl}/assets/DiscoverBFBText.png`;
      console.log(`🖼️ OG Tags: Using fallback logo: ${imageUrl}`);
    }
    
    console.log(`📤 OG Tags: Sending response with title="${title}", image="${imageUrl}"`);
    
    return sendHtmlWithOGTags({
      title: `${title} - Barefoot Bay Community`,
      description,
      url: fullUrl,
      image: imageUrl,
      type: 'article',
    }, res);
  } catch (error) {
    console.error(`❌ OG Tags: Error fetching community page ${pageSlug}:`, error);
    next();
  }
}

function sendHtmlWithOGTags(options: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  author?: string;
  publishedTime?: string;
}, res: Response) {
  const baseHtml = getBaseHtml();
  const htmlWithOGTags = generateHTMLWithOGTags(options, baseHtml);
  
  res.set('Content-Type', 'text/html');
  res.send(htmlWithOGTags);
}
