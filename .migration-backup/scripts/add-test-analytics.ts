import { db } from '../server/db';
import { analyticsSessions, analyticsPageViews } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Add test analytics data with various device types
 */
async function addTestAnalyticsData() {
  try {
    console.log('Adding test analytics data with various device types...');
    
    // Sample user agents representing different device types
    const userAgents = {
      desktop: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64; rv:95.0) Gecko/20100101 Firefox/95.0'
      ],
      mobile: [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Mobile Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 189.0.0.41.119'
      ],
      tablet: [
        'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36',
        'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
      ]
    };
    
    // Sample pages
    const pages = [
      '/',
      '/forum',
      '/events',
      '/directory',
      '/community',
      '/about',
      '/vendors'
    ];
    
    // Sample IPs from different regions
    const ips = {
      'us': ['72.21.215.90', '8.8.8.8', '52.54.54.54'],
      'uk': ['82.132.234.244', '82.132.234.245', '82.132.234.246'],
      'jp': ['61.195.190.222', '61.195.190.223', '61.195.190.224'],
      'de': ['85.214.132.117', '85.214.132.118', '85.214.132.119']
    };
    
    // Geo data for IPs
    const geoData = {
      'us': { country: 'US', region: 'NY', city: 'New York', ll: [40.7128, -74.0060] },
      'uk': { country: 'GB', region: 'England', city: 'London', ll: [51.5074, -0.1278] },
      'jp': { country: 'JP', region: 'Tokyo', city: 'Tokyo', ll: [35.6762, 139.6503] },
      'de': { country: 'DE', region: 'Berlin', city: 'Berlin', ll: [52.5200, 13.4050] }
    };

    // Insert desktop sessions
    await addSessionsForDeviceType('desktop', userAgents.desktop, 5, pages, ips, geoData);
    
    // Insert mobile sessions
    await addSessionsForDeviceType('mobile', userAgents.mobile, 8, pages, ips, geoData);
    
    // Insert tablet sessions
    await addSessionsForDeviceType('tablet', userAgents.tablet, 3, pages, ips, geoData);
    
    console.log('Test analytics data added successfully.');
    
  } catch (error) {
    console.error('Error adding test analytics data:', error);
  } finally {
    process.exit(0);
  }
}

/**
 * Add sessions for a specific device type
 */
async function addSessionsForDeviceType(
  deviceType: string, 
  userAgents: string[], 
  count: number, 
  pages: string[],
  ips: Record<string, string[]>,
  geoData: Record<string, { country: string, region: string, city: string, ll: number[] }>
) {
  console.log(`Adding ${count} sessions for device type: ${deviceType}`);
  
  // For each session we want to create
  for (let i = 0; i < count; i++) {
    // Select a random user agent from the list
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    // Select a random region and IP
    const regions = Object.keys(ips);
    const region = regions[Math.floor(Math.random() * regions.length)];
    const ip = ips[region][Math.floor(Math.random() * ips[region].length)];
    
    // Get geo data for this region
    const geo = geoData[region];
    
    // Create a session ID
    const sessionId = uuidv4();
    
    // Setup timing data
    const now = new Date();
    const startTime = new Date(now.getTime() - Math.floor(Math.random() * 86400000)); // Random time in the last 24h
    const endTime = new Date(startTime.getTime() + Math.floor(Math.random() * 3600000)); // Session up to 1h
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    // Determine browser from user agent
    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    
    // Determine OS from user agent
    let os = 'Unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac OS')) os = 'MacOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    
    // Insert the session
    await db.insert(analyticsSessions).values({
      sessionId,
      userId: null, // Anonymous user
      ip,
      userAgent,
      device: deviceType, // This is key - setting the device type explicitly
      browser,
      os,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      latitude: geo.ll[0],
      longitude: geo.ll[1],
      startTimestamp: startTime,
      endTimestamp: endTime,
      duration,
      isActive: false,
      pagesViewed: Math.floor(Math.random() * 5) + 1, // 1-5 pages
    });
    
    // Insert 1-5 page views for this session
    const pageViewCount = Math.floor(Math.random() * 5) + 1;
    
    for (let j = 0; j < pageViewCount; j++) {
      // Select a random page
      const path = pages[Math.floor(Math.random() * pages.length)];
      
      // Create timestamp between session start and end
      const timestamp = new Date(
        startTime.getTime() + 
        Math.floor(Math.random() * (endTime.getTime() - startTime.getTime()))
      );
      
      // Insert the page view
      await db.insert(analyticsPageViews).values({
        sessionId,
        userId: null,
        ip,
        userAgent,
        path,
        referrer: j === 0 ? 'https://www.google.com/' : null, // First page has referrer
        pageType: 'page',
        pageCategory: path === '/' ? 'home' : path.substring(1),
        timestamp,
      });
    }
  }
}

// Run the function
addTestAnalyticsData().catch(console.error);