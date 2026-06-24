/**
 * Process exported forum content from the browser tool and insert into database
 * 
 * This script:
 * 1. Reads the JSON file exported from the generate-forum-browser.html tool
 * 2. Processes the data into the format needed for the database
 * 3. Inserts the content into the database
 * 
 * Usage:
 * node process-browser-content.js path/to/exported-content.json
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper to generate a random past date
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

// Helper to get a random reaction type
function getRandomReactionType() {
  const reactionTypes = ["like", "love", "thumbsup", "laugh", "helpful"];
  return reactionTypes[Math.floor(Math.random() * reactionTypes.length)];
}

// Generate realistic reactions for posts and comments
function generateReactions(postId, commentIds) {
  const reactions = [];
  
  // Add reactions to the post
  const postReactionCount = Math.floor(Math.random() * 10) + 1; // 1-10 reactions
  for (let i = 0; i < postReactionCount; i++) {
    reactions.push({
      userId: Math.floor(Math.random() * 7) + 6, // User IDs from 6-12
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
          userId: Math.floor(Math.random() * 7) + 6, // User IDs from 6-12
          postId: null,
          commentId,
          reactionType: getRandomReactionType(),
        });
      }
    }
  });
  
  return reactions;
}

// Main function to process and insert forum content
async function processAndInsertContent(filePath) {
  try {
    console.log(`Reading content from ${filePath}...`);
    
    // Read and parse the JSON file
    const jsonContent = fs.readFileSync(filePath, 'utf8');
    const allContent = JSON.parse(jsonContent);
    
    console.log(`Processing content for ${allContent.length} categories...`);
    
    // Track all post IDs and comment IDs for validation
    const allPostIds = [];
    const allCommentIds = [];
    
    // Process each category
    for (const categoryContent of allContent) {
      const { category, posts } = categoryContent;
      console.log(`Processing content for ${category.name}...`);
      
      // Process each post
      for (const post of posts) {
        try {
          // Insert post
          const postCreatedAt = post.created_at ? new Date(post.created_at) : getRandomPastDate();
          
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
              post.is_pinned || false,
              post.is_locked || false,
              post.views || Math.floor(Math.random() * 100) + 10,
              null, // No media URLs for generated content
              postCreatedAt,
            ]
          );
          
          const postId = postResult.rows[0].id;
          allPostIds.push(postId);
          console.log(`Created post: ${post.title} (ID: ${postId})`);
          
          // Process comments for this post
          const commentIds = [];
          
          for (const comment of post.comments) {
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
                postId,
                comment.author_id,
                comment.created_at ? new Date(comment.created_at) : commentDate,
              ]
            );
            
            const commentId = commentResult.rows[0].id;
            commentIds.push(commentId);
            allCommentIds.push(commentId);
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
          
        } catch (postError) {
          console.error(`Error processing post "${post.title}":`, postError);
        }
      }
    }
    
    console.log(`Content processing complete!`);
    console.log(`Created ${allPostIds.length} posts and ${allCommentIds.length} comments.`);
    
  } catch (error) {
    console.error("Error processing content:", error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Please provide a path to the JSON file as an argument.");
  console.error("Usage: node process-browser-content.js path/to/exported-content.json");
  process.exit(1);
}

const filePath = args[0];
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

// Run the main function
processAndInsertContent(filePath);