/**
 * Create and upload a default event image to Object Storage
 * 
 * This script creates an SVG image to use as a fallback
 * when calendar event images fail to load.
 */

import { Client } from '@replit/object-storage';

// Default event image SVG content (simple camera icon with text)
const defaultEventImageSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f0f2f5"/>
  <g transform="translate(150, 100)">
    <path d="M40 41c-5.52 0-10-4.48-10-10s4.48-10 10-10 10 4.48 10 10-4.48 10-10 10zm60-31h-12.5l-6.987-9.316A4.997 4.997 0 0076.666 0H43.334a4.997 4.997 0 00-3.847 1.684L32.5 10H20C8.972 10 0 18.972 0 30v40c0 11.028 8.972 20 20 20h80c11.028 0 20-8.972 20-20V30c0-11.028-8.972-20-20-20zm-40 60c-13.807 0-25-11.193-25-25s11.193-25 25-25 25 11.193 25 25-11.193 25-25 25z" 
      fill="#aaa" transform="scale(1.5)"/>
  </g>
  <text x="200" y="210" font-family="Arial" font-size="16" text-anchor="middle" fill="#666">Event image not available</text>
</svg>
`;

async function createDefaultEventImage() {
  try {
    // Initialize the client
    const client = new Client();
    
    // Create the key with bucket prefix
    const storageKey = 'CALENDAR/events/default-event-image.svg';
    
    // Upload directly to object storage
    const result = await client.uploadText(
      storageKey,
      defaultEventImageSvg,
      { contentType: 'image/svg+xml' }
    );
    
    if (!result.ok) {
      throw new Error(`Upload failed: ${result.error.message}`);
    }
    
    const url = `https://object-storage.replit.app/${storageKey}`;
    console.log('Default event image uploaded successfully:', url);
    return url;
  } catch (error) {
    console.error('Error creating default event image:', error);
  }
}

// Execute the script
createDefaultEventImage().catch(console.error);