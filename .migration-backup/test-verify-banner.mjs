/**
 * Test script to verify banner slide paths
 */

import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Create mock data for testing banner slide verification
 */
async function createMockBannerSlideData() {
  try {
    // Check if we need to create test data
    const result = await pool.query("SELECT id FROM page_contents WHERE slug = 'banner-slides'");
    
    if (result.rows.length > 0) {
      console.log('Banner slides data already exists');
      return { id: result.rows[0].id };
    }
    
    // Create a test banner slide entry with paths to our test images
    const mockBannerSlides = [
      {
        title: 'Test Banner 1',
        src: '/banner-slides/bannerImage-1743595152309-999488918.png',
        alt: 'Test Banner 1',
        buttonText: 'Learn More',
        buttonUrl: '/test',
        position: 'center'
      },
      {
        title: 'Test Banner 2',
        src: '/uploads/banner-slides/bannerImage-1743595152309-999488918.png', 
        alt: 'Test Banner 2',
        buttonText: 'Sign Up',
        buttonUrl: '/signup',
        position: 'bottom'
      }
    ];
    
    // Insert test banner slides data
    const insertResult = await pool.query(
      "INSERT INTO page_contents (slug, content, category, \"order\") VALUES ('banner-slides', $1, 'system', 0) RETURNING id",
      [JSON.stringify(mockBannerSlides)]
    );
    
    console.log('Created mock banner slides data with ID:', insertResult.rows[0].id);
    return { id: insertResult.rows[0].id };
  } catch (error) {
    console.error('Error creating mock banner slide data:', error);
    return { error };
  }
}

/**
 * Verify banner slide paths in database and ensure they match existing files
 */
async function verifyBannerSlidePaths() {
  try {
    console.log('Verifying banner slide paths in database...');
    
    // Get banner slides content
    const result = await pool.query(
      "SELECT id, content FROM page_contents WHERE slug = 'banner-slides'"
    );
    
    if (result.rows.length === 0) {
      console.log('No banner slides found in database');
      return { updated: false };
    }
    
    const pageContent = result.rows[0];
    let slides;
    
    try {
      slides = JSON.parse(pageContent.content);
    } catch (error) {
      console.error('Error parsing banner slides JSON:', error);
      return { updated: false, error };
    }
    
    if (!Array.isArray(slides) || slides.length === 0) {
      console.log('No banner slides found or content is not an array');
      return { updated: false };
    }
    
    console.log(`Found ${slides.length} banner slides to verify`);
    let updatedSlides = false;
    
    // Process each slide and ensure correct path formats
    const newSlides = slides.map(slide => {
      // Skip if no source
      if (!slide.src) return slide;
      
      const newSlide = { ...slide };
      let fileExists = false;
      
      // Handle /banner-slides/ paths
      if (newSlide.src.startsWith('/banner-slides/')) {
        const filename = newSlide.src.replace('/banner-slides/', '');
        const fullPath = path.join('banner-slides', filename);
        
        if (fs.existsSync(fullPath)) {
          console.log(`File exists at path: ${fullPath}`);
          fileExists = true;
        } else {
          // Try uploads path
          const uploadsPath = path.join('uploads/banner-slides', filename);
          if (fs.existsSync(uploadsPath)) {
            // File exists in uploads but not in root, copy it
            try {
              // Ensure directory exists
              if (!fs.existsSync('banner-slides')) {
                fs.mkdirSync('banner-slides', { recursive: true });
              }
              fs.copyFileSync(uploadsPath, fullPath);
              console.log(`Copied file from uploads to banner-slides: ${filename}`);
              fileExists = true;
              updatedSlides = true;
            } catch (copyError) {
              console.error(`Error copying file ${filename}:`, copyError);
            }
          } else {
            console.log(`Banner slide file not found: ${filename}`);
          }
        }
      }
      
      // Handle /uploads/banner-slides/ paths
      else if (newSlide.src.startsWith('/uploads/banner-slides/')) {
        const filename = newSlide.src.replace('/uploads/banner-slides/', '');
        const fullPath = path.join('uploads/banner-slides', filename);
        
        if (fs.existsSync(fullPath)) {
          console.log(`File exists at path: ${fullPath}`);
          fileExists = true;
        } else {
          // Try non-uploads path
          const rootPath = path.join('banner-slides', filename);
          if (fs.existsSync(rootPath)) {
            // File exists in root but not in uploads, copy it
            try {
              // Ensure directory exists
              if (!fs.existsSync('uploads/banner-slides')) {
                fs.mkdirSync('uploads/banner-slides', { recursive: true });
              }
              fs.copyFileSync(rootPath, fullPath);
              console.log(`Copied file from banner-slides to uploads: ${filename}`);
              fileExists = true;
              updatedSlides = true;
            } catch (copyError) {
              console.error(`Error copying file ${filename}:`, copyError);
            }
          } else {
            console.log(`Banner slide file not found: ${filename}`);
          }
        }
      }
      
      // Return original slide if everything is OK
      return newSlide;
    });
    
    // Only update if changes were made
    if (updatedSlides) {
      await pool.query(
        'UPDATE page_contents SET content = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(newSlides), pageContent.id]
      );
      console.log('Updated banner slides paths in database');
    } else {
      console.log('No changes needed for banner slides paths');
    }
    
    return { updated: updatedSlides };
  } catch (error) {
    console.error('Error verifying banner slide paths:', error);
    return { updated: false, error };
  } finally {
    // Close DB pool
    await pool.end();
  }
}

// Run the tests
async function runTest() {
  try {
    // Create mock data
    await createMockBannerSlideData();
    
    // Run verification
    const result = await verifyBannerSlidePaths();
    
    console.log('Banner slide verification test complete!');
    console.log(result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();