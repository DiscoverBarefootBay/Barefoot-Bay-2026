/**
 * Utility to debug attachment handling in message replies
 */
import * as fs from 'fs';
import * as path from 'path';

// Make sure upload directories exist
const ensureDirectoriesExist = () => {
  const dirs = [
    'temp_upload',
    'uploads',
    'uploads/attachments',
    'uploads/messages'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    } else {
      console.log(`Directory already exists: ${dir}`);
    }
  });
};

// Check permissions on directories
const checkDirectoryPermissions = () => {
  const dirs = [
    'temp_upload',
    'uploads',
    'uploads/attachments',
    'uploads/messages'
  ];
  
  dirs.forEach(dir => {
    try {
      fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
      console.log(`Directory ${dir} is readable and writable`);
    } catch (err) {
      console.error(`Directory ${dir} is not accessible: ${err.message}`);
    }
  });
};

// Run the check
ensureDirectoriesExist();
checkDirectoryPermissions();

console.log('Attachment directories have been verified.');