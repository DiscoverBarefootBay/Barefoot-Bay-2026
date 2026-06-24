/**
 * Generate realistic forum content for Barefoot Bay community platform using Google's Gemini AI
 * 
 * This script uses Google's Generative AI to generate forum posts and comments
 * based on the Barefoot Bay community profile.
 * 
 * Usage:
 * node ai-generate-forum-content-updated-2025.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Use VITE_GEMINI_API_KEY for Gemini AI
const googleApiKey = process.env.VITE_GEMINI_API_KEY;

if (!googleApiKey) {
  console.log("Warning: No Gemini API key found. Please set VITE_GEMINI_API_KEY in your environment.");
  console.log("Using fallback content instead.");
}

// Setup Google Generative AI if API key is available
let genAI;
if (googleApiKey) {
  genAI = new GoogleGenerativeAI(googleApiKey);
}

// Forum categories from the database
const CATEGORIES = [
  { id: 1, name: "General Discussion", slug: "general-discussion", description: "General topics related to Barefoot Bay community" },
  { id: 2, name: "Announcements", slug: "announcements", description: "Official announcements from the Barefoot Bay community" },
  { id: 3, name: "Events & Activities", slug: "events-activities", description: "Discussions about upcoming events and activities" },
  { id: 4, name: "Neighbors Helping Neighbors", slug: "neighbors-helping-neighbors", description: "A place to offer or request help from fellow residents" },
  { id: 5, name: "Recommendations", slug: "recommendations", description: "Recommendations for local services and businesses" },
];

// Updated media URLs from our current uploads directory
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
        { id: 9, username: "resident1", role: "registered" },
        { id: 10, username: "resident2", role: "registered" },
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

// Generate posts for a category using AI
async function generateCategoryContent(category, users) {
  console.log(`Generating AI content for ${category.name}...`);
  
  const prompt = `
You are generating content for a community forum for Barefoot Bay, a residential community in Florida.
Create 5-6 realistic forum posts for the "${category.name}" category.
The category description is: "${category.description}"

For each post, include:
1. A realistic title
2. Forum post content in HTML format with paragraphs using <p> tags
3. Make content specific to residents of a community like Barefoot Bay with realistic concerns, questions, announcements, etc.
4. Include appropriate references to Florida-specific topics like weather, local activities, wildlife, etc.
5. Make the content feel like it was written by actual residents

Format the response as a JSON array with each object having these properties:
- title: The post title
- content: HTML content with proper formatting
- isPinned: boolean (true for important announcements in the Announcements category, false otherwise)
- isLocked: boolean (usually false except for official announcements that shouldn't get replies)
- userId: Pick a random number from this array: [${users.map(u => u.id).join(', ')}]
- views: A random number between 40 and 200
- mediaUrls: Include an image URL for some posts (about 40% of posts should have images)

IMPORTANT: Make the posts feel like they were written by real community members with authentic concerns and questions relevant to a residential community in Florida.
`;

  try {
    let aiResponse;
    
    if (genAI) {
      // Use Google Generative AI
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      const result = await model.generateContent(prompt);
      aiResponse = result.response.text();
    } else {
      // Fall back to predefined content if no AI service is available
      console.log("No AI API keys found. Using fallback predefined content.");
      return getFallbackContent(category, users);
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
    
    // Ensure each post has needed properties and appropriate images
    return posts.map(post => {
      // If post doesn't specify mediaUrls, randomly assign some based on category
      let mediaUrlsToUse = post.mediaUrls;
      
      if (!mediaUrlsToUse) {
        if (Math.random() > 0.6) { // 40% chance of having image
          // Choose an appropriate image based on category
          switch(category.slug) {
            case 'general-discussion':
              mediaUrlsToUse = [MEDIA_URLS[0]]; // Community image
              break;
            case 'announcements':
              mediaUrlsToUse = [MEDIA_URLS[5]]; // Logo
              break;
            case 'events-activities':
              mediaUrlsToUse = [Math.random() > 0.5 ? MEDIA_URLS[2] : MEDIA_URLS[6]]; // Recreation or event image
              break;
            case 'neighbors-helping-neighbors':
              mediaUrlsToUse = [MEDIA_URLS[3]]; // Map
              break;
            case 'recommendations':
              mediaUrlsToUse = [MEDIA_URLS[4]]; // Golf course
              break;
            default:
              mediaUrlsToUse = [MEDIA_URLS[Math.floor(Math.random() * MEDIA_URLS.length)]];
          }
        } else {
          mediaUrlsToUse = null;
        }
      }
      
      return {
        ...post,
        userId: post.userId || users[Math.floor(Math.random() * users.length)].id,
        mediaUrls: mediaUrlsToUse,
        commentCount: Math.floor(Math.random() * 12) + 1,
        views: post.views || Math.floor(Math.random() * 160) + 40,
        isPinned: post.isPinned || false,
        isLocked: post.isLocked || false,
      };
    });
  } catch (error) {
    console.error(`Error generating AI content for ${category.name}:`, error);
    // Fall back to predefined content
    console.log("Falling back to predefined content.");
    return getFallbackContent(category, users);
  }
}

// Generate comments for a post using AI
async function generateCommentsForPost(postId, postTitle, categorySlug, users) {
  console.log(`Generating AI comments for post ID ${postId}...`);
  
  const prompt = `
You are generating comments for a community forum post in Barefoot Bay, a residential community in Florida.
The post is in the "${categorySlug}" category and has the title: "${postTitle}"

Create 4-6 realistic comments that residents might write in response to this post.
Make the comments feel authentic, with different perspectives, writing styles, and even some friendly disagreements.
Include specific references to Florida life, local activities, and Barefoot Bay community when appropriate.

Format the response as a JSON array with each object having these properties:
- content: The comment text (can include basic HTML like <p> tags)
- userId: Pick a random number from this array: [${users.map(u => u.id).join(', ')}]
- postId: ${postId}
- mediaUrls: Occasionally include an image URL

IMPORTANT: Make the comments feel like they were written by different community members with varied perspectives, writing styles, and personalities.
`;

  try {
    let aiResponse;
    
    if (genAI) {
      // Use Google Generative AI
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      const result = await model.generateContent(prompt);
      aiResponse = result.response.text();
    } else {
      // Fall back to predefined comments
      return getFallbackComments(postId, categorySlug, users);
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
    return comments.map(comment => {
      // Occasionally add media URL to comments
      let mediaUrlsToUse = comment.mediaUrls;
      if (!mediaUrlsToUse && Math.random() > 0.85) { // 15% chance for comments to have images
        mediaUrlsToUse = [MEDIA_URLS[Math.floor(Math.random() * MEDIA_URLS.length)]];
      }
      
      return {
        ...comment,
        userId: comment.userId || users[Math.floor(Math.random() * users.length)].id,
        postId: postId,
        mediaUrls: mediaUrlsToUse || null,
      };
    });
  } catch (error) {
    console.error(`Error generating AI comments for post ID ${postId}:`, error);
    // Fall back to predefined comments
    console.log("Falling back to predefined comments.");
    return getFallbackComments(postId, categorySlug, users);
  }
}

// Helper function to get fallback content when AI is not available
function getFallbackContent(category, users) {
  const randomUserId = () => users[Math.floor(Math.random() * users.length)].id;
  
  // Basic fallback content for each category
  switch (category.slug) {
    case "general-discussion":
      return [
        {
          title: "Welcome to the Barefoot Bay Community Forum!",
          content: "<p>Hello neighbors! I'm excited to welcome everyone to our new community forum. This is a great place for us to connect, share information, and build relationships.</p><p>Feel free to introduce yourself here!</p>",
          userId: randomUserId(),
          views: 120,
          isPinned: true,
          isLocked: false,
          mediaUrls: null,
          commentCount: 5,
        },
        {
          title: "New resident looking for recommendations",
          content: "<p>Hi everyone, my family and I just moved to Barefoot Bay, and we're looking for recommendations on local restaurants, services, and community activities. Thanks in advance!</p>",
          userId: randomUserId(),
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
          userId: randomUserId(),
          views: 210,
          isPinned: true,
          isLocked: false,
          mediaUrls: [MEDIA_URLS[5]],
          commentCount: 2,
        },
      ];
      
    case "events-activities":
      return [
        {
          title: "Weekly Walking Group - Join Us!",
          content: "<p>Our community walking group meets every Tuesday and Thursday at 8:00 AM at the clubhouse. All fitness levels welcome!</p>",
          userId: randomUserId(),
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
          userId: randomUserId(),
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
          userId: randomUserId(),
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
function getFallbackComments(postId, categorySlug, users) {
  const randomUserId = () => users[Math.floor(Math.random() * users.length)].id;
  
  const baseComments = [
    {
      content: "Thanks for sharing this information with the community!",
      userId: randomUserId(),
      postId,
      mediaUrls: null,
    },
    {
      content: "This is exactly what I was looking for. Very helpful.",
      userId: randomUserId(),
      postId,
      mediaUrls: null,
    },
    {
      content: "I have a question about this - could you provide more details?",
      userId: randomUserId(),
      postId,
      mediaUrls: null,
    },
  ];
  
  return baseComments;
}

// Generate realistic reactions (likes, etc.)
function generateReactions(postId, commentIds, users) {
  const reactions = [];
  
  // Add reactions to the post
  const postReactionCount = Math.floor(Math.random() * 10) + 1; // 1-10 reactions
  for (let i = 0; i < postReactionCount; i++) {
    reactions.push({
      userId: users[Math.floor(Math.random() * users.length)].id,
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
          userId: users[Math.floor(Math.random() * users.length)].id,
          postId: null,
          commentId,
          reactionType: getRandomReactionType(),
        });
      }
    }
  });
  
  return reactions;
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

// Delete existing forum data to start fresh
async function clearExistingForumData() {
  try {
    console.log("Clearing existing forum data...");
    
    // Delete in proper order to respect foreign key constraints
    await pool.query("DELETE FROM forum_reactions");
    await pool.query("DELETE FROM forum_comments");
    await pool.query("DELETE FROM forum_posts");
    
    console.log("Existing forum data cleared successfully.");
  } catch (error) {
    console.error("Error clearing forum data:", error);
    throw error;
  }
}

// Main function to generate and insert forum content
async function generateForumContent() {
  try {
    console.log("Starting AI forum content generation...");
    
    if (!googleApiKey) {
      console.log("No AI API keys detected. Will use predefined content.");
      console.log("To use AI-generated content, please set VITE_GEMINI_API_KEY in your environment variables.");
    }
    
    // Get users from database
    const users = await getUsers();
    console.log(`Found ${users.length} users for content generation.`);
    
    // Clear existing forum data
    await clearExistingForumData();
    
    // Track all post IDs and comment IDs for reactions
    const allPostIds = [];
    const allCommentIds = [];
    
    // Insert posts for each category
    for (const category of CATEGORIES) {
      // Get AI-generated content for this category
      const posts = await generateCategoryContent(category, users);
      
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
        allPostIds.push(postId);
        
        // Don't generate comments for locked posts
        if (!post.isLocked) {
          // Generate and insert comments
          const commentCount = post.commentCount || Math.floor(Math.random() * 8) + 1;
          const comments = await generateCommentsForPost(postId, post.title, category.slug, users);
          
          // Only use up to the requested comment count
          const commentsToInsert = comments.slice(0, commentCount);
          
          for (const comment of commentsToInsert) {
            // Insert comment with a date slightly after the post
            const commentCreatedAt = new Date(postCreatedAt);
            commentCreatedAt.setMinutes(commentCreatedAt.getMinutes() + Math.floor(Math.random() * 600) + 10); // 10 min to 10 hours later
            
            const commentResult = await pool.query(
              `INSERT INTO forum_comments
               (content, post_id, user_id, media_urls, created_at, updated_at)
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
            
            allCommentIds.push(commentResult.rows[0].id);
          }
          
          console.log(`Created ${commentsToInsert.length} comments for post ID ${postId}`);
        }
      }
    }
    
    // Generate and insert reactions
    console.log("Generating reactions for posts and comments...");
    const reactions = generateReactions(allPostIds, allCommentIds, users);
    
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
    
    console.log(`Created ${reactions.length} reactions for posts and comments`);
    
    console.log("Forum content generation completed successfully!");
    
    // Close the database connection
    await pool.end();
    
    return {
      postsCreated: allPostIds.length,
      commentsCreated: allCommentIds.length,
      reactionsCreated: reactions.length,
    };
  } catch (error) {
    console.error("Error in forum content generation:", error);
    
    // Close the database connection on error
    await pool.end();
    
    throw error;
  }
}

// Run the main function
generateForumContent()
  .then(results => {
    console.log("Content generation completed with the following results:");
    console.log(`- Posts created: ${results.postsCreated}`);
    console.log(`- Comments created: ${results.commentsCreated}`);
    console.log(`- Reactions created: ${results.reactionsCreated}`);
  })
  .catch(error => {
    console.error("Content generation failed:", error);
    process.exit(1);
  });