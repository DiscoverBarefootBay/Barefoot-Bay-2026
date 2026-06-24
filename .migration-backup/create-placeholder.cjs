/**
 * Creates a placeholder banner image for use when original images are missing
 */

const fs = require('fs');
const path = require('path');

// Create the directories if they don't exist
const uploadsDir = path.join(process.cwd(), 'uploads/banner-slides');
const rootDir = path.join(process.cwd(), 'banner-slides');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Created uploads directory: ${uploadsDir}`);
}

if (!fs.existsSync(rootDir)) {
  fs.mkdirSync(rootDir, { recursive: true });
  console.log(`Created root directory: ${rootDir}`);
}

// Simple 1-pixel transparent PNG for placeholder
const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Decode the base64 string to a buffer
const buffer = Buffer.from(placeholderBase64, 'base64');

// Define the placeholder paths
const placeholderPathUploads = path.join(uploadsDir, 'placeholder-banner.png');
const placeholderPathRoot = path.join(rootDir, 'placeholder-banner.png');

// Write the placeholder files
fs.writeFileSync(placeholderPathUploads, buffer);
console.log(`Created placeholder at ${placeholderPathUploads}`);

fs.writeFileSync(placeholderPathRoot, buffer);
console.log(`Created placeholder at ${placeholderPathRoot}`);

// Done!
console.log('Placeholder banner images created successfully!');
