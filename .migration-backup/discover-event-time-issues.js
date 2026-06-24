import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function discoverEventTimeIssues() {
  console.log('================================================================================');
  console.log('DISCOVERING EVENT TIME ISSUES');
  console.log('================================================================================\n');

  try {
    // Step 1: Get all parent social events with their club page mappings
    console.log('Step 1: Finding parent social events with club page URLs...\n');
    
    const parentEvents = await sql`
      SELECT DISTINCT ON (e.title)
        e.id,
        e.title,
        e.start_date,
        e.end_date,
        e.website_url,
        e.is_recurring,
        TO_CHAR(e.start_date AT TIME ZONE 'America/New_York', 'Day HH24:MI') as event_time_display,
        TO_CHAR(e.start_date AT TIME ZONE 'UTC', 'HH24:MI') as event_time_utc,
        EXTRACT(HOUR FROM e.start_date) as start_hour_utc,
        EXTRACT(HOUR FROM e.end_date) as end_hour_utc
      FROM events e
      WHERE e.category = 'social'
        AND e.parent_event_id IS NULL
        AND e.website_url IS NOT NULL
        AND e.website_url != ''
      ORDER BY e.title, e.id
    `;

    console.log(`Found ${parentEvents.length} unique parent social events\n`);

    // Step 2: Get club pages with their meeting time content
    console.log('Step 2: Extracting club page meeting times...\n');
    
    const clubPages = await sql`
      SELECT 
        slug,
        title,
        content,
        'https://barefootbay.com/community/social/' || SUBSTRING(slug FROM 8) as club_url
      FROM page_contents
      WHERE slug LIKE 'social-%'
      ORDER BY title
    `;

    // Build a map of URLs to club data
    const clubMap = new Map();
    clubPages.forEach(club => {
      clubMap.set(club.club_url, {
        slug: club.slug,
        title: club.title,
        content: club.content
      });
    });

    console.log(`Found ${clubPages.length} club pages\n`);

    // Step 3: Match events to clubs and extract meeting times
    console.log('================================================================================');
    console.log('Step 3: Matching events to clubs and extracting times...\n');

    const results = [];

    for (const event of parentEvents) {
      const club = clubMap.get(event.website_url);
      
      if (!club) {
        results.push({
          event_id: event.id,
          event_title: event.title,
          event_time: event.event_time_display,
          club_url: event.website_url,
          club_title: 'NOT FOUND',
          meeting_time: 'N/A',
          status: 'CLUB_NOT_FOUND'
        });
        continue;
      }

      // Extract meeting time from HTML content
      const timeMatch = club.content.match(/Date and Time:<\/strong>\s*([^<]+)/i);
      const meetingTime = timeMatch ? timeMatch[1].trim() : 'NOT FOUND IN CONTENT';

      results.push({
        event_id: event.id,
        event_title: event.title,
        event_time: event.event_time_display?.trim(),
        event_start_utc: event.start_hour_utc,
        event_end_utc: event.end_hour_utc,
        club_url: event.website_url,
        club_title: club.title,
        meeting_time: meetingTime,
        status: timeMatch ? 'MATCHED' : 'NO_TIME_IN_CLUB'
      });
    }

    // Step 4: Display results
    console.log('================================================================================');
    console.log('RESULTS:');
    console.log('================================================================================\n');

    console.log(`Total events analyzed: ${results.length}\n`);

    const matched = results.filter(r => r.status === 'MATCHED');
    const noTimeInClub = results.filter(r => r.status === 'NO_TIME_IN_CLUB');
    const clubNotFound = results.filter(r => r.status === 'CLUB_NOT_FOUND');

    console.log(`✓ Matched (club page has time): ${matched.length}`);
    console.log(`⚠ Club page found but no time: ${noTimeInClub.length}`);
    console.log(`✗ Club page not found: ${clubNotFound.length}\n`);

    // Show first 20 matched events with their times
    console.log('Sample of matched events (first 20):');
    console.log('================================================================================\n');
    
    matched.slice(0, 20).forEach(r => {
      console.log(`Event: ${r.event_title}`);
      console.log(`  Current event time: ${r.event_time} (UTC hour: ${r.event_start_utc}-${r.event_end_utc})`);
      console.log(`  Club page says: ${r.meeting_time}`);
      console.log(`  Club: ${r.club_title}`);
      console.log('');
    });

    // Export full results to file
    console.log('================================================================================');
    console.log('Exporting full results to event-time-analysis.json...\n');
    
    const fs = await import('fs');
    fs.writeFileSync('event-time-analysis.json', JSON.stringify(results, null, 2));
    
    console.log('✓ Complete! Results saved to event-time-analysis.json');
    console.log(`\nYou can review the full list of ${results.length} events in the JSON file.`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

discoverEventTimeIssues();
