/**
 * Generate a small sample set of calendar events for Barefoot Bay community platform
 * Uses Google's Generative AI (Gemini) with a reduced scope for faster execution
 */

import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format, add, getDay } from 'date-fns';
import fetch from 'node-fetch';
import crypto from 'crypto';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Set up Google Generative AI with the environment variable
const googleApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!googleApiKey) {
  console.error("No Gemini API key found. Please set GEMINI_API_KEY or VITE_GEMINI_API_KEY in your environment.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(googleApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

// Event categories - select just a few for quick demonstration
const EVENT_CATEGORIES = [
  'social',
  'sports',
  'health',
  'community'
];

// Locations in Barefoot Bay
const LOCATIONS = [
  { name: 'Barefoot Bay Community Center', address: '625 Barefoot Blvd, Barefoot Bay, FL 32976, USA' },
  { name: 'Building A (Main Hall)', address: '625 Barefoot Blvd, Barefoot Bay, FL 32976, USA' },
  { name: 'Barefoot Bay Golf Course', address: '725 Golf Lane, Barefoot Bay, FL 32976, USA' },
  { name: 'Community Pool 1', address: '625 Barefoot Blvd, Barefoot Bay, FL 32976, USA' },
  { name: 'Tennis Courts', address: '625 Barefoot Blvd, Barefoot Bay, FL 32976, USA' },
  { name: 'Pickleball Courts', address: '625 Barefoot Blvd, Barefoot Bay, FL 32976, USA' }
];

// Community context for Barefoot Bay
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
Common activities include:
- Water aerobics and pool activities
- Golf tournaments and casual play
- Card games and board games (bridge, cribbage, mahjong)
- Arts and crafts classes
- Social gatherings and dances
- Holiday celebrations
`;

/**
 * Generate a batch of calendar events using AI
 * @param {string} category - Event category
 * @param {number} count - Number of events to generate
 * @returns {Promise<Array>} Array of event objects
 */
async function generateEventsForCategory(category, count = 2) {
  console.log(`Generating ${count} events for category: ${category}`);
  
  try {
    // Create the prompt for the AI
    const prompt = `
Create ${count} realistic community events for Barefoot Bay, Florida - a retirement community. 
Each event should be appropriate for the category: ${category.toUpperCase()}.

Use this context about the community:
${COMMUNITY_CONTEXT}

For each event, provide:
1. A title in ALL CAPS (keep it short and clear)
2. A detailed description (2-3 sentences about what the event involves, who it's for, what to bring, etc.)
3. An appropriate location within the community (from the provided list)
4. Duration in hours (typically 1-3 hours)
5. Frequency (ONCE, DAILY, WEEKLY, BI_WEEKLY, MONTHLY)
6. Contact information (name, email, phone)

Format as a JSON array with objects having these fields:
- title (string)
- description (string)
- location (string - choose from the locations list)
- durationHours (number)
- frequency (string - ONCE, DAILY, WEEKLY, BI_WEEKLY, MONTHLY)
- contactName (string)
- contactEmail (string)
- contactPhone (string)

Make sure titles are catchy, ALL CAPS, and reflect what the activity actually is (like "WATER AEROBICS" or "BRIDGE CLUB").
Ensure descriptions are informative and enticing.
Only respond with the JSON array, no other text.
`;

    // Call the AI model
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract the JSON from the response
    let events = [];
    try {
      // Find JSON content by searching for array markers
      const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const jsonContent = jsonMatch ? jsonMatch[0] : responseText;
      
      events = JSON.parse(jsonContent);
      console.log(`Successfully generated ${events.length} events for ${category}`);
    } catch (err) {
      console.error(`Error parsing AI response for ${category}:`, err);
      console.log('AI response:', responseText);
      return [];
    }
    
    // Process the events to add additional details
    const currentDate = new Date();
    const processedEvents = events.map((event, index) => {
      // Generate start and end dates
      const startOffset = index * 2 + Math.floor(Math.random() * 10); // Spread events out
      const startDate = add(currentDate, { days: startOffset });
      let hour = 8 + Math.floor(Math.random() * 10); // Events between 8 AM and 6 PM
      const startDateTime = new Date(startDate.setHours(hour, 0, 0, 0));
      const endDateTime = new Date(
        new Date(startDateTime).setHours(
          startDateTime.getHours() + (event.durationHours || 2)
        )
      );
      
      // Choose a location from our list
      const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
      
      // Generate recurring event info if needed
      let recurrence = null;
      if (event.frequency && event.frequency !== 'ONCE') {
        const dayOfWeek = getDay(startDateTime);
        recurrence = {
          frequency: event.frequency,
          interval: 1,
          byDay: [dayOfWeek],
          until: add(startDateTime, { months: 3 }) // Recur for 3 months
        };
      }
      
      // Format the final event object for the API
      return {
        title: event.title,
        startDate: format(startDateTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        endDate: format(endDateTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        description: event.description,
        category: category,
        location: location.address,
        area: location.name,
        contactInfo: {
          name: event.contactName,
          email: event.contactEmail,
          phone: event.contactPhone,
          website: null
        },
        hoursOfOperation: null,
        mediaUrls: [],
        featuredEvent: Math.random() > 0.8, // 20% chance of being featured
        recurrence: recurrence
      };
    });
    
    return processedEvents;
  } catch (error) {
    console.error(`Error generating events for category ${category}:`, error);
    return [];
  }
}

/**
 * Download an image for an event category from Unsplash API or use a local fallback
 * @param {string} category - Event category to get an image for
 * @returns {Promise<string|null>} - URL to the uploaded image or null if failed
 */
async function downloadEventImage(category) {
  try {
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create events subdirectory if it doesn't exist
    const eventsDir = path.join(uploadsDir, 'events');
    if (!fs.existsSync(eventsDir)) {
      fs.mkdirSync(eventsDir, { recursive: true });
    }
    
    // Generate a search term based on the category
    let searchTerm = '';
    switch(category) {
      case 'social':
        searchTerm = 'seniors social gathering florida';
        break;
      case 'sports':
        searchTerm = 'senior golf tennis pickleball';
        break;
      case 'health':
        searchTerm = 'seniors health wellness class';
        break;
      case 'community':
        searchTerm = 'community center meeting seniors';
        break;
      default:
        searchTerm = 'florida retirement community events';
    }
    
    // Use a placeholder service for free stock photos (no API key required)
    // This is a legal and free source of random placeholder images by category
    const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(searchTerm)}`;
    
    // Generate a unique filename
    const timestamp = Date.now();
    const randomHash = crypto.createHash('md5').update(category + timestamp).digest('hex').substring(0, 8);
    const filename = `event-${category}-${timestamp}-${randomHash}.jpg`;
    const filepath = path.join(eventsDir, filename);
    
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    // Save the image to disk
    const buffer = await response.buffer();
    fs.writeFileSync(filepath, buffer);
    console.log(`Downloaded image for ${category} to ${filepath}`);
    
    // Return the path to the image (relative to project root)
    return `/uploads/events/${filename}`;
  } catch (error) {
    console.error(`Error downloading image for category ${category}:`, error);
    return null;
  }
}

/**
 * Add images to a list of events based on their categories
 * @param {Array} events - Array of event objects to add images to
 * @returns {Promise<Array>} - Updated events with mediaUrls
 */
async function addImagesToEvents(events) {
  console.log('Adding relevant images to events...');
  
  // Download one image per category to avoid too many requests
  const categoryImages = {};
  
  for (const event of events) {
    try {
      // If this category doesn't have an image yet, download one
      if (!categoryImages[event.category]) {
        categoryImages[event.category] = await downloadEventImage(event.category);
      }
      
      // Add the image URL to the event's mediaUrls
      if (categoryImages[event.category]) {
        event.mediaUrls = [categoryImages[event.category]];
      }
    } catch (error) {
      console.error(`Error adding image to event ${event.title}:`, error);
    }
  }
  
  return events;
}

/**
 * Generate and save events to a JSON file
 * @param {Array} events - Array of event objects
 * @returns {Promise<void>}
 */
async function saveEventsToFile(events) {
  const outputPath = path.join(__dirname, 'uploads', 'sample-events.json');
  
  try {
    // Create the uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Write the events to a JSON file
    fs.writeFileSync(outputPath, JSON.stringify(events, null, 2));
    console.log(`Saved ${events.length} events to ${outputPath}`);
  } catch (error) {
    console.error('Error saving events to file:', error);
  }
}

/**
 * Main function to generate a sample set of events
 */
async function generateSampleEvents() {
  console.log('Starting to generate sample calendar events for Barefoot Bay...');
  
  try {
    const allEvents = [];
    
    // Generate events for each category (just 2 per category for this sample)
    for (const category of EVENT_CATEGORIES) {
      const events = await generateEventsForCategory(category, 2);
      allEvents.push(...events);
    }
    
    console.log(`Generated a total of ${allEvents.length} events`);
    
    // Add images to events
    console.log('Adding images to events...');
    const eventsWithImages = await addImagesToEvents(allEvents);
    
    // Save all events to a file
    await saveEventsToFile(eventsWithImages);
    
    console.log('Sample events generation complete!');
    console.log(`You can find the generated events in the file: ${path.join(__dirname, 'uploads', 'sample-events.json')}`);
    
    return eventsWithImages;
  } catch (error) {
    console.error('Error in sample event generation:', error);
    return [];
  }
}

// Run the script if it's executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateSampleEvents();
}

export { generateSampleEvents };