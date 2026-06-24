/**
 * Create a test banner slides record in the database
 */

import pkg from 'pg';
const { Pool } = pkg;

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createTestBannerSlides() {
  try {
    // Delete any existing banner slides data
    await pool.query("DELETE FROM page_contents WHERE slug = 'test-banner-slides'");
    
    // Create new test banner slides
    const mockBannerSlides = [
      {
        title: 'Test Banner 1',
        src: '/banner-slides/bannerImage-1743595152309-999488918.png',
        alt: 'Test Banner 1',
        buttonText: 'Learn More',
        buttonUrl: '/test',
        position: 'center'
      }
    ];
    
    // Insert test banner slides data
    const insertResult = await pool.query(
      "INSERT INTO page_contents (slug, content, category, \"order\") VALUES ('test-banner-slides', $1, 'system', 0) RETURNING id",
      [JSON.stringify(mockBannerSlides)]
    );
    
    console.log('Created test banner slides data with ID:', insertResult.rows[0].id);
  } catch (error) {
    console.error('Error creating test banner slide data:', error);
  } finally {
    await pool.end();
  }
}

createTestBannerSlides();