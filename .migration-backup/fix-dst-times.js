import postgres from 'postgres';
import { config } from 'dotenv';

config();

const sql = postgres(process.env.DATABASE_URL);

function isDST(date) {
  const year = date.getFullYear();
  
  const marchSecondSunday = new Date(year, 2, 1);
  while (marchSecondSunday.getDay() !== 0) marchSecondSunday.setDate(marchSecondSunday.getDate() + 1);
  marchSecondSunday.setDate(marchSecondSunday.getDate() + 7);
  marchSecondSunday.setHours(2, 0, 0, 0);
  
  const novemberFirstSunday = new Date(year, 10, 1);
  while (novemberFirstSunday.getDay() !== 0) novemberFirstSunday.setDate(novemberFirstSunday.getDate() + 1);
  novemberFirstSunday.setHours(2, 0, 0, 0);
  
  return date >= marchSecondSunday && date < novemberFirstSunday;
}

function parseLocalTime(timeStr) {
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return null;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const ampm = match[3]?.toLowerCase();
  
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  
  return { hours, minutes };
}

function convertToUTC(eventDate, localHour, localMinute) {
  const date = new Date(eventDate);
  date.setUTCHours(0, 0, 0, 0);
  
  const localDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), localHour, localMinute, 0, 0);
  
  const offset = isDST(localDate) ? 4 : 5;
  
  const utcHour = localHour + offset;
  const utcMinute = localMinute;
  
  return { utcHour, utcMinute, offset, isDST: isDST(localDate) };
}

async function fixEventTimes() {
  try {
    console.log('Fetching all social club events...');
    const events = await sql`
      SELECT id, title, start_date, end_date, parent_event_id, website_url
      FROM events
      WHERE website_url LIKE '%/social/%'
      ORDER BY parent_event_id NULLS FIRST, start_date
    `;
    
    console.log(`Found ${events.length} social club events`);
    
    const timePatterns = {
      "Bible Study - Men's": { start: "11:00 am", end: "1:00 pm" },
      "Bible Study - Ladies": { start: "10:00 am", end: "12:00 pm" },
      "Bocce": { start: "9:00 am", end: "11:00 am" },
      "Ceramics": { start: "9:00 am", end: "12:00 pm" },
      "Crochet & Knitting": { start: "1:00 pm", end: "3:00 pm" },
      "Water Aerobics": { start: "10:00 am", end: "11:00 am" },
      "Pickleball": { start: "8:00 am", end: "11:00 am" },
    };
    
    let updated = 0;
    let skipped = 0;
    
    for (const event of events) {
      const timeInfo = timePatterns[event.title];
      
      if (!timeInfo) {
        skipped++;
        continue;
      }
      
      const startTime = parseLocalTime(timeInfo.start);
      const endTime = parseLocalTime(timeInfo.end);
      
      if (!startTime || !endTime) {
        console.log(`⚠️  Could not parse times for ${event.title}`);
        skipped++;
        continue;
      }
      
      const startUTC = convertToUTC(event.start_date, startTime.hours, startTime.minutes);
      const endUTC = convertToUTC(event.end_date, endTime.hours, endTime.minutes);
      
      const eventDate = new Date(event.start_date);
      const dateStr = eventDate.toISOString().split('T')[0];
      const newStartDate = `${dateStr} ${String(startUTC.utcHour).padStart(2, '0')}:${String(startUTC.utcMinute).padStart(2, '0')}:00`;
      const newEndDate = `${dateStr} ${String(endUTC.utcHour).padStart(2, '0')}:${String(endUTC.utcMinute).padStart(2, '0')}:00`;
      
      console.log(`📅 ${event.title} (ID: ${event.id}) on ${dateStr}`);
      console.log(`   Old: ${event.start_date} - ${event.end_date}`);
      console.log(`   New: ${newStartDate} - ${newEndDate} (${startUTC.isDST ? 'EDT' : 'EST'}, UTC${startUTC.isDST ? '-4' : '-5'})`);
      
      await sql`
        UPDATE events
        SET 
          start_date = ${newStartDate},
          end_date = ${newEndDate}
        WHERE id = ${event.id}
      `;
      
      updated++;
    }
    
    console.log(`\n✅ Updated ${updated} events`);
    console.log(`⏭️  Skipped ${skipped} events (no time pattern defined)`);
    
  } catch (error) {
    console.error('Error fixing event times:', error);
  } finally {
    await sql.end();
  }
}

fixEventTimes();
