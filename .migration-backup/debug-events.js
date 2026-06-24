/**
 * Debug script to check for and display calendar events
 */

import fetch from 'node-fetch';

async function debugEvents() {
  try {
    console.log('Fetching events from API...');
    const response = await fetch('http://localhost:5000/api/events');
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const events = await response.json();
    console.log(`Found ${events.length} events in the database.`);
    
    if (events.length > 0) {
      // Get the first 3 events to display
      const sampleEvents = events.slice(0, 3);
      console.log('\nSample of events:');
      sampleEvents.forEach((event, index) => {
        console.log(`\nEvent ${index + 1}:`);
        console.log(`  Title: ${event.title}`);
        console.log(`  Start Date: ${new Date(event.startDate).toLocaleString()}`);
        console.log(`  Category: ${event.category}`);
        console.log(`  Location: ${event.location || 'N/A'}`);
      });
      
      // Get count of events by month
      const eventsByMonth = events.reduce((acc, event) => {
        const date = new Date(event.startDate);
        const month = date.getMonth();
        const year = date.getFullYear();
        const key = `${year}-${month}`;
        
        if (!acc[key]) {
          acc[key] = [];
        }
        
        acc[key].push(event);
        return acc;
      }, {});
      
      // Print counts by month
      console.log('\nEvents by month:');
      Object.keys(eventsByMonth).forEach(key => {
        const [year, month] = key.split('-');
        const monthName = new Date(parseInt(year), parseInt(month), 1).toLocaleString('default', { month: 'long' });
        console.log(`  ${monthName} ${year}: ${eventsByMonth[key].length} events`);
      });
      
      // Check if any events fall in April 2025 (the month showing in the calendar UI)
      const aprilEvents = events.filter(event => {
        const date = new Date(event.startDate);
        return date.getMonth() === 3 && date.getFullYear() === 2025; // April is month 3 (0-indexed)
      });
      
      console.log(`\nFound ${aprilEvents.length} events in April 2025.`);
      
      if (aprilEvents.length > 0) {
        console.log('\nSample of April 2025 events:');
        aprilEvents.slice(0, 3).forEach((event, index) => {
          console.log(`\nApril Event ${index + 1}:`);
          console.log(`  Title: ${event.title}`);
          console.log(`  Start Date: ${new Date(event.startDate).toLocaleString()}`);
          console.log(`  Category: ${event.category}`);
        });
        
        // Print sample of events for specific April dates
        const april11Events = aprilEvents.filter(event => {
          const date = new Date(event.startDate);
          return date.getDate() === 11; // April 11th
        });
        
        if (april11Events.length > 0) {
          console.log('\nEvents for April 11, 2025:');
          april11Events.slice(0, 3).forEach((event, index) => {
            console.log(`  - ${event.title} (${new Date(event.startDate).toLocaleTimeString()})`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error fetching events:', error);
  }
}

// Run the debug function
debugEvents();