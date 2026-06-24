/**
 * Community Media Migration Script
 * Migrates all community media from local filesystem to Object Storage
 * and updates database URLs to use the new storage proxy format
 */

import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';
import { db } from './server/storage.js';
import { sql } from 'drizzle-orm';

const COMMUNITY_MEDIA_DIR = 'uploads/community-media';
const BUCKET = 'COMMUNITY';

async function migrateMediaToObjectStorage() {
  console.log('🚀 Starting community media migration to Object Storage...\n');
  
  const client = new Client();
  
  // Check if directory exists
  if (!fs.existsSync(COMMUNITY_MEDIA_DIR)) {
    console.log(`❌ Directory ${COMMUNITY_MEDIA_DIR} does not exist`);
    return;
  }
  
  // Get all files in the directory
  const files = fs.readdirSync(COMMUNITY_MEDIA_DIR).filter(f => !f.startsWith('.'));
  console.log(`📁 Found ${files.length} files to migrate:\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const filename of files) {
    const filePath = path.join(COMMUNITY_MEDIA_DIR, filename);
    const storageKey = `community/${filename}`;
    
    try {
      console.log(`  📤 Uploading: ${filename}`);
      
      // Upload to Object Storage
      const result = await client.uploadFromFilename(storageKey, filePath, {
        bucketName: BUCKET,
        headers: {
          'X-Obj-Bucket': BUCKET
        }
      });
      
      if (!result.ok) {
        throw new Error(`Upload failed: ${result.error?.message || 'Unknown error'}`);
      }
      
      console.log(`  ✅ Successfully uploaded to: ${BUCKET}/${storageKey}`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ Failed to upload ${filename}:`, error.message);
      failCount++;
    }
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
}

async function updateDatabaseURLs() {
  console.log('\n🔄 Updating database URLs to use storage proxy...\n');
  
  try {
    // Update all URLs in page_contents that use the old format
    const updateResult = await db.execute(sql`
      UPDATE page_contents 
      SET content = REPLACE(
        REPLACE(
          content,
          '/uploads/community-media/',
          '/api/storage-proxy/direct-community/'
        ),
        '/community-media/',
        '/api/storage-proxy/direct-community/'
      )
      WHERE content LIKE '%/uploads/community-media/%' 
         OR content LIKE '%/community-media/%'
      RETURNING id, slug, title;
    `);
    
    console.log(`✅ Updated ${updateResult.rows?.length || 0} pages:`);
    updateResult.rows?.forEach(row => {
      console.log(`  - ${row.slug}: ${row.title}`);
    });
  } catch (error) {
    console.error('❌ Failed to update database URLs:', error.message);
    throw error;
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...\n');
  
  const client = new Client();
  
  try {
    // Check a few files in Object Storage
    const testFiles = [
      'community-1760366327928-660385518.JPEG',
      'community-1760192162618-568260141.jpeg'
    ];
    
    for (const filename of testFiles) {
      const storageKey = `community/${filename}`;
      
      try {
        const result = await client.listWithPrefix(storageKey, {
          bucketName: BUCKET,
          maxKeys: 1,
          headers: {
            'X-Obj-Bucket': BUCKET
          }
        });
        
        if (result.ok && result.value.length > 0) {
          console.log(`  ✅ Verified: ${filename} exists in Object Storage`);
        } else {
          console.log(`  ⚠️  Warning: ${filename} not found in Object Storage`);
        }
      } catch (error) {
        console.log(`  ⚠️  Warning: Could not verify ${filename}:`, error.message);
      }
    }
    
    // Check database URLs
    const pages = await db.execute(sql`
      SELECT id, slug, title, content 
      FROM page_contents 
      WHERE content LIKE '%/api/storage-proxy/direct-community/%'
      LIMIT 5;
    `);
    
    console.log(`\n✅ Found ${pages.rows?.length || 0} pages using new URL format`);
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('    Community Media Migration to Object Storage');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Step 1: Upload files to Object Storage
    await migrateMediaToObjectStorage();
    
    // Step 2: Update database URLs
    await updateDatabaseURLs();
    
    // Step 3: Verify migration
    await verifyMigration();
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✨ Migration completed successfully!');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
