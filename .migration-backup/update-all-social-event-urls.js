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

async function updateAllSocialEventUrls() {
  console.log('Updating website URLs for ALL social events...\n');

  try {
    // Get all social club pages
    const clubsResult = await sql`
      SELECT DISTINCT slug, title
      FROM page_contents
      WHERE slug LIKE 'social-%'
      ORDER BY slug
    `;

    console.log(`Found ${clubsResult.length} social club pages\n`);

    // Build a map of normalized titles to club info
    const clubMap = new Map();
    clubsResult.forEach(club => {
      const normalized = normalizeTitle(club.title);
      clubMap.set(normalized, {
        slug: club.slug,
        title: club.title,
        url: `https://barefootbay.com/more/social/${club.slug}`
      });
    });

    // Get ALL social events without URLs (recurring parents, children, and standalone)
    const eventsResult = await sql`
      SELECT id, title, is_recurring, parent_event_id
      FROM events
      WHERE category = 'social'
        AND (website_url IS NULL OR website_url = '')
      ORDER BY title
    `;

    console.log(`Found ${eventsResult.length} social events without URLs\n`);

    // Get manual overrides
    const overridesResult = await sql`
      SELECT event_id, slug
      FROM event_slug_overrides
    `;

    const overrides = new Map(overridesResult.map(o => [o.event_id, o.slug]));

    const matched = [];
    const unmatched = [];

    for (const event of eventsResult) {
      let club = null;
      let matchType = null;

      // First check if this event has a parent with a URL (for child events)
      if (event.parent_event_id) {
        const parentResult = await sql`
          SELECT website_url
          FROM events
          WHERE id = ${event.parent_event_id}
        `;
        
        if (parentResult.length > 0 && parentResult[0].website_url) {
          club = {
            url: parentResult[0].website_url
          };
          matchType = 'from_parent';
        }
      }

      // If no parent URL, check manual override
      if (!club && overrides.has(event.id)) {
        const overrideSlug = overrides.get(event.id);
        const overrideClub = clubsResult.find(c => c.slug === overrideSlug);
        
        if (overrideClub) {
          club = {
            slug: overrideClub.slug,
            title: overrideClub.title,
            url: `https://barefootbay.com/more/social/${overrideClub.slug}`
          };
          matchType = 'override';
        } else {
          // Slug doesn't exist but use it anyway
          club = {
            slug: overrideSlug,
            title: event.title,
            url: `https://barefootbay.com/more/social/${overrideSlug}`
          };
          matchType = 'override (page missing)';
        }
      }

      // If still no match, try normalized matching
      if (!club) {
        const normalized = normalizeTitle(event.title);
        club = clubMap.get(normalized);
        matchType = 'normalized';
      }

      if (club) {
        matched.push({
          id: event.id,
          title: event.title,
          url: club.url,
          matchType
        });
      } else {
        unmatched.push(event.title);
      }
    }

    console.log(`Matched: ${matched.length}, Unmatched: ${unmatched.length}\n`);

    // Update in batches
    if (matched.length > 0) {
      console.log('Updating events with URLs...');
      
      for (const match of matched) {
        await sql`
          UPDATE events
          SET website_url = ${match.url}
          WHERE id = ${match.id}
        `;
      }

      console.log(`✓ Updated ${matched.length} events\n`);
    }

    // Show unmatched events
    if (unmatched.length > 0) {
      console.log('================================================================================');
      console.log('UNMATCHED EVENTS (No Club Page Found):');
      console.log('================================================================================\n');
      
      const uniqueUnmatched = [...new Set(unmatched)].sort();
      uniqueUnmatched.forEach((title, idx) => {
        console.log(`${idx + 1}. ${title}`);
      });
      console.log(`\nTotal: ${uniqueUnmatched.length} unique unmatched event types\n`);
    }

    // Final verification
    const finalCheck = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 END) as with_urls,
        COUNT(CASE WHEN website_url IS NULL OR website_url = '' THEN 1 END) as without_urls
      FROM events
      WHERE category = 'social'
    `;

    console.log('================================================================================');
    console.log('FINAL STATISTICS:');
    console.log('================================================================================');
    console.log(`Total social events: ${finalCheck[0].total}`);
    console.log(`With URLs: ${finalCheck[0].with_urls}`);
    console.log(`Without URLs: ${finalCheck[0].without_urls}`);
    console.log(`Coverage: ${((finalCheck[0].with_urls / finalCheck[0].total) * 100).toFixed(1)}%`);
    console.log('================================================================================\n');

    console.log('✓ Complete!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

updateAllSocialEventUrls();
