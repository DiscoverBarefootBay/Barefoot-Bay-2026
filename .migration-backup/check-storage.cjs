/**
 * Script to check contents of Replit Object Storage
 */
const ObjectStorage = require('@replit/object-storage');

const storage = new ObjectStorage();

async function listObjects() {
  try {
    // List objects in the CALENDAR bucket
    console.log('Checking CALENDAR bucket...');
    const calendarObjects = await storage.list({ bucket: 'CALENDAR', prefix: 'events/' });
    console.log('\nObjects in CALENDAR/events/ bucket:');
    for (const object of calendarObjects) {
      console.log(` - ${object}`);
    }
    
    // Check if our specific file exists
    const testFile = 'media-1746247882901-166640615.png';
    console.log(`\nLooking for file matching: ${testFile}`);
    const matches = calendarObjects.filter(obj => obj.includes(testFile));
    
    if (matches.length > 0) {
      console.log('FOUND:');
      matches.forEach(match => console.log(` - ${match}`));
    } else {
      console.log('No matching files found in Object Storage');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

listObjects();