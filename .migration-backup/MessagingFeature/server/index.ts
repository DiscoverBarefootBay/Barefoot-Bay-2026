/**
 * Messaging Feature Server Index
 * 
 * Main export file for all server-side components.
 */

// Export storage interface and implementation
export { IMessagingStorage, MessagingStorage } from './storage';

// Export routes configuration
export { configureMessagingRoutes } from './routes';

// Export database migration utilities
export { createTables, dropTables, createSeedData, runMigrations } from './migrations';