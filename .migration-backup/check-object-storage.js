/**
 * Script to check contents of Replit Object Storage
 */
import { Client } from '@replit/object-storage';

const client = new Client();

async function listObjects() {
  try {
    // Get current timestamp to find uploads from today
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // First list all objects to see what buckets are available
    console.log('Checking all root buckets...');
    const allObjects = await client.list({});
    
    if (allObjects.objects && allObjects.objects.length > 0) {
      // Extract unique bucket prefixes to see what's available
      const uniquePrefixes = new Set();
      
      allObjects.objects.forEach(obj => {
        const parts = obj.key.split('/');
        if (parts.length > 0) {
          uniquePrefixes.add(parts[0]);
        }
      });
      
      console.log('Available buckets/prefixes:');
      uniquePrefixes.forEach(prefix => console.log(` - ${prefix}`));
    }
    
    // Now check the CALENDAR bucket
    console.log('\nChecking CALENDAR/events/ bucket...');
    const result = await client.list({ prefix: 'CALENDAR/events/' });
    
    if (!result.objects || result.objects.length === 0) {
      console.log('No objects found in CALENDAR/events/');
      return;
    }
    
    console.log(`\nFound ${result.objects.length} objects in CALENDAR/events/ bucket:`);
    
    // Sort by most recent uploads first
    const sortedObjects = result.objects.sort((a, b) => {
      return new Date(b.lastModified) - new Date(a.lastModified);
    });
    
    // Display the 10 most recent uploads with details
    console.log('\n10 most recent uploads:');
    for (let i = 0; i < Math.min(10, sortedObjects.length); i++) {
      const obj = sortedObjects[i];
      const sizeKB = Math.round(obj.size / 1024);
      const uploadTime = new Date(obj.lastModified).toLocaleString();
      console.log(` - ${obj.key} (${sizeKB}KB) - Uploaded: ${uploadTime}`);
    }
    
    // Find media uploaded today
    console.log(`\nMedia uploaded today (${today}):`);
    const todayUploads = sortedObjects.filter(obj => {
      const objDate = new Date(obj.lastModified).toISOString().split('T')[0];
      return objDate === today;
    });
    
    if (todayUploads.length === 0) {
      console.log('No media uploaded today');
    } else {
      todayUploads.forEach(obj => {
        const sizeKB = Math.round(obj.size / 1024);
        const uploadTime = new Date(obj.lastModified).toLocaleString();
        console.log(` - ${obj.key} (${sizeKB}KB) - Uploaded: ${uploadTime}`);
      });
    }
    
  } catch (error) {
    console.error('Error listing objects:', error);
  }
}

listObjects();