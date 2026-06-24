/**
 * Script to check image personalization progress for March 20th events
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Target event IDs we're tracking
const TARGET_EVENTS = [338, 341, 342, 343, 344, 345];
const EVENT_NAMES = {
  338: 'LAP SWIMMING',
  341: 'HYDRO EXERCISE',
  342: 'AQUATIC AEROBICS',
  343: 'AQUA ZUMBA',
  344: 'BEGINNER LINE DANCE',
  345: 'LINE DANCING'
};

// Number of expected images per event
const TARGET_IMAGES_PER_EVENT = 2;

/**
 * Generate a timestamp string for log filenames
 * @returns {string} - Timestamp string (ISO format)
 */
function getTimestamp() {
  return new Date().toISOString().replace(/:/g, '-');
}

/**
 * Check personalization progress for target events
 */
async function checkPersonalizationProgress() {
  try {
    console.log('Checking image personalization progress...');
    
    // Prepare log file
    const timestamp = getTimestamp();
    const logFile = `personalization-log-${timestamp}.txt`;
    let logContent = `= Event Image Personalization Progress Report =\nGenerated: ${new Date().toISOString()}\n\n`;
    
    // Get events
    const { rows } = await pool.query(`
      SELECT id, title, media_urls
      FROM events 
      WHERE id = ANY($1)
      ORDER BY id
    `, [TARGET_EVENTS]);
    
    console.log(`Found ${rows.length} events to check`);
    logContent += `Events checked: ${rows.length}\n\n`;
    
    // Track overall progress
    let totalPersonalized = 0;
    let totalGenericImages = 0;
    
    // Check each event
    logContent += `=== Individual Event Status ===\n`;
    for (const event of rows) {
      const mediaUrls = event.media_urls || [];
      const imageCount = mediaUrls.length;
      
      // Check if images are personalized (not the generic social-X.jpg pattern)
      const genericImages = mediaUrls.filter(url => url.includes('social-')).length;
      const personalizedImages = imageCount - genericImages;
      
      // Update totals
      totalPersonalized += personalizedImages;
      totalGenericImages += genericImages;
      
      // Calculate completion percentage
      const completionPercentage = Math.round((personalizedImages / TARGET_IMAGES_PER_EVENT) * 100);
      
      // Log event status
      const status = personalizedImages >= TARGET_IMAGES_PER_EVENT ? 'COMPLETE' : 'IN PROGRESS';
      
      logContent += `\nEvent ID ${event.id}: ${event.title}\n`;
      logContent += `Status: ${status} (${completionPercentage}%)\n`;
      logContent += `Images: ${personalizedImages} personalized, ${genericImages} generic\n`;
      logContent += `Media URLs: ${JSON.stringify(mediaUrls)}\n`;
      
      console.log(`Event ${event.id}: ${status} (${completionPercentage}%)`);
    }
    
    // Calculate overall progress
    const totalExpectedImages = TARGET_EVENTS.length * TARGET_IMAGES_PER_EVENT;
    const overallPercentage = Math.round((totalPersonalized / totalExpectedImages) * 100);
    
    logContent += `\n=== Overall Progress ===\n`;
    logContent += `Personalized images: ${totalPersonalized} / ${totalExpectedImages}\n`;
    logContent += `Generic images remaining: ${totalGenericImages}\n`;
    logContent += `Total progress: ${overallPercentage}%\n`;
    
    console.log(`\nOverall progress: ${overallPercentage}%`);
    console.log(`Personalized images: ${totalPersonalized} / ${totalExpectedImages}`);
    
    // Save log file
    fs.writeFileSync(logFile, logContent);
    console.log(`Log saved to ${logFile}`);
    
  } catch (err) {
    console.error('Error checking personalization progress:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the check
checkPersonalizationProgress().catch(console.error);