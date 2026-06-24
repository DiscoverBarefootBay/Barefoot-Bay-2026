/**
 * Create Android icon files from the existing BB logo
 * This script generates the 192x192 and 512x512 PNG files needed for Android home screen icons
 */

import fs from 'fs';
import path from 'path';

// Create SVG versions that can be converted to PNG
function createAndroidIcon(size) {
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- White background for proper Android display -->
  <rect width="${size}" height="${size}" fill="#ffffff" rx="${size * 0.1}"/>
  
  <!-- BB Logo scaled appropriately -->
  <g transform="translate(${size * 0.15}, ${size * 0.2}) scale(${size * 0.0035})">
    <!-- B Logo Path -->
    <path d="M20 10 C20 4, 25 0, 35 0 L65 0 C75 0, 80 4, 80 10 L80 15 C80 20, 75 25, 70 25 L75 25 C85 25, 90 30, 90 40 L90 50 C90 60, 85 65, 75 65 L35 65 C25 65, 20 60, 20 50 Z M35 15 L35 20 L65 20 C68 20, 70 18, 70 15 C70 12, 68 10, 65 10 L35 10 Z M35 35 L35 50 L70 50 C73 50, 75 48, 75 45 C75 42, 73 40, 70 40 L35 40 Z" fill="#2563eb" stroke="#1e40af" stroke-width="2"/>
    
    <!-- Second B -->
    <g transform="translate(100, 0)">
      <path d="M20 10 C20 4, 25 0, 35 0 L65 0 C75 0, 80 4, 80 10 L80 15 C80 20, 75 25, 70 25 L75 25 C85 25, 90 30, 90 40 L90 50 C90 60, 85 65, 75 65 L35 65 C25 65, 20 60, 20 50 Z M35 15 L35 20 L65 20 C68 20, 70 18, 70 15 C70 12, 68 10, 65 10 L35 10 Z M35 35 L35 50 L70 50 C73 50, 75 48, 75 45 C75 42, 73 40, 70 40 L35 40 Z" fill="#2563eb" stroke="#1e40af" stroke-width="2"/>
    </g>
  </g>
</svg>`;

  return svgContent;
}

// Create the icon files
const icon192 = createAndroidIcon(192);
const icon512 = createAndroidIcon(512);

// Save to icons directory
if (!fs.existsSync('./public/icons')) {
  fs.mkdirSync('./public/icons', { recursive: true });
}

fs.writeFileSync('./public/icons/icon-192.svg', icon192);
fs.writeFileSync('./public/icons/icon-512.svg', icon512);

console.log('✅ Created Android icon SVG files');
console.log('📱 These will work as fallbacks for Android devices');
console.log('🔄 You may want to convert these to PNG files for better compatibility');