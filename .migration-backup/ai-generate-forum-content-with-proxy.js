/**
 * Generate realistic forum content for Barefoot Bay community platform using Google's Gemini AI
 * with a proxy approach to handle referrer restrictions
 * 
 * This script uses Google's Generative AI to generate forum posts and comments
 * based on the Barefoot Bay community profile.
 * 
 * Usage:
 * node ai-generate-forum-content-with-proxy.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Set up the Gemini API key
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent";

// Users to use for content creation
const USERS = [
  { id: 6, username: "Bob the Builder", role: "admin" },
  { id: 7, username: "registereduser", role: "registered" },
  { id: 9, username: "John Watson", role: "registered" },
  { id: 10, username: "mag092593", role: "registered" },
  { id: 11, username: "firstuser", role: "registered" },
  { id: 12, username: "adminuser", role: "admin" },
];

// Forum categories from the database
const CATEGORIES = [
  { id: 1, name: "General Discussion", slug: "general-discussion", description: "General topics related to Barefoot Bay community" },
  { id: 2, name: "Announcements", slug: "announcements", description: "Official announcements from the Barefoot Bay community" },
  { id: 3, name: "Events & Activities", slug: "events-activities", description: "Discussions about upcoming events and activities" },
  { id: 4, name: "Neighbors Helping Neighbors", slug: "neighbors-helping-neighbors", description: "A place to offer or request help from fellow residents" },
  { id: 5, name: "Recommendations", slug: "recommendations", description: "Recommendations for local services and businesses" },
];

// Potential media URLs
const MEDIA_URLS = [
  "/uploads/media-1741584498267-707261025.jpg",
  "/uploads/media-1741588357728-170199023.png",
  "/uploads/media-1741589455403-560444925.jpg",
  "/uploads/media-1741629720111-89324860.png",
  "/uploads/media-1741666015400-424090711.png",
];

// Barefoot Bay context information for AI generation
const COMMUNITY_CONTEXT = `
Barefoot Bay is a residential community located in Brevard County, Florida, near Sebastian. 
It's primarily a retirement and vacation community with many amenities including:
- Community pool and recreation center
- Golf courses
- Tennis and pickleball courts
- Walking trails
- Community events and activities
- Close to beaches, fishing, and water activities

Residents are typically aged 55+, though there are some younger families. 
The community is known for its friendly atmosphere, active lifestyle options, and natural Florida beauty.
Common topics of discussion include:
- Community events and activities
- Local services and recommendations
- Home maintenance and improvement specific to Florida climate
- Wildlife and nature in the area
- Weather concerns (hurricane preparedness, etc.)
- Local government and community management
`;

// Function to make API calls to Gemini with a referrer
async function callGeminiAPI(prompt) {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://barefootbay.com',  // Set a valid referrer
        'Origin': 'https://barefootbay.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(`Error calling Gemini API: ${error.message}`);
    throw error;
  }
}

// Generate content for a specific category using AI
async function generateCategoryContent(category) {
  console.log(`Generating AI content for ${category.name}...`);
  
  try {
    const prompt = `
You are creating realistic forum posts for a community platform for Barefoot Bay, a residential community in Florida.
Generate 3-5 realistic forum posts for the "${category.name}" category. The description of this category is: "${category.description}".

${COMMUNITY_CONTEXT}

For each post, include:
1. A realistic, specific title relevant to the category
2. Content in HTML format with paragraphs using <p> tags and lists using <ul> or <ol> where appropriate
3. Make sure the content is realistic, helpful, and representative of actual community discussions
4. Ensure posts are between 50-200 words
5. Format your response as a JSON array of objects with the following properties:
   - title: the post title
   - content: the post content in HTML format

Current date: March 30, 2025

Response format example:
[
  {
    "title": "Example Post Title",
    "content": "<p>This is an example post content.</p><p>It has multiple paragraphs.</p>"
  }
]
`;

    const responseText = await callGeminiAPI(prompt);
    
    try {
      // Extract JSON from potential text wrapping
      const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      
      // Parse the JSON response
      const postsData = JSON.parse(jsonStr);
      
      // Add additional fields needed for database insertion
      return postsData.map(post => ({
        ...post,
        userId: getRandomUser().id,
        views: Math.floor(Math.random() * 150) + 20, // 20-170 views
        isPinned: Math.random() < 0.1, // 10% chance of being pinned
        isLocked: Math.random() < 0.05, // 5% chance of being locked
        mediaUrls: Math.random() < 0.3 ? [MEDIA_URLS[Math.floor(Math.random() * MEDIA_URLS.length)]] : null, // 30% chance of having media
      }));
    } catch (parseError) {
      console.error(`Error parsing AI response for ${category.name}:`, parseError);
      console.log("Raw response:", responseText);
      // Fall back to predefined content
      return getFallbackContent(category);
    }
  } catch (error) {
    console.error(`Error generating content for ${category.name}:`, error);
    // Fall back to predefined content
    return getFallbackContent(category);
  }
}

// Generate comments for a post using AI
async function generateCommentsForPost(postId, postTitle, categorySlug) {
  console.log(`Generating AI comments for post: ${postTitle}...`);
  
  try {
    const prompt = `
You are creating realistic comments for a community forum post in Barefoot Bay, a residential community in Florida.
The post title is: "${postTitle}" in the category "${categorySlug}".

${COMMUNITY_CONTEXT}

Generate 3-6 realistic comments that community members might make on this post.
Make the comments conversational, helpful, and representative of an active community discussion.
Ensure some comments respond to the post topic and some might respond to other comments.

For each comment, include content in HTML format with paragraphs using <p> tags.
Keep comments between 20-100 words.

Format your response as a JSON array of objects with one property:
- content: the comment content in HTML format

Response format example:
[
  {
    "content": "<p>This is an example comment content.</p>"
  }
]
`;

    const responseText = await callGeminiAPI(prompt);
    
    try {
      // Extract JSON from potential text wrapping
      const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      
      // Parse the JSON response
      const commentsData = JSON.parse(jsonStr);
      
      // Add additional fields needed for database insertion
      return commentsData.map(comment => ({
        ...comment,
        postId,
        authorId: getRandomUser().id,
      }));
    } catch (parseError) {
      console.error(`Error parsing AI comment response for post ${postTitle}:`, parseError);
      // Fall back to predefined comments
      return getFallbackComments(postId, categorySlug);
    }
  } catch (error) {
    console.error(`Error generating comments for post ${postTitle}:`, error);
    // Fall back to predefined comments
    return getFallbackComments(postId, categorySlug);
  }
}

// Fallback content for when AI generation fails
function getFallbackContent(category) {
  // Basic fallback content for each category
  switch (category.slug) {
    case "general-discussion":
      return [
        {
          title: "Welcome to the Barefoot Bay Community Forum!",
          content: "<p>Hello neighbors! I'm excited to welcome everyone to our new community forum. This is a great place for us to connect, share information, and build relationships.</p><p>Feel free to introduce yourself here!</p>",
          userId: 6,
          views: 120,
          isPinned: true,
          isLocked: false,
          mediaUrls: null,
        },
        {
          title: "New resident looking for recommendations",
          content: "<p>Hi everyone, my family and I just moved to Barefoot Bay, and we're looking for recommendations on local restaurants, services, and community activities. Thanks in advance!</p>",
          userId: 7,
          views: 87,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
        },
        {
          title: "Internet service providers in the area",
          content: "<p>Can anyone recommend a good internet service provider in Barefoot Bay? I work from home and need reliable high-speed internet. What are you using and how is the service?</p>",
          userId: 9,
          views: 93,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
        },
      ];
      
    case "announcements":
      return [
        {
          title: "Community Town Hall - April 2025",
          content: "<p><strong>IMPORTANT COMMUNITY ANNOUNCEMENT</strong></p><p>Mark your calendars for our quarterly Town Hall meeting on April 15, 2025 at 6:30 PM in the Community Center.</p><p>We'll be discussing upcoming infrastructure projects, community events for the summer, and taking questions from residents.</p>",
          userId: 12,
          views: 210,
          isPinned: true,
          isLocked: false,
          mediaUrls: null,
        },
        {
          title: "Pool Maintenance Schedule - Summer 2025",
          content: "<p>The community pool will undergo routine maintenance on the following dates:</p><ul><li>May 3-4, 2025</li><li>June 12, 2025</li><li>July 17, 2025</li></ul><p>The pool will be closed during these dates. We apologize for any inconvenience.</p>",
          userId: 6,
          views: 165,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[1]],
        },
      ];
      
    case "events-activities":
      return [
        {
          title: "Weekly Walking Group - Join Us!",
          content: "<p>Our community walking group meets every Tuesday and Thursday at 8:00 AM at the clubhouse. All fitness levels welcome!</p><p>We typically walk for about an hour around the community, enjoying the beautiful scenery and good conversation. It's a great way to stay active and meet your neighbors.</p>",
          userId: 9,
          views: 75,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[2]],
        },
        {
          title: "Barefoot Bay Annual Spring Festival",
          content: "<p>The Spring Festival committee is looking for volunteers to help organize our annual celebration in April. We need help with:</p><ul><li>Decorations</li><li>Food vendors</li><li>Children's activities</li><li>Setup/cleanup</li></ul><p>If you're interested, please come to our planning meeting next Wednesday at 7 PM in the community center.</p>",
          userId: 11,
          views: 128,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
        },
        {
          title: "Pickleball Tournament - May 20-21",
          content: "<p>Calling all pickleball enthusiasts! We're organizing a friendly tournament at the Barefoot Bay courts on May 20-21. Sign up as an individual or with a partner. All skill levels welcome!</p><p>Registration fee: $10/person (includes lunch and refreshments)</p><p>To register, email recreation@barefootbay.org or sign up at the community center.</p>",
          userId: 10,
          views: 83,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
        },
      ];
      
    case "neighbors-helping-neighbors":
      return [
        {
          title: "Need help with lawn maintenance",
          content: "<p>Due to recent surgery, I'm unable to maintain my lawn for the next few weeks. Would any neighbors be willing to help or recommend an affordable service? I live on Micco Road and need basic mowing and trimming.</p>",
          userId: 11,
          views: 62,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
        },
        {
          title: "Looking for a reliable babysitter",
          content: "<p>Hi neighbors, my wife and I are looking for a reliable babysitter for our 4-year-old daughter. We both work from home but have important meetings coming up next week where we need childcare for a few hours each day. Would prefer someone with experience and references. Please message me if you can help or know someone trustworthy in the community.</p>",
          userId: 7,
          views: 48,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
        },
        {
          title: "Free moving boxes - Just picked up from Home Depot",
          content: "<p>I just finished moving in and have about 20 sturdy boxes of various sizes that I no longer need. They're in great condition and free to anyone who needs them. I also have some packing paper and bubble wrap. First come, first served. I'm located near the community center. Please PM me if interested.</p>",
          userId: 9,
          views: 51,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[0]],
        },
      ];
      
    case "recommendations":
      return [
        {
          title: "Best local handyman?",
          content: "<p>I'm looking for recommendations for a reliable handyman in the area for several small projects around the house. Who have you used and been happy with?</p><p>I need someone for installing ceiling fans, fixing a leaky faucet, and some minor carpentry work.</p>",
          userId: 7,
          views: 105,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
        },
        {
          title: "Favorite restaurants near Sebastian?",
          content: "<p>My in-laws are visiting next weekend and I'd like to take them out for a nice dinner. What are your favorite restaurants in Sebastian or nearby? Looking for something with good seafood options and a nice atmosphere.</p>",
          userId: 10,
          views: 92,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
        },
        {
          title: "Reliable AC repair service?",
          content: "<p>With summer approaching, my AC unit needs some maintenance. Can anyone recommend a trustworthy HVAC service that won't overcharge? I've had mixed experiences in the past and would appreciate recommendations from neighbors.</p>",
          userId: 11,
          views: 78,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
        },
      ];
      
    default:
      return [];
  }
}

// Fallback comments for when AI generation fails
function getFallbackComments(postId, categorySlug) {
  let comments = [];
  
  switch(categorySlug) {
    case "general-discussion":
      comments = [
        {
          content: "<p>Welcome to the community! We're glad to have you join us. This forum is a great way to stay connected with everything happening in Barefoot Bay.</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>I've lived here for about 5 years now and absolutely love it. Don't hesitate to ask if you have any questions about the area!</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>There's a welcome packet available at the community center that has lots of useful information for new residents. You might want to pick one up!</p>",
          authorId: getRandomUser().id,
          postId,
        },
      ];
      break;
      
    case "announcements":
      comments = [
        {
          content: "<p>Thanks for the information. I've added this to my calendar.</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>Will the minutes from the meeting be posted online for those who can't attend?</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>Looking forward to hearing about the summer events!</p>",
          authorId: getRandomUser().id,
          postId,
        },
      ];
      break;
      
    case "events-activities":
      comments = [
        {
          content: "<p>I've been part of the walking group for a few months now and it's been wonderful! Great way to start the day.</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>Do you ever change the route? I'd love to explore more of the community.</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>Is it okay to bring my dog? She's very well-behaved and loves walks.</p>",
          authorId: getRandomUser().id,
          postId,
        },
      ];
      break;
      
    case "neighbors-helping-neighbors":
      comments = [
        {
          content: "<p>I'd be happy to help! I'm retired and have plenty of time. I'll send you a private message.</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>I've used Green Leaf Lawn Service and they're very reasonable. About $40 for a basic mow and trim for an average yard.</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>Hope your recovery goes well! Let me know if you need any groceries picked up too.</p>",
          authorId: getRandomUser().id,
          postId,
        },
      ];
      break;
      
    case "recommendations":
      comments = [
        {
          content: "<p>I highly recommend Jim's Handyman Service. He's done several projects for us and is very reasonably priced. His number is (321) 555-1234.</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>We used Mike from Reliable Home Repairs last month for similar projects. He was on time, professional, and did great work. I can PM you his contact info if you're interested.</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>Whatever you do, avoid Quick Fix Handyman. They charged us for hours they didn't work and left the job half finished.</p>",
          authorId: getRandomUser().id,
          postId,
        },
      ];
      break;
      
    default:
      comments = [
        {
          content: "<p>Thanks for sharing this information with the community!</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>This is exactly what I was looking for. Very helpful.</p>",
          authorId: getRandomUser().id,
          postId,
        },
        {
          content: "<p>I have a question about this - could you provide more details?</p>",
          authorId: getRandomUser().id,
          postId,
        },
      ];
  }
  
  return comments;
}

// Generate realistic reactions (likes, etc.)
function generateReactions(postId, commentIds) {
  const reactions = [];
  
  // Add reactions to posts
  const postReactionCount = Math.floor(Math.random() * 10) + 1; // 1-10 reactions
  for (let i = 0; i < postReactionCount; i++) {
    reactions.push({
      userId: getRandomUser().id,
      postId,
      commentId: null,
      reactionType: getRandomReactionType(),
    });
  }
  
  // Add reactions to comments
  commentIds.forEach(commentId => {
    if (Math.random() > 0.3) { // 70% chance of a comment getting reactions
      const commentReactionCount = Math.floor(Math.random() * 3) + 1; // 1-3 reactions
      for (let i = 0; i < commentReactionCount; i++) {
        reactions.push({
          userId: getRandomUser().id,
          postId: null,
          commentId,
          reactionType: getRandomReactionType(),
        });
      }
    }
  });
  
  return reactions;
}

// Helper to get a random user
function getRandomUser() {
  return USERS[Math.floor(Math.random() * USERS.length)];
}

// Helper to get a random media URL
function getRandomMediaUrl() {
  return MEDIA_URLS[Math.floor(Math.random() * MEDIA_URLS.length)];
}

// Helper to get a random reaction type
function getRandomReactionType() {
  const reactionTypes = ["like", "love", "thumbsup", "laugh", "helpful"];
  return reactionTypes[Math.floor(Math.random() * reactionTypes.length)];
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

// Main function to generate and insert forum content
async function generateForumContent() {
  try {
    console.log("Starting AI-powered forum content generation (with proxy approach)...");
    
    // Insert posts for each category
    for (const category of CATEGORIES) {
      console.log(`Working on ${category.name}...`);
      
      // Get content for this category
      const posts = await generateCategoryContent(category);
      
      // Insert each post
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
            post.isPinned || false,
            post.isLocked || false,
            post.views,
            post.mediaUrls,
            postCreatedAt,
          ]
        );
        
        const postId = postResult.rows[0].id;
        console.log(`Created post: ${post.title} (ID: ${postId})`);
        
        // Generate and insert comments for this post
        const comments = await generateCommentsForPost(postId, post.title, category.slug);
        const commentIds = [];
        
        for (const comment of comments) {
          // Make comment dates slightly after the post date
          const commentDate = new Date(postCreatedAt);
          commentDate.setHours(commentDate.getHours() + Math.floor(Math.random() * 24) + 1);
          
          const commentResult = await pool.query(
            `INSERT INTO forum_comments 
             (content, post_id, author_id, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $4) 
             RETURNING id`,
            [
              comment.content,
              comment.postId,
              comment.authorId,
              commentDate,
            ]
          );
          
          const commentId = commentResult.rows[0].id;
          commentIds.push(commentId);
          console.log(`Created comment for post ID ${postId}`);
        }
        
        // Generate and insert reactions for this post and its comments
        const reactions = generateReactions(postId, commentIds);
        
        for (const reaction of reactions) {
          await pool.query(
            `INSERT INTO forum_reactions 
             (user_id, post_id, comment_id, reaction_type, created_at) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              reaction.userId,
              reaction.postId,
              reaction.commentId,
              reaction.reactionType,
              getRandomPastDate(),
            ]
          );
        }
        
        console.log(`Created ${reactions.length} reactions for post ID ${postId}`);
      }
    }
    
    console.log(`AI Forum content generation complete! Created posts for all categories.`);
    
  } catch (error) {
    console.error("Error generating forum content:", error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the main function
generateForumContent();