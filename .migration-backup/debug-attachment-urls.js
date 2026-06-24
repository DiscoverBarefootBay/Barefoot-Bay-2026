/**
 * Debug script to check how attachment URLs are stored in the database
 * Run with: node debug-attachment-urls.js
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

    // Query the most recent 10 attachments
    const result = await client.query(`
      SELECT ma.id, ma.message_id, ma.filename, ma.url, ma.content_type, ma.created_at,
             m.subject
      FROM message_attachments ma
      JOIN messages m ON ma.message_id = m.id
      ORDER BY ma.created_at DESC
      LIMIT 10
    `);

    // Display the results in a clear format
    console.log('\n===== ATTACHMENT URL DEBUG INFO =====');
    console.log(`Found ${result.rows.length} attachments\n`);

    result.rows.forEach((row, index) => {
      console.log(`Attachment #${index + 1}`);
      console.log(`ID: ${row.id}`);
      console.log(`Message: ${row.subject} (ID: ${row.message_id})`);
      console.log(`Filename: ${row.filename}`);
      console.log(`Content Type: ${row.content_type}`);
      console.log(`Created: ${row.created_at}`);
      console.log(`URL AS STORED IN DB: ${row.url}`);
      console.log(`URL format check: ${analyzeUrlFormat(row.url)}`);
      console.log('-----------------------------------\n');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the database connection
    await client.end();
    console.log('Database connection closed');
  }
};

/**
 * Analyze URL format to identify potential issues
 */
function analyzeUrlFormat(url) {
  if (!url) return 'NULL or EMPTY URL!';
  
  if (url.startsWith('https://object-storage.replit.app/')) {
    return 'DIRECT OBJECT STORAGE URL ✓ (Production format)';
  }
  
  if (url.startsWith('/api/attachments/')) {
    return 'API ENDPOINT URL ✓ (Development or Production compatible)';
  }
  
  if (url.startsWith('/uploads/attachments/')) {
    return 'LOCAL PATH ✗ (May fail in production - needs fixing)';
  }
  
  if (url.startsWith('/attachments/')) {
    return 'LOCAL PATH WITHOUT UPLOADS PREFIX ✗ (May fail in some environments)';
  }
  
  return `UNKNOWN FORMAT: ${url}`;
}

// Run the main function
main().catch(console.error);