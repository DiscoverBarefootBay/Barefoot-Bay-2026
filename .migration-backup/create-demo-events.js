/**
 * Create sample demo events for the calendar
 * This script creates a few realistic events with images
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { add, format, getDay } from 'date-fns';
import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

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

// Sample event data - pre-generated to avoid AI calls
const DEMO_EVENTS = [
  {
    title: "SENIOR GOLF TOURNAMENT",
    description: "Join us for our monthly senior golf tournament at the Barefoot Bay Golf Course. Open to all residents aged 55 and above. Prizes will be awarded to top performers in multiple categories. Please bring your own clubs and register at the golf shop one week prior to the event.",
    category: "sports",
    location: "725 Golf Lane, Barefoot Bay, FL 32976, USA",
    area: "Barefoot Bay Golf Course",
    durationHours: 4,
    frequency: "MONTHLY",
    contactInfo: {
      name: "Robert Johnson",
      email: "golf@barefootbay.org",
      phone: "321-555-8765",
      website: null
    }
  },
  {
    title: "WATER AEROBICS CLASS",
    description: "Low-impact water aerobics class designed for seniors. Improve your strength, flexibility, and cardiovascular health in a fun and social setting. All fitness levels welcome. Bring a towel, water bottle, and optional water weights.",
    category: "health",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    area: "Community Pool 1",
    durationHours: 1,
    frequency: "WEEKLY",
    contactInfo: {
      name: "Linda Martinez",
      email: "aquafitness@barefootbay.org",
      phone: "321-555-2345",
      website: null
    }
  },
  {
    title: "COMMUNITY POTLUCK DINNER",
    description: "Monthly community potluck dinner for all Barefoot Bay residents. Join your neighbors for good food and great company. Please bring a dish to share that serves 8-10 people. Beverages and tableware will be provided.",
    category: "social",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    area: "Building A (Main Hall)",
    durationHours: 3,
    frequency: "MONTHLY",
    contactInfo: {
      name: "Susan Williams",
      email: "events@barefootbay.org",
      phone: "321-555-9876",
      website: null
    }
  },
  {
    title: "PICKLEBALL CLUB MEETUP",
    description: "Weekly pickleball club meetup for all skill levels. Equipment will be available for beginners. Come enjoy this popular paddle sport that combines elements of tennis, badminton, and ping-pong. Wear comfortable athletic clothing and non-marking court shoes.",
    category: "sports",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    area: "Pickleball Courts",
    durationHours: 2,
    frequency: "WEEKLY",
    contactInfo: {
      name: "Michael Thompson",
      email: "pickleball@barefootbay.org",
      phone: "321-555-6789",
      website: null
    }
  },
  {
    title: "BOARD GAME NIGHT",
    description: "Join fellow residents for a fun evening of board games and card games. A variety of games will be available, but feel free to bring your favorites. Light refreshments will be served. All ages welcome.",
    category: "social",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    area: "Building B (Recreation Room)",
    durationHours: 3,
    frequency: "BI_WEEKLY",
    contactInfo: {
      name: "David Anderson",
      email: "games@barefootbay.org",
      phone: "321-555-4321",
      website: null
    }
  },
  {
    title: "BLOOD PRESSURE SCREENING",
    description: "Free blood pressure screening provided by Barefoot Bay Health Services. No appointment necessary. Please bring a list of your current medications if you would like to discuss them with a healthcare professional.",
    category: "health",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    area: "Barefoot Bay Community Center",
    durationHours: 2,
    frequency: "WEEKLY",
    contactInfo: {
      name: "Dr. James Wilson",
      email: "health@barefootbay.org",
      phone: "321-555-1234",
      website: null
    }
  },
  {
    title: "TOWN HALL MEETING",
    description: "Monthly town hall meeting to discuss community affairs, upcoming projects, and address resident concerns. All community members are encouraged to attend. The meeting agenda will be posted one week in advance on the community bulletin board.",
    category: "community",
    location: "625 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    area: "Barefoot Bay Community Center",
    durationHours: 2,
    frequency: "MONTHLY",
    contactInfo: {
      name: "Thomas Miller",
      email: "community@barefootbay.org",
      phone: "321-555-7890",
      website: null
    }
  },
  {
    title: "BOOK CLUB DISCUSSION",
    description: "Join our monthly book club discussion. This month we're reading 'The Dutch House' by Ann Patchett. New members always welcome. Light refreshments will be served. Please read the book prior to attending.",
    category: "social",
    location: "1225 Barefoot Blvd, Barefoot Bay, FL 32976, USA",
    area: "Barefoot Bay Library",
    durationHours: 2,
    frequency: "MONTHLY",
    contactInfo: {
      name: "Emily Richards",
      email: "bookclub@barefootbay.org",
      phone: "321-555-5678",
      website: null
    }
  }
];

/**
 * Download an image for an event category from Unsplash
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
    
    // Use Unsplash source for placeholder images
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
 * Process demo events to add dates and additional details
 * @returns {Promise<Array>} Processed events
 */
