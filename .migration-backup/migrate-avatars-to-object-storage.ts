/**
 * Migration Script: Avatar Files to Object Storage
 * 
 * This script migrates existing avatar files from filesystem storage to Replit Object Storage.
 * It ensures avatars persist across deployments by:
 * 1. Finding all users with filesystem-based avatar URLs
 * 2. Uploading their avatar files to the AVATARS bucket in Object Storage
 * 3. Updating the database with the new Object Storage proxy URLs
 * 
 * Run this script with: node migrate-avatars-to-object-storage.js
 */

import { db } from './server/storage';
import { users } from './shared/schema';
import { objectStorageService } from './server/object-storage-service';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateAvatarsToObjectStorage() {
  console.log('🚀 Starting avatar migration to Object Storage...\n');
  
  try {
    // Get all users with avatar URLs
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} total users`);
    
    // Filter users with filesystem-based avatars (not already using Object Storage)
    const usersWithFilesystemAvatars = allUsers.filter(user => 
      user.avatarUrl && 
      user.avatarUrl.startsWith('/avatars/') &&
      !user.avatarUrl.includes('/api/storage-proxy/')
    );
    
    console.log(`Found ${usersWithFilesystemAvatars.length} users with filesystem-based avatars to migrate\n`);
    
    if (usersWithFilesystemAvatars.length === 0) {
      console.log('✅ No avatars need migration. All avatars are already using Object Storage or no avatars exist.');
      return;
    }
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const user of usersWithFilesystemAvatars) {
      console.log(`\n📸 Processing user: ${user.username} (ID: ${user.id})`);
      console.log(`   Current avatar URL: ${user.avatarUrl}`);
      
      // Extract filename from avatar URL
      const filename = user.avatarUrl.replace('/avatars/', '');
      console.log(`   Filename: ${filename}`);
      
      // Try to find the file in filesystem
      const possiblePaths = [
        path.join(__dirname, 'uploads', 'avatars', filename),
        path.join(__dirname, 'avatars', filename)
      ];
      
      let filePath = null;
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          console.log(`   ✓ Found file at: ${filePath}`);
          break;
        }
      }
      
      if (!filePath) {
        console.log(`   ⚠️  SKIP: Avatar file not found in filesystem (may have been deleted)`);
        skipCount++;
        continue;
      }
      
      try {
        // Upload to Object Storage AVATARS bucket
        console.log(`   ⬆️  Uploading to Object Storage AVATARS bucket...`);
        
        const objectStorageUrl = await objectStorageService.uploadFile(
          filePath,
          '', // No subdirectory - store directly in bucket root
          filename,
          'AVATARS' // Dedicated AVATARS bucket
        );
        
        console.log(`   ✓ Uploaded to Object Storage: ${objectStorageUrl}`);
        
        // Update database with Object Storage proxy URL
        const newAvatarUrl = `/api/storage-proxy/direct-avatars/${filename}`;
        
        await db
          .update(users)
          .set({ 
            avatarUrl: newAvatarUrl,
            updatedAt: new Date()
          })
          .where(eq(users.id, user.id));
        
        console.log(`   ✓ Updated database with new URL: ${newAvatarUrl}`);
        console.log(`   ✅ SUCCESS: Migration complete for user ${user.username}`);
        
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ ERROR migrating avatar for user ${user.username}:`, error.message);
        errorCount++;
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${successCount} avatars`);
    console.log(`⚠️  Skipped (file not found): ${skipCount} avatars`);
    console.log(`❌ Failed: ${errorCount} avatars`);
    console.log(`📝 Total processed: ${usersWithFilesystemAvatars.length} users`);
    console.log('='.repeat(60));
    
    if (successCount > 0) {
      console.log('\n✨ Avatars are now stored in Object Storage and will persist through deployments!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
    throw error;
  }
}

// Run the migration
migrateAvatarsToObjectStorage()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
