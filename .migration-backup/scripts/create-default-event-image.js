/**
 * Create and upload default event image to Object Storage
 * This ensures we always have a fallback image in all required paths
 */

import fs from 'fs';
import path from 'path';
import { Client } from '@replit/object-storage';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SVG content for default image
const defaultImage = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#f0f0f0"/>
  <text x="400" y="300" font-family="Arial" font-size="24" text-anchor="middle">Event Image</text>
  <text x="400" y="340" font-family="Arial" font-size="20" text-anchor="middle">Barefoot Bay Community</text>
</svg>`;

async function createDefaultEventImage() {
  try {
    // Save the default image locally as a temporary file
    const tempFilePath = path.join(__dirname, 'default-event-image.svg');
    fs.writeFileSync(tempFilePath, defaultImage);
    console.log('Default event image created locally:', tempFilePath);

    // Initialize Object Storage client
    const client = new Client();
    console.log('Object Storage client initialized');

    // Upload to all possible paths where event images might be accessed
    const pathsToCreate = [
      // Standard path with bucket in key
      { key: 'CALENDAR/events/default-event-image.svg', bucket: 'CALENDAR' },
      // Path without bucket prefix in key
      { key: 'events/default-event-image.svg', bucket: 'CALENDAR' },
      // Direct root path
      { key: 'default-event-image.svg', bucket: 'CALENDAR' }
    ];

    // Upload to each path
    for (const pathInfo of pathsToCreate) {
      console.log(`Uploading to ${pathInfo.key} in bucket ${pathInfo.bucket}...`);
      
      const result = await client.uploadFromFilename(
        pathInfo.key,
        tempFilePath,
        {
          contentType: 'image/svg+xml',
          bucketName: pathInfo.bucket,
          headers: {
            'X-Obj-Bucket': pathInfo.bucket
          }
        }
      );

      if (result.ok) {
        console.log(`✅ Successfully uploaded to ${pathInfo.key}`);
      } else {
        console.error(`❌ Failed to upload to ${pathInfo.key}:`, result.error);
      }
    }

    // Also create in the public directory for local access
    const publicPath = path.join(process.cwd(), 'client', 'public', 'default-event-image.svg');
    fs.writeFileSync(publicPath, defaultImage);
    console.log('Default event image saved to public directory:', publicPath);

    // Remove temporary file
    fs.unlinkSync(tempFilePath);
    console.log('Temporary file removed');

    console.log('✅ Default event image created and uploaded to all paths');
  } catch (error) {
    console.error('Error creating default event image:', error);
  }
}

createDefaultEventImage();