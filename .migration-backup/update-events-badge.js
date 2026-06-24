/**
 * Script to update all events to set badgeRequired to true
 */

import 'dotenv/config';
import { db } from './server/db.js';
import { events } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function updateEventsBadgeStatus() {
  try {
    console.log('Starting update of events badge status...');

    // Get all events
    const allEvents = await db.select().from(events);
    console.log(`Found ${allEvents.length} events to update`);

    // Update each event to set badgeRequired to true
    let updateCount = 0;
    for (const event of allEvents) {
      await db.update(events)
        .set({ badgeRequired: true })
        .where(eq(events.id, event.id));
      
      updateCount++;
      console.log(`Updated event ID: ${event.id} - ${event.title}`);
    }

    console.log(`Successfully updated ${updateCount} events to require badges`);
  } catch (error) {
    console.error('Error updating events:', error);
  }
}

// Run the update function
updateEventsBadgeStatus();