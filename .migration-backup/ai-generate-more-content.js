/**
 * Generate realistic content for Barefoot Bay community platform's "More" section using AI
 * 
 * This script uses Google's Generative AI (Gemini) to create informative content
 * for the different pages in the "More" section such as amenities, government,
 * community information, etc.
 * 
 * Usage:
 * node ai-generate-more-content.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Connect to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Set up Google Generative AI with the environment variable
const googleApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!googleApiKey) {
  console.error("No Gemini API key found. Please set GEMINI_API_KEY or VITE_GEMINI_API_KEY in your environment.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(googleApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

// Content pages to generate for the "More" section
const CONTENT_PAGES = [
  {
    slug: "amenities-pools",
    title: "Community Pools",
    description: "Information about the community pools in Barefoot Bay"
  },
  {
    slug: "amenities-golf",
    title: "Golf Course",
    description: "Information about the golf courses and facilities"
  },
  {
    slug: "amenities-recreation",
    title: "Recreation Facilities",
    description: "Information about recreation centers and activities"
  },
  {
    slug: "government-bbrd",
    title: "BBRD",
    description: "Information about the Barefoot Bay Recreation District"
  },
  {
    slug: "government-board",
    title: "Board of Trustees",
    description: "Information about the Board of Trustees"
  },
  {
    slug: "government-meetings",
    title: "Community Meetings",
    description: "Schedule and information about community meetings"
  },
  {
    slug: "community-about",
    title: "About Our Community",
    description: "General information about Barefoot Bay"
  },
  {
    slug: "community-news",
    title: "Community News",
    description: "Latest news and updates from Barefoot Bay"
  },
  {
    slug: "community-resources",
    title: "Community Resources",
    description: "Resources and links for Barefoot Bay residents"
  }
];

// Community context for Barefoot Bay
const COMMUNITY_CONTEXT = `
Barefoot Bay is a residential community located in Brevard County, Florida, near Sebastian. 
It's primarily a retirement and vacation community with many amenities including:
- Community pools (3 main pools with different facilities)
- Golf course (9-hole course with pro shop)
- Tennis and pickleball courts
- Recreation centers with various activities
- Walking trails and natural areas
- Community events and activities
- Close to beaches, fishing, and water activities

Barefoot Bay is governed by the Barefoot Bay Recreation District (BBRD), which is overseen by a Board of Trustees.
The community holds regular meetings for residents to participate in governance.

Residents are typically aged 55+, though there are some younger families. 
The community is known for its friendly atmosphere, active lifestyle options, and natural Florida beauty.
The community was established in the 1970s and has grown into a vibrant destination for retirees and vacationers.

The weather is typically warm year-round, with a tropical climate that supports palm trees and other tropical vegetation.
Wildlife in the area includes birds, fish, alligators, and other Florida native species.
`;

/**
 * Generate content for a specific page using AI
 * @param {Object} page - Page object with slug, title, and description
 * @returns {Promise<Object>} Generated content object
 */
async function generatePageContent(page) {
  console.log(`Generating content for page: ${page.title} (${page.slug})`);
  
  try {
    // Create the prompt for the AI based on the page type
    let specificPrompt = '';
    
    // Customize the prompt based on the page slug
    if (page.slug.startsWith('amenities-')) {
      specificPrompt = `
This page should describe one of Barefoot Bay's amenities: ${page.title}.
Include details about:
- Facilities available
- Hours of operation
- Rules and guidelines
- Any special events or activities held at this facility
- Contact information for facility management
`;
    } else if (page.slug.startsWith('government-')) {
      specificPrompt = `
This page should provide information about the governance aspect: ${page.title}.
Include details about:
- Role and responsibilities
- Current members or officials
- Meeting schedules
- How residents can participate or contact
- Recent initiatives or decisions
`;
    } else if (page.slug.startsWith('community-')) {
      specificPrompt = `
This page should provide information about: ${page.title}.
Include details about:
- Key community facts and history
- What makes Barefoot Bay special
- Community values and lifestyle
- Demographics and location information
- Frequently asked questions
`;
    }
    
    const prompt = `
Create informative, welcoming content for the Barefoot Bay community website page: "${page.title}".
${page.description}

Use this context about the community:
${COMMUNITY_CONTEXT}

${specificPrompt}

Format your response as HTML that can be used directly on the website.
Use appropriate HTML tags (p, h2, h3, ul, ol, etc.) for formatting.
Create engaging, positive content that highlights the community's strengths.
The tone should be friendly, informative, and professional.
Include at least 3-4 paragraphs of content with appropriate headings.
Don't include any images or external links in the HTML.

Only respond with the HTML content. No additional text.
`;

    // Call the AI model
    const result = await model.generateContent(prompt);
    const htmlContent = result.response.text();
    
    // Clean up the HTML content if needed
    const cleanedHtml = htmlContent
      .replace(/```html/g, '')
      .replace(/```/g, '')
      .trim();
    
    // Create the page content object
    const contentObject = {
      slug: page.slug,
      title: page.title,
      content: cleanedHtml,
      mediaUrls: [],
      isHidden: false
    };
    
    console.log(`Successfully generated content for ${page.title}`);
    return contentObject;
  } catch (error) {
    console.error(`Error generating content for ${page.slug}:`, error);
    return {
      slug: page.slug,
      title: page.title,
      content: `<p>Content coming soon for ${page.title}.</p>`,
      mediaUrls: [],
      isHidden: false
    };
  }
}

