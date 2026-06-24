/**
 * Script to check if a specific file exists in Object Storage across all buckets
 */
const { Client } = require('@replit/object-storage');

// Initialize the client
const client = new Client();

// Target filename to check
const FILENAME = 'media-1746247882901-166640615.png';

// Define all buckets to check
const BUCKETS = [
  'DEFAULT',
  'CALENDAR',
  'FORUM',
  'VENDORS',
  'SALE',
  'COMMUNITY'
];

async function checkAllBuckets() {
  console.log(`Searching for file ${FILENAME} across all buckets...`);
  
  for (const bucket of BUCKETS) {
    try {
      // List all objects in the bucket
      console.log(`\nChecking bucket: ${bucket}`);
      const result = await client.list({
        bucketName: bucket
      });
      
      if (!result.ok) {
        console.error(`Error listing objects in ${bucket}: ${result.error.message}`);
        continue;
      }
      
      console.log(`Found ${result.value.length} objects in ${bucket}`);
      
      // List all objects in this bucket
      console.log(`\nObjects in ${bucket}:`);
      result.value.forEach(obj => {
        console.log(` - ${obj.name}`);
      });
      
      // Check if our specific file exists
      const matches = result.value.filter(obj => obj.name.includes(FILENAME));
      
      if (matches.length > 0) {
        console.log(`\nFOUND IN BUCKET ${bucket}:`);
        matches.forEach(match => {
          console.log(` - ${match.name}`);
          console.log(`   URL: https://object-storage.replit.app/${bucket}/${match.name}`);
        });
      } else {
        console.log(`No match for ${FILENAME} in bucket ${bucket}`);
      }
    } catch (error) {
      console.error(`Error checking bucket ${bucket}:`, error);
    }
  }
}

// Run the check
checkAllBuckets();