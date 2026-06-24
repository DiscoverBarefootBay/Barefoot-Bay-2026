import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

// Mapping of clubs to their correct Eastern Time hours
const clubTimes = {
  'AA Meeting': { start: '19:00', end: '20:00', url: 'aa-meeting' },
  'Aqua Zumba': { start: '14:00', end: '15:00', url: 'aquazumba' },
  'Aquatic Exercise': { start: '10:00', end: '11:00', url: 'aquatic-exercise' },
  'Art Group': { start: '13:00', end: '16:00', url: 'art-group' },
  'Barefoot Angels': { start: '17:30', end: '20:00', url: 'barefoot-angels' },
  'Boat and Fishing Club': { start: '19:30', end: '20:30', url: 'boat-and-fishing-club' },
  // Add more as needed from the social pages
};

async function fixSocialClubTimes() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    let totalUpdated = 0;

    for (const [clubName, times] of Object.entries(clubTimes)) {
      console.log(`\nFixing: ${clubName}`);
      console.log(`  Target time: ${times.start} - ${times.end} ET`);

      // Update events to show correct Eastern Time
      // Use double AT TIME ZONE conversion: UTC → Eastern (get date) → add time → back to UTC
      const result = await client.query(`
        UPDATE events
        SET 
          start_date = (
            ((((start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::date + $2::time) 
              AT TIME ZONE 'America/New_York') 
            AT TIME ZONE 'UTC'
          ),
          end_date = (
            ((((end_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::date + $3::time) 
              AT TIME ZONE 'America/New_York') 
            AT TIME ZONE 'UTC'
          ),
          contact_info = COALESCE(contact_info, '{}'::jsonb) || jsonb_build_object('website', $4::text),
          updated_at = NOW()
        WHERE title ILIKE $1
        RETURNING id, title, start_date
      `, [
        `%${clubName}%`,
        times.start,
        times.end,
        `https://barefootbay.com/more/social/${times.url}`
      ]);

      console.log(`  ✓ Updated ${result.rowCount} events`);
      totalUpdated += result.rowCount;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total events updated: ${totalUpdated}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the fix
fixSocialClubTimes()
  .then(() => {
    console.log('Fix complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fix failed:', error);
    process.exit(1);
  });
