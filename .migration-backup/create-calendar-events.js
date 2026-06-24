/**
 * Create sample events for the Barefoot Bay calendar
 * This script creates pre-defined events and matches with the correct database schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { add, format, getDay, addMonths } from 'date-fns';
import pg from 'pg';
import dotenv from 'dotenv';

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
    location: "Barefoot Bay Golf Course, 725 Golf Lane, Barefoot Bay, FL 32976",
    mapLink: "https://maps.google.com/?q=725+Golf+Lane,+Barefoot+Bay,+FL+32976",
    durationHours: 4,
    isRecurring: true,
    recurrenceFrequency: "MONTHLY",
    contactInfo: {
      name: "Robert Johnson",
      email: "golf@barefootbay.org",
      phone: "321-555-8765"
    },
    mediaUrls: ["/uploads/sample/golf-tournament.jpg"]
  },
  {
    title: "WATER AEROBICS CLASS",
    description: "Low-impact water aerobics class designed for seniors. Improve your strength, flexibility, and cardiovascular health in a fun and social setting. All fitness levels welcome. Bring a towel, water bottle, and optional water weights.",
    category: "health",
    location: "Community Pool 1, 625 Barefoot Blvd, Barefoot Bay, FL 32976",
    mapLink: "https://maps.google.com/?q=625+Barefoot+Blvd,+Barefoot+Bay,+FL+32976",
    durationHours: 1,
    isRecurring: true,
    recurrenceFrequency: "WEEKLY",
    contactInfo: {
      name: "Linda Martinez",
      email: "aquafitness@barefootbay.org",
      phone: "321-555-2345"
    },
    mediaUrls: ["/uploads/sample/water-aerobics.jpg"]
  },
  {
    title: "COMMUNITY POTLUCK DINNER",
    description: "Monthly community potluck dinner for all Barefoot Bay residents. Join your neighbors for good food and great company. Please bring a dish to share that serves 8-10 people. Beverages and tableware will be provided.",
    category: "social",
    location: "Building A (Main Hall), 625 Barefoot Blvd, Barefoot Bay, FL 32976",
    mapLink: "https://maps.google.com/?q=625+Barefoot+Blvd,+Barefoot+Bay,+FL+32976",
    durationHours: 3,
    isRecurring: true,
    recurrenceFrequency: "MONTHLY",
    contactInfo: {
      name: "Susan Williams",
      email: "events@barefootbay.org",
      phone: "321-555-9876"
    },
    mediaUrls: ["/uploads/sample/potluck-dinner.jpg"]
  },
  {
    title: "PICKLEBALL CLUB MEETUP",
    description: "Weekly pickleball club meetup for all skill levels. Equipment will be available for beginners. Come enjoy this popular paddle sport that combines elements of tennis, badminton, and ping-pong. Wear comfortable athletic clothing and non-marking court shoes.",
    category: "sports",
    location: "Pickleball Courts, 625 Barefoot Blvd, Barefoot Bay, FL 32976",
    mapLink: "https://maps.google.com/?q=625+Barefoot+Blvd,+Barefoot+Bay,+FL+32976",
    durationHours: 2,
    isRecurring: true,
    recurrenceFrequency: "WEEKLY",
    contactInfo: {
      name: "Michael Thompson",
      email: "pickleball@barefootbay.org",
      phone: "321-555-6789"
    },
    mediaUrls: ["/uploads/sample/pickleball.jpg"]
  },
  {
    title: "BOARD GAME NIGHT",
    description: "Join fellow residents for a fun evening of board games and card games. A variety of games will be available, but feel free to bring your favorites. Light refreshments will be served. All ages welcome.",
    category: "social",
    location: "Building B (Recreation Room), 625 Barefoot Blvd, Barefoot Bay, FL 32976",
    mapLink: "https://maps.google.com/?q=625+Barefoot+Blvd,+Barefoot+Bay,+FL+32976",
    durationHours: 3,
    isRecurring: true,
    recurrenceFrequency: "BI-WEEKLY",
    contactInfo: {
      name: "David Anderson",
      email: "games@barefootbay.org",
      phone: "321-555-4321"
    },
    mediaUrls: ["/uploads/sample/board-games.jpg"]
  },
  {
    title: "BLOOD PRESSURE SCREENING",
    description: "Free blood pressure screening provided by Barefoot Bay Health Services. No appointment necessary. Please bring a list of your current medications if you would like to discuss them with a healthcare professional.",
    category: "health",
    location: "Barefoot Bay Community Center, 625 Barefoot Blvd, Barefoot Bay, FL 32976",
    mapLink: "https://maps.google.com/?q=625+Barefoot+Blvd,+Barefoot+Bay,+FL+32976",
    durationHours: 2,
    isRecurring: true,
    recurrenceFrequency: "WEEKLY",
    contactInfo: {
      name: "Dr. James Wilson",
      email: "health@barefootbay.org",
      phone: "321-555-1234"
    },
    mediaUrls: ["/uploads/sample/health-screening.jpg"]
  },
  {
    title: "TOWN HALL MEETING",
    description: "Monthly town hall meeting to discuss community affairs, upcoming projects, and address resident concerns. All community members are encouraged to attend. The meeting agenda will be posted one week in advance on the community bulletin board.",
    category: "community",
    location: "Barefoot Bay Community Center, 625 Barefoot Blvd, Barefoot Bay, FL 32976",
    mapLink: "https://maps.google.com/?q=625+Barefoot+Blvd,+Barefoot+Bay,+FL+32976",
    durationHours: 2,
    isRecurring: true,
    recurrenceFrequency: "MONTHLY",
    contactInfo: {
      name: "Thomas Miller",
      email: "community@barefootbay.org",
      phone: "321-555-7890"
    },
    mediaUrls: ["/uploads/sample/town-hall.jpg"]
  },
  {
    title: "BOOK CLUB DISCUSSION",
    description: "Join our monthly book club discussion. This month we're reading 'The Dutch House' by Ann Patchett. New members always welcome. Light refreshments will be served. Please read the book prior to attending.",
    category: "social",
    location: "Barefoot Bay Library, 1225 Barefoot Blvd, Barefoot Bay, FL 32976",
    mapLink: "https://maps.google.com/?q=1225+Barefoot+Blvd,+Barefoot+Bay,+FL+32976",
    durationHours: 2,
    isRecurring: true,
    recurrenceFrequency: "MONTHLY",
    contactInfo: {
      name: "Emily Richards",
      email: "bookclub@barefootbay.org",
      phone: "321-555-5678"
    },
    mediaUrls: ["/uploads/sample/book-club.jpg"]
  }
];

/**
 * Process and insert sample events into database
 */
