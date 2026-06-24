/**
 * Check what banner slide files are actually available in Object Storage
 */
import { Client } from '@replit/object-storage';

async function checkBannerStorage() {
    try {
        const client = new Client();
        
        console.log('🔍 Checking Object Storage contents...');
        
        // Check for banner-slides directory
        const bannerSlides = await client.list('banner-slides/');
        console.log('📁 Files in banner-slides/:', bannerSlides);
        
        // Check for BANNER directory (as seen in the 404 URLs)
        const bannerDir = await client.list('BANNER/');
        console.log('📁 Files in BANNER/:', bannerDir);
        
        // Check root level
        const rootFiles = await client.list('');
        console.log('📁 Files in root:', rootFiles.slice(0, 10)); // Show first 10
        
        // Check for any files with "banner" in the name
        const allFiles = await client.list('');
        const bannerFiles = allFiles.filter(file => 
            file.toLowerCase().includes('banner') || 
            file.includes('bannerImage')
        );
        console.log('🖼️ Banner-related files found:', bannerFiles);
        
    } catch (error) {
        console.error('❌ Error checking Object Storage:', error);
    }
}

checkBannerStorage();