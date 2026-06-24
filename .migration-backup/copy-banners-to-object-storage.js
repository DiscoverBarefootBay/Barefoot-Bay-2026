/**
 * Copy banner slide files from local server storage to Object Storage
 * This will make the banner slides accessible via direct Object Storage URLs
 */
import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';

async function copyBannerSlidesToObjectStorage() {
    try {
        const client = new Client();
        
        // List of banner files that need to be copied based on your database content
        const bannerFiles = [
            'bannerImage-1747918143132-922929174.mp4',
            'bannerImage-1747752361661-294313402.jpg',
            'bannerImage-1747659587396-506755060.jpg', 
            'bannerImage-1747102509843-170028248.jpg',
            'bannerImage-1746673771236-269458171.jpg',
            'bannerImage-1746647370983-876461691.png',
            'bannerImage-1746647338044-947664207.png',
            'bannerImage-1747881799464-29191037.mp4'
        ];
        
        // Possible local paths where banner files might be stored
        const localPaths = [
            '/home/runner/workspace/uploads/banner-slides/',
            '/home/runner/workspace/banner-slides/',
            '/home/runner/workspace/uploads/',
            '/home/runner/workspace/public/banner-slides/',
            '/home/runner/workspace/server/public/banner-slides/'
        ];
        
        console.log('🔍 Starting banner slide file copy process...');
        
        for (const filename of bannerFiles) {
            console.log(`\n📁 Looking for: ${filename}`);
            
            let found = false;
            for (const localPath of localPaths) {
                const fullPath = path.join(localPath, filename);
                
                if (fs.existsSync(fullPath)) {
                    console.log(`✅ Found at: ${fullPath}`);
                    
                    try {
                        // Read the file
                        const fileBuffer = fs.readFileSync(fullPath);
                        
                        // Upload to Object Storage in the correct location
                        const objectStoragePath = `BANNER/banner-slides/${filename}`;
                        const result = await client.uploadFromBytes(objectStoragePath, fileBuffer, {
                            'content-type': filename.endsWith('.mp4') ? 'video/mp4' : 
                                          filename.endsWith('.jpg') ? 'image/jpeg' :
                                          filename.endsWith('.png') ? 'image/png' : 'application/octet-stream'
                        });
                        
                        if (result.ok) {
                            console.log(`✅ Successfully uploaded: ${objectStoragePath}`);
                        } else {
                            console.log(`❌ Upload failed for ${filename}:`, result);
                        }
                        
                        found = true;
                        break; // Found and processed, move to next file
                        
                    } catch (uploadError) {
                        console.log(`❌ Error uploading ${filename}:`, uploadError.message);
                    }
                }
            }
            
            if (!found) {
                console.log(`⚠️ File not found in any local paths: ${filename}`);
                
                // List what files are actually in the banner-slides directory
                const bannerSlidesDir = '/home/runner/workspace/uploads/banner-slides/';
                if (fs.existsSync(bannerSlidesDir)) {
                    const actualFiles = fs.readdirSync(bannerSlidesDir);
                    console.log(`📂 Files actually in ${bannerSlidesDir}:`, actualFiles.slice(0, 5));
                }
            }
        }
        
        console.log('\n🎉 Banner slide copy process completed!');
        
        // Verify what's now in Object Storage
        console.log('\n🔍 Verifying Object Storage contents...');
        const bannerStorageList = await client.list('BANNER/banner-slides/');
        if (bannerStorageList.ok) {
            const bannerFiles = bannerStorageList.value.map(item => item.name);
            console.log('📁 Files now in BANNER/banner-slides/:', bannerFiles);
        }
        
    } catch (error) {
        console.error('❌ Error in banner slide copy process:', error);
    }
}

copyBannerSlidesToObjectStorage();