async function processEvents() {
  console.log('Processing demo events...');
  const currentDate = new Date();
  const categoryImages = {};
  
  const processedEvents = [];
  
  // Process each event
  for (let i = 0; i < DEMO_EVENTS.length; i++) {
    const event = DEMO_EVENTS[i];
    
    // Generate start and end dates
    const startOffset = i * 2 + Math.floor(Math.random() * 5); // Spread events out
    const startDate = add(currentDate, { days: startOffset });
    let hour = 8 + Math.floor(Math.random() * 10); // Events between 8 AM and 6 PM
    const startDateTime = new Date(startDate.setHours(hour, 0, 0, 0));
    const endDateTime = new Date(
      new Date(startDateTime).setHours(
        startDateTime.getHours() + (event.durationHours || 2)
      )
    );
    
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
    
    // Download image for the category if not already downloaded
    if (!categoryImages[event.category]) {
      categoryImages[event.category] = await downloadEventImage(event.category);
    }
    
    // Create the processed event
    const processedEvent = {
      title: event.title,
      startDate: format(startDateTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      endDate: format(endDateTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      description: event.description,
      category: event.category,
      location: event.location,
      area: event.area,
      contactInfo: event.contactInfo,
      hoursOfOperation: null,
      mediaUrls: categoryImages[event.category] ? [categoryImages[event.category]] : [],
      featuredEvent: i < 3, // First 3 events are featured
      recurrence: recurrence
    };
    
    processedEvents.push(processedEvent);
  }
  
  return processedEvents;
}

/**
 * Insert events into the database
 * @param {Array} events - Events to insert
 * @returns {Promise<number>} Number of events inserted
 */
async function insertEventsToDatabase(events) {
  let insertedCount = 0;
  
  for (const event of events) {
    try {
      // Insert the event into the database
      const query = `
        INSERT INTO events (
          title, description, start_date, end_date, location, area, category,
          contact_info, hours_of_operation, media_urls, featured_event, recurrence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;
      
      const values = [
        event.title,
        event.description,
        event.startDate,
        event.endDate,
        event.location,
        event.area,
        event.category,
        JSON.stringify(event.contactInfo),
        event.hoursOfOperation,
        JSON.stringify(event.mediaUrls),
        event.featuredEvent,
        event.recurrence ? JSON.stringify(event.recurrence) : null
      ];
      
      const result = await pool.query(query, values);
      console.log(`Inserted event: ${event.title} with ID ${result.rows[0].id}`);
      insertedCount++;
    } catch (error) {
      console.error(`Error inserting event ${event.title}:`, error.message);
    }
  }
  
  return insertedCount;
}

/**
 * Save events to a JSON file
 * @param {Array} events - Events to save
 */
async function saveEventsToFile(events) {
  const outputPath = path.join(__dirname, 'uploads', 'demo-events.json');
  
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
 * Main function
 */
async function main() {
  console.log('Creating demo events for Barefoot Bay calendar...');
  
  try {
    // Process events
    const events = await processEvents();
    console.log(`Processed ${events.length} events`);
    
    // Save events to file
    await saveEventsToFile(events);
    
    // Insert events into database
    const insertedCount = await insertEventsToDatabase(events);
    console.log(`Successfully inserted ${insertedCount} events into the database`);
    
    await pool.end();
    console.log('Done!');
  } catch (error) {
    console.error('Error in main process:', error);
    await pool.end();
  }
}

// Run the script
main();