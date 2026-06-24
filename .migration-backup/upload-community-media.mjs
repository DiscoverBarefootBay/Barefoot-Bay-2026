import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';

const COMMUNITY_MEDIA_DIR = 'community-media';
const BUCKET = 'COMMUNITY';

async function uploadFiles() {
  const client = new Client();
  
  if (!fs.existsSync(COMMUNITY_MEDIA_DIR)) {
    console.log(`Directory ${COMMUNITY_MEDIA_DIR} not found`);
    return;
  }
  
  const files = fs.readdirSync(COMMUNITY_MEDIA_DIR).filter(f => !f.startsWith('.'));
  console.log(`Found ${files.length} files\n`);
  
  for (const filename of files) {
    const filePath = path.join(COMMUNITY_MEDIA_DIR, filename);
    const storageKey = `community/${filename}`;
    
    try {
      const result = await client.uploadFromFilename(storageKey, filePath, {
        bucketName: BUCKET,
        headers: { 'X-Obj-Bucket': BUCKET }
      });
      
      if (result.ok) {
        console.log(`✅ ${filename}`);
      } else {
        console.log(`❌ ${filename}: ${result.error?.message || 'Failed'}`);
      }
    } catch (error) {
      console.log(`❌ ${filename}: ${error.message}`);
    }
  }
  
  console.log('\nDone!');
}

uploadFiles();
