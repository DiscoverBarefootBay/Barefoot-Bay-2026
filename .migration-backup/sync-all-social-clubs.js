import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

// Set to true to see what would be updated without making changes
const DRY_RUN = process.argv.includes('--dry-run');

async function syncAllSocialClubs() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}\n`);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Process updates with proper guards and validation
    const updateQuery = `
      WITH event_hours AS (
        SELECT 
          id,
          title,
          start_date,
          end_date,
          hours_of_operation,
          EXTRACT(DOW FROM (start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') as day_of_week,
          TO_CHAR((start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'HH24:MI') as current_start,
          TO_CHAR((end_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'HH24:MI') as current_end
        FROM events
        WHERE category = 'social' 
          AND hours_of_operation IS NOT NULL
          AND hours_of_operation::text != '{}'
          AND hours_of_operation::text != 'null'
      ),
      target_times AS (
        SELECT 
          id,
          title,
          start_date,
          end_date,
          day_of_week,
          current_start,
          current_end,
          CASE day_of_week
            WHEN 0 THEN hours_of_operation::jsonb->'Sunday'
            WHEN 1 THEN hours_of_operation::jsonb->'Monday'
            WHEN 2 THEN hours_of_operation::jsonb->'Tuesday'
            WHEN 3 THEN hours_of_operation::jsonb->'Wednesday'
            WHEN 4 THEN hours_of_operation::jsonb->'Thursday'
            WHEN 5 THEN hours_of_operation::jsonb->'Friday'
            WHEN 6 THEN hours_of_operation::jsonb->'Saturday'
          END as day_hours
        FROM event_hours
      ),
      events_to_update AS (
        SELECT 
          id,
          title,
          (day_hours->>'openTime')::text as target_start,
          (day_hours->>'closeTime')::text as target_end,
          current_start,
          current_end
        FROM target_times
        WHERE (day_hours->>'isOpen')::boolean = true
          AND day_hours->>'openTime' IS NOT NULL
          AND day_hours->>'closeTime' IS NOT NULL
          AND day_hours->>'openTime' != ''
          AND day_hours->>'closeTime' != ''
          AND (
            current_start != (day_hours->>'openTime')::text 
            OR current_end != (day_hours->>'closeTime')::text
          )
      )
      SELECT 
        title,
        target_start,
        target_end,
        COUNT(*) as event_count
      FROM events_to_update
      GROUP BY title, target_start, target_end
      ORDER BY event_count DESC;
    `;

    const summaryResult = await client.query(updateQuery);
    
    console.log(`${'='.repeat(70)}`);
    console.log('EVENTS TO UPDATE:');
    console.log(`${'='.repeat(70)}`);
    
    let totalEvents = 0;
    for (const row of summaryResult.rows) {
      console.log(`${row.event_count.toString().padStart(4)} events | ${row.target_start}-${row.target_end} | ${row.title}`);
      totalEvents += parseInt(row.event_count);
    }

    console.log(`${'='.repeat(70)}`);
    console.log(`Total events to update: ${totalEvents}`);
    console.log(`${'='.repeat(70)}\n`);

    if (!DRY_RUN && totalEvents > 0) {
      console.log('Applying updates...\n');
      
      // Perform the actual update with all safeguards
      const updateResult = await client.query(`
        WITH event_hours AS (
          SELECT 
            id,
            start_date,
            end_date,
            hours_of_operation,
            EXTRACT(DOW FROM (start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') as day_of_week,
            TO_CHAR((start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'HH24:MI') as current_start,
            TO_CHAR((end_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'HH24:MI') as current_end
          FROM events
          WHERE category = 'social' 
            AND hours_of_operation IS NOT NULL
            AND hours_of_operation::text != '{}'
            AND hours_of_operation::text != 'null'
        ),
        target_times AS (
          SELECT 
            id,
            start_date,
            end_date,
            current_start,
            current_end,
            CASE day_of_week
              WHEN 0 THEN hours_of_operation::jsonb->'Sunday'
              WHEN 1 THEN hours_of_operation::jsonb->'Monday'
              WHEN 2 THEN hours_of_operation::jsonb->'Tuesday'
              WHEN 3 THEN hours_of_operation::jsonb->'Wednesday'
              WHEN 4 THEN hours_of_operation::jsonb->'Thursday'
              WHEN 5 THEN hours_of_operation::jsonb->'Friday'
              WHEN 6 THEN hours_of_operation::jsonb->'Saturday'
            END as day_hours
          FROM event_hours
        ),
        events_to_update AS (
          SELECT 
            id,
            start_date,
            end_date,
            (day_hours->>'openTime')::text as target_start,
            (day_hours->>'closeTime')::text as target_end,
            current_start,
            current_end
          FROM target_times
          WHERE (day_hours->>'isOpen')::boolean = true
            AND day_hours->>'openTime' IS NOT NULL
            AND day_hours->>'closeTime' IS NOT NULL
            AND day_hours->>'openTime' != ''
            AND day_hours->>'closeTime' != ''
            AND (
              current_start != (day_hours->>'openTime')::text 
              OR current_end != (day_hours->>'closeTime')::text
            )
        )
        UPDATE events
        SET 
          start_date = (
            ((((events.start_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::date 
              + events_to_update.target_start::time) 
              AT TIME ZONE 'America/New_York') 
            AT TIME ZONE 'UTC'
          ),
          end_date = (
            ((((events.end_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::date 
              + events_to_update.target_end::time) 
              AT TIME ZONE 'America/New_York') 
            AT TIME ZONE 'UTC'
          ),
          updated_at = NOW()
        FROM events_to_update
        WHERE events.id = events_to_update.id
      `);

      console.log(`✓ Updated ${updateResult.rowCount} events\n`);
    } else if (DRY_RUN) {
      console.log('✓ Dry run complete. Run without --dry-run to apply changes.\n');
    } else {
      console.log('✓ No events need updating. All times are already correct.\n');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the sync
syncAllSocialClubs()
  .then(() => {
    console.log('Sync complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
