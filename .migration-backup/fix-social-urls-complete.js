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

async function fixSocialUrlsComplete() {
  console.log('================================================================================');
  console.log('COMPLETE FIX FOR ALL SOCIAL EVENT URLS');
  console.log('================================================================================\n');

  try {
    // Step 1: Get all social club pages with correct URLs
    console.log('Step 1: Building club URL map...\n');
    
    const clubsResult = await sql`
      SELECT DISTINCT
        slug,
        title,
        SUBSTRING(slug FROM 8) as page_slug,
        'https://barefootbay.com/community/social/' || SUBSTRING(slug FROM 8) as correct_url
      FROM page_contents
      WHERE slug LIKE 'social-%'
      ORDER BY title
    `;

    console.log(`Found ${clubsResult.length} social club pages\n`);

    // Build a map of normalized titles to URLs
    const clubMap = new Map();
    clubsResult.forEach(club => {
      const normalized = normalizeTitle(club.title);
      clubMap.set(normalized, club.correct_url);
    });

    // Step 2: Get all social events
    console.log('================================================================================');
    console.log('Step 2: Loading all social events...\n');

    const allEvents = await sql`
      SELECT id, title, is_recurring, parent_event_id, website_url
      FROM events
      WHERE category = 'social'
      ORDER BY is_recurring DESC, parent_event_id NULLS FIRST, title
    `;

    console.log(`Total events: ${allEvents.length}\n`);

    // Step 3: Get manual overrides
    const overridesResult = await sql`
      SELECT event_id, slug
      FROM event_slug_overrides
    `;

    const overrideMap = new Map();
    overridesResult.forEach(o => {
      // Build correct URL from slug
      const pageSlug = o.slug.startsWith('social-') ? o.slug.substring(7) : o.slug;
      overrideMap.set(o.event_id, `https://barefootbay.com/community/social/${pageSlug}`);
    });

    console.log(`Found ${overrideMap.size} manual overrides\n`);

    // Step 4: Build parent URL map and update parents
    console.log('================================================================================');
    console.log('Step 3: Updating parent events and building parent map...\n');

    const parentUrlMap = new Map();
    let parentUpdateCount = 0;

    for (const event of allEvents) {
      // Skip child events for now
      if (event.parent_event_id) continue;

      let correctUrl = null;

      // Check manual override first
      if (overrideMap.has(event.id)) {
        correctUrl = overrideMap.get(event.id);
      } else {
        // Try normalized matching
        const normalized = normalizeTitle(event.title);
        correctUrl = clubMap.get(normalized);
      }

      if (correctUrl) {
        // Store in parent map
        parentUrlMap.set(event.id, correctUrl);

        // Update if different from current URL
        if (event.website_url !== correctUrl) {
          await sql`
            UPDATE events
            SET website_url = ${correctUrl}
            WHERE id = ${event.id}
          `;
          parentUpdateCount++;

          if (parentUpdateCount % 50 === 0) {
            console.log(`  Updated ${parentUpdateCount} parent events...`);
          }
        }
      }
    }

    console.log(`✓ Updated ${parentUpdateCount} parent events\n`);

    // Step 5: Update all child events to match their parent
    console.log('================================================================================');
    console.log('Step 4: Updating child events to match parents...\n');

    let childUpdateCount = 0;

    for (const event of allEvents) {
      // Only process child events
      if (!event.parent_event_id) continue;

      const parentUrl = parentUrlMap.get(event.parent_event_id);
      
      if (parentUrl && event.website_url !== parentUrl) {
        await sql`
          UPDATE events
          SET website_url = ${parentUrl}
          WHERE id = ${event.id}
        `;
        childUpdateCount++;

        if (childUpdateCount % 100 === 0) {
          console.log(`  Updated ${childUpdateCount} child events...`);
        }
      }
    }

    console.log(`✓ Updated ${childUpdateCount} child events\n`);

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

    if (finalCheck[0].wrong_path > 0) {
      console.log('⚠️  Still have events with wrong path. Checking sample...\n');
      
      const wrongExamples = await sql`
        SELECT id, title, website_url, is_recurring, parent_event_id
        FROM events
        WHERE category = 'social'
          AND website_url LIKE '%/more/social/%'
        LIMIT 10
      `;
      
      wrongExamples.forEach(e => {
        console.log(`  ${e.title}`);
        console.log(`    URL: ${e.website_url}`);
        console.log(`    Parent ID: ${e.parent_event_id || 'none'}\n`);
      });
    }

    // Show remaining unmatched
    if (finalCheck[0].without_urls > 0) {
      const unmatched = await sql`
        SELECT DISTINCT title
        FROM events
        WHERE category = 'social'
          AND (website_url IS NULL OR website_url = '')
        ORDER BY title
      `;

      console.log('Unmatched events (no club page):');
      unmatched.forEach((e, idx) => {
        console.log(`  ${idx + 1}. ${e.title}`);
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

fixSocialUrlsComplete();
