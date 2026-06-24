/**
 * Create Forum Placeholder Images
 * 
 * This script creates forum placeholder images in the local filesystem
 * to be used as fallbacks when forum media is not found in Object Storage.
 * 
 * Note: This is a simplified version that focuses on creating local files.
 * The actual Object Storage upload will be handled separately through the server's
 * existing mechanisms or a separate script that uses the server's modules.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default forum image SVG content
const DEFAULT_FORUM_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#f0f2f5"/>
  <rect x="200" y="150" width="400" height="300" rx="10" fill="#dfe3e8"/>
  <path d="M430,250 L370,350 L400,350 L370,450" stroke="#a0aec0" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="450" cy="250" r="30" fill="#a0aec0"/>
  <text x="400" y="480" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#5c6b7a">Forum Image</text>
</svg>`;

// Forum placeholder SVG content
const FORUM_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#e6f2ff"/>
  <rect x="150" y="100" width="500" height="400" rx="15" fill="#cce0ff"/>
  <line x1="250" y1="200" x2="550" y2="200" stroke="#6699cc" stroke-width="10" stroke-linecap="round"/>
  <line x1="250" y1="250" x2="450" y2="250" stroke="#6699cc" stroke-width="10" stroke-linecap="round"/>
  <line x1="250" y1="300" x2="500" y2="300" stroke="#6699cc" stroke-width="10" stroke-linecap="round"/>
  <line x1="250" y1="350" x2="350" y2="350" stroke="#6699cc" stroke-width="10" stroke-linecap="round"/>
  <circle cx="350" cy="430" r="30" fill="#6699cc"/>
  <text x="400" y="500" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#336699">Forum Post</text>
</svg>`;

// Forum comment placeholder SVG
const FORUM_COMMENT_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <rect width="800" height="400" fill="#f5f8fa"/>
  <rect x="100" y="50" width="600" height="300" rx="10" fill="#e1e8ed"/>
  <circle cx="150" cy="100" r="30" fill="#aab8c2"/>
  <line x1="200" y1="90" x2="500" y2="90" stroke="#657786" stroke-width="10" stroke-linecap="round"/>
  <line x1="200" y1="120" x2="400" y2="120" stroke="#657786" stroke-width="10" stroke-linecap="round"/>
  <line x1="150" y1="150" x2="600" y2="150" stroke="#aab8c2" stroke-width="2"/>
  <text x="400" y="340" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#657786">Forum Comment</text>
</svg>`;

/**
 * Save the placeholder images to local filesystem as fallbacks
 */
async function saveLocalPlaceholders() {
  try {
    // Create directory if it doesn't exist
    const dir = path.join(process.cwd(), 'public', 'media-placeholder');
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (mkdirErr) {
      console.log('Directory may already exist:', mkdirErr.message);
    }
    
    // Save default forum image
    await fs.promises.writeFile(
      path.join(dir, 'default-forum-image.svg'), 
      DEFAULT_FORUM_IMAGE,
      'utf8'
    );
    
    // Save forum placeholder
    await fs.promises.writeFile(
      path.join(dir, 'forum-placeholder.svg'), 
      FORUM_PLACEHOLDER,
      'utf8'
    );
    
    // Save forum comment placeholder
    await fs.promises.writeFile(
      path.join(dir, 'forum-comment-placeholder.svg'), 
      FORUM_COMMENT_PLACEHOLDER,
      'utf8'
    );
    
    console.log('✅ Successfully saved local placeholder files to:', dir);
    
    // List the files we created
    const files = await fs.promises.readdir(dir);
    console.log('Created files:', files);
    
    return true;
  } catch (error) {
    console.error('Error saving local placeholder files:', error);
    return false;
  }
}

// Save local placeholders
console.log('Starting forum placeholder image creation...');
saveLocalPlaceholders().then(result => {
  console.log('Forum placeholder image creation complete!', result ? 'Success' : 'Failed');
}).catch(err => {
  console.error('Error running script:', err);
});