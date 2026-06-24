import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres(process.env.DATABASE_URL);

// Parse meeting time string to extract hours and minutes
function parseMeetingTime(timeStr) {
  if (!timeStr || timeStr === 'Per Schedule') {
    return null;
  }

  // Common patterns:
  // "Every Tuesday, 11:00 am–1:00 pm"
  // "Monday–Friday, 10–11 am"
  // "3rd Tuesday, 7:00–9:00 PM"
  // "Every Friday, 12:00–4:00 pm"
  
  // Extract the time range (looking for patterns like "11:00 am" or "10 am")
  const timeRangeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?[–-](\d{1,2}):?(\d{2})?\s*(am|pm)/i);
  
  if (timeRangeMatch) {
    let startHour = parseInt(timeRangeMatch[1]);
    const startMin = timeRangeMatch[2] ? parseInt(timeRangeMatch[2]) : 0;
    const startPeriod = timeRangeMatch[3] || timeRangeMatch[6]; // Use end period if start period missing
    
    let endHour = parseInt(timeRangeMatch[4]);
    const endMin = timeRangeMatch[5] ? parseInt(timeRangeMatch[5]) : 0;
    const endPeriod = timeRangeMatch[6];

    // Convert to 24-hour format
    if (startPeriod?.toLowerCase() === 'pm' && startHour !== 12) {
      startHour += 12;
    } else if (startPeriod?.toLowerCase() === 'am' && startHour === 12) {
      startHour = 0;
    }

    if (endPeriod?.toLowerCase() === 'pm' && endHour !== 12) {
      endHour += 12;
    } else if (endPeriod?.toLowerCase() === 'am' && endHour === 12) {
      endHour = 0;
    }

    return {
      startHour,
      startMin,
      endHour,
      endMin,
      originalText: timeStr
    };
  }

  // Try simpler pattern without minutes: "10–11 am"
  const simpleMatch = timeStr.match(/(\d{1,2})[–-](\d{1,2})\s*(am|pm)/i);
  if (simpleMatch) {
    let startHour = parseInt(simpleMatch[1]);
    let endHour = parseInt(simpleMatch[2]);
    const period = simpleMatch[3];

    if (period?.toLowerCase() === 'pm' && startHour !== 12) {
      startHour += 12;
      endHour += 12;
    } else if (period?.toLowerCase() === 'am' && startHour === 12) {
      startHour = 0;
    }

    return {
      startHour,
      startMin: 0,
      endHour,
      endMin: 0,
      originalText: timeStr
    };
  }

  return null;
}

async function generateUpdatePlan() {
  console.log('================================================================================');
  console.log('GENERATING EVENT TIME UPDATE PLAN');
  console.log('================================================================================\n');

  try {
    // Load the analysis results
    const results = JSON.parse(readFileSync('event-time-analysis.json', 'utf-8'));
    
    console.log(`Loaded ${results.length} event records\n`);

    // Parse meeting times and generate update plan
    const updatePlan = [];
    const cannotParse = [];

    for (const record of results) {
      if (record.status !== 'MATCHED') {
        continue;
      }

      const parsedTime = parseMeetingTime(record.meeting_time);
      
      if (!parsedTime) {
        cannotParse.push(record);
        continue;
      }

      // Get the actual event to extract the date
      const events = await sql`
        SELECT id, title, start_date, end_date
        FROM events
        WHERE id = ${record.event_id}
        LIMIT 1
      `;

      if (events.length === 0) continue;

      const event = events[0];
      const eventDate = new Date(event.start_date);

      // Create new timestamps in ET timezone
      // Format: YYYY-MM-DD HH:MM:SS
      const year = eventDate.getUTCFullYear();
      const month = String(eventDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getUTCDate()).padStart(2, '0');
      
      const newStartTime = `${year}-${month}-${day} ${String(parsedTime.startHour).padStart(2, '0')}:${String(parsedTime.startMin).padStart(2, '0')}:00`;
      const newEndTime = `${year}-${month}-${day} ${String(parsedTime.endHour).padStart(2, '0')}:${String(parsedTime.endMin).padStart(2, '0')}:00`;

      updatePlan.push({
        event_id: record.event_id,
        event_title: record.event_title,
        club_meeting_time: record.meeting_time,
        current_start: event.start_date,
        current_end: event.end_date,
        proposed_start: newStartTime,
        proposed_end: newEndTime,
        parsed: parsedTime
      });
    }

    console.log('================================================================================');
    console.log('UPDATE PLAN SUMMARY:');
    console.log('================================================================================\n');
    console.log(`Total events analyzed: ${results.length}`);
    console.log(`Can update: ${updatePlan.length}`);
    console.log(`Cannot parse: ${cannotParse.length}\n`);

    // Show sample of updates
    console.log('Sample updates (first 20):');
    console.log('================================================================================\n');
    
    updatePlan.slice(0, 20).forEach(plan => {
      console.log(`Event: ${plan.event_title}`);
      console.log(`  Club says: ${plan.club_meeting_time}`);
      console.log(`  Current:   ${plan.current_start} → ${plan.current_end}`);
      console.log(`  Proposed:  ${plan.proposed_start} → ${plan.proposed_end}`);
      console.log('');
    });

    if (cannotParse.length > 0) {
      console.log('================================================================================');
      console.log('CANNOT PARSE (need manual review):');
      console.log('================================================================================\n');
      
      cannotParse.slice(0, 10).forEach(r => {
        console.log(`${r.event_title}: "${r.meeting_time}"`);
      });
      console.log('');
    }

    // Save the update plan
    const fs = await import('fs');
    fs.writeFileSync('event-time-update-plan.json', JSON.stringify(updatePlan, null, 2));
    
    console.log('✓ Update plan saved to event-time-update-plan.json\n');
    console.log(`Ready to update ${updatePlan.length} parent events.`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

generateUpdatePlan();
