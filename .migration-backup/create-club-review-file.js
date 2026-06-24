import postgres from 'postgres';
import fs from 'fs';

const sql = postgres(process.env.DATABASE_URL);

async function createReviewFile() {
  try {
    // Get all clubs
    const clubs = await sql`
      SELECT DISTINCT slug, title
      FROM page_contents
      WHERE slug LIKE 'social-%'
      ORDER BY slug
    `;

    // Get all parent events
    const events = await sql`
      SELECT id, title, website_url
      FROM events
      WHERE category = 'social'
        AND is_recurring = true
        AND parent_event_id IS NULL
      ORDER BY title
    `;

    // Get clubs without events
    const eventSlugs = new Set(
      events
        .filter(e => e.website_url)
        .map(e => e.website_url.replace('https://barefootbay.com/more/social/', ''))
    );

    const missingClubs = clubs.filter(c => !eventSlugs.has(c.slug));

    // Create review data
    const reviewData = [];

    for (const club of missingClubs) {
      const normalize = (text) => text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const clubNorm = normalize(club.title);
      const clubWords = new Set(clubNorm.split(' ').filter(w => w.length > 2));

      // Find candidate events
      const candidates = [];
      
      for (const event of events) {
        const eventNorm = normalize(event.title);
        const eventWords = new Set(eventNorm.split(' ').filter(w => w.length > 2));
        
        // Calculate word overlap
        const commonWords = [...clubWords].filter(w => eventWords.has(w));
        const score = commonWords.length;

        if (score > 0 || clubNorm.includes(eventNorm) || eventNorm.includes(clubNorm)) {
          candidates.push({
            id: event.id,
            title: event.title,
            current_url: event.website_url || '',
            score: score,
            common_words: commonWords.join(', ')
          });
        }
      }

      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);

      reviewData.push({
        club_slug: club.slug,
        club_title: club.title,
        candidates: candidates.slice(0, 5) // Top 5 candidates
      });
    }

    // Write to JSON for processing
    fs.writeFileSync('club-review-data.json', JSON.stringify(reviewData, null, 2));

    // Write human-readable format
    let output = '================================================================================\n';
    output += 'SOCIAL CLUB TO EVENT MAPPING REVIEW\n';
    output += '================================================================================\n\n';
    output += `Total unmapped clubs: ${reviewData.length}\n\n`;

    reviewData.forEach((item, idx) => {
      output += `\n${idx + 1}. CLUB: "${item.club_title}"\n`;
      output += `   Slug: ${item.club_slug}\n\n`;
      
      if (item.candidates.length === 0) {
        output += '   ❌ NO CANDIDATE EVENTS FOUND - Likely informational page only\n';
      } else {
        output += '   Candidate Events:\n';
        item.candidates.forEach((cand, i) => {
          output += `   ${i + 1}) Event ID ${cand.id}: "${cand.title}"\n`;
          output += `      Score: ${cand.score} | Common: ${cand.common_words || '(contains)'}\n`;
          output += `      Current URL: ${cand.current_url || '(none)'}\n`;
        });
      }
      output += '\n' + '-'.repeat(80) + '\n';
    });

    fs.writeFileSync('club-review.txt', output);

    console.log('✓ Review files created:');
    console.log('  - club-review-data.json (machine readable)');
    console.log('  - club-review.txt (human readable)\n');

    console.log(`Found ${reviewData.length} clubs to review\n`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

createReviewFile();
