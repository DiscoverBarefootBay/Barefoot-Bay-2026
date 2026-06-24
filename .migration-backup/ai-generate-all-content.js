/**
 * Master script to generate content for all Barefoot Bay community sections using AI
 * 
 * This script orchestrates the generation of content for:
 * - Forum posts and comments
 * - Calendar events
 * - Real estate listings
 * - Vendor listings
 * - "More" section content pages
 * 
 * Usage:
 * node ai-generate-all-content.js
 */

import dotenv from 'dotenv';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Import the individual content generators
import { generateForumContent } from './ai-generate-forum-content.js';
import { generateCalendarEvents } from './ai-generate-calendar-events.js';
import { createRealEstateListings } from './create-real-estate-listings.js';
import { generateVendorContent } from './ai-generate-vendor-content.js';
import { generateMoreContent } from './ai-generate-more-content.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt user
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

/**
 * Main function to orchestrate content generation
 */
async function generateAllContent() {
  console.log('===== Barefoot Bay AI Content Generator =====');
  console.log('This script will generate content for all sections of the Barefoot Bay community platform.');
  console.log('Make sure you have set up either GEMINI_API_KEY or VITE_GEMINI_API_KEY in your environment variables.\n');
  
  // Check for the Gemini API key
  const googleApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!googleApiKey) {
    console.error('ERROR: No Gemini API key found in your environment variables.');
    console.log('Please set either GEMINI_API_KEY or VITE_GEMINI_API_KEY in your .env file before running this script.');
    rl.close();
    return;
  }
  
  // Initialize the Google Generative AI
  try {
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    
    // Test the model with a simple query to ensure the API key works
    console.log('Verifying Gemini API key...');
    const result = await model.generateContent("Hello, please respond with just the word 'verified' to confirm connection.");
    const text = result.response.text().trim();
    
    if (text.includes('verified')) {
      console.log('✅ Gemini API key verified successfully. Ready to generate content.');
    } else {
      console.log('⚠️ Gemini API is responding but returned an unexpected response.');
      console.log('The script will continue, but you may want to check your API key if you encounter errors.');
    }
  } catch (error) {
    console.error('❌ Error verifying Gemini API key:', error.message);
    console.log('Please check your API key and internet connection.');
    const continue_anyway = await askQuestion('Do you want to continue anyway? (y/n): ');
    if (continue_anyway.toLowerCase() !== 'y') {
      rl.close();
      return;
    }
  }
  
  
  try {
    // Ask user which sections they want to generate content for
    console.log('Which sections would you like to generate content for?');
    console.log('1. Forum posts and comments');
    console.log('2. Calendar events');
    console.log('3. Real estate listings');
    console.log('4. Vendor listings');
    console.log('5. "More" section pages');
    console.log('6. All sections (this will take a while)');
    
    const choice = await askQuestion('\nEnter your choice (1-6): ');
    
    switch(choice) {
      case '1':
        // Generate forum content
        console.log('\nGenerating forum content...');
        await generateForumContent();
        break;
        
      case '2':
        // Generate calendar events
        console.log('\nGenerating calendar events...');
        await generateCalendarEvents();
        break;
        
      case '3':
        // Generate real estate listings
        console.log('\nGenerating real estate listings...');
        await createRealEstateListings();
        break;
        
      case '4':
        // Generate vendor listings
        console.log('\nGenerating vendor listings...');
        await generateVendorContent();
        break;
        
      case '5':
        // Generate "More" section content
        console.log('\nGenerating "More" section content...');
        await generateMoreContent();
        break;
        
      case '6':
        // Generate all content
        console.log('\nGenerating all content. This will take a while...');
        
        console.log('\n--- Step 1/5: Generating forum content ---');
        await generateForumContent();
        
        console.log('\n--- Step 2/5: Generating calendar events ---');
        await generateCalendarEvents();
        
        console.log('\n--- Step 3/5: Generating real estate listings ---');
        await createRealEstateListings();
        
        console.log('\n--- Step 4/5: Generating vendor listings ---');
        await generateVendorContent();
        
        console.log('\n--- Step 5/5: Generating "More" section content ---');
        await generateMoreContent();
        
        console.log('\nAll content generated successfully!');
        break;
        
      default:
        console.log('Invalid choice. Please run the script again and select a valid option.');
        break;
    }
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    rl.close();
  }
}

// Run the script if it's executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAllContent();
}