/**
 * Generate realistic forum content for Barefoot Bay community platform using AI
 * 
 * This script uses either Google's Generative AI or OpenAI to generate
 * forum posts and comments based on the community's profile.
 * 
 * Usage:
 * node ai-generate-forum-content.js
 * 
 * @type {module}
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format } from 'date-fns';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Use either GEMINI_API_KEY or VITE_GEMINI_API_KEY for Gemini AI
// This is the same API key used for the frontend search functionality
const googleApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY; // Optional OpenAI fallback

if (!googleApiKey) {
  console.log("Warning: No Gemini API key found. Please set GEMINI_API_KEY or VITE_GEMINI_API_KEY in your environment.");
  console.log("Using fallback content instead.");
}

// Setup Google Generative AI if API key is available
let genAI;
if (googleApiKey) {
  genAI = new GoogleGenerativeAI(googleApiKey);
}

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

// Generate posts for a category using AI
async function generateCategoryContent(category) {
  console.log(`Generating AI content for ${category.name}...`);
  
  const prompt = `
You are generating content for a community forum for Barefoot Bay, a residential community in Florida.
Create 3-4 realistic forum posts for the "${category.name}" category.
The category description is: "${category.description}"

For each post, include:
1. A realistic title
2. Forum post content in HTML format with paragraphs using <p> tags
3. Make content specific to residents of a community like Barefoot Bay with realistic concerns, questions, announcements, etc.

Format the response as a JSON array with each object having these properties:
- title: The post title
- content: HTML content with proper formatting
- isPinned: boolean (true for important announcements, false otherwise)
- isLocked: boolean (usually false except for official announcements)
- userId: Pick a random number from this array: [6, 7, 9, 10, 11, 12]
- views: A random number between 40 and 200
- mediaUrls: null or an empty array

IMPORTANT: Make the posts feel like they were written by real community members with authentic concerns and questions relevant to a residential community.
`;

  try {
    let aiResponse;
    
    if (genAI) {
      // Use Google Generative AI
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      const result = await model.generateContent(prompt);
      aiResponse = result.response.text();
    } else if (openaiApiKey) {
      // Use OpenAI if available
      const { OpenAI } = require("openai");
      const openai = new OpenAI({
        apiKey: openaiApiKey,
      });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant creating realistic community forum content." },
          { role: "user", content: prompt }
        ],
      });
      
      aiResponse = completion.choices[0].message.content;
    } else {
      // Fall back to predefined content if no AI service is available
      console.log("No AI API keys found. Using fallback predefined content.");
      return getFallbackContent(category);
    }
    
    // Parse the AI response into JSON
    let cleanedResponse = aiResponse;
    
    // Clean up the response if it has markdown code fences
    if (cleanedResponse.includes("```json")) {
      cleanedResponse = cleanedResponse.split("```json")[1].split("```")[0].trim();
    } else if (cleanedResponse.includes("```")) {
      cleanedResponse = cleanedResponse.split("```")[1].split("```")[0].trim();
    }
    
    // Parse the JSON response
    const posts = JSON.parse(cleanedResponse);
    
    // Ensure each post has needed properties
    return posts.map(post => ({
      ...post,
      userId: post.userId || getRandomUser().id,
      mediaUrls: post.mediaUrls || (Math.random() > 0.7 ? [getRandomMediaUrl()] : null),
      commentCount: Math.floor(Math.random() * 12) + 1,
      views: post.views || Math.floor(Math.random() * 160) + 40,
      isPinned: post.isPinned || false,
      isLocked: post.isLocked || false,
    }));
  } catch (error) {
    console.error(`Error generating AI content for ${category.name}:`, error);
    // Fall back to predefined content
    console.log("Falling back to predefined content.");
    return getFallbackContent(category);
  }
}

// Generate comments for a post using AI
async function generateCommentsForPost(postId, postTitle, categorySlug) {
  console.log(`Generating AI comments for post ID ${postId}...`);
  
  const prompt = `
You are generating comments for a community forum post in Barefoot Bay, a residential community in Florida.
The post is in the "${categorySlug}" category and has the title: "${postTitle}"

Create 3-5 realistic comments that residents might write in response to this post.
Make the comments feel authentic, with different perspectives and writing styles.

Format the response as a JSON array with each object having these properties:
- content: The comment text (can include basic HTML like <p> tags)
- userId: Pick a random number from this array: [6, 7, 9, 10, 11, 12]
- postId: ${postId}
- mediaUrls: null

IMPORTANT: Make the comments feel like they were written by different community members with varied perspectives, writing styles, and personalities.
`;

  try {
    let aiResponse;
    
    if (genAI) {
      // Use Google Generative AI
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      const result = await model.generateContent(prompt);
      aiResponse = result.response.text();
    } else if (openaiApiKey) {
      // Use OpenAI if available
      const { OpenAI } = require("openai");
      const openai = new OpenAI({
        apiKey: openaiApiKey,
      });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant creating realistic community forum content." },
          { role: "user", content: prompt }
        ],
      });
      
      aiResponse = completion.choices[0].message.content;
    } else {
      // Fall back to predefined comments
      return getFallbackComments(postId, categorySlug);
    }
    
    // Parse the AI response into JSON
    let cleanedResponse = aiResponse;
    
    // Clean up the response if it has markdown code fences
    if (cleanedResponse.includes("```json")) {
      cleanedResponse = cleanedResponse.split("```json")[1].split("```")[0].trim();
    } else if (cleanedResponse.includes("```")) {
      cleanedResponse = cleanedResponse.split("```")[1].split("```")[0].trim();
    }
    
    // Parse the JSON response
    const comments = JSON.parse(cleanedResponse);
    
    // Ensure each comment has needed properties
    return comments.map(comment => ({
      ...comment,
      userId: comment.userId || getRandomUser().id,
      postId: postId,
      mediaUrls: comment.mediaUrls || null,
    }));
  } catch (error) {
    console.error(`Error generating AI comments for post ID ${postId}:`, error);
    // Fall back to predefined comments
    console.log("Falling back to predefined comments.");
    return getFallbackComments(postId, categorySlug);
  }
}

// Helper function to get fallback content when AI is not available
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
          commentCount: 5,
        },
        {
          title: "New resident looking for recommendations",
          content: "<p>Hi everyone, my family and I just moved to Barefoot Bay, and we're looking for recommendations on local restaurants, services, and community activities. Thanks in advance!</p>",
          userId: 7,
          views: 87,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 8,
        },
      ];
      
    case "announcements":
      return [
        {
          title: "Community Town Hall - April 2025",
          content: "<p><strong>IMPORTANT COMMUNITY ANNOUNCEMENT</strong></p><p>Mark your calendars for our quarterly Town Hall meeting on April 15, 2025 at 6:30 PM in the Community Center.</p>",
          userId: 12,
          views: 210,
          isPinned: true,
          isLocked: false,
          mediaUrls: null,
          commentCount: 2,
        },
      ];
      
    case "events-activities":
      return [
        {
          title: "Weekly Walking Group - Join Us!",
          content: "<p>Our community walking group meets every Tuesday and Thursday at 8:00 AM at the clubhouse. All fitness levels welcome!</p>",
          userId: 9,
          views: 75,
          isPinned: false,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[2]],
          commentCount: 5,
        },
      ];
      
    case "neighbors-helping-neighbors":
      return [
        {
          title: "Need help with lawn maintenance",
          content: "<p>Due to recent surgery, I'm unable to maintain my lawn for the next few weeks. Would any neighbors be willing to help or recommend an affordable service?</p>",
          userId: 11,
          views: 62,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 7,
        },
      ];
      
    case "recommendations":
      return [
        {
          title: "Best local handyman?",
          content: "<p>I'm looking for recommendations for a reliable handyman in the area for several small projects around the house. Who have you used and been happy with?</p>",
          userId: 7,
          views: 105,
          isPinned: false,
          isLocked: false,
          mediaUrls: null,
          commentCount: 12,
        },
      ];
      
    default:
      return [];
  }
}

// Helper function to get fallback comments when AI is not available
function getFallbackComments(postId, categorySlug) {
  const baseComments = [
    {
      content: "Thanks for sharing this information with the community!",
      userId: getRandomUser().id,
      postId,
      mediaUrls: null,
    },
    {
      content: "This is exactly what I was looking for. Very helpful.",
      userId: getRandomUser().id,
      postId,
      mediaUrls: null,
    },
    {
      content: "I have a question about this - could you provide more details?",
      userId: getRandomUser().id,
      postId,
      mediaUrls: null,
    },
  ];
  
  return baseComments;
}

// Generate realistic reactions (likes, etc.)
function generateReactions(postId, commentIds) {
  const reactions = [];
  
  // Add reactions to the post
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
    console.log("Starting AI forum content generation...");
    
    if (!googleApiKey && !openaiApiKey) {
      console.log("No AI API keys detected. Will use predefined content.");
      console.log("To use AI-generated content, please set GEMINI_API_KEY, VITE_GEMINI_API_KEY, or OPENAI_API_KEY in your environment variables.");
    }
    
    // Track all post IDs and comment IDs for reactions
    const allPostIds = [];
    const allCommentIds = [];
    
    // Insert posts for each category
    for (const category of CATEGORIES) {
      // Get AI-generated content for this category
      const posts = await generateCategoryContent(category);
      
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
        
        const postId = postResult.rows[0].id;
        allPostIds.push(postId);
        console.log(`Created post: ${post.title} (ID: ${postId})`);
        
        // Generate and insert comments for this post
        const comments = await generateCommentsForPost(postId, post.title, category.slug);
        
        for (const comment of comments) {
          // Make comment dates slightly after the post date
          const commentDate = new Date(postCreatedAt);
          commentDate.setHours(commentDate.getHours() + Math.floor(Math.random() * 24) + 1);
          
          const commentResult = await pool.query(
            `INSERT INTO forum_comments 
             (content, post_id, user_id, media_urls, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $5) 
             RETURNING id`,
            [
              comment.content,
              comment.postId,
              comment.userId,
              comment.mediaUrls,
              commentDate,
            ]
          );
          
          const commentId = commentResult.rows[0].id;
          allCommentIds.push(commentId);
        }
        
        console.log(`Added ${comments.length} comments to post ID: ${postId}`);
      }
    }
    
    // Generate and insert reactions
    const reactions = generateReactions(allPostIds, allCommentIds);
    
    for (const reaction of reactions) {
      await pool.query(
        `INSERT INTO forum_reactions 
         (post_id, comment_id, user_id, reaction_type, created_at) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          reaction.postId,
          reaction.commentId,
          reaction.userId,
          reaction.reactionType,
          getRandomPastDate(),
        ]
      );
    }
    
    console.log(`Added ${reactions.length} reactions to posts and comments`);
    console.log("AI forum content generation complete!");
    
  } catch (error) {
    console.error("Error generating forum content:", error);
  } finally {
    pool.end();
  }
}

// Run the script
generateForumContent();