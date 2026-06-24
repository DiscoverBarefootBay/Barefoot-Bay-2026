/**
 * Script to restore Rob Allan's avatar and upload it to Object Storage
 * This ensures his avatar survives future deployments
 */

const { Client } = require('@replit/object-storage');
const fs = require('fs');
const path = require('path');

async function restoreRobAllanAvatar() {
  try {
    console.log('Restoring Rob Allan\'s avatar with Object Storage backup...');
    
    const targetFilename = 'avatar-1751698858449-742776583.jpg';
    const avatarPath = path.join('avatars', targetFilename);
    
    // Verify the file exists on filesystem
    if (!fs.existsSync(avatarPath)) {
      console.error('Avatar file not found on filesystem:', avatarPath);
      return false;
    }
    
    console.log('Avatar file found on filesystem');
    
    // Read the file buffer
    const fileBuffer = fs.readFileSync(avatarPath);
    console.log(`File size: ${Math.round(fileBuffer.length / 1024)}KB`);
    
    // Upload to Object Storage AVATARS bucket
    console.log('Uploading to Object Storage AVATARS bucket...');
    
    const client = new Client();
    
    // Upload to AVATARS bucket with the correct key format
    const storageKey = `AVATARS/${targetFilename}`;
    
    const uploadResult = await client.uploadFromBytes(storageKey, fileBuffer, {
      'Content-Type': 'image/jpeg'
    });
    
    console.log('Successfully uploaded to Object Storage');
    console.log('Storage key:', storageKey);
    
    // Verify the upload by listing AVATARS bucket contents
    console.log('Verifying upload...');
    const listResult = await client.list({ prefix: 'AVATARS/' });
    
    const avatarFound = listResult.objects?.find(obj => obj.key === storageKey);
    if (avatarFound) {
      console.log('Upload verified! Avatar found in Object Storage');
      console.log('Object details:', {
        key: avatarFound.key,
        size: Math.round(avatarFound.size / 1024) + 'KB',
        lastModified: avatarFound.lastModified
      });
    } else {
      console.log('Warning: Could not verify upload in AVATARS bucket');
    }
    
    console.log('Rob Allan\'s avatar has been restored and backed up to Object Storage!');
    console.log('Filesystem path:', avatarPath);
    console.log('Object Storage key:', storageKey);
    console.log('Proxy URL: /api/storage-proxy/direct-avatars/' + targetFilename);
    
    return true;
    
  } catch (error) {
    console.error('Error restoring avatar:', error.message);
    console.error(error);
    return false;
  }
}

// Run the restoration
restoreRobAllanAvatar()
  .then(success => {
    if (success) {
      console.log('\n✅ Avatar restoration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Avatar restoration failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Script error:', error);
    process.exit(1);
  });