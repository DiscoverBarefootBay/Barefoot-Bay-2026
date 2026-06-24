/**
 * Deployment hooks for Barefoot Bay
 * 
 * This file exports functions that are called during the deployment process.
 * - preDeploy: Called before deployment to backup media files
 * - postDeploy: Called after deployment to restore media files
 */

import { spawn } from 'child_process';

/**
 * Executes a shell command and returns the output
 * @param {string} command - The command to execute
 * @returns {Promise<string>} - The command output
 */
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn('bash', ['-c', command], {
      stdio: 'inherit' // Redirect output to parent process
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

/**
 * Pre-deployment hook - backs up media files to database
 */
export async function preDeploy() {
  console.log('Running pre-deployment media backup...');
  
  try {
    await executeCommand('./deploy.sh pre');
    return {
      success: true,
      message: 'Media files successfully backed up to database'
    };
  } catch (error) {
    console.error('Pre-deployment backup failed:', error);
    return {
      success: false,
      message: `Pre-deployment backup failed: ${error.message}`
    };
  }
}

/**
 * Post-deployment hook - restores media files from database
 */
export async function postDeploy() {
  console.log('Running post-deployment media restoration...');
  
  try {
    await executeCommand('./deploy.sh post');
    return {
      success: true,
      message: 'Media files successfully restored from database'
    };
  } catch (error) {
    console.error('Post-deployment restoration failed:', error);
    return {
      success: false,
      message: `Post-deployment restoration failed: ${error.message}`
    };
  }
}