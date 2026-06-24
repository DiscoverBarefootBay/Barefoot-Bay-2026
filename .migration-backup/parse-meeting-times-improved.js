import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres(process.env.DATABASE_URL);

// Normalize time strings
function normalizeTimeString(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/\bnoon\b/gi, '12:00 pm')
    .replace(/\bmidnight\b/gi, '12:00 am')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse a single time like "7:30 pm" or "9:00 am"
function parseSingleTime(timeStr) {
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
  if (!match) return null;

  let hour = parseInt(match[1]);
  const min = match[2] ? parseInt(match[2]) : 0;
  const period = match[3];

  // Convert to 24-hour
  if (period?.toLowerCase() === 'pm' && hour !== 12) {
    hour += 12;
  } else if (period?.toLowerCase() === 'am' && hour === 12) {
    hour = 0;
  }

  return { hour, min };
}

// Parse meeting time string to extract hours and minutes
function parseMeetingTime(timeStr) {
  if (!timeStr || timeStr === 'Per Schedule' || timeStr === 'Per Event' || timeStr === '') {
    return null;
  }

  const normalized = normalizeTimeString(timeStr);

  // Pattern 1: Full range with times "11:00 am–1:00 pm"
  const fullRangeMatch = normalized.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?[–-]\s*(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
  
  if (fullRangeMatch) {
    let startHour = parseInt(fullRangeMatch[1]);
    const startMin = fullRangeMatch[2] ? parseInt(fullRangeMatch[2]) : 0;
    const startPeriod = fullRangeMatch[3] || fullRangeMatch[6]; // Use end period if start period missing
    
    let endHour = parseInt(fullRangeMatch[4]);
    const endMin = fullRangeMatch[5] ? parseInt(fullRangeMatch[5]) : 0;
    const endPeriod = fullRangeMatch[6];

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

    // Validation: ensure end is after start
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (endMinutes <= startMinutes) {
      console.warn(`Invalid time range: ${timeStr} (parsed as ${startHour}:${startMin} - ${endHour}:${endMin})`);
      return null;
    }

    return {
      startHour,
      startMin,
      endHour,
      endMin,
      originalText: timeStr,
      method: 'full_range'
    };
  }

  // Pattern 2: Simpler pattern without minutes: "10–11 am"
  const simpleMatch = normalized.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})\s*(am|pm)/i);
  if (simpleMatch) {
    let startHour = parseInt(simpleMatch[1]);
    let endHour = parseInt(simpleMatch[2]);
    const period = simpleMatch[3];

    if (period?.toLowerCase() === 'pm') {
      if (startHour !== 12) startHour += 12;
      if (endHour !== 12) endHour += 12;
    } else if (period?.toLowerCase() === 'am' && startHour === 12) {
      startHour = 0;
    }

    return {
      startHour,
      startMin: 0,
      endHour,
      endMin: 0,
      originalText: timeStr,
      method: 'simple_range'
    };
  }

  // Pattern 3: Single time only "7:30 pm" - assume 2 hour duration
  const singleMatch = normalized.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
  if (singleMatch) {
    const start = parseSingleTime(normalized);
    if (start) {
      // Default 2-hour duration
      let endHour = start.hour + 2;
      let endMin = start.min;
      
      // Handle overflow past midnight
      if (endHour >= 24) {
        endHour -= 24;
      }

      return {
        startHour: start.hour,
        startMin: start.min,
        endHour,
        endMin,
        originalText: timeStr,
        method: 'single_time_assumed_duration'
      };
    }
  }

  return null;
}

async function generateImprovedUpdatePlan() {
  console.log('================================================================================');
  console.log('GENERATING IMPROVED EVENT TIME UPDATE PLAN');
  console.log('================================================================================\n');

  try {
    // Load the analysis results
    const results = JSON.parse(readFileSync('event-time-analysis.json', 'utf-8'));
    
    console.log(`Loaded ${results.length} event records\n`);

    // Parse meeting times and generate update plan
    const updatePlan = [];
    const cannotParse = [];
    const manualReview = [];

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
      
      // Extract date parts from existing event (in UTC)
      const eventDate = new Date(event.start_date);
      const year = eventDate.getUTCFullYear();
      const month = String(eventDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getUTCDate()).padStart(2, '0');
      
      // Build timestamp strings in format that Postgres will interpret correctly with AT TIME ZONE
      const dateStr = `${year}-${month}-${day}`;
      const startTimeStr = `${String(parsedTime.startHour).padStart(2, '0')}:${String(parsedTime.startMin).padStart(2, '0')}:00`;
      const endTimeStr = `${String(parsedTime.endHour).padStart(2, '0')}:${String(parsedTime.endMin).padStart(2, '0')}:00`;

      const plan = {
        event_id: record.event_id,
        event_title: record.event_title,
        club_meeting_time: record.meeting_time,
        current_start: event.start_date,
        current_end: event.end_date,
        proposed_date: dateStr,
        proposed_start_time: startTimeStr,
        proposed_end_time: endTimeStr,
        parsed: parsedTime
      };

      // Flag items parsed with assumptions for manual review
      if (parsedTime.method === 'single_time_assumed_duration') {
        manualReview.push(plan);
      } else {
        updatePlan.push(plan);
      }
    }

    console.log('================================================================================');
    console.log('UPDATE PLAN SUMMARY:');
    console.log('================================================================================\n');
    console.log(`Total events analyzed: ${results.length}`);
    console.log(`Can auto-update: ${updatePlan.length}`);
    console.log(`Need manual review (assumed duration): ${manualReview.length}`);
    console.log(`Cannot parse: ${cannotParse.length}\n`);

    // Show sample of updates
    console.log('AUTO-UPDATE READY (first 15):');
    console.log('================================================================================\n');
    
    updatePlan.slice(0, 15).forEach(plan => {
      console.log(`${plan.event_title}`);
      console.log(`  Club: ${plan.club_meeting_time}`);
      console.log(`  Will update to: ${plan.proposed_date} ${plan.proposed_start_time} - ${plan.proposed_end_time} ET`);
      console.log('');
    });

    if (manualReview.length > 0) {
      console.log('================================================================================');
      console.log('MANUAL REVIEW NEEDED (assumed 2hr duration):');
      console.log('================================================================================\n');
      
      manualReview.forEach(plan => {
        console.log(`${plan.event_title}: "${plan.club_meeting_time}"`);
        console.log(`  Proposed: ${plan.proposed_start_time} - ${plan.proposed_end_time}`);
      });
      console.log('');
    }

    if (cannotParse.length > 0) {
      console.log('================================================================================');
      console.log('CANNOT PARSE:');
      console.log('================================================================================\n');
      
      cannotParse.forEach(r => {
        console.log(`${r.event_title}: "${r.meeting_time}"`);
      });
      console.log('');
    }

    // Save plans
    const fs = await import('fs');
    fs.writeFileSync('event-time-auto-update.json', JSON.stringify(updatePlan, null, 2));
    fs.writeFileSync('event-time-manual-review.json', JSON.stringify(manualReview, null, 2));
    fs.writeFileSync('event-time-cannot-parse.json', JSON.stringify(cannotParse, null, 2));
    
    console.log('✓ Plans saved to:');
    console.log('  - event-time-auto-update.json');
    console.log('  - event-time-manual-review.json');
    console.log('  - event-time-cannot-parse.json\n');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

generateImprovedUpdatePlan();
