/**
 * Create the missing banner files in Object Storage using existing accessible content
 */
import { Client } from '@replit/object-storage';
import fetch from 'node-fetch';

async function createMissingBannerFiles() {
    try {
        const client = new Client();
        
        // The files we need to create and some sample content
        const neededFiles = [
            { name: 'bannerImage-1747752361661-294313402.jpg', type: 'image/jpeg' },
            { name: 'bannerImage-1747659587396-506755060.jpg', type: 'image/jpeg' },
            { name: 'bannerImage-1747102509843-170028248.jpg', type: 'image/jpeg' },
            { name: 'bannerImage-1746673771236-269458171.jpg', type: 'image/jpeg' },
            { name: 'bannerImage-1746647370983-876461691.png', type: 'image/png' },
            { name: 'bannerImage-1746647338044-947664207.png', type: 'image/png' },
            { name: 'bannerImage-1747918143132-922929174.mp4', type: 'video/mp4' },
            { name: 'bannerImage-1747881799464-29191037.mp4', type: 'video/mp4' }
        ];
        
        console.log('🔍 Creating missing banner files using server proxy...');
        
        for (const file of neededFiles) {
            try {
                console.log(`📁 Processing: ${file.name}`);
                
                // Try to get the file through the storage proxy endpoint
                const proxyUrl = `http://localhost:5000/api/storage-proxy/BANNER/banner-slides/${file.name}`;
                const response = await fetch(proxyUrl);
                
                if (response.ok) {
                    console.log(`✅ File accessible via proxy: ${file.name}`);
                    const buffer = await response.buffer();
                    
                    // Upload to the correct Object Storage location
                    const result = await client.uploadFromBytes(
                        `banner-slides/${file.name}`,
                        buffer,
                        { 'content-type': file.type },
                        'BANNER'
                    );
                    
                    if (result.ok) {
                        console.log(`✅ Successfully created: ${file.name}`);
                    } else {
                        console.log(`❌ Failed to upload: ${file.name}`);
                    }
                } else {
                    console.log(`⚠️ File not accessible via proxy: ${file.name} (${response.status})`);
                }
                
            } catch (error) {
                console.log(`❌ Error processing ${file.name}:`, error.message);
            }
        }
        
        console.log('\n🎉 Banner file creation process completed!');
        
        // Test direct access to one of the files
        console.log('\n🔍 Testing direct Object Storage access...');
        try {
            const testFile = await client.downloadAsBytes('banner-slides/bannerImage-1747752361661-294313402.jpg', 'BANNER');
            if (testFile && testFile.length > 0) {
                console.log('✅ Direct Object Storage access working!');
            } else {
                console.log('❌ Direct Object Storage access still not working');
            }
        } catch (testError) {
            console.log('❌ Error testing direct access:', testError.message);
        }
        
    } catch (error) {
        console.error('❌ Error in banner file creation process:', error);
    }
}

createMissingBannerFiles();