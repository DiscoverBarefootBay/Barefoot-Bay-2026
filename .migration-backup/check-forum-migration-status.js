/**
 * Check the status of forum media migration
 * 
 * This script provides a simple status report for the ongoing forum media migration.
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Support for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_LOG_FILE = 'forum-media-migration-log.json';
const FORUM_MEDIA_DIRS = [
  path.join(process.cwd(), 'forum-media'),
  path.join(process.cwd(), 'uploads', 'forum-media'),
  path.join(process.cwd(), 'uploads', 'forum'),
  path.join(process.cwd(), 'forum')
];

function countFiles(directory) {
  if (!fs.existsSync(directory)) {
    return 0;
  }
  
  try {
    const files = fs.readdirSync(directory);
    let count = 0;
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      if (fs.statSync(filePath).isFile()) {
        // Check if it's a media file
        const ext = path.extname(file).toLowerCase();
        const mediaExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4', '.mov', '.webm'];
        if (mediaExts.includes(ext)) {
          count++;
        }
      }
    }
    
    return count;
  } catch (error) {
    console.error(`Error counting files in ${directory}:`, error);
    return 0;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function calculateTimeDifference(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end || new Date());
  const diffMs = endDate - startDate;
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours} hours, ${minutes % 60} minutes`;
  } else if (minutes > 0) {
    return `${minutes} minutes, ${seconds % 60} seconds`;
  } else {
    return `${seconds} seconds`;
  }
}

// Count total media files
let totalMediaFiles = 0;
for (const dir of FORUM_MEDIA_DIRS) {
  const count = countFiles(dir);
  totalMediaFiles += count;
  if (count > 0) {
    console.log(`${dir}: ${count} media files`);
  }
}

console.log(`\nTotal media files found: ${totalMediaFiles}`);

// Check migration log
if (fs.existsSync(MIGRATION_LOG_FILE)) {
  try {
    const migrationData = JSON.parse(fs.readFileSync(MIGRATION_LOG_FILE, 'utf8'));
    
    console.log('\nMigration Status:');
    console.log(`Started: ${formatDate(migrationData.startTime)}`);
    
    if (migrationData.completionTime) {
      console.log(`Completed: ${formatDate(migrationData.completionTime)}`);
      console.log(`Duration: ${calculateTimeDifference(migrationData.startTime, migrationData.completionTime)}`);
    } else {
      console.log('Status: In progress');
      console.log(`Duration so far: ${calculateTimeDifference(migrationData.startTime)}`);
    }
    
    const migratedCount = migrationData.migratedFiles.length;
    const progress = totalMediaFiles > 0 ? ((migratedCount / totalMediaFiles) * 100).toFixed(2) : '0.00';
    
    console.log(`\nMigrated: ${migratedCount} of ${totalMediaFiles} files (${progress}%)`);
    
    // Check for errors
    if (migrationData.errors && migrationData.errors.length > 0) {
      console.log(`\nErrors: ${migrationData.errors.length}`);
      
      // Show a few recent errors
      if (migrationData.errors.length > 0) {
        console.log('\nRecent errors:');
        const recentErrors = migrationData.errors.slice(-3);
        for (const error of recentErrors) {
          console.log(`- ${error.type}: ${error.filename || error.error}`);
        }
      }
    } else {
      console.log('\nNo errors reported.');
    }
    
    // Database updates
    console.log('\nDatabase Updates:');
    console.log(`Posts updated: ${migrationData.databaseUpdates.posts}`);
    console.log(`Comments updated: ${migrationData.databaseUpdates.comments}`);
    
    // Show most recent files
    if (migratedCount > 0) {
      console.log('\nMost recently migrated files:');
      const recentFiles = migrationData.migratedFiles.slice(-5);
      for (const file of recentFiles) {
        console.log(`- ${file.filename} (${formatDate(file.timestamp)})`);
      }
    }
  } catch (error) {
    console.error(`Error reading migration data: ${error.message}`);
  }
} else {
  console.log('\nNo migration log found. Migration may not have started yet.');
}