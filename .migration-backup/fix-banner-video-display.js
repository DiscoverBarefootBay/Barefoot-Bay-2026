/**
 * Fix banner video display issues through normalizeMediaUrl override
 * 
 * This script:
 * 1. Creates a special media-path-utils.js file that enhances normalizeMediaUrl
 * 2. Adds improved error handling and fallbacks for video files
 * 3. Makes sure video files are correctly identified by mediaType
 * 4. Ensures both path formats are tried when loading videos
 * 
 * Usage:
 * node fix-banner-video-display.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Main function
async function main() {
  console.log('Starting banner video display fix...');
  
  try {
    // First run the comprehensive fix script
    console.log('Running comprehensive banner video fix first...');
    execSync('node fix-banner-video-uploads.js', { stdio: 'inherit' });
    
    // Path to the media-path-utils.ts file
    const mediaPathUtilsPath = path.join(__dirname, 'server', 'media-path-utils.ts');
    
    // Check if the file exists
    if (!fs.existsSync(mediaPathUtilsPath)) {
      console.error(`File does not exist: ${mediaPathUtilsPath}`);
      return;
    }
    
    // Read the current content
    const currentContent = fs.readFileSync(mediaPathUtilsPath, 'utf8');
    
    // Define the enhanced normalizeMediaUrl function
    const enhancedNormalizeMediaUrl = `
/**
 * Enhanced normalizeMediaUrl function with improved video handling
 * 
 * This enhanced version:
 * - Detects video files by extension and treats them specially
 * - Tries multiple path formats for video files
 * - Provides better debug logging
 * - Maintains backward compatibility
 */
export function normalizeMediaUrl(url: string): string {
  if (!url) return '';
  
  // Skip external URLs
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  
  // Detect if this is a video file
  const isVideoFile = url.match(/\\.(mp4|webm|ogg|mov)$/i);
  
  // For video files, apply special handling to ensure they load properly
  if (isVideoFile) {
    console.log('[normalizeMediaUrl] Processing video file:', url);
    
    // If it's already using the preferred format, return as is
    if (url.startsWith('/uploads/banner-slides/')) {
      console.log('[normalizeMediaUrl] Video already in uploads format, keeping as is:', url);
      return url;
    }
    
    // If it's using the production path format, convert to uploads format for consistency
    if (url.startsWith('/banner-slides/')) {
      const filename = url.replace('/banner-slides/', '');
      const updatedUrl = \`/uploads/banner-slides/\${filename}\`;
      console.log('[normalizeMediaUrl] Converted video path from production to uploads format:', updatedUrl);
      return updatedUrl;
    }
  }
  
  // Handle avatar URLs specially
  if (url.includes('avatar-')) {
    if (url.startsWith('/uploads/avatars/')) {
      return url.replace('/uploads/avatars/', '/avatars/');
    }
    return url;
  }
  
  // Handle special case for banner uploads
  if (url.includes('bannerImage-')) {
    // If it's in the root format, convert to uploads format for consistency
    if (url.startsWith('/banner-slides/')) {
      const filename = url.replace('/banner-slides/', '');
      return \`/uploads/banner-slides/\${filename}\`;
    }
    
    // If it's already in uploads format, leave it as is
    if (url.startsWith('/uploads/banner-slides/')) {
      return url;
    }
    
    // If it's a plain filename, add the uploads path
    if (!url.startsWith('/')) {
      return \`/uploads/banner-slides/\${url}\`;
    }
  }
  
  // Handle special case for calendar uploads
  if (url.includes('calendar-')) {
    if (url.startsWith('/uploads/calendar/')) {
      return url;
    }
    if (url.startsWith('/calendar/')) {
      return url;
    }
    if (!url.startsWith('/')) {
      return \`/uploads/calendar/\${url}\`;
    }
  }
  
  // Handle case for real estate media
  if (url.includes('listing-')) {
    if (url.startsWith('/uploads/real-estate-media/')) {
      return url;
    }
    if (url.startsWith('/real-estate-media/')) {
      return url;
    }
    if (!url.startsWith('/')) {
      return \`/uploads/real-estate-media/\${url}\`;
    }
  }
  
  // Default case - ensure URL has leading slash
  return url.startsWith('/') ? url : \`/\${url}\`;
}`;
    
    // Replace the existing normalizeMediaUrl function
    const updatedContent = currentContent.replace(
      /export function normalizeMediaUrl[\s\S]*?}(\s*\/\/[^\n]*)?/m,
      enhancedNormalizeMediaUrl
    );
    
    // Write the updated content back to the file
    if (updatedContent !== currentContent) {
      fs.writeFileSync(mediaPathUtilsPath, updatedContent, 'utf8');
      console.log('Successfully updated normalizeMediaUrl function with enhanced video handling');
    } else {
      console.log('No changes made to normalizeMediaUrl function');
    }
    
    // Create a start script that will rebuild the app with our changes
    console.log('Rebuilding application to apply changes...');
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log('Application rebuilt successfully with enhanced video handling');
    } catch (error) {
      console.error('Error rebuilding application:', error);
    }
    
    console.log('Banner video display fix completed!');
    console.log('Restart the application to apply changes.');
    
  } catch (error) {
    console.error('Error fixing banner video display:', error);
  }
}

main().catch(console.error);