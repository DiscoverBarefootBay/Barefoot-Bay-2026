import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

// Normalize title for matching
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove emojis, punctuation
    .replace(/\b(club|meeting|group|thursday|friday|monday|tuesday|wednesday|saturday|sunday|weekly|daily|night|morning|afternoon|mixed|ladies|mens|womens|men|women|s)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fixAllSocialEventUrls() {
  console.log('================================================================================');
  console.log('FIXING ALL SOCIAL EVENT URLS');
  console.log('================================================================================\n');

  try {
    // Step 1: Get all social club pages with correct URLs
    console.log('Step 1: Extracting social club pages from database...\n');
    
    const clubsResult = await sql`
      SELECT DISTINCT
        slug,
        title,
        SUBSTRING(slug FROM 8) as page_slug,
        'https://barefootbay.com/community/social/' || SUBSTRING(slug FROM 8) as correct_url
      FROM page_contents
      WHERE slug LIKE 'social-%'
      ORDER BY slug
    `;

    console.log(`Found ${clubsResult.length} social club pages\n`);

    // Build a map of normalized titles to club info
    const clubMap = new Map();
    clubsResult.forEach(club => {
      const normalized = normalizeTitle(club.title);
      clubMap.set(normalized, club.correct_url);
    });

    console.log('================================================================================');
    console.log('Step 2: Getting manual overrides...\n');

    // Get manual overrides and build their URLs
    const overridesResult = await sql`
      SELECT eso.event_id, eso.slug, pc.slug as page_slug
      FROM event_slug_overrides eso
      LEFT JOIN page_contents pc ON pc.slug = eso.slug
    `;

    const overrideMap = new Map();
    overridesResult.forEach(o => {
      if (o.page_slug) {
        const pageSlug = o.page_slug.substring(7); // Remove 'social-' prefix
        overrideMap.set(o.event_id, `https://barefootbay.com/community/social/${pageSlug}`);
      }
    });

    console.log(`Found ${overrideMap.size} manual overrides\n`);

    console.log('================================================================================');
    console.log('Step 3: Batch updating all social events...\n');

    // Strategy: Update in SQL using CASE statements for efficiency
    // First, update all events based on normalized title matching
    let updateCount = 0;

    for (const [normalized, url] of clubMap.entries()) {
      const result = await sql`
        UPDATE events
        SET website_url = ${url}
        WHERE category = 'social'
          AND LOWER(REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(title, '[^a-zA-Z0-9\\s]', '', 'g'),
              '\\m(club|meeting|group|thursday|friday|monday|tuesday|wednesday|saturday|sunday|weekly|daily|night|morning|afternoon|mixed|ladies|mens|womens|men|women|s)\\M',
              '',
              'gi'
            ),
            '\\s+', ' ', 'g'
          )) = ${normalized}
      `;
      
      if (result.count > 0) {
        updateCount += result.count;
        console.log(`  Updated ${result.count} events for: ${normalized}`);
      }
    }

    console.log(`\n✓ Matched and updated ${updateCount} events via normalized matching\n`);

    // Update events with manual overrides
    console.log('Applying manual overrides...\n');
    let overrideCount = 0;
    
    for (const [eventId, url] of overrideMap.entries()) {
      await sql`
        UPDATE events
        SET website_url = ${url}
        WHERE id = ${eventId}
      `;
      overrideCount++;
    }

    console.log(`✓ Updated ${overrideCount} events via manual overrides\n`);

    // Final verification
    const finalCheck = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 END) as with_urls,
        COUNT(CASE WHEN website_url IS NULL OR website_url = '' THEN 1 END) as without_urls,
        COUNT(CASE WHEN website_url LIKE '%/more/social/%' THEN 1 END) as wrong_path,
        COUNT(CASE WHEN website_url LIKE '%/community/social/%' THEN 1 END) as correct_path
      FROM events
      WHERE category = 'social'
    `;

    console.log('================================================================================');
    console.log('FINAL VERIFICATION:');
    console.log('================================================================================');
    console.log(`Total social events: ${finalCheck[0].total}`);
    console.log(`With URLs: ${finalCheck[0].with_urls}`);
    console.log(`Without URLs: ${finalCheck[0].without_urls}`);
    console.log(`Wrong path (/more/social/): ${finalCheck[0].wrong_path}`);
    console.log(`Correct path (/community/social/): ${finalCheck[0].correct_path}`);
    console.log(`Coverage: ${((finalCheck[0].with_urls / finalCheck[0].total) * 100).toFixed(1)}%`);
    console.log('================================================================================\n');

    // Show unmatched events
    if (finalCheck[0].without_urls > 0) {
      const unmatchedEvents = await sql`
        SELECT id, title
        FROM events
        WHERE category = 'social'
          AND (website_url IS NULL OR website_url = '')
        ORDER BY title
      `;

      console.log('UNMATCHED EVENTS (No Club Page Found):');
      console.log('================================================================================\n');
      unmatchedEvents.forEach((e, idx) => {
        console.log(`${idx + 1}. ${e.title} (ID: ${e.id})`);
      });
      console.log('');
    }

    console.log('✓ Complete!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

fixAllSocialEventUrls();
