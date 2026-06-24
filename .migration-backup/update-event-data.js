/**
 * Script to update event data with missing fields and download/reference open source images
 * This script:
 * 1. Downloads relevant open source images for events based on category
 * 2. Updates events with missing data (contact_info, hours_of_operation, map_link, media_urls)
 * 3. Ensures all fields are complete for testing purposes
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import pg from 'pg';
import Batch from 'batch';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Open-source image URLs by category
const openSourceImagesByCategory = {
  entertainment: [
    { url: 'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg', description: 'Concert crowd' },
    { url: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg', description: 'Theater performance' },
    { url: 'https://images.pexels.com/photos/1916821/pexels-photo-1916821.jpeg', description: 'Comedy show' },
    { url: 'https://images.pexels.com/photos/196652/pexels-photo-196652.jpeg', description: 'Movie screening' },
    { url: 'https://images.pexels.com/photos/625644/pexels-photo-625644.jpeg', description: 'Dance performance' }
  ],
  social: [
    { url: 'https://images.pexels.com/photos/6964104/pexels-photo-6964104.jpeg', description: 'Community gathering' },
    { url: 'https://images.pexels.com/photos/7148384/pexels-photo-7148384.jpeg', description: 'Social club meeting' },
    { url: 'https://images.pexels.com/photos/8111311/pexels-photo-8111311.jpeg', description: 'Seniors playing cards' },
    { url: 'https://images.pexels.com/photos/5026851/pexels-photo-5026851.jpeg', description: 'Book club' },
    { url: 'https://images.pexels.com/photos/7180788/pexels-photo-7180788.jpeg', description: 'Group activity' }
  ],
  government: [
    { url: 'https://images.pexels.com/photos/1056553/pexels-photo-1056553.jpeg', description: 'Community meeting' },
    { url: 'https://images.pexels.com/photos/8845354/pexels-photo-8845354.jpeg', description: 'Town hall' },
    { url: 'https://images.pexels.com/photos/6646918/pexels-photo-6646918.jpeg', description: 'Board meeting' },
    { url: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg', description: 'Community planning' },
    { url: 'https://images.pexels.com/photos/3182749/pexels-photo-3182749.jpeg', description: 'Voting and elections' }
  ]
};

// Sport-specific images for social events that involve sports
const sportImages = {
  'swimming': ['https://images.pexels.com/photos/260598/pexels-photo-260598.jpeg', 'https://images.pexels.com/photos/73760/swimming-swimmer-female-race-73760.jpeg'],
  'yoga': ['https://images.pexels.com/photos/317157/pexels-photo-317157.jpeg', 'https://images.pexels.com/photos/1051838/pexels-photo-1051838.jpeg'],
  'golf': ['https://images.pexels.com/photos/114972/pexels-photo-114972.jpeg', 'https://images.pexels.com/photos/424767/pexels-photo-424767.jpeg'],
  'tennis': ['https://images.pexels.com/photos/8224058/pexels-photo-8224058.jpeg', 'https://images.pexels.com/photos/5730742/pexels-photo-5730742.jpeg'],
  'pickleball': ['https://images.pexels.com/photos/5739118/pexels-photo-5739118.jpeg', 'https://images.pexels.com/photos/7464807/pexels-photo-7464807.jpeg'],
  'bowling': ['https://images.pexels.com/photos/4988021/pexels-photo-4988021.jpeg', 'https://images.pexels.com/photos/4225228/pexels-photo-4225228.jpeg'],
  'fitness': ['https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg', 'https://images.pexels.com/photos/791763/pexels-photo-791763.jpeg']
};

// Arts and crafts images
const artsAndCraftsImages = {
  'art': ['https://images.pexels.com/photos/374054/pexels-photo-374054.jpeg', 'https://images.pexels.com/photos/1038041/pexels-photo-1038041.jpeg'],
  'craft': ['https://images.pexels.com/photos/3972737/pexels-photo-3972737.jpeg', 'https://images.pexels.com/photos/4992776/pexels-photo-4992776.jpeg'],
  'quilting': ['https://images.pexels.com/photos/8961444/pexels-photo-8961444.jpeg', 'https://images.pexels.com/photos/5601216/pexels-photo-5601216.jpeg'],
  'painting': ['https://images.pexels.com/photos/1646953/pexels-photo-1646953.jpeg', 'https://images.pexels.com/photos/3844789/pexels-photo-3844789.jpeg'],
  'choir': ['https://images.pexels.com/photos/7096/people-woman-event-singing.jpg', 'https://images.pexels.com/photos/10028027/pexels-photo-10028027.jpeg'],
  'music': ['https://images.pexels.com/photos/4328961/pexels-photo-4328961.jpeg', 'https://images.pexels.com/photos/4088012/pexels-photo-4088012.jpeg']
};

// Game and card images
const gameImages = {
  'cards': ['https://images.pexels.com/photos/6203797/pexels-photo-6203797.jpeg', 'https://images.pexels.com/photos/3279691/pexels-photo-3279691.jpeg'],
  'bingo': ['https://images.pexels.com/photos/6163593/pexels-photo-6163593.jpeg', 'https://images.pexels.com/photos/5185695/pexels-photo-5185695.jpeg'],
  'bridge': ['https://images.pexels.com/photos/1059658/pexels-photo-1059658.jpeg', 'https://images.pexels.com/photos/1831625/pexels-photo-1831625.jpeg'],
  'canasta': ['https://images.pexels.com/photos/1201996/pexels-photo-1201996.jpeg', 'https://images.pexels.com/photos/5673500/pexels-photo-5673500.jpeg'],
  'cribbage': ['https://images.pexels.com/photos/3933273/pexels-photo-3933273.jpeg', 'https://images.pexels.com/photos/7290747/pexels-photo-7290747.jpeg'],
  'board games': ['https://images.pexels.com/photos/776654/pexels-photo-776654.jpeg', 'https://images.pexels.com/photos/5532850/pexels-photo-5532850.jpeg']
};

// Social event images
const socialEventImages = {
  'lunch': ['https://images.pexels.com/photos/5491010/pexels-photo-5491010.jpeg', 'https://images.pexels.com/photos/4255483/pexels-photo-4255483.jpeg'],
  'dinner': ['https://images.pexels.com/photos/5379437/pexels-photo-5379437.jpeg', 'https://images.pexels.com/photos/8133136/pexels-photo-8133136.jpeg'],
  'party': ['https://images.pexels.com/photos/5707603/pexels-photo-5707603.jpeg', 'https://images.pexels.com/photos/3171770/pexels-photo-3171770.jpeg'],
  'club': ['https://images.pexels.com/photos/936048/pexels-photo-936048.jpeg', 'https://images.pexels.com/photos/8111435/pexels-photo-8111435.jpeg'],
  'meeting': ['https://images.pexels.com/photos/3810756/pexels-photo-3810756.jpeg', 'https://images.pexels.com/photos/6517037/pexels-photo-6517037.jpeg']
};

// Function to create default hours of operation
function createDefaultHoursOfOperation() {
  return {
    Monday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Tuesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Wednesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Thursday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Friday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Saturday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
    Sunday: { isOpen: false, openTime: "09:00", closeTime: "17:00" }
  };
}

// Function to create contact info based on event category and title
function createContactInfo(event) {
  const contactInfo = {
    name: "",
    phone: "",
    email: "",
    website: ""
  };
  
  // Add category-specific contact info
  if (event.category === 'entertainment') {
    contactInfo.name = "Entertainment Coordinator";
    contactInfo.phone = "(321) 555-1234";
    contactInfo.email = "entertainment@barefootbay.org";
    contactInfo.website = "https://barefootbay.org/entertainment";
  } else if (event.category === 'social') {
    contactInfo.name = "Social Activities Director";
    contactInfo.phone = "(321) 555-5678";
    contactInfo.email = "social@barefootbay.org";
    contactInfo.website = "https://barefootbay.org/social";
  } else if (event.category === 'government') {
    contactInfo.name = "Community Management";
    contactInfo.phone = "(321) 555-9012";
    contactInfo.email = "government@barefootbay.org";
    contactInfo.website = "https://barefootbay.org/government";
  }
  
  // Personalize for specific events if they match certain keywords
  const title = event.title.toLowerCase();
  
  if (title.includes('golf')) {
    contactInfo.name = "Golf Course Manager";
    contactInfo.email = "golf@barefootbay.org";
  } else if (title.includes('pool') || title.includes('swim')) {
    contactInfo.name = "Aquatics Director";
    contactInfo.email = "aquatics@barefootbay.org";
  } else if (title.includes('yoga') || title.includes('fitness')) {
    contactInfo.name = "Fitness Coordinator";
    contactInfo.email = "fitness@barefootbay.org";
  } else if (title.includes('art') || title.includes('craft') || title.includes('quilt')) {
    contactInfo.name = "Arts & Crafts Coordinator";
    contactInfo.email = "arts@barefootbay.org";
  } else if (title.includes('card') || title.includes('bridge') || title.includes('bingo') || 
             title.includes('canasta') || title.includes('cribbage')) {
    contactInfo.name = "Card Games Coordinator";
    contactInfo.email = "games@barefootbay.org";
  }
  
  return contactInfo;
}

// Function to download an image file and save it locally
function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, 'uploads/events', filename);
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Image downloaded and saved: ${filename}`);
        resolve(filename);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); // Delete the file if there was an error
      reject(err);
    });
  });
}

// Function to get suitable image URLs for an event based on title and category
function getImageUrlsForEvent(event) {
  const title = event.title.toLowerCase();
  const category = event.category.toLowerCase();
  let imageUrls = [];
  
  // First try to match specific keywords in the title
  if (title.includes('swim') || title.includes('pool') || title.includes('aqua') || title.includes('water')) {
    imageUrls = sportImages.swimming;
  } else if (title.includes('yoga')) {
    imageUrls = sportImages.yoga;
  } else if (title.includes('golf')) {
    imageUrls = sportImages.golf;
  } else if (title.includes('tennis')) {
    imageUrls = sportImages.tennis;
  } else if (title.includes('pickleball')) {
    imageUrls = sportImages.pickleball;
  } else if (title.includes('bowl')) {
    imageUrls = sportImages.bowling;
  } else if (title.includes('fitness') || title.includes('exercise') || title.includes('aerobic')) {
    imageUrls = sportImages.fitness;
  } else if (title.includes('art') || title.includes('gallery')) {
    imageUrls = artsAndCraftsImages.art;
  } else if (title.includes('craft')) {
    imageUrls = artsAndCraftsImages.craft;
  } else if (title.includes('quilt')) {
    imageUrls = artsAndCraftsImages.quilting;
  } else if (title.includes('paint')) {
    imageUrls = artsAndCraftsImages.painting;
  } else if (title.includes('choir') || title.includes('sing')) {
    imageUrls = artsAndCraftsImages.choir;
  } else if (title.includes('music') || title.includes('band') || title.includes('concert')) {
    imageUrls = artsAndCraftsImages.music;
  } else if (title.includes('card') || title.includes('poker')) {
    imageUrls = gameImages.cards;
  } else if (title.includes('bingo')) {
    imageUrls = gameImages.bingo;
  } else if (title.includes('bridge')) {
    imageUrls = gameImages.bridge;
  } else if (title.includes('canasta')) {
    imageUrls = gameImages.canasta;
  } else if (title.includes('cribbage')) {
    imageUrls = gameImages.cribbage;
  } else if (title.includes('game') || title.includes('board game')) {
    imageUrls = gameImages['board games'];
  } else if (title.includes('lunch')) {
    imageUrls = socialEventImages.lunch;
  } else if (title.includes('dinner')) {
    imageUrls = socialEventImages.dinner;
  } else if (title.includes('party')) {
    imageUrls = socialEventImages.party;
  } else if (title.includes('club')) {
    imageUrls = socialEventImages.club;
  } else if (title.includes('meeting')) {
    imageUrls = socialEventImages.meeting;
  } else {
    // If no specific match, use category-based images
    const categoryImages = openSourceImagesByCategory[category];
    if (categoryImages && categoryImages.length > 0) {
      imageUrls = categoryImages.map(img => img.url);
    }
  }
  
  // If we still don't have any images, use a generic one for the category
  if (imageUrls.length === 0) {
    const categoryImages = openSourceImagesByCategory[category];
    if (categoryImages && categoryImages.length > 0) {
      imageUrls = categoryImages.map(img => img.url);
    }
  }
  
  // Always return at least one URL - use default if needed
  if (imageUrls.length === 0) {
    imageUrls = [openSourceImagesByCategory.social[0].url]; // Default to first social image
  }
  
  return imageUrls;
}

// Main function to update all events
async function updateAllEvents() {
  try {
    console.log('Starting event update process...');
    
    // 1. Get all events from the database
    const { rows: events } = await pool.query('SELECT * FROM events ORDER BY id');
    console.log(`Found ${events.length} events to process`);
    
    // Process events in smaller batches to avoid memory issues
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < events.length; i += batchSize) {
      const batchEvents = events.slice(i, i + batchSize);
      batches.push(batchEvents);
    }
    
    console.log(`Split into ${batches.length} batches for processing`);
    
    // Process each batch sequentially
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1} of ${batches.length} (${batch.length} events)`);
      
      // Process each event in the batch
      for (let i = 0; i < batch.length; i++) {
        const event = batch[i];
        console.log(`Processing event ${event.id}: ${event.title}`);
        
        try {
          // 2. Prepare missing data for the event
          const updates = {};
          
          // Add hours of operation if missing
          if (!event.hours_of_operation) {
            updates.hours_of_operation = createDefaultHoursOfOperation();
          }
          
          // Add contact info if missing or empty
          if (!event.contact_info || Object.keys(event.contact_info).length === 0) {
            updates.contact_info = createContactInfo(event);
          }
          
          // Add map link if missing
          if (!event.map_link && event.location) {
            updates.map_link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
          }
          
          // Add media URLs if missing
          if (!event.media_urls || !Array.isArray(event.media_urls) || event.media_urls.length === 0) {
            // Get appropriate images
            const imageUrls = getImageUrlsForEvent(event);
            
            // Download images and get local paths
            const mediaUrls = [];
            
            for (let j = 0; j < Math.min(2, imageUrls.length); j++) {
              const imageUrl = imageUrls[j];
              const imageName = `${event.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${j+1}.jpg`;
              
              try {
                await downloadImage(imageUrl, imageName);
                mediaUrls.push(`/uploads/events/${imageName}`);
              } catch (err) {
                console.error(`Error downloading image for event ${event.id}:`, err);
              }
            }
            
            if (mediaUrls.length > 0) {
              updates.media_urls = mediaUrls;
            }
          }
          
          // 3. Update the event in the database if we have changes
          if (Object.keys(updates).length > 0) {
            // No need for the intermediate variables, we'll build the query directly
            
            // Execute update
            const query = {
              text: `UPDATE events SET ${Object.keys(updates).map((col, i) => `${col} = $${i + 2}`).join(', ')} WHERE id = $1`,
              values: [event.id, ...Object.values(updates).map(v => typeof v === 'object' ? JSON.stringify(v) : v)]
            };
            
            await pool.query(query);
            console.log(`Updated event ${event.id} with:`, Object.keys(updates).join(', '));
          } else {
            console.log(`No updates needed for event ${event.id}`);
          }
          
        } catch (err) {
          console.error(`Error processing event ${event.id}:`, err);
        }
      }
      
      console.log(`Completed batch ${batchIndex + 1}`);
    }
    
    console.log('All events have been processed successfully');
    
  } catch (err) {
    console.error('Error in updateAllEvents:', err);
  } finally {
    // Close the database connection
    await pool.end();
    console.log('Database connection closed');
  }
}

// Execute the main function
updateAllEvents().catch(console.error);