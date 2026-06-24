import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

function normalizeTitle(title) {
  let normalized = title
    .replace(/[^\w\s&-]/g, '')           // Keep word chars, spaces, ampersands, hyphens
    .replace(/&/g, 'and')                 // Normalize ampersands
    .replace(/\s*-\s*/g, ' ')             // Normalize hyphens to spaces
    .replace(/\s+/g, ' ')                 // Collapse spaces
    .trim()
    .toLowerCase();
  
  // Remove common suffixes after dash or in parentheses
  normalized = normalized.replace(/\s+(club|meeting|group|society|association|committee)$/, '');
  normalized = normalized.replace(/\s+\([^)]+\)$/, '');           // Remove trailing (...)
  normalized = normalized.replace(/\s+mixed.*$/, '');             // Remove "mixed blind draw" etc
  normalized = normalized.replace(/\s+quarter.*$/, '');           // Remove "quarter auction" etc
  normalized = normalized.replace(/\s+tap only$/, '');            // Remove "tap only"
  normalized = normalized.replace(/\s+sunday.*$/, '');            // Remove day specifications
  normalized = normalized.replace(/\s+monday.*$/, '');
  normalized = normalized.replace(/\s+tuesday.*$/, '');
  normalized = normalized.replace(/\s+wednesday.*$/, '');
  normalized = normalized.replace(/\s+thursday.*$/, '');
  normalized = normalized.replace(/\s+friday.*$/, '');
  normalized = normalized.replace(/\s+saturday.*$/, '');
  
  // Normalize plural variations
  normalized = normalized.replace(/mens$/, 'men');
  normalized = normalized.replace(/ladies$/, 'lady');
  normalized = normalized.replace(/mens\b/, 'men');
  
  return normalized.trim();
}

async function updateParentEventUrls() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Updating website URLs for parent recurring events...\n');

    // Step 1: Get all unique social club pages (prefer specific slugs over 'social-page')
    const clubsResult = await client.query(`
      SELECT DISTINCT ON (title) 
        slug, 
        title,
        id
      FROM page_contents
      WHERE slug LIKE 'social-%'
        AND content ~ '<strong>Date and Time:</strong>'
      ORDER BY title, 
        CASE 
          WHEN slug = 'social-page' THEN 2
          ELSE 1
        END,
        id DESC
    `);

    console.log(`Found ${clubsResult.rows.length} social club pages\n`);

    // Step 2: Build normalized title map
    const clubMap = new Map();
    const duplicates = new Map();
    
    for (const club of clubsResult.rows) {
      const normalized = normalizeTitle(club.title);
      
      if (clubMap.has(normalized)) {
        if (!duplicates.has(normalized)) {
          duplicates.set(normalized, [clubMap.get(normalized)]);
        }
        duplicates.get(normalized).push(club);
      } else {
        clubMap.set(normalized, {
          slug: club.slug,
          title: club.title,
          url: `https://barefootbay.com/more/social/${club.slug}`
        });
      }
    }

    // Step 3: Get all parent recurring events with any overrides
    const parentsResult = await client.query(`
      SELECT 
        e.id, 
        e.title, 
        e.website_url,
        o.slug as override_slug
      FROM events e
      LEFT JOIN event_slug_overrides o ON e.id = o.event_id
      WHERE e.category = 'social'
        AND e.is_recurring = true
        AND e.parent_event_id IS NULL
      ORDER BY e.title
    `);

    console.log(`Found ${parentsResult.rows.length} parent recurring events\n`);

    // Step 4: Match events to clubs
    const updates = [];
    const matched = [];
    const unmatched = [];
    const alreadyCorrect = [];

    for (const event of parentsResult.rows) {
      let club = null;
      let matchType = null;
      
      // First check manual override
      if (event.override_slug) {
        const overrideClub = clubsResult.rows.find(c => c.slug === event.override_slug);
        if (overrideClub) {
          club = {
            slug: overrideClub.slug,
            title: overrideClub.title,
            url: `https://barefootbay.com/more/social/${overrideClub.slug}`
          };
          matchType = 'override';
        } else {
          // Slug doesn't exist in page_contents, but still create URL
          console.warn(`⚠️  Override slug "${event.override_slug}" not found in page_contents for event "${event.title}"`);
          club = {
            slug: event.override_slug,
            title: event.title,
            url: `https://barefootbay.com/more/social/${event.override_slug}`
          };
          matchType = 'override (page missing)';
        }
      }
      
      // If no override, try normalized matching
      if (!club) {
        const normalized = normalizeTitle(event.title);
        club = clubMap.get(normalized);
        matchType = 'normalized';
      }

      if (club) {
        if (event.website_url === club.url) {
          alreadyCorrect.push(event.title);
        } else {
          updates.push({
            id: event.id,
            title: event.title,
            url: club.url
          });
          matched.push({ event: event.title, club: club.title, url: club.url, type: matchType });
        }
      } else {
        unmatched.push(event.title);
      }
    }

    // Step 5: Show what will be updated
    const normalizedMatches = matched.filter(m => m.type === 'normalized').length;
    const overrideMatches = matched.filter(m => m.type === 'override').length;
    
    console.log('Matches to update:');
    console.log(`  (${normalizedMatches} auto-matched, ${overrideMatches} manual overrides)\n`);
    matched.slice(0, 15).forEach(m => {
      const prefix = m.type === 'override' ? '[OVERRIDE]' : '';
      console.log(`  ${prefix} "${m.event}" → ${m.url}`);
    });
    if (matched.length > 15) {
      console.log(`  ... and ${matched.length - 15} more`);
    }
    console.log();

    // Step 6: Perform batched update
    if (updates.length > 0) {
      const updateQuery = `
        UPDATE events
        SET website_url = c.url
        FROM (VALUES ${updates.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')}) 
        AS c(id, url)
        WHERE events.id = c.id::integer
      `;
      
      const params = updates.flatMap(u => [u.id, u.url]);
      const result = await client.query(updateQuery, params);
      
      console.log(`✓ Updated ${result.rowCount} parent events in batch\n`);
    }

    // Step 7: Summary
    console.log('='.repeat(80));
    console.log('Summary:');
    console.log(`  Social club pages: ${clubsResult.rows.length}`);
    console.log(`  Parent recurring events: ${parentsResult.rows.length}`);
    console.log(`  Matched & updated: ${updates.length}`);
    console.log(`  Already had correct URL: ${alreadyCorrect.length}`);
    console.log(`  Unmatched events: ${unmatched.length}`);
    console.log('='.repeat(80));

    if (unmatched.length > 0) {
      console.log('\nUnmatched parent events:');
      unmatched.slice(0, 20).forEach(title => {
        console.log(`  - ${title}`);
      });
      if (unmatched.length > 20) {
        console.log(`  ... and ${unmatched.length - 20} more`);
      }
    }

    if (duplicates.size > 0) {
      console.log('\n⚠️  Title collisions detected:');
      for (const [norm, clubs] of duplicates) {
        console.log(`  "${norm}": ${clubs.map(c => c.title).join(', ')}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

updateParentEventUrls()
  .then(() => {
    console.log('\n✓ Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Failed:', error);
    process.exit(1);
  });
