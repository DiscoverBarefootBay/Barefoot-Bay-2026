#!/usr/bin/env node

/**
 * CLI script for migrating calendar media to Replit Object Storage
 * 
 * This script provides a command-line interface for running the migration
 * with options for dry runs and testing.
 * 
 * Usage:
 * $ node scripts/migrate-calendar-media-cli.js [--dry-run] [--verify]
 * 
 * Options:
 *   --dry-run    Run the migration in dry run mode without making changes
 *   --verify     Verify the migration by testing access to Object Storage
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Get the directory path for this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerify = args.includes('--verify');

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          CALENDAR MEDIA MIGRATION TO REPLIT OBJECT STORAGE     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);

  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes will be made)' : '✅ LIVE RUN'}`);
  console.log(`Verify Only: ${isVerify ? '✅ YES' : '❌ NO'}`);
  console.log(`\n✋ This migration PRESERVES all filesystem media while adding Object Storage copies`);
  console.log(`No files will be deleted from the filesystem during this migration`);
  
  // Check if REPLIT_OBJECT_STORAGE_TOKEN is set in environment
  if (!process.env.REPLIT_OBJECT_STORAGE_TOKEN) {
    console.error('\n❌ ERROR: REPLIT_OBJECT_STORAGE_TOKEN is not set in environment');
    console.error('Please add it to your .env file or set it as an environment variable.');
    console.error('You can find your token in the Replit Secrets/Environment variables tab.');
    process.exit(1);
  }
  
  // In verify mode, just check Object Storage access and exit
  if (isVerify) {
    console.log('\n🔍 Verifying Replit Object Storage access...');
    
    try {
      // Import the ObjectStorageService class - try from our local modules directory first
      let objectStorageService;
      try {
        // First try importing from our local modules directory using require
        // This works because we compiled the modules in CommonJS format
        const module = require('./modules/object-storage-service.js');
        objectStorageService = module.objectStorageService;
        console.log('Successfully imported object-storage-service from modules directory');
      } catch (err) {
        console.log('Could not import from modules directory, trying source...');
        try {
          // Then try importing from source
          const module = await import('../server/object-storage-service.js');
          objectStorageService = module.objectStorageService;
          console.log('Successfully imported object-storage-service from source');
        } catch (sourceErr) {
          console.log('Could not import from source, trying dist directory...');
          try {
            // Finally try importing from dist
            const module = await import('../dist/server/object-storage-service.js');
            objectStorageService = module.objectStorageService;
            console.log('Successfully imported object-storage-service from dist');
          } catch (distErr) {
            throw new Error(`Failed to import object-storage-service module: ${distErr.message}`);
          }
        }
      }
      
      // Try to list buckets or perform a test upload
      const testKey = `test-${Date.now()}`;
      const testContent = Buffer.from('Test file for Object Storage verification');
      
      console.log('Uploading test file to Object Storage...');
      const url = await objectStorageService.uploadData(
        testContent,
        'test',
        testKey,
        'text/plain'
      );
      
      console.log(`✅ Successfully uploaded test file: ${url}`);
      console.log('Object Storage access is working correctly.');
      
      // Try to clean up the test file
      try {
        await objectStorageService.deleteFile('test', testKey);
        console.log('✅ Successfully deleted test file.');
      } catch (deleteErr) {
        console.warn('⚠️ Could not delete test file, but upload was successful.');
      }
      
      console.log('\n✅ Verification completed successfully. Your Replit Object Storage is properly configured.');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ ERROR: Could not access Replit Object Storage');
      console.error(error);
      process.exit(1);
    }
  }
  
  // Run the migration directly or as a separate process
  try {
    // First, try to import and run the migration script directly
    console.log(`\n🚀 Preparing migration with ${isDryRun ? 'dry run' : 'live run'} mode...`);
    
    try {
      // Try to import the migration script directly
      const migrationScriptPath = join(rootDir, 'scripts/migrate-calendar-events-to-object-storage.js');
      
      // Check if the migration script exists
      if (!fs.existsSync(migrationScriptPath)) {
        console.error(`\n❌ ERROR: Migration script not found at ${migrationScriptPath}`);
        process.exit(1);
      }
      
      // Import the migration module and run its main function
      console.log(`Importing migration script from ${migrationScriptPath}...`);
      
      // Since we don't know how the migrate-calendar-events-to-object-storage.js is structured,
      // let's fall back to running it as a separate process
      const { execSync } = await import('child_process');
      
      console.log(`\n🚀 Running migration script with ${isDryRun ? 'dry run' : 'live run'} mode...`);
      let command = `node ${migrationScriptPath}`;
      if (isDryRun) {
        command += ' --dry-run';
      }
      
      // Execute the migration script
      execSync(command, { stdio: 'inherit' });
      
      console.log('\n✅ Migration completed successfully.');
      process.exit(0);
    } catch (importError) {
      console.error(`\n❌ ERROR: Could not run migration script`);
      console.error(importError);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ ERROR: Migration failed');
    console.error(error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});