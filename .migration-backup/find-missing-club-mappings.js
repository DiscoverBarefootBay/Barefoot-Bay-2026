import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

// Simple string similarity function
function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  
  const editDistance = (s1, s2) => {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  };
  
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

// Normalize title for comparison
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findMissingClubMappings() {
  console.log('Finding missing club-to-event mappings...\n');

  try {
    // Get all club pages
    const clubs = await sql`
      SELECT DISTINCT slug, title
      FROM page_contents
      WHERE slug LIKE 'social-%'
      ORDER BY slug
    `;

    // Get all parent recurring events
    const events = await sql`
      SELECT id, title, website_url
      FROM events
      WHERE category = 'social'
        AND is_recurring = true
        AND parent_event_id IS NULL
      ORDER BY title
    `;

    // Get clubs that don't have events
    const eventSlugs = new Set(
      events
        .filter(e => e.website_url)
        .map(e => e.website_url.replace('https://barefootbay.com/more/social/', ''))
    );

    const missingClubs = clubs.filter(c => !eventSlugs.has(c.slug));

    console.log(`Found ${missingClubs.length} clubs without linked events:\n`);

    const suggestions = [];

    for (const club of missingClubs) {
      const clubTitle = normalize(club.title);
      
      // Find best matching event
      let bestMatch = null;
      let bestScore = 0;
      
      for (const event of events) {
        const eventTitle = normalize(event.title);
        
        // Skip if already has correct URL
        if (event.website_url === `https://barefootbay.com/more/social/${club.slug}`) {
          continue;
        }
        
        // Calculate similarity
        const score = similarity(clubTitle, eventTitle);
        
        // Also check if one contains the other
        const containsScore = clubTitle.includes(eventTitle) || eventTitle.includes(clubTitle) ? 0.7 : 0;
        
        const finalScore = Math.max(score, containsScore);
        
        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestMatch = event;
        }
      }
      
      if (bestMatch && bestScore > 0.4) {
        suggestions.push({
          club_slug: club.slug,
          club_title: club.title,
          event_id: bestMatch.id,
          event_title: bestMatch.title,
          current_url: bestMatch.website_url || '(none)',
          score: bestScore.toFixed(2)
        });
      } else {
        suggestions.push({
          club_slug: club.slug,
          club_title: club.title,
          event_id: null,
          event_title: 'NO MATCH FOUND',
          current_url: '',
          score: '0.00'
        });
      }
    }

    // Group by whether we found a match
    const matched = suggestions.filter(s => s.event_id !== null);
    const unmatched = suggestions.filter(s => s.event_id === null);

    console.log('================================================================================');
    console.log('SUGGESTED MAPPINGS (confidence > 40%):');
    console.log('================================================================================\n');
    
    matched.forEach((s, i) => {
      console.log(`${i + 1}. Club: "${s.club_title}" (${s.club_slug})`);
      console.log(`   Event: "${s.event_title}" (ID: ${s.event_id})`);
      console.log(`   Current URL: ${s.current_url}`);
      console.log(`   Confidence: ${(parseFloat(s.score) * 100).toFixed(0)}%\n`);
    });

    console.log('================================================================================');
    console.log('CLUBS WITH NO MATCHING EVENTS:');
    console.log('================================================================================\n');
    
    unmatched.forEach((s, i) => {
      console.log(`${i + 1}. "${s.club_title}" (${s.club_slug})`);
    });

    console.log('\n================================================================================');
    console.log('SUMMARY:');
    console.log('================================================================================');
    console.log(`Total clubs without events: ${missingClubs.length}`);
    console.log(`Suggested mappings found: ${matched.length}`);
    console.log(`Clubs with no matches: ${unmatched.length}`);
    console.log('================================================================================\n');

    // Output SQL for manual overrides
    if (matched.length > 0) {
      console.log('SQL TO CREATE MANUAL OVERRIDES:\n');
      console.log('INSERT INTO event_slug_overrides (event_id, slug) VALUES');
      const values = matched.map(s => `  (${s.event_id}, '${s.club_slug}')`);
      console.log(values.join(',\n'));
      console.log('ON CONFLICT (event_id) DO UPDATE SET slug = EXCLUDED.slug;\n');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

findMissingClubMappings();
