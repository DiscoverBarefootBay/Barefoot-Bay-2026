/**
 * Generate predefined realistic forum content for a single Barefoot Bay community category
 * This script creates ready-made forum posts with relevant images for a specified category
 * 
 * Usage:
 * node generate-forum-content-by-category.js [category_id]
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Forum categories
const CATEGORIES = [
  { id: 1, name: "General Discussion", slug: "general-discussion", description: "General topics related to Barefoot Bay community" },
  { id: 2, name: "Announcements", slug: "announcements", description: "Official announcements from the Barefoot Bay community" },
  { id: 3, name: "Events & Activities", slug: "events-activities", description: "Discussions about upcoming events and activities" },
  { id: 4, name: "Neighbors Helping Neighbors", slug: "neighbors-helping-neighbors", description: "A place to offer or request help from fellow residents" },
  { id: 5, name: "Recommendations", slug: "recommendations", description: "Recommendations for local services and businesses" },
];

// Media URLs from our current uploads directory
const MEDIA_URLS = [
  "/uploads/content-media/mediaFile-1743672364746-350837951.jpg", // Community image
  "/uploads/content-media/mediaFile-1743672686007-828150271.jpg", // Beach image
  "/uploads/content-media/mediaFile-1743672695521-422337637.jpg", // Recreation image
  "/uploads/content-media/mediaFile-1743672727761-239772382.png", // Community map
  "/uploads/content-media/mediaFile-1743674178868-373676888.jpg", // Golf course
  "/uploads/content-media/mediaFile-1743697001167-254940736.jpg", // Barefoot Bay logo
  "/uploads/content-media/mediaFile-1743783246277-60318144.png", // Community event
];

// Users to use for content creation
async function getUsers() {
  try {
    const result = await pool.query(
      "SELECT id, username, role FROM users WHERE role IN ('admin', 'registered') LIMIT 10"
    );
    
    if (result.rows.length > 0) {
      return result.rows;
    } else {
      // Fallback users if none found in DB
      return [
        { id: 6, username: "admin", role: "admin" },
        { id: 7, username: "registereduser", role: "registered" },
      ];
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    // Fallback users
    return [
      { id: 6, username: "admin", role: "admin" },
      { id: 7, username: "registereduser", role: "registered" },
    ];
  }
}

// Predefined content for each category
function getForumContent(category, users) {
  const randomUserId = () => users[Math.floor(Math.random() * users.length)].id;
  
  switch (category.slug) {
    case "general-discussion":
      return [
        {
          title: "Welcome to the Barefoot Bay Community Forum!",
          content: "<p>Hello neighbors! I'm excited to welcome everyone to our new community forum. This is a great place for us to connect, share information, and build relationships.</p><p>Feel free to introduce yourself here and let us know how long you've been a resident or if you're considering moving to our beautiful community.</p>",
          userId: randomUserId(),
          views: 163,
          isPinned: true,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[0]],
          commentCount: 5,
        },
        {
          title: "New resident looking for recommendations",
          content: "<p>Hi everyone, my family and I just moved to Barefoot Bay last month, and we're looking for recommendations on local restaurants, services, and community activities. We're particularly interested in seafood restaurants and family-friendly activities in the area.</p><p>Also, any tips on handling the Florida summer heat would be much appreciated! Coming from Michigan, it's quite an adjustment for us.</p>",
          userId: randomUserId(),
          views: 87,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 8,
        },
        {
          title: "Wildlife spotting at the lake",
          content: "<p>Just wanted to share that I spotted a beautiful family of sandhill cranes by the lake yesterday evening. They had two young ones with them. It's amazing how much wildlife we have right here in our community!</p><p>Has anyone else spotted interesting wildlife around Barefoot Bay lately? I've heard there are also otters in some of the waterways.</p>",
          userId: randomUserId(),
          views: 112,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[1]],
          commentCount: 6,
        },
        {
          title: "Question about community rules for home exteriors",
          content: "<p>I'm planning to repaint my house exterior soon and wanted to check about the community guidelines. Does anyone know if there's a specific color palette we need to choose from, or can we select any color as long as it's not too bright?</p><p>Also, do I need to submit a form to the HOA before starting the project?</p>",
          userId: randomUserId(),
          views: 74,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 4,
        },
        {
          title: "Best internet service provider in Barefoot Bay?",
          content: "<p>I'm currently having issues with my internet service and considering switching providers. What internet service do you use in Barefoot Bay, and how has your experience been with speed and reliability?</p><p>Are there any local providers that specialize in our area that I should look into?</p>",
          userId: randomUserId(),
          views: 135,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 7,
        },
      ];
      
    case "announcements":
      return [
        {
          title: "Community Town Hall - April 15, 2025",
          content: "<p><strong>IMPORTANT COMMUNITY ANNOUNCEMENT</strong></p><p>Mark your calendars for our quarterly Town Hall meeting on April 15, 2025 at 6:30 PM in the Community Center.</p><p>Agenda items include:</p><ul><li>Updates on the community pool renovation project</li><li>Discussion of the proposed walking trail expansion</li><li>Budget review for Q2 2025</li><li>Open forum for resident questions</li></ul><p>Light refreshments will be served. We hope to see you there!</p>",
          userId: users.find(u => u.role === 'admin')?.id || randomUserId(),
          views: 210,
          isPinned: true,
          isLocked: true,
          mediaUrls: [MEDIA_URLS[5]],
          commentCount: 0,
        },
        {
          title: "Hurricane Preparedness Workshop - May 5, 2025",
          content: "<p>The Barefoot Bay Emergency Management Committee will be hosting a Hurricane Preparedness Workshop on May 5, 2025 from 2:00 PM to 4:00 PM at the Community Center.</p><p>Topics will include:</p><ul><li>Creating an evacuation plan</li><li>Building an emergency kit</li><li>Securing your home</li><li>Community resources during emergencies</li><li>Special considerations for seniors and those with medical needs</li></ul><p>Local emergency management officials will be present to answer questions. This is especially important for new residents who haven't experienced a Florida hurricane season before.</p>",
          userId: users.find(u => u.role === 'admin')?.id || randomUserId(),
          views: 178,
          isPinned: true,
          isLocked: false,
          mediaUrls: null,
          commentCount: 3,
        },
        {
          title: "Community Pool Schedule Change - Effective April 10",
          content: "<p>Please note that starting April 10, 2025, the main community pool will have updated hours:</p><p>Monday - Friday: 7:00 AM to 8:00 PM<br>Saturday - Sunday: 8:00 AM to 9:00 PM</p><p>The change in hours is to accommodate the new early morning water aerobics class and evening maintenance requirements.</p><p>The satellite pools will maintain their regular hours.</p>",
          userId: users.find(u => u.role === 'admin')?.id || randomUserId(),
          views: 156,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[2]],
          commentCount: 5,
        },
      ];
      
    case "events-activities":
      return [
        {
          title: "Weekly Walking Group - Join Us!",
          content: "<p>Our community walking group meets every Tuesday and Thursday at 8:00 AM at the clubhouse. All fitness levels welcome!</p><p>We typically walk for about 45 minutes to an hour, covering different routes through our beautiful community. It's a great way to stay active and meet neighbors.</p><p>No registration required - just show up with comfortable shoes, water, and a smile!</p>",
          userId: randomUserId(),
          views: 95,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[6]],
          commentCount: 5,
        },
        {
          title: "Community Garage Sale - April 22-23, 2025",
          content: "<p>The spring community-wide garage sale will be held on Saturday, April 22 and Sunday, April 23 from 8:00 AM to 2:00 PM.</p><p>To participate and have your address added to the community map, please register at the Community Center by April 15. There is a $5 registration fee that covers advertising and signage.</p><p>This is always a popular event that draws visitors from surrounding areas, so start gathering those items you no longer need!</p>",
          userId: randomUserId(),
          views: 142,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[3]],
          commentCount: 7,
        },
        {
          title: "Golf Tournament Fundraiser - May 12, 2025",
          content: "<p>Join us for the annual Barefoot Bay Charity Golf Tournament on May 12, 2025, starting at 9:00 AM.</p><p>Entry fee: $45 per person, includes green fees, cart, lunch, and a donation to the Barefoot Bay Scholarship Fund for local students.</p><p>Format: 4-person scramble</p><p>Sign up at the Pro Shop by May 5. Singles are welcome and will be paired up.</p><p>Prizes for closest to pin, longest drive, and winning teams!</p>",
          userId: randomUserId(),
          views: 87,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[4]],
          commentCount: 4,
        },
        {
          title: "Craft Club Meeting - Every Wednesday",
          content: "<p>The Barefoot Bay Craft Club meets every Wednesday from 1:00 PM to 3:00 PM in the Recreation Center craft room.</p><p>This week we'll be working on seashell crafts - a perfect Florida-themed project! All materials will be provided for a $5 fee.</p><p>Beginners are always welcome, and experienced crafters can bring their own projects to work on as well.</p><p>Questions? Contact Jane at 555-123-4567.</p>",
          userId: randomUserId(),
          views: 65,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 3,
        },
        {
          title: "Movie Night at the Community Center - April 14",
          content: "<p>Join us for a free movie night on Friday, April 14 at 7:00 PM in the Community Center.</p><p>We'll be showing the classic film \"Some Like It Hot\" on our big screen.</p><p>Complimentary popcorn and water will be provided. Feel free to bring your own comfortable chair or cushion and additional snacks.</p><p>No registration required - just come and enjoy an evening with neighbors!</p>",
          userId: randomUserId(),
          views: 119,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 6,
        },
      ];
      
    case "neighbors-helping-neighbors":
      return [
        {
          title: "Need help with lawn maintenance",
          content: "<p>Due to recent hip surgery, I'm unable to maintain my lawn for the next few weeks. Would any neighbors be willing to help or recommend an affordable service? I'm on a fixed income, so I'm hoping to find a reasonable option.</p><p>I'm located on Sailfish Avenue. Thank you in advance for any suggestions!</p>",
          userId: randomUserId(),
          views: 62,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 7,
        },
        {
          title: "Seeking ride to medical appointment",
          content: "<p>I have a medical appointment at Sebastian River Medical Center next Tuesday (April 11) at 10:30 AM and no transportation. My regular ride is unavailable. Would anyone be able to give me a lift there and back? I expect to be done around noon.</p><p>I'm happy to pay for gas and your time. Please message me if you're able to help. Thank you!</p>",
          userId: randomUserId(),
          views: 48,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 4,
        },
        {
          title: "Free moving boxes available",
          content: "<p>We just finished unpacking from our move to Barefoot Bay and have about 20 medium and large moving boxes to give away. All are in good condition and can be reused.</p><p>Also have some packing paper and bubble wrap. First come, first served! I'll leave them on my driveway at 123 Marlin Circle until Sunday evening. Help yourself!</p>",
          userId: randomUserId(),
          views: 87,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 3,
        },
        {
          title: "Computer help needed for senior",
          content: "<p>My 80-year-old mother recently moved in with me and is trying to learn how to use a computer to video chat with her grandchildren. Is there anyone in the community who could spare an hour or two to give her some basic computer lessons?</p><p>She has an iPad but finds it confusing. We would be so grateful for any help and would be happy to compensate you for your time.</p>",
          userId: randomUserId(),
          views: 73,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 5,
        },
        {
          title: "Looking for walking buddy",
          content: "<p>I've recently been advised by my doctor to take daily walks for my health, but I find it hard to stay motivated on my own. Is there anyone in the Whispering Palms section who'd like to be walking buddies?</p><p>I'm looking to walk about 30 minutes a day, ideally in the morning around 8:00 AM or in the evening around 6:00 PM. I'm a slow walker, so this would be a leisurely pace with some conversation.</p>",
          userId: randomUserId(),
          views: 54,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 6,
        },
      ];
      
    case "recommendations":
      return [
        {
          title: "Best local handyman?",
          content: "<p>I'm looking for recommendations for a reliable handyman in the area for several small projects around the house. Who have you used and been happy with?</p><p>My list includes fixing a leaky faucet, repairing some damaged drywall, and installing ceiling fans in two bedrooms.</p>",
          userId: randomUserId(),
          views: 105,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 12,
        },
        {
          title: "Favorite seafood restaurants nearby?",
          content: "<p>We have family visiting from out of state next week and want to take them to a great local seafood restaurant. Any recommendations within 20-30 minutes of Barefoot Bay?</p><p>Looking for somewhere with fresh catches and good ambiance. Outdoor seating would be a plus!</p>",
          userId: randomUserId(),
          views: 132,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[1]],
          commentCount: 9,
        },
        {
          title: "Reliable air conditioning service",
          content: "<p>With summer approaching, I want to have my A/C system serviced before the real heat hits. Can anyone recommend a trustworthy HVAC company that won't overcharge or try to sell me a new system when I don't need one?</p><p>I've had bad experiences in the past with companies taking advantage of seniors, so I'm looking for someone honest and reliable.</p>",
          userId: randomUserId(),
          views: 94,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 7,
        },
        {
          title: "Best place for fresh produce?",
          content: "<p>I'm looking for recommendations on where to buy the freshest produce in our area. Is there a good farmer's market nearby? Or a local farm stand?</p><p>I'd prefer to support local growers if possible, but am also interested in hearing about which grocery stores have the best quality fruits and vegetables.</p>",
          userId: randomUserId(),
          views: 68,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 5,
        },
        {
          title: "Dog groomer recommendations",
          content: "<p>We just adopted a Goldendoodle who's going to need regular grooming. Any recommendations for good dog groomers in the area? Preferably someone who's good with nervous dogs, as our boy is a bit shy.</p><p>Mobile grooming services would be ideal, but we're open to taking him somewhere if the service is excellent.</p>",
          userId: randomUserId(),
          views: 79,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 8,
        },
      ];
      
    default:
      return [];
  }
}

// Helper function to get comments for posts
function getForumComments(postId, categorySlug, users) {
  const randomUserId = () => users[Math.floor(Math.random() * users.length)].id;
  
  // Category-specific comments
  switch(categorySlug) {
    case "general-discussion":
      return [
        {
          content: "<p>Welcome to Barefoot Bay! We moved here from New York about 5 years ago and love it. The community is very friendly. If you have any questions about the area, feel free to ask!</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>For restaurants, I'd highly recommend Captain Hiram's in Sebastian for seafood. For the heat, invest in good ceiling fans and lightweight clothing. You'll adjust to it over time!</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>Make sure to check out the farmers market on Saturdays in Sebastian. Great local produce and it's a nice way to spend a morning.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>I've lived here for 12 years and still see new wildlife regularly! Last week I spotted a manatee in the canal behind my house. Definitely keep your camera handy.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: [MEDIA_URLS[1]],
        },
        {
          content: "<p>For Internet, I've had good experiences with Spectrum. They're not perfect but better than the alternatives I've tried. Call them for special pricing deals.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
      ];
      
    case "announcements":
      return [
        {
          content: "<p>Thanks for the information! Will there be minutes published for those who can't attend?</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>I'm looking forward to learning more about hurricane prep. As a new Florida resident, I want to make sure I'm prepared for storm season.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>Will the early morning water aerobics class be open to all residents or is registration required?</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>This is a much-needed workshop! Last hurricane season caught many new residents off guard. I recommend everyone attend, especially those new to Florida.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
      ];
      
    case "events-activities":
      return [
        {
          content: "<p>I've been joining the walking group for about 3 months now. It's a wonderful way to start the day, and I've met some great neighbors through it!</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>Is there a rain policy for the movie night? What happens if there's bad weather?</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>I participated in last year's golf tournament and had a blast! Even if you're not a great golfer, it's a fun event for a good cause.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: [MEDIA_URLS[4]],
        },
        {
          content: "<p>The craft club is so welcoming! I joined as a complete beginner last month and everyone was so helpful and friendly. Highly recommend!</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>Will there be a map of participating houses for the garage sale? I'd like to plan my route in advance.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
      ];
      
    case "neighbors-helping-neighbors":
      return [
        {
          content: "<p>I can help with your lawn for the next few weeks while you recover. No charge - that's what neighbors are for! I'll send you a private message to coordinate.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>I'm available to drive you to your appointment. I have to be in Sebastian that morning anyway. I'll message you my contact information.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>Thanks for offering the boxes! I'm moving next month and could definitely use them. I'll swing by tomorrow morning if that's okay.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>I used to teach computer classes before retiring. I'd be happy to help your mother learn the basics. No payment necessary - I enjoy teaching seniors about technology.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>I live in Whispering Palms and also need a walking buddy! I prefer mornings around 8:00. Let's connect and give it a try next week.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
      ];
      
    case "recommendations":
      return [
        {
          content: "<p>I've used Jim's Handyman Services for several projects and been very pleased. He's prompt, reasonably priced, and does quality work. His number is 555-987-6543.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>For seafood, you can't beat The Crab Spot in Sebastian. Get the seafood platter - it's amazing and enough to share. Make reservations, especially on weekends.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>We've used Cool Breeze A/C for years. Family-owned, fair prices, and they've never tried to upsell us on unnecessary services.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>There's a great farmers market every Saturday morning at the county fairgrounds. Local honey, fresh produce, and homemade baked goods. Well worth the trip!</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>Pampered Paws Mobile Grooming has been wonderful with our nervous Shih Tzu. Lisa the groomer is patient and gentle. Bit of a waiting list for new clients, but worth it.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
      ];
      
    default:
      return [
        {
          content: "<p>Welcome to the community! You'll love it here. We've been residents for 15 years and couldn't imagine living anywhere else.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>Thanks for sharing this information with everyone. It's exactly what I was looking for!</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>I have a question about this - could you provide more details about the timing? I might be out of town that week.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>Great post! I've been wondering about this myself. Looking forward to more updates.</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
        {
          content: "<p>I had a similar experience last month. It's definitely worth checking out!</p>",
          userId: randomUserId(),
          postId,
          mediaUrls: null,
        },
      ];
  }
}

// Helper to generate a past date within the last 30 days
function getRandomPastDate() {
  const now = new Date();
  const days = Math.floor(Math.random() * 30);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  
  now.setDate(now.getDate() - days);
  now.setHours(now.getHours() - hours);
  now.setMinutes(now.getMinutes() - minutes);
  
  return now;
}

// Delete existing forum data for a specific category to start fresh
async function clearExistingCategoryData(categoryId) {
  try {
    console.log(`Clearing existing forum data for category ID ${categoryId}...`);
    
    // Get post IDs for this category
    const postResult = await pool.query(
      "SELECT id FROM forum_posts WHERE category_id = $1",
      [categoryId]
    );
    
    if (postResult.rows.length > 0) {
      // Get array of post IDs
      const postIds = postResult.rows.map(row => row.id);
      
      // Delete comments for these posts
      await pool.query(
        "DELETE FROM forum_comments WHERE post_id = ANY($1::int[])",
        [postIds]
      );
      
      // Delete reactions for these posts
      await pool.query(
        "DELETE FROM forum_reactions WHERE post_id = ANY($1::int[])",
        [postIds]
      );
      
      // Delete the posts themselves
      await pool.query(
        "DELETE FROM forum_posts WHERE id = ANY($1::int[])",
        [postIds]
      );
    }
    
    console.log(`Cleared existing forum data for category ID ${categoryId}.`);
  } catch (error) {
    console.error(`Error clearing forum data for category ${categoryId}:`, error);
    throw error;
  }
}

// Main function to generate content for a specific category
async function generateCategoryContent(categoryId) {
  try {
    console.log(`Starting AI forum content generation for category ID ${categoryId}...`);
    
    // Get users from database
    const users = await getUsers();
    console.log(`Found ${users.length} users for content generation.`);
    
    // Load all categories
    const categories = await pool.query("SELECT id, name, slug, description FROM forum_categories");
    console.log(`Found ${categories.rowCount} forum categories in the database`);
    
    // Find the requested category
    const category = categories.rows.find(c => c.id === categoryId) || 
                    CATEGORIES.find(c => c.id === categoryId);
    
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }
    
    // Clear existing data for this category
    await clearExistingCategoryData(categoryId);
    
    // Generate and insert content for this category
    console.log(`Generating AI content for ${category.name}...`);
    
    // Get content for this category
    const posts = getForumContent(category, users);
    
    // Track all post IDs and comment IDs for reactions
    const postIds = [];
    const commentIds = [];
    
    for (const post of posts) {
      // Insert post
      const postCreatedAt = getRandomPastDate();
      const postResult = await pool.query(
        `INSERT INTO forum_posts 
         (title, content, category_id, user_id, is_pinned, is_locked, views, media_urls, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) 
         RETURNING id`,
        [
          post.title,
          post.content,
          category.id,
          post.userId,
          post.isPinned,
          post.isLocked,
          post.views,
          post.mediaUrls,
          postCreatedAt,
        ]
      );
      
      console.log(`Created post ID ${postResult.rows[0].id}: ${post.title}`);
      
      const postId = postResult.rows[0].id;
      postIds.push(postId);
      
      // Don't generate comments for locked posts
      if (!post.isLocked) {
        // Generate and insert comments
        const comments = getForumComments(postId, category.slug, users);
        const commentCount = Math.min(post.commentCount, comments.length);
        
        // Only use up to the requested comment count
        const commentsToInsert = comments.slice(0, commentCount);
        
        for (const comment of commentsToInsert) {
          // Insert comment with a date slightly after the post
          const commentCreatedAt = new Date(postCreatedAt);
          commentCreatedAt.setMinutes(commentCreatedAt.getMinutes() + Math.floor(Math.random() * 600) + 10); // 10 min to 10 hours later
          
          const commentResult = await pool.query(
            `INSERT INTO forum_comments
             (content, post_id, author_id, media_urls, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $5)
             RETURNING id`,
            [
              comment.content,
              postId,
              comment.userId,
              comment.mediaUrls,
              commentCreatedAt,
            ]
          );
          
          commentIds.push(commentResult.rows[0].id);
        }
        
        console.log(`Created ${commentsToInsert.length} comments for post ID ${postId}`);
      }
    }
    
    console.log(`Category content generation completed successfully for ${category.name}!`);
    console.log(`- Posts created: ${postIds.length}`);
    console.log(`- Comments created: ${commentIds.length}`);
    
    return {
      postsCreated: postIds.length,
      commentsCreated: commentIds.length,
    };
  } catch (error) {
    console.error(`Error generating forum content for category ${categoryId}:`, error);
    throw error;
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Get the category ID from command line arguments
const categoryId = process.argv[2] ? parseInt(process.argv[2], 10) : null;

if (categoryId) {
  // Generate content for a specific category
  generateCategoryContent(categoryId)
    .catch(error => {
      console.error("Content generation failed:", error);
      process.exit(1);
    });
} else {
  console.error("Please provide a category ID as a command line argument.");
  console.error("Example: node generate-forum-content-by-category.js 1");
  process.exit(1);
}