/**
 * Insert or update page content in the database
 * @param {Object} page - Page content object
 * @returns {Promise<Object>} Result of the operation
 */
async function upsertPageContent(page) {
  try {
    // Check if the page already exists
    const checkQuery = 'SELECT id FROM page_content WHERE slug = $1';
    const checkResult = await pool.query(checkQuery, [page.slug]);
    
    let result;
    
    if (checkResult.rows.length > 0) {
      // Update existing page
      const pageId = checkResult.rows[0].id;
      const updateQuery = `
        UPDATE page_content
        SET title = $1, content = $2, media_urls = $3, is_hidden = $4, updated_at = NOW(), updated_by = 6
        WHERE id = $5
        RETURNING id
      `;
      
      result = await pool.query(updateQuery, [
        page.title,
        page.content,
        JSON.stringify(page.mediaUrls),
        page.isHidden,
        pageId
      ]);
      
      console.log(`Updated page content for ${page.slug} with ID ${pageId}`);
    } else {
      // Insert new page
      const insertQuery = `
        INSERT INTO page_content (slug, title, content, media_urls, is_hidden, updated_by)
        VALUES ($1, $2, $3, $4, $5, 6)
        RETURNING id
      `;
      
      result = await pool.query(insertQuery, [
        page.slug,
        page.title,
        page.content,
        JSON.stringify(page.mediaUrls),
        page.isHidden
      ]);
      
      console.log(`Created new page content for ${page.slug} with ID ${result.rows[0].id}`);
    }
    
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error(`Error upserting page content for ${page.slug}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Save generated content to JSON files
 * @param {Array} pages - Array of page content objects
 * @returns {Promise<void>}
 */
async function saveContentToFiles(pages) {
  const outputDir = path.join(__dirname, 'uploads', 'more-content');
  
  try {
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save each page to its own file
    for (const page of pages) {
      const filePath = path.join(outputDir, `${page.slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(page, null, 2));
      console.log(`Saved content for ${page.slug} to ${filePath}`);
    }
    
    // Also save all content to a single file
    const allContentPath = path.join(outputDir, 'all-content.json');
    fs.writeFileSync(allContentPath, JSON.stringify(pages, null, 2));
    console.log(`Saved all content to ${allContentPath}`);
  } catch (error) {
    console.error('Error saving content to files:', error);
  }
}

/**
 * Main function to generate content for all pages
 */
async function generateMoreContent() {
  console.log('Starting to generate content for the "More" section pages...');
  
  try {
    const generatedPages = [];
    
    // Generate content for each page
    for (const page of CONTENT_PAGES) {
      const content = await generatePageContent(page);
      generatedPages.push(content);
    }
    
    console.log(`Generated content for ${generatedPages.length} pages`);
    
    // Save content to files
    await saveContentToFiles(generatedPages);
    
    // Ask user if they want to insert content into the database
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Would you like to insert/update this content in the database? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        let successCount = 0;
        
        for (const page of generatedPages) {
          const result = await upsertPageContent(page);
          if (result.success) {
            successCount++;
          }
        }
        
        console.log(`Successfully inserted/updated ${successCount} pages in the database`);
      } else {
        console.log('Content was not inserted into the database');
        console.log(`You can find the generated content in the directory: ${path.join(__dirname, 'uploads', 'more-content')}`);
      }
      
      readline.close();
      await pool.end();
      console.log('Done!');
    });
  } catch (error) {
    console.error('Error in main process:', error);
    await pool.end();
  }
}

// Run the script if it's executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateMoreContent();
}

export { generateMoreContent, generatePageContent };