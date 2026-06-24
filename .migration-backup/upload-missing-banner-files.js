/**
 * Upload the specific missing banner files causing 404 errors
 * This targets the exact files from the database that are missing in Object Storage
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';

const objectStorage = new Client();
const BANNER_BUCKET = 'BANNER';

// These are the specific files causing 404 errors from your database
const requiredFiles = [
  'bannerImage-1747752361661-294313402.jpg',
  'bannerImage-1747881799464-29191037.mp4',
  'bannerImage-1747659587396-506755060.jpg',
  'bannerImage-1747102509843-170028248.jpg',
  'bannerImage-1746673771236-269458171.jpg',
  'bannerImage-1746647370983-876461691.png',
  'bannerImage-1746647338044-947664207.png',
  'bannerImage-1747918143132-922929174.mp4'
];

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

async function findAndUploadFile(filename) {
  console.log(`🔍 Looking for: ${filename}`);
  
  // Possible locations where the file might exist
  const searchPaths = [
    `./banner-slides/${filename}`,
    `./uploads/banner-slides/${filename}`,
    `./uploads/backups/banner-slides/2025-04-09T22-45-08.994Z/${filename}`,
    `./test-media-backup/banner-slides/${filename}`,
    `./test-media-restore/banner-slides/${filename}`
  ];
  
  // Try to find the file
  for (const filePath of searchPaths) {
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ Found at: ${filePath}`);
      
      try {
        const buffer = fs.readFileSync(filePath);
        const contentType = getContentType(filename);
        const storageKey = `banner-slides/${filename}`;
        
        console.log(`  📤 Uploading ${filename} (${buffer.length} bytes)...`);
        
        const result = await objectStorage.uploadFromBytes(
          storageKey,
          buffer,
          { 'content-type': contentType },
          BANNER_BUCKET
        );
        
        if (result.ok) {
          console.log(`  ✅ Successfully uploaded: ${filename}`);
          return true;
        } else {
          console.log(`  ❌ Upload failed: ${filename}`);
          return false;
        }
      } catch (error) {
        console.log(`  ❌ Error uploading ${filename}:`, error.message);
        return false;
      }
    }
  }
  
  console.log(`  ⚠️ File not found in any location: ${filename}`);
  return false;
}

async function checkIfFileExistsInStorage(filename) {
  try {
    const storageKey = `banner-slides/${filename}`;
    const result = await objectStorage.downloadAsBytes(storageKey, BANNER_BUCKET);
    return result && result.length > 0;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🚀 Uploading critical missing banner files...\n');
  
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const filename of requiredFiles) {
    // Check if already exists
    const exists = await checkIfFileExistsInStorage(filename);
    
    if (exists) {
      console.log(`⏭️ ${filename} already exists in Object Storage`);
      skipped++;
      continue;
    }
    
    // Try to upload
    const success = await findAndUploadFile(filename);
    
    if (success) {
      uploaded++;
    } else {
      failed++;
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('🎯 Results:');
  console.log(`✅ Uploaded: ${uploaded}`);
  console.log(`⏭️ Already existed: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (uploaded > 0 || skipped === requiredFiles.length) {
    console.log('\n🎉 Banner slide 404 errors should now be resolved!');
    console.log('Try refreshing your website to see the changes.');
  }
}

main().catch(console.error);