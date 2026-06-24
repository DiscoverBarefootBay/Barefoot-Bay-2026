/**
 * Helper script to run the personalize-event-images.js in batches
 * This script accepts the starting index as a command-line argument
 * 
 * Usage:
 * node process-march-events-in-batches.js 0
 * 
 * After the script completes a batch, it will output the next starting index
 * You can then run it again with that index to continue processing
 */

import { spawn } from 'child_process';
import * as fs from 'fs';

// Parse command-line arguments
const args = process.argv.slice(2);
const startIndex = parseInt(args[0]) || 0;
const batchSize = parseInt(args[1]) || 20;

// Generate a timestamp for the log file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = `personalization-log-${timestamp}.txt`;

// Modify the original script to use batch parameters
async function modifyScript() {
  try {
    // Read the original script
    const scriptPath = './personalize-event-images.js';
    let content = fs.readFileSync(scriptPath, 'utf8');
    
    // Replace the execution line
    const originalExecution = /personalizeEventImages\(\)\.catch\(console\.error\);/;
    const batchExecution = `personalizeEventImages(${batchSize}, ${startIndex}).catch(console.error);`;
    
    content = content.replace(originalExecution, batchExecution);
    
    // Write to a temporary file
    const tempScriptPath = './temp-personalize-script.js';
    fs.writeFileSync(tempScriptPath, content);
    
    console.log(`Modified script with startIndex=${startIndex}, batchSize=${batchSize}`);
    return tempScriptPath;
  } catch (err) {
    console.error('Error modifying script:', err);
    process.exit(1);
  }
}

// Run the script and capture output
async function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`Running script: ${scriptPath}`);
    
    // Create a log stream
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`\n----- STARTING BATCH FROM INDEX ${startIndex} -----\n`);
    
    // Spawn the process
    const child = spawn('node', [scriptPath]);
    
    // Capture stdout
    child.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      logStream.write(output);
      
      // Look for the "Next batch should start from index" line
      if (output.includes('Next batch should start from index')) {
        const match = output.match(/Next batch should start from index (\d+)/);
        if (match && match[1]) {
          const nextIndex = parseInt(match[1]);
          resolve(nextIndex);
        }
      }
    });
    
    // Capture stderr
    child.stderr.on('data', (data) => {
      const error = data.toString();
      process.stderr.write(error);
      logStream.write(`ERROR: ${error}`);
    });
    
    // Handle process completion
    child.on('close', (code) => {
      logStream.write(`\n----- PROCESS EXITED WITH CODE ${code} -----\n`);
      logStream.end();
      
      if (code !== 0) {
        reject(new Error(`Script exited with code ${code}`));
      } else {
        resolve(null); // If we couldn't determine the next index
      }
    });
  });
}

// Clean up temporary files
function cleanup(tempPath) {
  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
      console.log(`Cleaned up temporary file: ${tempPath}`);
    }
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}

// Main function
async function main() {
  let tempScriptPath = null;
  
  try {
    // Create the modified script
    tempScriptPath = await modifyScript();
    
    // Run the script
    const nextIndex = await runScript(tempScriptPath);
    
    if (nextIndex) {
      console.log(`\nBatch processing completed successfully.`);
      console.log(`To continue processing, run:`);
      console.log(`node process-march-events-in-batches.js ${nextIndex}`);
      
      // Write the command to a file for easy reference
      fs.writeFileSync('next-batch-command.txt', `node process-march-events-in-batches.js ${nextIndex}`);
      console.log(`Command saved to next-batch-command.txt`);
    } else {
      console.log(`\nBatch processing completed, but couldn't determine next index.`);
      console.log(`Check the log file: ${logFile}`);
    }
  } catch (err) {
    console.error('\nError running batch process:', err);
    console.log(`Check the log file: ${logFile}`);
  } finally {
    // Clean up
    if (tempScriptPath) {
      cleanup(tempScriptPath);
    }
  }
}

// Run the main function
main().catch(console.error);