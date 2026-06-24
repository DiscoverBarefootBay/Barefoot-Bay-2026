/**
 * A more direct approach to update event data using SQL
 * This script directly updates the database tables with batch SQL queries
 */

import pg from 'pg';
const { Pool } = pg;

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Update all events with missing hours of operation
 */
async function updateHoursOfOperation() {
  console.log('Updating hours of operation for events...');
  
  const defaultHoursOfOperation = {
    Monday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Tuesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Wednesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Thursday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Friday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
    Saturday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
    Sunday: { isOpen: false, openTime: "09:00", closeTime: "17:00" }
  };
  
  try {
    const result = await pool.query(`
      UPDATE events 
      SET hours_of_operation = $1::jsonb 
      WHERE hours_of_operation IS NULL OR hours_of_operation = '{}'::jsonb
    `, [JSON.stringify(defaultHoursOfOperation)]);
    
    console.log(`Updated hours of operation for ${result.rowCount} events`);
  } catch (err) {
    console.error('Error updating hours of operation:', err);
  }
}

/**
 * Update events with missing contact info
 */
async function updateContactInfo() {
  console.log('Updating contact info for events...');
  
  try {
    // Update entertainment events
    await pool.query(`
      UPDATE events 
      SET contact_info = '{"name": "Entertainment Coordinator", "phone": "(321) 555-1234", "email": "entertainment@barefootbay.org", "website": "https://barefootbay.org/entertainment"}'::jsonb
      WHERE category = 'entertainment' AND (contact_info IS NULL OR contact_info = '{}'::jsonb)
    `);
    
    // Update social events
    await pool.query(`
      UPDATE events 
      SET contact_info = '{"name": "Social Activities Director", "phone": "(321) 555-5678", "email": "social@barefootbay.org", "website": "https://barefootbay.org/social"}'::jsonb
      WHERE category = 'social' AND (contact_info IS NULL OR contact_info = '{}'::jsonb)
    `);
    
    // Update government events
    await pool.query(`
      UPDATE events 
      SET contact_info = '{"name": "Community Management", "phone": "(321) 555-9012", "email": "government@barefootbay.org", "website": "https://barefootbay.org/government"}'::jsonb
      WHERE category = 'government' AND (contact_info IS NULL OR contact_info = '{}'::jsonb)
    `);
    
    // Specific updates for specialized activities
    // Golf-related events
    await pool.query(`
      UPDATE events 
      SET contact_info = jsonb_set(
        CASE WHEN contact_info IS NULL OR contact_info = '{}'::jsonb 
        THEN '{"phone": "(321) 555-5678", "website": "https://barefootbay.org/golf"}'::jsonb 
        ELSE contact_info END,
        '{name}', '"Golf Course Manager"',
        true
      ),
      contact_info = jsonb_set(contact_info, '{email}', '"golf@barefootbay.org"', true)
      WHERE (lower(title) LIKE '%golf%') AND contact_info->>'name' IS NULL
    `);
    
    // Swimming events
    await pool.query(`
      UPDATE events 
      SET contact_info = jsonb_set(
        CASE WHEN contact_info IS NULL OR contact_info = '{}'::jsonb 
        THEN '{"phone": "(321) 555-5678", "website": "https://barefootbay.org/aquatics"}'::jsonb 
        ELSE contact_info END,
        '{name}', '"Aquatics Director"',
        true
      ),
      contact_info = jsonb_set(contact_info, '{email}', '"aquatics@barefootbay.org"', true)
      WHERE (lower(title) LIKE '%pool%' OR lower(title) LIKE '%swim%' OR lower(title) LIKE '%lap%' OR lower(title) LIKE '%aqua%') 
      AND contact_info->>'name' IS NULL
    `);
    
    // Fitness events
    await pool.query(`
      UPDATE events 
      SET contact_info = jsonb_set(
        CASE WHEN contact_info IS NULL OR contact_info = '{}'::jsonb 
        THEN '{"phone": "(321) 555-5678", "website": "https://barefootbay.org/fitness"}'::jsonb 
        ELSE contact_info END,
        '{name}', '"Fitness Coordinator"',
        true
      ),
      contact_info = jsonb_set(contact_info, '{email}', '"fitness@barefootbay.org"', true)
      WHERE (lower(title) LIKE '%yoga%' OR lower(title) LIKE '%fitness%' OR lower(title) LIKE '%exercise%' OR lower(title) LIKE '%aerobic%') 
      AND contact_info->>'name' IS NULL
    `);
    
    console.log('Contact info updates completed');
  } catch (err) {
    console.error('Error updating contact info:', err);
  }
}

