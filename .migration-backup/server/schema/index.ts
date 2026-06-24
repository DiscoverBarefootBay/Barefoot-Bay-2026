/**
 * Database Schema Index
 * Exports all the schema components for use throughout the application
 */

// Export migration related types from shared schema
export { 
  migrationRecords,
  type MigrationRecord,
  type InsertMigrationRecord 
} from '@shared/schema';

// The migration schema has been moved to shared/schema.ts
// This file is maintained for backward compatibility