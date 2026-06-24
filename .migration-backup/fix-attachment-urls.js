/**
 * Script to fix message attachment URLs in the database
 * This script directly updates database records to use the proper attachment URL format
 * 
 * Run with: node fix-attachment-urls.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const main = async () => {
  // Create a connection to the database
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to database');

    // Find all attachments with local paths
    const findResult = await client.query(`
      SELECT id, url
      FROM message_attachments
      WHERE url LIKE '/uploads/attachments/%'
    `);

    console.log(`Found ${findResult.rows.length} attachments with local paths`);
    
    let fixedCount = 0;
    let failedCount = 0;
    
    // Process each attachment
    for (const attachment of findResult.rows) {
      try {
        // Extract filename from URL
        const filename = attachment.url.split('/').pop();
        if (!filename) {
          console.error(`Cannot extract filename from URL: ${attachment.url}`);
          failedCount++;
          continue;
        }
        
        // Generate new URL using the /api/attachments/ endpoint
        const newUrl = `/api/attachments/${filename}`;
        
        // Update the attachment URL in the database
        const updateResult = await client.query(`
          UPDATE message_attachments
          SET url = $1
          WHERE id = $2
        `, [newUrl, attachment.id]);
        
        console.log(`Fixed attachment URL: ${attachment.url} -> ${newUrl}`);
        fixedCount++;
      } catch (error) {
        console.error(`Error fixing attachment ${attachment.id}:`, error);
        failedCount++;
      }
    }
    
    console.log(`\nSUMMARY:`);
    console.log(`- Found: ${findResult.rows.length} attachments with local paths`);
    console.log(`- Fixed: ${fixedCount}`);
    console.log(`- Failed: ${failedCount}`);
    
    // Confirm all URLs are now fixed
    const confirmResult = await client.query(`
      SELECT url, COUNT(*) as count
      FROM message_attachments
      GROUP BY url
      ORDER BY count DESC
    `);
    
    console.log('\nCurrent URL formats in database:');
    confirmResult.rows.forEach(row => {
      console.log(`- ${row.url.substring(0, 50)}${row.url.length > 50 ? '...' : ''}: ${row.count} records`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the database connection
    await client.end();
    console.log('Database connection closed');
  }
};

// Run the main function
main().catch(console.error);