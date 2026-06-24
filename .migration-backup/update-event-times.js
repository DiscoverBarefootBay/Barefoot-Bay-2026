import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres(process.env.DATABASE_URL);

async function updateEventTimes() {
  console.log('================================================================================');
  console.log('UPDATING EVENT TIMES WITH PROPER TIMEZONE HANDLING');
  console.log('================================================================================\n');

  try {
    // Load the auto-update plan
    const updatePlan = JSON.parse(readFileSync('event-time-auto-update.json', 'utf-8'));
    
    console.log(`Loaded ${updatePlan.length} events ready for auto-update\n`);
    console.log('This will update parent events AND propagate to all child events.\n');

    // Update each parent event
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const plan of updatePlan) {
      try {
        // Build the timestamp in ET timezone using Postgres AT TIME ZONE
        const startTimestamp = `${plan.proposed_date} ${plan.proposed_start_time}`;
        const endTimestamp = `${plan.proposed_date} ${plan.proposed_end_time}`;

        // Convert ET to UTC for storage
        // Step 1: Parse string as timestamp (naive, no timezone)
        // Step 2: AT TIME ZONE 'America/New_York' treats it as ET, outputs timestamptz
        // Step 3: AT TIME ZONE 'UTC' converts to UTC and strips timezone info
        const result = await sql`
          UPDATE events
          SET 
            start_date = (${startTimestamp}::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC',
            end_date = (${endTimestamp}::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC'
          WHERE id = ${plan.event_id}
        `;

        if (result.count > 0) {
          successCount++;
          console.log(`✓ Updated: ${plan.event_title}`);
        } else {
          errorCount++;
          errors.push({ event_id: plan.event_id, title: plan.event_title, error: 'No rows updated' });
          console.log(`✗ Failed: ${plan.event_title} (no rows updated)`);
        }

      } catch (error) {
        errorCount++;
        errors.push({ event_id: plan.event_id, title: plan.event_title, error: error.message });
        console.error(`✗ Error updating ${plan.event_title}:`, error.message);
      }
    }

    console.log('\n================================================================================');
    console.log('UPDATE SUMMARY:');
    console.log('================================================================================');
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(e => {
        console.log(`  ${e.title}: ${e.error}`);
      });
    }

    // Now propagate to child events
    // For each parent event that was updated, we need to calculate the time offset
    // and apply it to all child events
    console.log('\n================================================================================');
    console.log('PROPAGATING TO CHILD EVENTS:');
    console.log('================================================================================\n');

    let totalChildrenUpdated = 0;
    
    for (const plan of updatePlan) {
      // Get the parent's new start/end times
      const parent = await sql`
        SELECT start_date, end_date
        FROM events
        WHERE id = ${plan.event_id}
      `;

      if (parent.length === 0) continue;

      const parentStartDate = parent[0].start_date;
      const parentEndDate = parent[0].end_date;

      // Update all children to match the parent's new time of day
      // We keep the same date but update the time portion
      const childrenResult = await sql`
        UPDATE events
        SET 
          start_date = event_date::timestamp + ${parentStartDate}::time,
          end_date = event_date::timestamp + ${parentEndDate}::time
        WHERE parent_event_id = ${plan.event_id}
      `;

      totalChildrenUpdated += childrenResult.count;
    }

    console.log(`✓ Updated ${totalChildrenUpdated} child events\n`);

    // Verification
    console.log('================================================================================');
    console.log('VERIFICATION - Sample corrected events:');
    console.log('================================================================================\n');

    const sampleIds = updatePlan.slice(0, 5).map(p => p.event_id);
    const verifyResults = await sql`
      SELECT 
        id,
        title,
        start_date,
        end_date,
        TO_CHAR(start_date AT TIME ZONE 'America/New_York', 'Day HH24:MI') as display_time
      FROM events
      WHERE id = ANY(${sampleIds})
    `;

    verifyResults.forEach(e => {
      console.log(`${e.title}`);
      console.log(`  Time: ${e.display_time?.trim()}`);
      console.log(`  UTC: ${e.start_date}`);
      console.log('');
    });

    console.log('✓ Complete!');

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

updateEventTimes();