/**
 * Update map links for events
 */
async function updateMapLinks() {
  console.log('Updating map links for events...');
  
  try {
    const { rows } = await pool.query(`
      SELECT id, location
      FROM events
      WHERE map_link IS NULL AND location IS NOT NULL AND location != ''
    `);
    
    console.log(`Found ${rows.length} events needing map links`);
    
    for (const event of rows) {
      const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
      
      await pool.query(`
        UPDATE events
        SET map_link = $1
        WHERE id = $2
      `, [mapLink, event.id]);
    }
    
    console.log('Map link updates completed');
  } catch (err) {
    console.error('Error updating map links:', err);
  }
}

/**
 * Update media URLs for events
 */
async function updateMediaUrls() {
  console.log('Updating media URLs for events...');
  
  // Define media URLs based on event categories and keywords
  const categoryImages = {
    'entertainment': [
      '/uploads/events/entertainment-1.jpg',
      '/uploads/events/entertainment-2.jpg'
    ],
    'social': [
      '/uploads/events/social-1.jpg',
      '/uploads/events/social-2.jpg'
    ],
    'government': [
      '/uploads/events/government-1.jpg',
      '/uploads/events/government-2.jpg'
    ]
  };
  
  // Specialized image sets
  const activityImages = {
    'swimming': ['/uploads/events/swimming-1.jpg', '/uploads/events/swimming-2.jpg'],
    'yoga': ['/uploads/events/yoga-1.jpg', '/uploads/events/yoga-2.jpg'],
    'golf': ['/uploads/events/golf-1.jpg', '/uploads/events/golf-2.jpg'],
    'tennis': ['/uploads/events/tennis-1.jpg', '/uploads/events/tennis-2.jpg'],
    'fitness': ['/uploads/events/fitness-1.jpg', '/uploads/events/fitness-2.jpg'],
    'cards': ['/uploads/events/cards-1.jpg', '/uploads/events/cards-2.jpg'],
    'bingo': ['/uploads/events/bingo-1.jpg', '/uploads/events/bingo-2.jpg'],
    'craft': ['/uploads/events/craft-1.jpg', '/uploads/events/craft-2.jpg'],
    'art': ['/uploads/events/art-1.jpg', '/uploads/events/art-2.jpg'],
    'music': ['/uploads/events/music-1.jpg', '/uploads/events/music-2.jpg'],
  };
  
  try {
    // Default category images for events with no media
    for (const [category, images] of Object.entries(categoryImages)) {
      await pool.query(`
        UPDATE events
        SET media_urls = $1::text[]
        WHERE category = $2 AND (media_urls IS NULL OR media_urls = '{}' OR array_length(media_urls, 1) IS NULL)
      `, [images, category]);
    }
    
    // Add specialized images based on keywords in title
    for (const [activity, images] of Object.entries(activityImages)) {
      await pool.query(`
        UPDATE events
        SET media_urls = $1::text[]
        WHERE lower(title) LIKE $2 AND (media_urls IS NULL OR media_urls = '{}' OR array_length(media_urls, 1) IS NULL)
      `, [images, `%${activity}%`]);
    }
    
    console.log('Media URL updates completed');
  } catch (err) {
    console.error('Error updating media URLs:', err);
  }
}

/**
 * Download popular open source images to use for our events
 */