async function insertSampleEvents() {
  console.log('Creating sample events for Barefoot Bay calendar...');
  
  try {
    // Process each event
    const currentDate = new Date();
    let insertedCount = 0;
    
    // First, ensure the uploads/sample directory exists
    const sampleDir = path.join(__dirname, 'uploads', 'sample');
    if (!fs.existsSync(sampleDir)) {
      fs.mkdirSync(sampleDir, { recursive: true });
    }
    
    // Create empty placeholder image files if they don't exist
    // This is just for demonstration purposes
    for (const imageName of [
      'golf-tournament.jpg', 'water-aerobics.jpg', 'potluck-dinner.jpg',
      'pickleball.jpg', 'board-games.jpg', 'health-screening.jpg',
      'town-hall.jpg', 'book-club.jpg'
    ]) {
      const imagePath = path.join(sampleDir, imageName);
      if (!fs.existsSync(imagePath)) {
        // Create a minimal valid JPG file
        const minimalJpg = Buffer.from([
          0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
          0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00,
          0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01,
          0x01, 0x00, 0x00, 0x3F, 0x00, 0xD2, 0xCF, 0x20, 0xFF, 0xD9
        ]);
        fs.writeFileSync(imagePath, minimalJpg);
        console.log(`Created placeholder image: ${imagePath}`);
      }
    }
    
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
      
      // Generate recurrence end date for recurring events
      let recurrenceEndDate = null;
      if (event.isRecurring) {
        recurrenceEndDate = addMonths(startDateTime, 3); // Recur for 3 months
      }
      
      // Insert the event into the database
      const query = `
        INSERT INTO events (
          title, description, start_date, end_date, location, map_link, 
          category, contact_info, hours_of_operation, media_urls, 
          is_recurring, recurrence_frequency, recurrence_end_date,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `;
      
      const values = [
        event.title,
        event.description,
        startDateTime,
        endDateTime,
        event.location,
        event.mapLink,
        event.category,
        JSON.stringify(event.contactInfo),
        null, // hours_of_operation
        event.mediaUrls,
        event.isRecurring,
        event.recurrenceFrequency,
        recurrenceEndDate,
        new Date(), // created_at
        new Date()  // updated_at
      ];
      
      try {
        const result = await pool.query(query, values);
        console.log(`Inserted event: ${event.title} with ID ${result.rows[0].id}`);
        insertedCount++;
      } catch (error) {
        console.error(`Error inserting event ${event.title}:`, error.message);
      }
    }
    
    console.log(`Successfully inserted ${insertedCount} events into the database`);
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    await pool.end();
    console.log('Done!');
  }
}

// Run the script
insertSampleEvents();