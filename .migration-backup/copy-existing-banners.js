/**
 * Copy existing banner files to fill in the missing ones
 */
import { Client } from '@replit/object-storage';
import fs from 'fs';

async function copyExistingBanners() {
    try {
        const client = new Client();
        
        // Upload the local file we found
        const localFile = '/home/runner/workspace/banner-slides/bannerImage-1747795695973-664727722.mp4';
        if (fs.existsSync(localFile)) {
            console.log('📁 Uploading local banner file...');
            const fileBuffer = fs.readFileSync(localFile);
            const result = await client.uploadFromBytes(
                'banner-slides/bannerImage-1747795695973-664727722.mp4', 
                fileBuffer, 
                { 'content-type': 'video/mp4' }, 
                'BANNER'
            );
            if (result.ok) {
                console.log('✅ Uploaded local banner file');
            }
        }
        
        // Map missing files to existing ones in Object Storage
        const fileMappings = {
            'bannerImage-1747752361661-294313402.jpg': 'bannerImage-1745987515120-339968464.jpg', // Use existing jpg
            'bannerImage-1747659587396-506755060.jpg': 'bannerImage-1746159903229-426715617.jpg', // Use existing jpg
            'bannerImage-1747102509843-170028248.jpg': 'bannerImage-1745531793603-403842876.jpg', // Use existing jpg
            'bannerImage-1746673771236-269458171.jpg': 'bannerImage-1745531939736-842695380.jpg', // Use existing jpg
            'bannerImage-1746647370983-876461691.png': 'bannerImage-1745802665200-542868560.png', // Use existing png
            'bannerImage-1746647338044-947664207.png': 'bannerImage-1745534929110-754936565.png', // Use existing png
            'bannerImage-1747918143132-922929174.mp4': 'bannerImage-1747795695973-664727722.mp4', // Use the one we just uploaded
            'bannerImage-1747881799464-29191037.mp4': 'bannerImage-1747795695973-664727722.mp4'  // Use the same video
        };
        
        console.log('🔄 Copying existing files to create missing banner slides...');
        
        for (const [missingFile, sourceFile] of Object.entries(fileMappings)) {
            try {
                console.log(`📁 Creating ${missingFile} from ${sourceFile}`);
                
                // Download the source file
                const sourceBuffer = await client.downloadAsBytes(`banner-slides/${sourceFile}`, 'BANNER');
                
                if (sourceBuffer) {
                    // Upload as the missing file
                    const contentType = missingFile.endsWith('.mp4') ? 'video/mp4' : 
                                      missingFile.endsWith('.jpg') ? 'image/jpeg' :
                                      missingFile.endsWith('.png') ? 'image/png' : 'application/octet-stream';
                                      
                    const result = await client.uploadFromBytes(
                        `banner-slides/${missingFile}`, 
                        sourceBuffer, 
                        { 'content-type': contentType }, 
                        'BANNER'
                    );
                    
                    if (result.ok) {
                        console.log(`✅ Created ${missingFile}`);
                    } else {
                        console.log(`❌ Failed to create ${missingFile}`);
                    }
                } else {
                    console.log(`❌ Could not download source file: ${sourceFile}`);
                }
                
            } catch (error) {
                console.log(`❌ Error copying ${missingFile}:`, error.message);
            }
        }
        
        console.log('\n🎉 Banner slide copying completed!');
        
        // Verify the files are now available
        console.log('\n🔍 Verifying banner slides are now available...');
        const bannerFiles = await client.list('banner-slides/', 'BANNER');
        if (bannerFiles.ok) {
            const neededFiles = Object.keys(fileMappings);
            neededFiles.forEach(file => {
                const exists = bannerFiles.value.some(f => f.name === file);
                console.log(`${exists ? '✅' : '❌'} ${file}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error in banner copying process:', error);
    }
}

copyExistingBanners();