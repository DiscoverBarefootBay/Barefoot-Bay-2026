/**
 * Script to synchronize avatar images from production to development environment
 * 
 * This script:
 * 1. Fetches users from the database to get avatarUrl values
 * 2. Downloads avatar images from the production URL (barefootbay.com)
 * 3. Saves them to both /uploads/avatars and /avatars directories
 * 
 * Usage:
 * node sync-avatar-images.js
 */

import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure PostgreSQL connection using pg instead of postgres
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1
});

// Make sure directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Setup avatar directories
const rootAvatarsDir = path.join(__dirname, 'avatars');
const uploadsAvatarsDir = path.join(__dirname, 'uploads', 'avatars');

ensureDir(rootAvatarsDir);
ensureDir(uploadsAvatarsDir);

// Function to extract filename from URL
const getFilenameFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  return parts[parts.length - 1];
};

// Function to download a file from URL
const downloadFile = (url, destPath) => {
  return new Promise((resolve, reject) => {
    // Check if URL is valid
    if (!url) {
      console.log(`Skipping invalid URL: ${url}`);
      return resolve(false);
    }

    const filename = getFilenameFromUrl(url);
    if (!filename) {
      console.log(`Couldn't extract filename from URL: ${url}`);
      return resolve(false);
    }

    // Check if file already exists
    if (fs.existsSync(destPath)) {
      console.log(`File already exists: ${destPath}`);
      return resolve(true);
    }

    // Full URL to download from
    const fullUrl = url.startsWith('http') ? url : `https://barefootbay.com${url.startsWith('/') ? '' : '/'}${url}`;
    
    console.log(`Downloading ${fullUrl} to ${destPath}`);
    
    // Create a write stream to save the file
    const file = fs.createWriteStream(destPath);
    
    // Download the file
    https.get(fullUrl, (response) => {
      if (response.statusCode !== 200) {
        // Only try to unlink if the file was actually created
        if (fs.existsSync(destPath)) {
          fs.unlink(destPath, () => {
            console.error(`Failed to download ${fullUrl}: ${response.statusCode}`);
            reject(new Error(`Failed to download file: ${response.statusCode}`));
          });
        } else {
          console.error(`Failed to download ${fullUrl}: ${response.statusCode}`);
          reject(new Error(`Failed to download file: ${response.statusCode}`));
        }
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          console.log(`Downloaded ${filename} successfully`);
          resolve(true);
        });
      });
    }).on('error', (err) => {
      if (fs.existsSync(destPath)) {
        fs.unlink(destPath, () => {
          console.error(`Error downloading ${fullUrl}:`, err);
          reject(err);
        });
      } else {
        console.error(`Error downloading ${fullUrl}:`, err);
        reject(err);
      }
    });
  });
};

// Function to synchronize a single avatar
const syncAvatar = async (avatarUrl) => {
  if (!avatarUrl || avatarUrl === 'null' || avatarUrl === 'undefined') {
    return false;
  }
  
  try {
    const filename = getFilenameFromUrl(avatarUrl);
    if (!filename) return false;
    
    // Standardize avatar URL format
    let downloadUrl = avatarUrl;
    
    // Make sure we have an absolute URL for downloading
    if (!downloadUrl.includes('barefootbay.com')) {
      downloadUrl = `https://barefootbay.com${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
    }
    
    // Define destination file paths
    const rootDestPath = path.join(rootAvatarsDir, filename);
    const uploadsDestPath = path.join(uploadsAvatarsDir, filename);
    
    // Download to root avatars dir
    await downloadFile(downloadUrl, rootDestPath);
    
    // Copy to uploads/avatars dir
    if (fs.existsSync(rootDestPath) && !fs.existsSync(uploadsDestPath)) {
      fs.copyFileSync(rootDestPath, uploadsDestPath);
      console.log(`Copied ${filename} to uploads/avatars directory`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error syncing avatar ${avatarUrl}:`, error);
    return false;
  }
};

// Main function to sync all avatar images
const syncAvatarImages = async () => {
  console.log('Starting avatar image synchronization...');
  
  try {
    // Get all users with avatar URLs from the database
    const result = await pool.query('SELECT id, username, avatar_url FROM users WHERE avatar_url IS NOT NULL');
    const users = result.rows;
    console.log(`Found ${users.length} users with avatar URLs to process`);
    
    let syncCount = 0;
    let errorCount = 0;
    
    // Process each user's avatar
    for (const user of users) {
      console.log(`Processing avatar for user ${user.id} (${user.username}): ${user.avatar_url}`);
      
      try {
        const success = await syncAvatar(user.avatar_url);
        if (success) {
          syncCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing avatar for user ${user.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Avatar synchronization complete!`);
    console.log(`Successfully synced: ${syncCount} avatars`);
    console.log(`Errors: ${errorCount} avatars`);
    
  } catch (error) {
    console.error('Error during avatar synchronization:', error);
  } finally {
    // Close the database pool
    await pool.end();
  }
};

// Run the sync function
syncAvatarImages().catch(console.error);