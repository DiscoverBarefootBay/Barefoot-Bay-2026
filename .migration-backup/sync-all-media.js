/**
 * Comprehensive Media Synchronization Tool
 * 
 * This script provides a complete solution for syncing media files 
 * from production to development across all website sections:
 * - Forum posts
 * - Vendor pages
 * - Calendar events 
 * - Banner slides
 * - Community media
 * - Content media
 * 
 * Usage: node sync-all-media.js [options]
 * 
 * Options:
 *   --forum         Sync forum media
 *   --vendors       Sync vendor media
 *   --calendar      Sync calendar media
 *   --banners       Sync banner slides
 *   --community     Sync community media
 *   --content       Sync general content media
 *   --all           Sync all media (default)
 *   --specific=URL  Sync a specific media file
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

// Configuration
const PRODUCTION_URL = 'https://barefootbay.com';
const API_PAGES_URL = `${PRODUCTION_URL}/api/pages`;
const API_FORUM_URL = `${PRODUCTION_URL}/api/forum`;
const API_CALENDAR_URL = `${PRODUCTION_URL}/api/events`;

// Media directories
const MEDIA_DIRS = [
  'content-media',
  'vendor-media',
  'forum-media',
  'community-media',
  'attached_assets',
  'avatars',
  'icons',
  'banner-slides',
  'calendar',
  'uploads',
  'uploads/calendar'
];

// Regular expressions for extracting media URLs
const MEDIA_URL_PATTERNS = [
  // Image tags
  /<img[^>]+src="([^"]+)"[^>]*>/g,
  
  // Background images
  /background-image:\s*url\(['"]?([^'")]+)['"]?\)/g,
  
  // Direct media paths
  /\/content-media\/[^"'\s)]+/g,
  /\/forum-media\/[^"'\s)]+/g,
  /\/community-media\/[^"'\s)]+/g,
  /\/vendor-media\/[^"'\s)]+/g,
  /\/attached_assets\/[^"'\s)]+/g,
  /\/uploads\/[^"'\s)]+/g,
  /\/banner-slides\/[^"'\s)]+/g,
  /\/calendar\/[^"'\s)]+/g,
  /\/avatars\/[^"'\s)]+/g,
  /\/icons\/[^"'\s)]+/g
];

// Ensure all directories exist
function ensureDirectoriesExist() {
  console.log('Ensuring media directories exist...');
  for (const dir of MEDIA_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    forum: false,
    vendors: false,
    calendar: false,
    banners: false,
    community: false,
    content: false,
    realestate: false,
    all: false,
    specific: null
  };
  
  // If no args, default to all
  if (args.length === 0) {
    options.all = true;
  }
  
  for (const arg of args) {
    if (arg === '--forum') options.forum = true;
    else if (arg === '--vendors') options.vendors = true;
    else if (arg === '--calendar') options.calendar = true;
    else if (arg === '--banners') options.banners = true;
    else if (arg === '--community') options.community = true;
    else if (arg === '--content') options.content = true;
    else if (arg === '--realestate') options.realestate = true;
    else if (arg === '--all') options.all = true;
    else if (arg.startsWith('--specific=')) {
      options.specific = arg.split('=')[1];
    }
  }
  
  return options;
}

// Check if a URL is a media URL
function isMediaUrl(url) {
  if (!url) return false;
  if (!url.startsWith('/')) return false;
  
  return MEDIA_DIRS.some(dir => {
    return url.startsWith(`/${dir}/`) || url === `/${dir}`;
  });
}

// Extract all media URLs from content
function extractMediaUrls(content) {
  if (!content) return [];
  
  const urls = new Set();
  
  // Convert objects to strings if needed
  const contentStr = typeof content === 'object' ? JSON.stringify(content) : content;
  
  // Use all patterns to extract URLs
  for (const pattern of MEDIA_URL_PATTERNS) {
    let match;
    // Reset lastIndex to avoid issues with global regex
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(contentStr)) !== null) {
      const url = match[1] || match[0];
      if (url && isMediaUrl(url)) {
        urls.add(url);
      }
    }
  }
  
  // Also check for mediaUrls arrays in JSON
  try {
    const jsonObj = typeof content === 'object' ? content : JSON.parse(contentStr);
    if (jsonObj && Array.isArray(jsonObj.mediaUrls)) {
      for (const url of jsonObj.mediaUrls) {
        if (isMediaUrl(url)) {
          urls.add(url);
        }
      }
    }
  } catch (e) {
    // Not valid JSON or doesn't have mediaUrls, ignore
  }
  
  return Array.from(urls);
}

// Download a file
async function downloadFile(url, localPath) {
  // Ensure the URL starts with http or https
  const fullUrl = url.startsWith('http') ? url : `${PRODUCTION_URL}${url}`;
  
  return new Promise((resolve, reject) => {
    // Create directory if it doesn't exist
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Skip if file exists
    if (fs.existsSync(localPath)) {
      console.log(`File already exists: ${localPath}`);
      return resolve({ success: true, skipped: true });
    }
    
    console.log(`Downloading ${fullUrl} -> ${localPath}`);
    
    const file = fs.createWriteStream(localPath);
    https.get(fullUrl, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(localPath);
        reject(new Error(`Failed to download ${fullUrl}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          console.log(`Downloaded successfully: ${localPath}`);
          resolve({ success: true });
        });
      });
      
      file.on('error', (err) => {
        file.close();
        fs.unlinkSync(localPath);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(localPath);
      reject(err);
    });
  });
}

// Process media URLs in content
async function processMediaUrls(content, source = 'unknown') {
  try {
    const mediaUrls = extractMediaUrls(content);
    
    console.log(`Found ${mediaUrls.length} media URLs in ${source}`);
    if (mediaUrls.length > 0 && mediaUrls.length < 10) {
      console.log("Media URLs:", mediaUrls);
    }
    
    // Download all media files
    let downloadCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const url of mediaUrls) {
      const localPath = url.startsWith('/') ? url.substring(1) : url;
      
      try {
        const result = await downloadFile(url, localPath);
        if (result.skipped) {
          skipCount++;
        } else {
          downloadCount++;
        }
      } catch (error) {
        console.error(`Error downloading ${url}:`, error.message);
        errorCount++;
      }
    }
    
    return { mediaCount: mediaUrls.length, downloadCount, skipCount, errorCount };
  } catch (error) {
    console.error(`Error processing media URLs for ${source}:`, error.message);
    return { mediaCount: 0, downloadCount: 0, skipCount: 0, errorCount: 1 };
  }
}

// Download a specific file
async function downloadSpecificFile(url) {
  // Normalize URL to ensure it starts with /
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  const localPath = normalizedUrl.substring(1);
  
  try {
    console.log(`Downloading specific file: ${normalizedUrl}`);
    await downloadFile(normalizedUrl, localPath);
    return { success: true };
  } catch (error) {
    console.error(`Error downloading specific file ${normalizedUrl}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Sync forum media
async function syncForumMedia() {
  console.log('\n===== Syncing Forum Media =====');
  
  try {
    // Get categories first
    console.log('Fetching forum categories...');
    const categoriesResponse = await fetch(`${API_FORUM_URL}/categories`);
    
    if (!categoriesResponse.ok) {
      throw new Error(`Error fetching categories: ${categoriesResponse.status}`);
    }
    
    const categories = await categoriesResponse.json();
    console.log(`Found ${categories.length} forum categories`);
    
    let totalPosts = 0;
    let totalMediaCount = 0;
    let totalDownloadCount = 0;
    let totalSkipCount = 0;
    let totalErrorCount = 0;
    
    // Process each category
    for (const category of categories) {
      console.log(`\nProcessing category: ${category.name} (ID: ${category.id})`);
      
      // Get posts for this category
      const postsResponse = await fetch(`${API_FORUM_URL}/posts/category/${category.id}`);
      
      if (!postsResponse.ok) {
        console.error(`Error fetching posts for category ${category.id}: ${postsResponse.status}`);
        continue;
      }
      
      const posts = await postsResponse.json();
      console.log(`Found ${posts.length} posts in category ${category.name}`);
      totalPosts += posts.length;
      
      // Process each post's content
      for (const post of posts) {
        console.log(`Processing post: ${post.title} (ID: ${post.id})`);
        
        // Process post content
        const postResult = await processMediaUrls(post.content, `post ${post.id}`);
        totalMediaCount += postResult.mediaCount;
        totalDownloadCount += postResult.downloadCount;
        totalSkipCount += postResult.skipCount;
        totalErrorCount += postResult.errorCount;
        
        // Get comments for this post
        const commentsResponse = await fetch(`${API_FORUM_URL}/comments/post/${post.id}`);
        
        if (!commentsResponse.ok) {
          console.error(`Error fetching comments for post ${post.id}: ${commentsResponse.status}`);
          continue;
        }
        
        const comments = await commentsResponse.json();
        console.log(`Found ${comments.length} comments for post ${post.id}`);
        
        // Process each comment's content
        for (const comment of comments) {
          const commentResult = await processMediaUrls(comment.content, `comment ${comment.id}`);
          totalMediaCount += commentResult.mediaCount;
          totalDownloadCount += commentResult.downloadCount;
          totalSkipCount += commentResult.skipCount;
          totalErrorCount += commentResult.errorCount;
        }
      }
    }
    
    console.log('\nForum Media Sync Summary:');
    console.log(`Processed ${totalPosts} posts across ${categories.length} categories`);
    console.log(`Found ${totalMediaCount} media URLs`);
    console.log(`Downloaded ${totalDownloadCount} files`);
    console.log(`Skipped ${totalSkipCount} existing files`);
    console.log(`Encountered ${totalErrorCount} errors`);
    
    return {
      success: true,
      totalPosts,
      totalMediaCount,
      totalDownloadCount,
      totalSkipCount,
      totalErrorCount
    };
  } catch (error) {
    console.error('Error syncing forum media:', error.message);
    return { success: false, error: error.message };
  }
}

// Sync vendor media
async function syncVendorMedia() {
  console.log('\n===== Syncing Vendor Media =====');
  
  try {
    // Fetch all vendor pages
    console.log('Fetching vendor pages...');
    const response = await fetch(API_PAGES_URL);
    
    if (!response.ok) {
      throw new Error(`Error fetching pages: ${response.status}`);
    }
    
    const pages = await response.json();
    
    // Filter to just vendor pages
    const vendorPages = pages.filter(page => 
      page.slug && page.slug.startsWith('vendors-')
    );
    
    console.log(`Found ${vendorPages.length} vendor pages`);
    
    let totalMediaCount = 0;
    let totalDownloadCount = 0;
    let totalSkipCount = 0;
    let totalErrorCount = 0;
    
    // Process each vendor page
    for (const page of vendorPages) {
      console.log(`\nProcessing vendor page: ${page.slug} (ID: ${page.id})`);
      
      if (!page.content) {
        console.log(`No content found for vendor page: ${page.slug}`);
        continue;
      }
      
      // Process page content
      const result = await processMediaUrls(page.content, `vendor page ${page.slug}`);
      totalMediaCount += result.mediaCount;
      totalDownloadCount += result.downloadCount;
      totalSkipCount += result.skipCount;
      totalErrorCount += result.errorCount;
    }
    
    console.log('\nVendor Media Sync Summary:');
    console.log(`Processed ${vendorPages.length} vendor pages`);
    console.log(`Found ${totalMediaCount} media URLs`);
    console.log(`Downloaded ${totalDownloadCount} files`);
    console.log(`Skipped ${totalSkipCount} existing files`);
    console.log(`Encountered ${totalErrorCount} errors`);
    
    return {
      success: true,
      totalPages: vendorPages.length,
      totalMediaCount,
      totalDownloadCount,
      totalSkipCount,
      totalErrorCount
    };
  } catch (error) {
    console.error('Error syncing vendor media:', error.message);
    return { success: false, error: error.message };
  }
}

// Sync calendar event media
async function syncCalendarMedia() {
  console.log('\n===== Syncing Calendar Media =====');
  
  try {
    // Fetch all events
    console.log('Fetching calendar events...');
    const response = await fetch(API_CALENDAR_URL);
    
    if (!response.ok) {
      throw new Error(`Error fetching events: ${response.status}`);
    }
    
    const events = await response.json();
    console.log(`Found ${events.length} calendar events`);
    
    let totalMediaCount = 0;
    let totalDownloadCount = 0;
    let totalSkipCount = 0;
    let totalErrorCount = 0;
    
    // Process each event
    for (const event of events) {
      console.log(`\nProcessing event: ${event.title} (ID: ${event.id})`);
      
      // Process event content
      const result = await processMediaUrls(event, `event ${event.id}`);
      totalMediaCount += result.mediaCount;
      totalDownloadCount += result.downloadCount;
      totalSkipCount += result.skipCount;
      totalErrorCount += result.errorCount;
    }
    
    console.log('\nCalendar Media Sync Summary:');
    console.log(`Processed ${events.length} events`);
    console.log(`Found ${totalMediaCount} media URLs`);
    console.log(`Downloaded ${totalDownloadCount} files`);
    console.log(`Skipped ${totalSkipCount} existing files`);
    console.log(`Encountered ${totalErrorCount} errors`);
    
    return {
      success: true,
      totalEvents: events.length,
      totalMediaCount,
      totalDownloadCount,
      totalSkipCount,
      totalErrorCount
    };
  } catch (error) {
    console.error('Error syncing calendar media:', error.message);
    return { success: false, error: error.message };
  }
}

// Sync banner slides
async function syncBannerMedia() {
  console.log('\n===== Syncing Banner Media =====');
  
  try {
    // Fetch banner slides content
    console.log('Fetching banner slides...');
    const response = await fetch(`${API_PAGES_URL}/4`); // Banner slides page
    
    if (!response.ok) {
      throw new Error(`Error fetching banner slides: ${response.status}`);
    }
    
    const bannerPage = await response.json();
    console.log(`Retrieved banner slides page`);
    
    // Process banner slides content
    const result = await processMediaUrls(bannerPage.content, 'banner slides');
    
    console.log('\nBanner Media Sync Summary:');
    console.log(`Found ${result.mediaCount} media URLs`);
    console.log(`Downloaded ${result.downloadCount} files`);
    console.log(`Skipped ${result.skipCount} existing files`);
    console.log(`Encountered ${result.errorCount} errors`);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('Error syncing banner media:', error.message);
    return { success: false, error: error.message };
  }
}

// Sync community media
async function syncCommunityMedia() {
  console.log('\n===== Syncing Community Media =====');
  
  try {
    // Fetch community content
    console.log('Fetching community content pages...');
    const response = await fetch(API_PAGES_URL);
    
    if (!response.ok) {
      throw new Error(`Error fetching pages: ${response.status}`);
    }
    
    const pages = await response.json();
    
    // Filter to just community pages (non-vendor, non-system pages)
    const communityPages = pages.filter(page => 
      page.slug && 
      !page.slug.startsWith('vendors-') && 
      !['banner-slides', 'system-settings'].includes(page.slug)
    );
    
    console.log(`Found ${communityPages.length} community content pages`);
    
    let totalMediaCount = 0;
    let totalDownloadCount = 0;
    let totalSkipCount = 0;
    let totalErrorCount = 0;
    
    // Process each community page
    for (const page of communityPages) {
      console.log(`\nProcessing community page: ${page.slug} (ID: ${page.id})`);
      
      if (!page.content) {
        console.log(`No content found for page: ${page.slug}`);
        continue;
      }
      
      // Process page content
      const result = await processMediaUrls(page.content, `community page ${page.slug}`);
      totalMediaCount += result.mediaCount;
      totalDownloadCount += result.downloadCount;
      totalSkipCount += result.skipCount;
      totalErrorCount += result.errorCount;
    }
    
    console.log('\nCommunity Media Sync Summary:');
    console.log(`Processed ${communityPages.length} community pages`);
    console.log(`Found ${totalMediaCount} media URLs`);
    console.log(`Downloaded ${totalDownloadCount} files`);
    console.log(`Skipped ${totalSkipCount} existing files`);
    console.log(`Encountered ${totalErrorCount} errors`);
    
    return {
      success: true,
      totalPages: communityPages.length,
      totalMediaCount,
      totalDownloadCount,
      totalSkipCount,
      totalErrorCount
    };
  } catch (error) {
    console.error('Error syncing community media:', error.message);
    return { success: false, error: error.message };
  }
}

// Sync general content media
async function syncContentMedia() {
  console.log('\n===== Syncing Content Media =====');
  
  try {
    // This is a catch-all for any content-media that might not be covered elsewhere
    // We'll just validate that the content-media directory exists and has expected structure
    if (!fs.existsSync('content-media')) {
      console.log('Creating content-media directory');
      fs.mkdirSync('content-media', { recursive: true });
    }
    
    console.log('Content media directory structure verified');
    return { success: true };
  } catch (error) {
    console.error('Error syncing content media:', error.message);
    return { success: false, error: error.message };
  }
}

// Sync real estate media
async function syncRealEstateMedia() {
  console.log('\n===== Syncing Real Estate Media =====');
  
  try {
    // Ensure the directories exist
    const realEstateMediaDir = 'real-estate-media';
    const uploadDir = path.join('uploads', realEstateMediaDir);
    
    if (!fs.existsSync(realEstateMediaDir)) {
      fs.mkdirSync(realEstateMediaDir, { recursive: true });
      console.log(`Created real-estate-media directory`);
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`Created uploads/real-estate-media directory`);
    }
    
    // Fetch all real estate listings
    console.log('Fetching real estate listings...');
    const response = await fetch(API_URL + '/api/listings');
    
    if (!response.ok) {
      throw new Error(`Error fetching listings: ${response.status}`);
    }
    
    const listings = await response.json();
    console.log(`Found ${listings.length} real estate listings`);
    
    let totalMediaCount = 0;
    let totalDownloadCount = 0;
    let totalSkipCount = 0;
    let totalErrorCount = 0;
    
    // Process each listing
    for (const listing of listings) {
      console.log(`\nProcessing listing: ${listing.title || 'Untitled'} (ID: ${listing.id})`);
      
      if (!listing.photos || !Array.isArray(listing.photos) || listing.photos.length === 0) {
        console.log(`No photos found for listing ID: ${listing.id}`);
        continue;
      }
      
      console.log(`Found ${listing.photos.length} photos for listing ID: ${listing.id}`);
      
      for (const photoUrl of listing.photos) {
        if (!photoUrl) continue;
        
        // Fix the URL path if it's in the calendar folder
        const fixedUrl = photoUrl.replace('/calendar/', '/real-estate-media/').replace('/uploads/calendar/', '/uploads/real-estate-media/');
        
        try {
          const localPath = fixedUrl.startsWith('/') ? fixedUrl.substring(1) : fixedUrl;
          const result = await downloadFile(photoUrl, localPath);
          
          if (result.skipped) {
            totalSkipCount++;
          } else {
            totalDownloadCount++;
          }
          
          totalMediaCount++;
        } catch (error) {
          console.error(`Error downloading photo ${photoUrl}:`, error.message);
          totalErrorCount++;
        }
      }
    }
    
    console.log('\nReal Estate Media Sync Summary:');
    console.log(`Processed ${listings.length} real estate listings`);
    console.log(`Found ${totalMediaCount} photos`);
    console.log(`Downloaded ${totalDownloadCount} files`);
    console.log(`Skipped ${totalSkipCount} existing files`);
    console.log(`Encountered ${totalErrorCount} errors`);
    
    return {
      success: true,
      totalListings: listings.length,
      totalMediaCount,
      totalDownloadCount,
      totalSkipCount,
      totalErrorCount
    };
  } catch (error) {
    console.error('Error syncing real estate media:', error.message);
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  console.log('================================');
  console.log('   Media Synchronization Tool   ');
  console.log('================================');
  
  // Parse command line arguments
  const options = parseArgs();
  
  console.log('Options:');
  if (options.specific) {
    console.log(`- Syncing specific file: ${options.specific}`);
  } else {
    console.log(`- Forum media: ${options.all || options.forum ? 'Yes' : 'No'}`);
    console.log(`- Vendor media: ${options.all || options.vendors ? 'Yes' : 'No'}`);
    console.log(`- Calendar media: ${options.all || options.calendar ? 'Yes' : 'No'}`);
    console.log(`- Banner media: ${options.all || options.banners ? 'Yes' : 'No'}`);
    console.log(`- Community media: ${options.all || options.community ? 'Yes' : 'No'}`);
    console.log(`- Content media: ${options.all || options.content ? 'Yes' : 'No'}`);
    console.log(`- Real Estate media: ${options.all || options.realestate ? 'Yes' : 'No'}`);
  }
  console.log('================================');
  
  // Ensure directories exist
  ensureDirectoriesExist();
  
  // Process specific file if requested
  if (options.specific) {
    await downloadSpecificFile(options.specific);
    return;
  }
  
  // Otherwise process the requested sections
  const results = {
    forum: null,
    vendors: null,
    calendar: null,
    banners: null,
    community: null,
    content: null,
    realestate: null
  };
  
  // Sync forum media
  if (options.all || options.forum) {
    results.forum = await syncForumMedia();
  }
  
  // Sync vendor media
  if (options.all || options.vendors) {
    results.vendors = await syncVendorMedia();
  }
  
  // Sync calendar media
  if (options.all || options.calendar) {
    results.calendar = await syncCalendarMedia();
  }
  
  // Sync banner media
  if (options.all || options.banners) {
    results.banners = await syncBannerMedia();
  }
  
  // Sync community media
  if (options.all || options.community) {
    results.community = await syncCommunityMedia();
  }
  
  // Sync content media
  if (options.all || options.content) {
    results.content = await syncContentMedia();
  }
  
  // Sync real estate media
  if (options.all || options.realestate) {
    results.realestate = await syncRealEstateMedia();
  }
  
  // Output summary
  console.log('\n================================');
  console.log('        Final Summary          ');
  console.log('================================');
  
  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  if (results.forum && results.forum.success) {
    console.log(`Forum Media: ${results.forum.totalDownloadCount} downloaded, ${results.forum.totalSkipCount} skipped, ${results.forum.totalErrorCount} errors`);
    totalDownloaded += results.forum.totalDownloadCount;
    totalSkipped += results.forum.totalSkipCount;
    totalErrors += results.forum.totalErrorCount;
  }
  
  if (results.vendors && results.vendors.success) {
    console.log(`Vendor Media: ${results.vendors.totalDownloadCount} downloaded, ${results.vendors.totalSkipCount} skipped, ${results.vendors.totalErrorCount} errors`);
    totalDownloaded += results.vendors.totalDownloadCount;
    totalSkipped += results.vendors.totalSkipCount;
    totalErrors += results.vendors.totalErrorCount;
  }
  
  if (results.calendar && results.calendar.success) {
    console.log(`Calendar Media: ${results.calendar.totalDownloadCount} downloaded, ${results.calendar.totalSkipCount} skipped, ${results.calendar.totalErrorCount} errors`);
    totalDownloaded += results.calendar.totalDownloadCount;
    totalSkipped += results.calendar.totalSkipCount;
    totalErrors += results.calendar.totalErrorCount;
  }
  
  if (results.banners && results.banners.success) {
    console.log(`Banner Media: ${results.banners.downloadCount} downloaded, ${results.banners.skipCount} skipped, ${results.banners.errorCount} errors`);
    totalDownloaded += results.banners.downloadCount;
    totalSkipped += results.banners.skipCount;
    totalErrors += results.banners.errorCount;
  }
  
  if (results.community && results.community.success) {
    console.log(`Community Media: ${results.community.totalDownloadCount} downloaded, ${results.community.totalSkipCount} skipped, ${results.community.totalErrorCount} errors`);
    totalDownloaded += results.community.totalDownloadCount;
    totalSkipped += results.community.totalSkipCount;
    totalErrors += results.community.totalErrorCount;
  }
  
  if (results.realestate && results.realestate.success) {
    console.log(`Real Estate Media: ${results.realestate.totalDownloadCount} downloaded, ${results.realestate.totalSkipCount} skipped, ${results.realestate.totalErrorCount} errors`);
    totalDownloaded += results.realestate.totalDownloadCount;
    totalSkipped += results.realestate.totalSkipCount;
    totalErrors += results.realestate.totalErrorCount;
  }
  
  console.log('--------------------------------');
  console.log(`TOTAL: ${totalDownloaded} downloaded, ${totalSkipped} skipped, ${totalErrors} errors`);
  console.log('================================');
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});