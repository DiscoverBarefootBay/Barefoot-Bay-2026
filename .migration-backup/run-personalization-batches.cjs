/**
 * Sequential batch processor for event image personalization
 * 
 * This script:
 * 1. Runs the personalization script in batches
 * 2. Continues to the next batch automatically until all events are processed
 * 
 * Usage: node run-personalization-batches.js [startIndex] [batchSize] [maxBatches]
 */

const { spawn } = require('child_process');
const fs = require('fs');

// Parse command-line arguments
const args = process.argv.slice(2);
const startIndex = parseInt(args[0]) || 33; // Start from where we left off by default
const batchSize = parseInt(args[1]) || 20;   // Default batch size
const maxBatches = parseInt(args[2]) || 5;   // Default max number of batches to run

// Generate a timestamp for the log file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = `personalization-log-${timestamp}.txt`;

// Create log file with header
fs.writeFileSync(logFile, `PERSONALIZATION BATCH PROCESSING\n` +
                          `Started: ${new Date().toISOString()}\n` +
                          `Starting Index: ${startIndex}\n` +
                          `Batch Size: ${batchSize}\n` +
                          `Max Batches: ${maxBatches}\n\n`);

// Run the personalization script and return the next index to start from
async function runPersonalizationBatch(currentIndex, currentBatch) {
  return new Promise((resolve, reject) => {
    console.log(`\n----- RUNNING BATCH ${currentBatch} (${currentIndex} to ${currentIndex + batchSize - 1}) -----\n`);
    
    // Append to log file
    fs.appendFileSync(logFile, `\n----- BATCH ${currentBatch} (${currentIndex} to ${currentIndex + batchSize - 1}) -----\n`);
    
    // Spawn the process
    const child = spawn('node', ['personalize-events.cjs', currentIndex, batchSize]);
    
    let nextStartIndex = null;
    
    // Capture stdout
    child.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      fs.appendFileSync(logFile, output);
      
      // Look for the next start index
      if (output.includes('Next batch should start from index')) {
        const match = output.match(/Next batch should start from index (\d+)/);
        if (match && match[1]) {
          nextStartIndex = parseInt(match[1]);
        }
      }
    });
    
    // Capture stderr
    child.stderr.on('data', (data) => {
      const error = data.toString();
      process.stderr.write(error);
      fs.appendFileSync(logFile, `ERROR: ${error}`);
    });
    
    // Handle process completion
    child.on('close', (code) => {
      fs.appendFileSync(logFile, `\n----- BATCH ${currentBatch} COMPLETED WITH CODE ${code} -----\n`);
      
      if (code !== 0) {
        reject(new Error(`Batch ${currentBatch} exited with code ${code}`));
      } else {
        resolve(nextStartIndex);
      }
    });
  });
}

// Main function to run multiple batches
async function runBatches() {
  console.log(`Starting personalization batch processing`);
  console.log(`Log file: ${logFile}`);
  
  let currentIndex = startIndex;
  let batchNumber = 1;
  let totalProcessed = 0;
  let isComplete = false;
  
  try {
    while (batchNumber <= maxBatches && !isComplete) {
      // Run the current batch
      const nextIndex = await runPersonalizationBatch(currentIndex, batchNumber);
      
      if (!nextIndex) {
        console.log(`\nCould not determine next index. Stopping batch processing.`);
        break;
      }
      
      const processed = nextIndex - currentIndex;
      totalProcessed += processed;
      
      // Check if we're done
      if (nextIndex === currentIndex) {
        console.log(`\nNo more events to process. Batch processing complete.`);
        isComplete = true;
        break;
      }
      
      // Update for next batch
      currentIndex = nextIndex;
      batchNumber++;
      
      // Check if we need to continue
      if (batchNumber > maxBatches) {
        console.log(`\nReached maximum number of batches (${maxBatches}). Stopping.`);
        console.log(`To continue processing, run: node run-personalization-batches.cjs ${currentIndex} ${batchSize} ${maxBatches}`);
        break;
      }
      
      console.log(`\nMoving to next batch starting at index ${currentIndex}`);
    }
    
    // Final summary
    const summary = `\n----- PROCESSING SUMMARY -----\n` +
                    `Total batches processed: ${batchNumber - 1}\n` +
                    `Total events processed: ${totalProcessed}\n` +
                    `Next start index: ${currentIndex}\n` +
                    `Completed: ${isComplete ? 'YES' : 'NO'}\n` +
                    `Finished: ${new Date().toISOString()}\n`;
    
    console.log(summary);
    fs.appendFileSync(logFile, summary);
    
    // Save next command for convenience
    if (!isComplete) {
      const nextCommand = `node run-personalization-batches.cjs ${currentIndex} ${batchSize} ${maxBatches}`;
      fs.writeFileSync('next-batch-command.txt', nextCommand);
      console.log(`Next command saved to next-batch-command.txt`);
    }
  } catch (err) {
    console.error(`\nError during batch processing: ${err.message}`);
    fs.appendFileSync(logFile, `\nERROR: ${err.message}\n`);
    
    // Save recovery command
    const recoveryCommand = `node run-personalization-batches.cjs ${currentIndex} ${batchSize} ${maxBatches}`;
    fs.writeFileSync('recovery-command.txt', recoveryCommand);
    console.log(`Recovery command saved to recovery-command.txt`);
  }
}

// Run the batch processing
runBatches().catch(console.error);