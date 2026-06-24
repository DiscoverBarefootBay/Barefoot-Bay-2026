/**
 * Randomize event categories for March and April 2025 events
 * This script ensures different categories are shown per day
 * 
 * This script:
 * 1. Gets all events for March and April 2025
 * 2. Assigns categories based on the day of the week and day of the month
 *    to ensure different categories are shown on different days
 * 3. Updates all events with their new categories (using bulk updates)
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
 * Get all March and April 2025 events
 * @returns {Promise<Array>} - Array of events
 */
async function getEvents() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, title, start_date as "startDate", category  
      FROM events 
      WHERE (EXTRACT(MONTH FROM start_date) = 3 OR EXTRACT(MONTH FROM start_date) = 4)
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
 * Get a category based on the date to ensure variety
 * @param {Date} date - Event date
 * @returns {string} - Category
 */
function getCategoryByDate(date) {
  // Use different strategies based on the day of month and day of week
  // to ensure good visual variety when viewing the calendar
  
  const dayOfMonth = date.getDate();
  const dayOfWeek = date.getDay(); // 0-6, where 0 is Sunday
  
  // Primary strategy: Rotate based on day of month
  // This creates a repeating pattern that shifts slightly each week
  const categoryIndex = (dayOfMonth % 3);
  return CATEGORIES[categoryIndex];
}

/**
 * Randomize event categories for March and April 2025
 */
async function randomizeEventCategories() {
  try {
    console.log('Starting category randomization for March and April 2025 events');
    
    // Get March and April events
    const events = await getEvents();
    console.log(`Found ${events.length} events for March and April 2025`);
    
    // Group events by day
    const eventsByDay = {};
    events.forEach(event => {
      const date = new Date(event.startDate);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!eventsByDay[dateKey]) {
        eventsByDay[dateKey] = [];
      }
      eventsByDay[dateKey].push(event);
    });
    
    console.log(`Found events spanning ${Object.keys(eventsByDay).length} unique days`);
    
    // Track category changes for reporting
    const categoryChanges = {
      total: 0,
      byCategory: {
        social: 0,
        entertainment: 0,
        government: 0
      },
      byMonth: {
        3: { // March
          social: 0,
          entertainment: 0,
          government: 0
        },
        4: { // April
          social: 0,
          entertainment: 0,
          government: 0
        }
      }
    };
    
    // Map of event ID to new category
    const newCategoriesByEventId = {};
    
    // Assign categories based on date
    for (const [dateKey, dayEvents] of Object.entries(eventsByDay)) {
      const date = new Date(dateKey);
      const category = getCategoryByDate(date);
      const month = date.getMonth() + 1; // JavaScript months are 0-indexed
      
      console.log(`Assigning category "${category}" to events on ${dateKey} (${dayEvents.length} events)`);
      
      // Prepare all events with this date for batch update
      for (const event of dayEvents) {
        const existingCategory = event.category ? event.category.toLowerCase() : '';
        
        // Always set it regardless of existing category to ensure consistent categories per day
        newCategoriesByEventId[event.id] = category;
        categoryChanges.total++;
        categoryChanges.byCategory[category] = 
          (categoryChanges.byCategory[category] || 0) + 1;
        
        // Track by month too
        categoryChanges.byMonth[month][category] = 
          (categoryChanges.byMonth[month][category] || 0) + 1;
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
    
    console.log('\nEvents by month and category:');
    for (const [month, categories] of Object.entries(categoryChanges.byMonth)) {
      console.log(`  Month ${month}:`);
      for (const [category, count] of Object.entries(categories)) {
        console.log(`    ${category}: ${count}`);
      }
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