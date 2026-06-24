/**
 * Fix banner slide Object Storage structure by copying files to correct paths
 */
import { Client } from '@replit/object-storage';

async function fixBannerObjectStorage() {
    try {
        const client = new Client();
        
        // The banner files we need
        const neededFiles = [
            'bannerImage-1747918143132-922929174.mp4',
            'bannerImage-1747752361661-294313402.jpg', 
            'bannerImage-1747659587396-506755060.jpg',
            'bannerImage-1747102509843-170028248.jpg',
            'bannerImage-1746673771236-269458171.jpg',
            'bannerImage-1746647370983-876461691.png',
            'bannerImage-1746647338044-947664207.png',
            'bannerImage-1747881799464-29191037.mp4'
        ];
        
        console.log('🔍 Checking current BANNER bucket structure...');
        
        // First, let's see ALL files in the BANNER bucket
        const allBannerFiles = await client.list('', 'BANNER');
        if (allBannerFiles.ok) {
            console.log(`📁 Total files in BANNER bucket: ${allBannerFiles.value.length}`);
            
            // Look for our specific banner files anywhere in the bucket
            for (const neededFile of neededFiles) {
                console.log(`\n🔍 Looking for: ${neededFile}`);
                
                const found = allBannerFiles.value.find(file => 
                    file.name === neededFile || 
                    file.name.includes(neededFile) ||
                    file.name.endsWith(neededFile)
                );
                
                if (found) {
                    console.log(`✅ Found: ${found.name}`);
                    
                    // If it's not in the banner-slides/ subfolder, copy it there
                    const correctPath = `banner-slides/${neededFile}`;
                    if (found.name !== correctPath) {
                        try {
                            console.log(`📁 Copying from ${found.name} to ${correctPath}`);
                            
                            // Get the file content
                            const fileBuffer = await client.downloadAsBytes(found.name, 'BANNER');
                            
                            if (fileBuffer) {
                                // Upload to correct location
                                const result = await client.uploadFromBytes(correctPath, fileBuffer, {
                                    'content-type': neededFile.endsWith('.mp4') ? 'video/mp4' : 
                                                  neededFile.endsWith('.jpg') ? 'image/jpeg' :
                                                  neededFile.endsWith('.png') ? 'image/png' : 'application/octet-stream'
                                }, 'BANNER');
                                
                                if (result.ok) {
                                    console.log(`✅ Successfully copied to: ${correctPath}`);
                                } else {
                                    console.log(`❌ Failed to copy: ${result}`);
                                }
                            }
                        } catch (copyError) {
                            console.log(`❌ Error copying ${found.name}:`, copyError.message);
                        }
                    } else {
                        console.log(`✅ Already in correct location: ${correctPath}`);
                    }
                } else {
                    console.log(`❌ Not found in BANNER bucket: ${neededFile}`);
                }
            }
        }
        
        console.log('\n🔍 Verifying final structure...');
        
        // Check what's now in banner-slides/ subdirectory
        const bannerSlidesFiles = await client.list('banner-slides/', 'BANNER');
        if (bannerSlidesFiles.ok) {
            console.log('\n📁 Files in BANNER/banner-slides/:');
            bannerSlidesFiles.value.forEach(file => {
                if (neededFiles.some(needed => file.name.includes(needed))) {
                    console.log(`✅ ${file.name}`);
                } else {
                    console.log(`📄 ${file.name}`);
                }
            });
        }
        
        console.log('\n🎉 Banner slide Object Storage fix completed!');
        
    } catch (error) {
        console.error('❌ Error fixing banner Object Storage:', error);
    }
}

fixBannerObjectStorage();