async function downloadImages() {
  const { spawn } = await import('child_process');
  
  console.log('Downloading open source images for events...');
  
  // Categories
  const imageSources = [
    // Entertainment images
    { url: 'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg', dest: 'uploads/events/entertainment-1.jpg' },
    { url: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg', dest: 'uploads/events/entertainment-2.jpg' },
    
    // Social images
    { url: 'https://images.pexels.com/photos/7148384/pexels-photo-7148384.jpeg', dest: 'uploads/events/social-1.jpg' },
    { url: 'https://images.pexels.com/photos/8111311/pexels-photo-8111311.jpeg', dest: 'uploads/events/social-2.jpg' },
    
    // Government images
    { url: 'https://images.pexels.com/photos/1056553/pexels-photo-1056553.jpeg', dest: 'uploads/events/government-1.jpg' },
    { url: 'https://images.pexels.com/photos/8845354/pexels-photo-8845354.jpeg', dest: 'uploads/events/government-2.jpg' },
    
    // Activity-specific images
    { url: 'https://images.pexels.com/photos/260598/pexels-photo-260598.jpeg', dest: 'uploads/events/swimming-1.jpg' },
    { url: 'https://images.pexels.com/photos/73760/swimming-swimmer-female-race-73760.jpeg', dest: 'uploads/events/swimming-2.jpg' },
    
    { url: 'https://images.pexels.com/photos/317157/pexels-photo-317157.jpeg', dest: 'uploads/events/yoga-1.jpg' },
    { url: 'https://images.pexels.com/photos/1051838/pexels-photo-1051838.jpeg', dest: 'uploads/events/yoga-2.jpg' },
    
    { url: 'https://images.pexels.com/photos/114972/pexels-photo-114972.jpeg', dest: 'uploads/events/golf-1.jpg' },
    { url: 'https://images.pexels.com/photos/424767/pexels-photo-424767.jpeg', dest: 'uploads/events/golf-2.jpg' },
    
    { url: 'https://images.pexels.com/photos/5730742/pexels-photo-5730742.jpeg', dest: 'uploads/events/tennis-1.jpg' },
    { url: 'https://images.pexels.com/photos/8224058/pexels-photo-8224058.jpeg', dest: 'uploads/events/tennis-2.jpg' },
    
    { url: 'https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg', dest: 'uploads/events/fitness-1.jpg' },
    { url: 'https://images.pexels.com/photos/791763/pexels-photo-791763.jpeg', dest: 'uploads/events/fitness-2.jpg' },
    
    { url: 'https://images.pexels.com/photos/6203797/pexels-photo-6203797.jpeg', dest: 'uploads/events/cards-1.jpg' },
    { url: 'https://images.pexels.com/photos/3279691/pexels-photo-3279691.jpeg', dest: 'uploads/events/cards-2.jpg' },
    
    { url: 'https://images.pexels.com/photos/6163593/pexels-photo-6163593.jpeg', dest: 'uploads/events/bingo-1.jpg' },
    { url: 'https://images.pexels.com/photos/5185695/pexels-photo-5185695.jpeg', dest: 'uploads/events/bingo-2.jpg' },
    
    { url: 'https://images.pexels.com/photos/3972737/pexels-photo-3972737.jpeg', dest: 'uploads/events/craft-1.jpg' },
    { url: 'https://images.pexels.com/photos/4992776/pexels-photo-4992776.jpeg', dest: 'uploads/events/craft-2.jpg' },
    
    { url: 'https://images.pexels.com/photos/374054/pexels-photo-374054.jpeg', dest: 'uploads/events/art-1.jpg' },
    { url: 'https://images.pexels.com/photos/1038041/pexels-photo-1038041.jpeg', dest: 'uploads/events/art-2.jpg' },
    
    { url: 'https://images.pexels.com/photos/4328961/pexels-photo-4328961.jpeg', dest: 'uploads/events/music-1.jpg' },
    { url: 'https://images.pexels.com/photos/4088012/pexels-photo-4088012.jpeg', dest: 'uploads/events/music-2.jpg' },
  ];
  
  for (const image of imageSources) {
    console.log(`Downloading ${image.url} to ${image.dest}...`);
    
    const cmd = spawn('curl', ['-s', '-o', image.dest, image.url]);
    
    await new Promise((resolve, reject) => {
      cmd.on('close', (code) => {
        if (code !== 0) {
          console.error(`Failed to download ${image.url} with code ${code}`);
          reject(new Error(`Download failed with code ${code}`));
        } else {
          console.log(`Successfully downloaded ${image.dest}`);
          resolve();
        }
      });
      
      cmd.on('error', (err) => {
        console.error(`Failed to spawn curl process: ${err}`);
        reject(err);
      });
    });
  }
  
  console.log('All images downloaded successfully');
}

/**
 * Main function to run all the update processes
 */
async function updateAllEvents() {
  try {
    console.log('Starting event data update process...');
    
    // First download all the necessary images
    await downloadImages();
    
    // Then update all the database fields
    await updateHoursOfOperation();
    await updateContactInfo();
    await updateMapLinks();
    await updateMediaUrls();
    
    console.log('All updates completed successfully!');
  } catch (err) {
    console.error('Error in updateAllEvents:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the update process
updateAllEvents().catch(console.error);