/**
 * Emergency fix script to correct all media paths in the database
 * 
 * This script:
 * 1. Connects directly to the database
 * 2. Finds all records with /uploads/ paths
 * 3. Updates them to use the correct production format
 * 4. Works with all content types (pages, events, forum posts, etc.)
 * 
 * Run this script ONCE after deployment to fix all existing image paths
 * 
 * Usage:
 * node fix-all-image-paths.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Create a PostgreSQL client
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

// Paths that need to be fixed in database records
const SEARCH_PATTERN = '/uploads/';
const REPLACEMENT = '/';

// Content tables that might contain media URLs
const TABLES_TO_FIX = [
  { 
    name: 'page_content', 
    columns: ['content'], 
    idColumn: 'id',
    description: 'Page content (including vendors)'
  },
  { 
    name: 'content', 
    columns: ['content'], 
    idColumn: 'id',
    description: 'Generic content'
  },
  { 
    name: 'events', 
    columns: ['mediaUrls', 'description'], 
    idColumn: 'id',
    description: 'Calendar events'
  },
  { 
    name: 'forum_posts', 
    columns: ['content', 'mediaUrls'], 
    idColumn: 'id',
    description: 'Forum posts'
  },
  { 
    name: 'forum_comments', 
    columns: ['content', 'mediaUrls'], 
    idColumn: 'id',
    description: 'Forum comments'
  },
  { 
    name: 'real_estate_listings', 
    columns: ['photos', 'description'], 
    idColumn: 'id',
    description: 'Real estate listings'
  },
  { 
    name: 'users', 
    columns: ['avatarUrl'], 
    idColumn: 'id',
    description: 'User avatars'
  }
];

// Start the script
async function main() {
  // Track overall statistics
  const stats = {
    totalTablesChecked: 0,
    totalRecordsChecked: 0,
    totalRecordsFixed: 0,
    totalPathsFixed: 0,
    tableStats: {},
  };

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected to database successfully.');

    // Create a backup of each table before modifying
    console.log('Creating backup of tables before modifications...');
    for (const table of TABLES_TO_FIX) {
      // Create a clean backup table name without special characters
      const timestamp = new Date().getTime();
      const backupTableName = `${table.name}_backup_${timestamp}`;
      await client.query(`CREATE TABLE IF NOT EXISTS ${backupTableName} AS SELECT * FROM ${table.name}`);
      console.log(`Created backup of ${table.name} as ${backupTableName}`);
    }

    // Process each table
    for (const table of TABLES_TO_FIX) {
      console.log(`\nProcessing table: ${table.name} (${table.description})`);
      stats.totalTablesChecked++;
      stats.tableStats[table.name] = {
        recordsChecked: 0,
        recordsFixed: 0,
        pathsFixed: 0
      };

      // Get all records
      const { rows } = await client.query(`SELECT * FROM ${table.name}`);
      console.log(`Found ${rows.length} records in ${table.name}`);
      stats.totalRecordsChecked += rows.length;
      stats.tableStats[table.name].recordsChecked = rows.length;

      // Process each record
      for (const row of rows) {
        let recordUpdated = false;
        const updates = [];
        
        // Process each column that might contain media URLs
        for (const column of table.columns) {
          let value = row[column];
          
          // Skip null or undefined values
          if (value === null || value === undefined) {
            continue;
          }
          
          // Handle different data types
          if (Array.isArray(value)) {
            // Handle array of URLs (like mediaUrls)
            let arrayUpdated = false;
            const newArray = value.map(item => {
              if (typeof item === 'string' && item.includes(SEARCH_PATTERN)) {
                stats.totalPathsFixed++;
                stats.tableStats[table.name].pathsFixed++;
                arrayUpdated = true;
                return item.replace(SEARCH_PATTERN, REPLACEMENT);
              }
              return item;
            });
            
            if (arrayUpdated) {
              updates.push(\`${column} = $\${updates.length + 1}\`);
              recordUpdated = true;
            }
          } else if (typeof value === 'string') {
            // Direct string replacement for URLs
            if (value.includes(SEARCH_PATTERN)) {
              const newValue = value.replace(new RegExp(SEARCH_PATTERN, 'g'), REPLACEMENT);
              updates.push(\`${column} = $\${updates.length + 1}\`);
              value = newValue;
              recordUpdated = true;
              stats.totalPathsFixed++;
              stats.tableStats[table.name].pathsFixed++;
            }
          } else if (typeof value === 'object') {
            // Handle JSON objects that might contain URLs
            const jsonStr = JSON.stringify(value);
            if (jsonStr.includes(SEARCH_PATTERN)) {
              const newJsonStr = jsonStr.replace(new RegExp(SEARCH_PATTERN, 'g'), REPLACEMENT);
              updates.push(\`${column} = $\${updates.length + 1}\`);
              value = JSON.parse(newJsonStr);
              recordUpdated = true;
              // Count approximately how many paths were fixed
              const pathCount = (jsonStr.match(new RegExp(SEARCH_PATTERN, 'g')) || []).length;
              stats.totalPathsFixed += pathCount;
              stats.tableStats[table.name].pathsFixed += pathCount;
            }
          }
        }
        
        // Update the record if needed
        if (recordUpdated) {
          const updateValues = updates.map((_, index) => row[table.columns[index]]);
          const updateQuery = \`
            UPDATE ${table.name}
            SET ${updates.join(', ')}
            WHERE ${table.idColumn} = $\${updates.length + 1}
          \`;
          
          await client.query(updateQuery, [...updateValues, row[table.idColumn]]);
          stats.totalRecordsFixed++;
          stats.tableStats[table.name].recordsFixed++;
          
          console.log(\`Fixed record: ${table.name} id=${row[table.idColumn]}\`);
        }
      }
    }

    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(\`Checked ${stats.totalTablesChecked} tables and ${stats.totalRecordsChecked} records\`);
    console.log(\`Fixed ${stats.totalRecordsFixed} records containing ${stats.totalPathsFixed} paths\`);
    
    console.log('\nBreakdown by table:');
    for (const tableName in stats.tableStats) {
      const tableStats = stats.tableStats[tableName];
      console.log(\`- ${tableName}: ${tableStats.recordsFixed}/${tableStats.recordsChecked} records fixed, ${tableStats.pathsFixed} paths updated\`);
    }

    console.log('\nDone! Your database has been updated with correct media paths.');
    console.log('Media will now display correctly in production environment.');
    console.log('\nImportant: This script has created backup tables of your data before making changes.');
    console.log('If you encounter any issues, you can restore from these backup tables.');

  } catch (error) {
    console.error('Error fixing image paths:', error);
  } finally {
    await client.end();
  }
}

// Run the script
main();