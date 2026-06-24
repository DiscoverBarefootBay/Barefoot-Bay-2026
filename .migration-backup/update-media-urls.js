/**
 * Script focused on updating media_urls for events
 */

import pg from 'pg';
const { Pool } = pg;

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Update media URLs for events
 */
async function updateMediaUrls() {
  console.log('Updating media URLs for events...');
  
  // Check if images were downloaded previously
  const fs = await import('fs');
  
  // Check if entertainment-1.jpg exists
  const hasDownloadedImages = fs.existsSync('./uploads/events/entertainment-1.jpg');
  console.log(`Images already downloaded: ${hasDownloadedImages}`);
  
  // Define media URLs based on event categories - these must exist in the uploads/events folder
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
  
  // If images don't exist, use publicly available placeholder images
  if (!hasDownloadedImages) {
    console.log('Using placeholder images since downloaded images not found');
    
    // Use generic placeholder images that don't need to be downloaded
    categoryImages.entertainment = [
      'https://placehold.co/600x400/orange/white?text=Entertainment',
      'https://placehold.co/600x400/red/white?text=Entertainment'
    ];
    
    categoryImages.social = [
      'https://placehold.co/600x400/blue/white?text=Social',
      'https://placehold.co/600x400/lightblue/white?text=Social'
    ];
    
    categoryImages.government = [
      'https://placehold.co/600x400/darkgreen/white?text=Government',
      'https://placehold.co/600x400/green/white?text=Government'
    ];
  }
  
  try {
    // First check the database schema
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'events'
      AND column_name = 'media_urls';
    `);
    
    console.log('Column info for media_urls:', columns[0]);
    
    // Default category images for events with no media
    let totalUpdated = 0;
    
    for (const [category, images] of Object.entries(categoryImages)) {
      const result = await pool.query(`
        UPDATE events
        SET media_urls = $1::text[]
        WHERE category = $2 AND (media_urls IS NULL OR media_urls = '{}' OR array_length(media_urls, 1) IS NULL)
      `, [images, category]);
      
      totalUpdated += result.rowCount;
      console.log(`Updated ${result.rowCount} ${category} events with default images`);
    }
    
    console.log(`Media URL updates completed. Total: ${totalUpdated} events updated.`);
  } catch (err) {
    console.error('Error updating media URLs:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the update
updateMediaUrls().catch(console.error);