import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

// Normalize a title for matching by removing emojis, punctuation, extra spaces
function normalizeTitle(title) {
  return title
    .replace(/[^\w\s]/g, '') // Remove emojis and punctuation
    .replace(/\s+/g, ' ')     // Collapse multiple spaces
    .trim()
    .toLowerCase();
}

async function addSocialClubUrls() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Adding website URLs to social club events...\n');

    // Step 1: Get all social club pages with slugs
    const clubsResult = await client.query(`
      SELECT DISTINCT ON (title) slug, title
      FROM page_contents
      WHERE slug LIKE 'social-%'
        AND content ~ '<strong>Date and Time:</strong>'
      ORDER BY title, id DESC
    `);

    console.log(`Found ${clubsResult.rows.length} social clubs with meeting times\n`);

    // Build a map of normalized titles to club data, detect collisions
    const clubMap = new Map();
    const collisions = [];
    
    for (const club of clubsResult.rows) {
      const normalized = normalizeTitle(club.title);
      
      if (clubMap.has(normalized)) {
        collisions.push({
          normalized,
          existing: clubMap.get(normalized).title,
          duplicate: club.title
        });
      } else {
        clubMap.set(normalized, {
          slug: club.slug,
          title: club.title,
          url: `https://barefootbay.com/more/social/${club.slug}`
        });
      }
    }
    
    if (collisions.length > 0) {
      console.log('⚠️  WARNING: Found title collisions in club pages:');
      collisions.forEach(c => {
        console.log(`  "${c.existing}" vs "${c.duplicate}" → "${c.normalized}"`);
      });
      console.log();
    }

    // Step 2: Get all social events
    const eventsResult = await client.query(`
      SELECT id, title, website_url
      FROM events
      WHERE category = 'social'
      ORDER BY title
    `);

    console.log(`Found ${eventsResult.rows.length} social events\n`);

    let matched = 0;
    let unmatched = 0;
    let skipped = 0;
    const unmatchedEvents = [];
    const matchesToUpdate = [];

    // Step 3: Analyze matches first (don't update yet)
    for (const event of eventsResult.rows) {
      const normalizedEventTitle = normalizeTitle(event.title);
      const club = clubMap.get(normalizedEventTitle);

      if (club) {
        matched++;
        
        // Only add to update list if URL is different or null
        if (event.website_url !== club.url) {
          matchesToUpdate.push({
            eventId: event.id,
            eventTitle: event.title,
            clubTitle: club.title,
            url: club.url,
            currentUrl: event.website_url
          });
        } else {
          skipped++;
        }
      } else {
        unmatched++;
        unmatchedEvents.push(event.title);
      }
    }
    
    // Show what will be updated
    console.log('Matches to update:');
    matchesToUpdate.slice(0, 10).forEach(m => {
      console.log(`  "${m.eventTitle}" → ${m.url}`);
    });
    if (matchesToUpdate.length > 10) {
      console.log(`  ... and ${matchesToUpdate.length - 10} more`);
    }
    console.log();
    
    // Step 4: Perform updates
    for (const match of matchesToUpdate) {
      await client.query(`
        UPDATE events
        SET website_url = $1
        WHERE id = $2
      `, [match.url, match.eventId]);
    }
    
    const updated = matchesToUpdate.length;

    console.log('='.repeat(80));
    console.log(`Summary:`);
    console.log(`  - Social club pages: ${clubsResult.rows.length}`);
    console.log(`  - Page title collisions: ${collisions.length}`);
    console.log(`  - Total social events: ${eventsResult.rows.length}`);
    console.log(`  - Matched events: ${matched}`);
    console.log(`  - Already had correct URL: ${skipped}`);
    console.log(`  - Unmatched events: ${unmatched}`);
    console.log(`  - Events updated: ${updated}`);
    console.log('='.repeat(80));

    if (unmatched > 0) {
      console.log(`\nUnmatched events (sample of first 20):`);
      unmatchedEvents.slice(0, 20).forEach(title => {
        console.log(`  - ${title}`);
      });
      if (unmatched > 20) {
        console.log(`  ... and ${unmatched - 20} more`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

addSocialClubUrls()
  .then(() => {
    console.log('\n✓ Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Failed:', error);
    process.exit(1);
  });
