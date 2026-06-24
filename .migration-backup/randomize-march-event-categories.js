/**
 * Randomize event categories for March 2025 events
 * 
 * This script:
 * 1. Gets all events for March 2025
 * 2. Groups them by event title
 * 3. Assigns a random category to each unique title
 * 4. Updates all events with their new categories (using bulk updates)
 */

import pg from 'pg';

const { Pool } = pg;

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Available event categories
const CATEGORIES = ["social", "entertainment", "government"];

/**
 * Get all March 2025 events
 * @returns {Promise<Array>} - Array of events
 */
async function getMarchEvents() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, title, category  
      FROM events 
      WHERE EXTRACT(MONTH FROM start_date) = 3 
      AND EXTRACT(YEAR FROM start_date) = 2025
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Update event categories in bulk using SQL CASE expression
 * @param {Object} categoryByEventId - Map of event IDs to categories
 */
async function bulkUpdateEventCategories(categoryByEventId) {
  const client = await pool.connect();
  
  try {
    // Build a CASE statement for efficient bulk update
    const eventIds = Object.keys(categoryByEventId);
    
    if (eventIds.length === 0) return;
    
    // Split into batches to avoid query size limits
    const BATCH_SIZE = 100;
    const batches = [];
    
    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      batches.push(eventIds.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Processing ${batches.length} batches of updates...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batchIds = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batchIds.length} events)`);
      
      // Build case statement for this batch
      let caseStatement = 'CASE id ';
      const params = [];
      let paramIndex = 1;
      
      batchIds.forEach(id => {
        caseStatement += `WHEN $${paramIndex} THEN $${paramIndex + 1} `;
        params.push(parseInt(id, 10), categoryByEventId[id]);
        paramIndex += 2;
      });
      
      caseStatement += 'ELSE category END';
      
      // Execute the update
      const query = `
        UPDATE events 
        SET category = ${caseStatement}
        WHERE id IN (${batchIds.map((_, i) => `$${paramIndex + i}`).join(',')})
      `;
      
      // Add the IDs again for the WHERE IN clause
      batchIds.forEach(id => {
        params.push(parseInt(id, 10));
      });
      
      await client.query(query, params);
    }
  } finally {
    client.release();
  }
}

/**
 * Get a random category
 * @returns {string} - Random category
 */
function getRandomCategory() {
  const randomIndex = Math.floor(Math.random() * CATEGORIES.length);
  return CATEGORIES[randomIndex];
}

/**
 * Randomize event categories for March 2025
 */
async function randomizeEventCategories() {
  try {
    console.log('Starting category randomization for March 2025 events');
    
    // Get all March events
    const events = await getMarchEvents();
    console.log(`Found ${events.length} events for March 2025`);
    
    // Group events by title
    const eventsByTitle = {};
    events.forEach(event => {
      if (!eventsByTitle[event.title]) {
        eventsByTitle[event.title] = [];
      }
      eventsByTitle[event.title].push(event);
    });
    
    console.log(`Found ${Object.keys(eventsByTitle).length} unique event titles`);
    
    // Track category changes for reporting
    const categoryChanges = {
      total: 0,
      byCategory: {
        social: 0,
        entertainment: 0,
        government: 0
      }
    };
    
    // Map of event ID to new category
    const newCategoriesByEventId = {};
    
    // Assign random categories to each unique title
    for (const [title, titleEvents] of Object.entries(eventsByTitle)) {
      // Choose a random category for this title
      const randomCategory = getRandomCategory();
      console.log(`Assigning category "${randomCategory}" to "${title}" (${titleEvents.length} events)`);
      
      // Prepare all events with this title for batch update
      for (const event of titleEvents) {
        if (event.category !== randomCategory) {
          newCategoriesByEventId[event.id] = randomCategory;
          categoryChanges.total++;
          categoryChanges.byCategory[randomCategory] = 
            (categoryChanges.byCategory[randomCategory] || 0) + 1;
        }
      }
    }
    
    console.log(`Prepared ${Object.keys(newCategoriesByEventId).length} events for update`);
    
    // Perform bulk update
    await bulkUpdateEventCategories(newCategoriesByEventId);
    
    console.log('\nCategory randomization completed');
    console.log(`Updated ${categoryChanges.total} events`);
    console.log('Events by category:');
    for (const [category, count] of Object.entries(categoryChanges.byCategory)) {
      console.log(`  ${category}: ${count}`);
    }
    
  } catch (err) {
    console.error('Error in randomizeEventCategories:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the randomization process
randomizeEventCategories().catch(console.error);