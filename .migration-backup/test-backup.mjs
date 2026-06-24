/**
 * Test script to backup a small set of media files
 */

import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Just our test directories
const MEDIA_DIRS = [
  'test-media-backup/avatars',
  'test-media-backup/banner-slides'
];

/**
 * Create the media_files table if it doesn't exist
 */
async function ensureMediaTable() {
  try {
    // Check if table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'media_files'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creating media_files table for deployment persistence...');
      
      await pool.query(`
        CREATE TABLE media_files (
          id SERIAL PRIMARY KEY,
          filename TEXT NOT NULL,
          directory TEXT NOT NULL,
          file_data BYTEA NOT NULL,
          file_size BIGINT NOT NULL,
          mime_type TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_media_files_filename ON media_files(filename);
        CREATE INDEX idx_media_files_directory ON media_files(directory);
      `);
      
      console.log('Media files table created successfully');
    }
  } catch (error) {
    console.error('Error ensuring media table exists:', error);
  }
}

/**
 * Get MIME type based on file extension
 * @param {string} filename - File name
 * @returns {string} MIME type
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.ogg':
      return 'video/ogg';
    case '.mov':
      return 'video/quicktime';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Store test media files in the database
 */
async function storeTestMediaFiles() {
  try {
    await ensureMediaTable();
    
    console.log('Beginning test media file backup...');
    let totalFiles = 0;
    let savedFiles = 0;
    
    for (const dir of MEDIA_DIRS) {
      if (!fs.existsSync(dir)) {
        console.log(`Directory ${dir} doesn't exist, skipping...`);
        continue;
      }
      
      const files = fs.readdirSync(dir);
      totalFiles += files.length;
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        
        // Skip directories
        if (fs.statSync(filePath).isDirectory()) continue;
        
        try {
          const fileData = fs.readFileSync(filePath);
          const fileSize = fs.statSync(filePath).size;
          const mimeType = getMimeType(file);
          
          // Store file data in database
          await pool.query(
            'INSERT INTO media_files (filename, directory, file_data, file_size, mime_type) VALUES ($1, $2, $3, $4, $5)',
            [file, dir, fileData, fileSize, mimeType]
          );
          
          console.log(`Saved file to database: ${dir}/${file}`);
          savedFiles++;
        } catch (fileError) {
          console.error(`Error processing file ${filePath}:`, fileError);
        }
      }
    }
    
    console.log(`Test backup complete: Processed ${totalFiles} files, saved ${savedFiles} files`);
    return { totalFiles, savedFiles };
  } catch (error) {
    console.error('Error storing test media files:', error);
    return { totalFiles: 0, savedFiles: 0, error };
  } finally {
    // Close DB pool
    await pool.end();
  }
}

// Execute the test
storeTestMediaFiles()
  .then(({ totalFiles, savedFiles }) => {
    console.log(`Test backup summary: ${savedFiles}/${totalFiles} files backed up`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Test backup failed:', error);
    process.exit(1);
  });