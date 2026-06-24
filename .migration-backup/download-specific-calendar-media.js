/**
 * Download a specific calendar media file from production to development environment
 * 
 * This script downloads a specific file from the production site and saves it to
 * both /calendar and /uploads/calendar folders for consistent access
 * 
 * Usage:
 * node download-specific-calendar-media.js
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

// Production domain
const PRODUCTION_DOMAIN = 'https://barefootbay.com';

// The specific file we're downloading
const FILENAME = 'media-1745445651154-545325499.jpeg';
const PRODUCTION_URL = `${PRODUCTION_DOMAIN}/calendar/${FILENAME}`;

// Local paths
const CALENDAR_PATH = path.join(process.cwd(), 'calendar');
const UPLOADS_CALENDAR_PATH = path.join(process.cwd(), 'uploads', 'calendar');

// Ensure directories exist
async function ensureDirectoryExists(dir) {
  try {
    await fsPromises.mkdir(dir, { recursive: true });
    console.log(`Ensured directory exists: ${dir}`);
  } catch (error) {
    console.error(`Error creating directory ${dir}:`, error);
    throw error;
  }
}

// Download file and save to both locations
async function downloadAndSaveFile() {
  try {
    // Ensure directories exist
    await ensureDirectoryExists(CALENDAR_PATH);
    await ensureDirectoryExists(UPLOADS_CALENDAR_PATH);
    
    // Destination file paths
    const calendarFilePath = path.join(CALENDAR_PATH, FILENAME);
    const uploadsCalendarFilePath = path.join(UPLOADS_CALENDAR_PATH, FILENAME);
    
    // Download file
    console.log(`Downloading file from: ${PRODUCTION_URL}`);
    const response = await fetch(PRODUCTION_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    
    const fileBuffer = await response.buffer();
    
    // Save to both locations
    await fsPromises.writeFile(calendarFilePath, fileBuffer);
    console.log(`File saved to: ${calendarFilePath}`);
    
    await fsPromises.writeFile(uploadsCalendarFilePath, fileBuffer);
    console.log(`File saved to: ${uploadsCalendarFilePath}`);
    
    // Print file size
    const stats = await fsPromises.stat(calendarFilePath);
    console.log(`File size: ${stats.size} bytes`);
    
    console.log('Download completed successfully!');
  } catch (error) {
    console.error('Error downloading and saving file:', error);
  }
}

// Run the download process
downloadAndSaveFile();