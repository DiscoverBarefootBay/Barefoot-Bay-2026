/**
 * Fix for calendar event media that was uploaded to the wrong bucket (DEFAULT instead of CALENDAR)
 * 
 * This script:
 * 1. Searches for media in the DEFAULT/events directory
 * 2. Re-uploads each file to the correct CALENDAR/events directory
 * 3. Updates the calendar-media-mapping.json file with the correct URLs
 * 
 * Usage:
 * node scripts/fix-events-bucket.js
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the mapping file
const MAPPING_FILE_PATH = path.resolve(__dirname, '../server/calendar-media-mapping.json');

// Main function
async function fixEventsBucket() {
  try {
    console.log('Starting bucket migration for calendar events...');
    
    // Initialize object storage client
    const client = new Client();
    
    // List files in DEFAULT/events directory
    console.log('Listing files in DEFAULT/events directory...');
    const listResult = await client.list({ 
      prefix: 'events/',
      bucketName: 'DEFAULT'
    });
    
    if (!listResult.ok) {
      throw new Error(`Failed to list files: ${listResult.error.message}`);
    }
    
    const objectStorageBaseUrl = 'https://object-storage.replit.app';
    const defaultFiles = listResult.value;
    console.log(`Found ${defaultFiles.length} files in DEFAULT/events`);
    
    // Load current mapping file
    let mappingData = {};
    if (fs.existsSync(MAPPING_FILE_PATH)) {
      const mappingContent = fs.readFileSync(MAPPING_FILE_PATH, 'utf8');
      mappingData = JSON.parse(mappingContent);
      console.log(`Loaded mapping file with ${Object.keys(mappingData).length} entries`);
    }
    
    // Process each file
    let successCount = 0;
    let failureCount = 0;
    
    for (const file of defaultFiles) {
      try {
        const fileName = path.basename(file.name);
        console.log(`Processing ${fileName}...`);
        
        // Download the file from DEFAULT bucket
        console.log(`Downloading from DEFAULT bucket...`);
        const downloadResult = await client.downloadAsBytes(file.name, { bucketName: 'DEFAULT' });
        
        if (!downloadResult.ok) {
          throw new Error(`Failed to download file: ${downloadResult.error.message}`);
        }
        
        const fileData = downloadResult.value[0];
        console.log(`Downloaded ${fileData.length} bytes`);
        
        // Create temporary file
        const tempFilePath = `/tmp/${fileName}`;
        fs.writeFileSync(tempFilePath, fileData);
        
        // Upload to CALENDAR bucket
        console.log(`Uploading to CALENDAR bucket...`);
        const uploadResult = await client.uploadFromFilename(
          `events/${fileName}`, 
          tempFilePath, 
          {
            contentType: file.contentType || 'application/octet-stream',
            bucketName: 'CALENDAR'
          }
        );
        
        if (!uploadResult.ok) {
          throw new Error(`Failed to upload file: ${uploadResult.error.message}`);
        }
        
        // Remove temp file
        fs.unlinkSync(tempFilePath);
        
        // Update mapping
        const defaultUrl = `${objectStorageBaseUrl}/DEFAULT/${file.name}`;
        
        // IMPORTANT: Verify that we're using the correct format for the CALENDAR URL
        // It should be CALENDAR/events/filename.ext, not repeating the directory
        const calendarKey = `events/${fileName}`; 
        const calendarUrl = `${objectStorageBaseUrl}/CALENDAR/${calendarKey}`;
        
        // Add entries for both path formats
        const fsPath = `/uploads/calendar/${fileName}`;
        const altPath = `/calendar/${fileName}`;
        
        mappingData[fsPath] = calendarUrl;
        mappingData[altPath] = calendarUrl;
        
        console.log(`Added mapping: ${fsPath} -> ${calendarUrl}`);
        console.log(`Added mapping: ${altPath} -> ${calendarUrl}`);
        
        // Verify accessibility of the new URL
        try {
          const response = await fetch(calendarUrl, { method: 'HEAD' });
          if (response.ok) {
            console.log(`Verified URL is accessible: ${calendarUrl}`);
          } else {
            console.warn(`Warning: URL returned ${response.status}: ${calendarUrl}`);
          }
        } catch (verifyError) {
          console.warn(`Warning: Could not verify URL: ${verifyError.message}`);
        }
        
        successCount++;
      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        failureCount++;
      }
    }
    
    // Save updated mapping file
    fs.writeFileSync(MAPPING_FILE_PATH, JSON.stringify(mappingData, null, 2));
    console.log(`Updated mapping file saved with ${Object.keys(mappingData).length} entries`);
    
    // Summary
    console.log(`
    Migration Summary:
    -----------------
    Files processed: ${defaultFiles.length}
    Successful: ${successCount}
    Failed: ${failureCount}
    `);
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the script
fixEventsBucket();