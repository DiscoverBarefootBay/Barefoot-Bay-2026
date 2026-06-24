/**
 * Randomize event categories for individual events
 * 
 * This script:
 * 1. Gets all events for March and April 2025
 * 2. Assigns random categories to each individual event
 * 3. Ensures a balanced distribution of categories
 * 4. Updates events with their new categories (using bulk updates)
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
      SELECT id, title, category, start_date  
      FROM events 
      WHERE (EXTRACT(MONTH FROM start_date) IN (3, 4))
      AND EXTRACT(YEAR FROM start_date) = 2025
      ORDER BY start_date, id
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
 * Get a random category with balancing
 * @param {Object} counts - Current counts of each category
 * @returns {string} - Random category
 */
function getBalancedRandomCategory(counts) {
  // Calculate total count
  const totalAssigned = Object.values(counts).reduce((a, b) => a + b, 0);
  
  // For the first 30 events, truly randomize
  if (totalAssigned < 30) {
    const randomIndex = Math.floor(Math.random() * CATEGORIES.length);
    return CATEGORIES[randomIndex];
  }
  
  // Calculate the target percentage for each category (33.33%)
  const targetPercentage = 1 / CATEGORIES.length;
  
  // Calculate current percentages
  const percentages = {};
  for (const category of CATEGORIES) {
    percentages[category] = (counts[category] || 0) / totalAssigned;
  }
  
  // Find categories below target percentage
  const belowTarget = CATEGORIES.filter(
    category => percentages[category] < targetPercentage
  );
  
  // If we have categories below target, pick one of those
  if (belowTarget.length > 0) {
    const randomIndex = Math.floor(Math.random() * belowTarget.length);
    return belowTarget[randomIndex];
  }
  
  // Otherwise, just pick a random one
  const randomIndex = Math.floor(Math.random() * CATEGORIES.length);
  return CATEGORIES[randomIndex];
}

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Check if two events are on the same day
 * @param {Object} event1 - First event
 * @param {Object} event2 - Second event
 * @returns {boolean} - True if events are on the same day
 */
function sameDay(event1, event2) {
  const date1 = new Date(event1.start_date);
  const date2 = new Date(event2.start_date);
  return formatDate(date1) === formatDate(date2);
}

/**
 * Randomize categories for individual events
 */
async function randomizeEventCategories() {
  try {
    console.log('Starting randomization for individual events in March and April 2025');
    
    // Get all events
    const events = await getEvents();
    console.log(`Found ${events.length} events for March and April 2025`);
    
    // Track category changes for reporting
    const categoryChanges = {
      total: 0,
      byCategory: {
        social: 0,
        entertainment: 0,
        government: 0
      },
      byMonth: {
        3: { social: 0, entertainment: 0, government: 0 },
        4: { social: 0, entertainment: 0, government: 0 }
      }
    };
    
    // Map of event ID to new category
    const newCategoriesByEventId = {};
    
    // Daily category counts to help ensure variety
    let currentDay = null;
    let dailyCounts = {
      social: 0,
      entertainment: 0,
      government: 0
    };
    
    // Global category counts
    const globalCounts = {
      social: 0,
      entertainment: 0,
      government: 0
    };
    
    // Process each event
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventDate = new Date(event.start_date);
      const formattedDate = formatDate(eventDate);
      const month = eventDate.getMonth() + 1; // JavaScript months are 0-indexed
      
      // If we're on a new day, reset daily counts
      if (currentDay !== formattedDate) {
        currentDay = formattedDate;
        dailyCounts = {
          social: 0,
          entertainment: 0,
          government: 0
        };
        console.log(`Processing events for ${formattedDate}`);
      }
      
      // Get the next few events on the same day to ensure variety
      const sameTimeEvents = [];
      for (let j = i + 1; j < events.length && j < i + 5; j++) {
        if (sameDay(event, events[j])) {
          sameTimeEvents.push(events[j]);
        }
      }
      
      // Avoid assigning the same category to consecutive events on the same day
      let category;
      let attempts = 0;
      do {
        category = getBalancedRandomCategory(globalCounts);
        attempts++;
        
        // After a few attempts, just accept any category to avoid infinite loops
        if (attempts > 5) break;
        
        // Only keep trying if there are multiple events scheduled for this day
        // AND if this category is overrepresented for this day
      } while (sameTimeEvents.length > 0 && 
               dailyCounts[category] > Math.floor(dailyCounts.social + dailyCounts.entertainment + dailyCounts.government) / 3);
      
      console.log(`Assigning category "${category}" to event #${event.id}: "${event.title}" on ${formattedDate}`);
      
      // Only update if category is different from current
      const existingCategory = event.category ? event.category.toLowerCase() : '';
      if (existingCategory !== category) {
        newCategoriesByEventId[event.id] = category;
        categoryChanges.total++;
        categoryChanges.byCategory[category]++;
        categoryChanges.byMonth[month][category]++;
      }
      
      // Update counts
      dailyCounts[category]++;
      globalCounts[category]++;
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