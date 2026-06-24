/**
 * Temporary script to ensure that the tmp_debug directory exists and 
 * contains the required forum media debug HTML file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure tmp_debug directory exists
const tmpDebugDir = path.join(__dirname, '../tmp_debug');
if (!fs.existsSync(tmpDebugDir)) {
  console.log(`Creating tmp_debug directory at ${tmpDebugDir}`);
  fs.mkdirSync(tmpDebugDir, { recursive: true });
}

// Check if the forum-media-debug.html file exists in public
const sourceFile = path.join(__dirname, '../public/forum-media-debug.html');
const targetFile = path.join(tmpDebugDir, 'forum-media-debug.html');

if (fs.existsSync(sourceFile)) {
  console.log(`Copying forum-media-debug.html from public to tmp_debug`);
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`File copied successfully to ${targetFile}`);
} else {
  console.error(`Source file not found at ${sourceFile}`);
  
  // Create a basic version in tmp_debug if it doesn't exist
  if (!fs.existsSync(targetFile)) {
    console.log(`Creating basic debug file in tmp_debug directory`);
    const basicHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Forum Media Debug</title>
  <style>
    body { font-family: sans-serif; margin: 20px; }
    h1 { color: #2d3748; }
    .button {
      display: inline-block;
      background-color: #4299e1;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      text-decoration: none;
      margin-right: 10px;
    }
  </style>
</head>
<body>
  <h1>Forum Media Debug Tool</h1>
  <p>This is a basic version of the debug tool. The full version should be in the public directory.</p>
  
  <a href="/api/forum-media-test/system-info" class="button">View System Info</a>
  <a href="/api/forum-media-test/debug/standard/example.jpg" class="button">Test Standard URL</a>
</body>
</html>`;
    
    fs.writeFileSync(targetFile, basicHtml);
    console.log(`Basic debug file created at ${targetFile}`);
  }
}

// Export this function to be used in routes.ts
export function ensureTmpDebugExists() {
  return fs.existsSync(tmpDebugDir) && fs.existsSync(targetFile);
}