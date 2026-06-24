/**
 * Helper script to run all event update scripts in sequence
 */

import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// List of scripts to run in order
const scripts = [
  {
    name: 'Update hours of operation',
    script: 'update-hours-operation.js',
    description: 'Adding operating hours to all events'
  },
  {
    name: 'Update contact information',
    script: 'update-contact-info.js',
    description: 'Adding contact details to all events'
  },
  {
    name: 'Update map links',
    script: 'update-map-links.js',
    description: 'Adding Google Maps links for all event locations'
  },
  {
    name: 'Update media URLs',
    script: 'update-media-urls.js',
    description: 'Adding relevant images for all events'
  }
];

/**
 * Run all update scripts in sequence
 */
async function runAllUpdates() {
  console.log('🔄 Starting comprehensive event data update process');
  console.log('=================================================');
  
  for (let i = 0; i < scripts.length; i++) {
    const { name, script, description } = scripts[i];
    
    console.log(`\n[${i+1}/${scripts.length}] ${name}`);
    console.log(`🔹 ${description}`);
    console.log('--------------------------------------------------');
    
    try {
      const startTime = Date.now();
      console.log(`🕒 Started at: ${new Date().toISOString()}`);
      
      const { stdout, stderr } = await execPromise(`node ${script}`);
      
      if (stderr) {
        console.error(`⚠️ Warnings/Errors from ${script}:\n${stderr}`);
      }
      
      console.log(`✅ Output from ${script}:\n${stdout}`);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      console.log(`✅ Completed in ${duration.toFixed(2)} seconds`);
    } catch (error) {
      console.error(`❌ Error running ${script}:`);
      console.error(error.message);
      
      if (error.stdout) {
        console.log(`📝 Last output before error:\n${error.stdout}`);
      }
      
      // Continue with next script even if this one failed
      console.log('--------------------------------------------------');
      console.log(`⚠️ Continuing with next script...`);
    }
  }
  
  console.log('\n=================================================');
  console.log('✅ All event update scripts have been executed');
  console.log('=================================================');
}

// Run all updates
runAllUpdates().catch(console.error);