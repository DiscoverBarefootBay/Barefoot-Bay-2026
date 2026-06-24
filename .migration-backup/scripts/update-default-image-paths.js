/**
 * Script to update all references to default event image path
 * from filesystem (/uploads/calendar/default-event-image.svg) 
 * to Object Storage (https://object-storage.replit.app/CALENDAR/events/default-event-image.svg)
 * 
 * This ensures consistent use of Object Storage for calendar event media
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Define the paths that need to be updated
const filesWithDefaultImages = [
  'client/src/components/calendar/event-media-gallery-simple.tsx',
  'client/src/components/calendar/event-media-gallery.tsx',
  'client/src/lib/media-helper.ts'
];

// Define the replacement
const oldPath = '/uploads/calendar/default-event-image.svg';
const newPath = 'https://object-storage.replit.app/CALENDAR/events/default-event-image.svg';

// Counter for statistics
let replacementCount = 0;
let filesModifiedCount = 0;

// Process each file
filesWithDefaultImages.forEach(relativeFilePath => {
  const filePath = path.join(rootDir, relativeFilePath);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Perform the replacement
  content = content.replace(new RegExp(oldPath.replace(/\//g, '\\/'), 'g'), newPath);
  
  // Count the replacements
  const replacements = (originalContent.match(new RegExp(oldPath.replace(/\//g, '\\/'), 'g')) || []).length;
  replacementCount += replacements;
  
  // Only write back if there were changes
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesModifiedCount++;
    console.log(`Updated ${filePath}: ${replacements} replacements`);
  } else {
    console.log(`No changes needed in ${filePath}`);
  }
});

console.log(`\nDefault image path migration complete:`);
console.log(`- Total path references updated: ${replacementCount}`);
console.log(`- Files modified: ${filesModifiedCount} / ${filesWithDefaultImages.length}`);
console.log(`\nOld path: ${oldPath}`);
console.log(`New path: ${newPath}`);