/**
 * Migration Service
 * Handles tracking and management of media migrations to Replit Object Storage
 */

import { db } from './db';
import { migrationRecords, type MigrationRecord, type InsertMigrationRecord } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Constants
export const SOURCE_TYPE = {
  FILESYSTEM: 'filesystem',
  POSTGRESQL: 'postgresql'
} as const;

export const MIGRATION_STATUS = {
  PENDING: 'pending',
  MIGRATED: 'migrated',
  FAILED: 'failed'
} as const;

export type SourceType = typeof SOURCE_TYPE[keyof typeof SOURCE_TYPE];
export type MigrationStatus = typeof MIGRATION_STATUS[keyof typeof MIGRATION_STATUS];

// Interface for creating new migration records
export interface CreateMigrationOptions {
  sourceType: SourceType;
  sourceLocation: string;
  mediaBucket: string;
  mediaType: string;
  storageKey: string;
  migrationStatus: MigrationStatus;
  errorMessage?: string;
}

// Interface for migration statistics
export interface MigrationStats {
  total: number;
  pending: number;
  migrated: number;
  failed: number;
  verified: number;
}

/**
 * Service for managing migration records
 */
class MigrationService {
  // Expose schema for use in other modules
  migrationRecords = migrationRecords;

  /**
   * Create a new migration record
   * @param options Migration record details
   * @returns Created migration record
   */
  async createMigrationRecord(options: CreateMigrationOptions): Promise<MigrationRecord> {
    try {
      const record: InsertMigrationRecord = {
        sourceType: options.sourceType,
        sourceLocation: options.sourceLocation,
        mediaBucket: options.mediaBucket,
        mediaType: options.mediaType,
        storageKey: options.storageKey,
        migrationStatus: options.migrationStatus,
        errorMessage: options.errorMessage || null,
        migratedAt: options.migrationStatus === MIGRATION_STATUS.MIGRATED ? new Date() : null,
        verificationStatus: false,
        verifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [created] = await db.insert(migrationRecords).values(record).returning();
      return created;
    } catch (error) {
      console.error('Error creating migration record:', error);
      throw error;
    }
  }

  /**
   * Get a migration record by ID
   * @param id Migration record ID
   * @returns Migration record or undefined if not found
   */
  async getMigrationRecord(id: number): Promise<MigrationRecord | undefined> {
    try {
      const [record] = await db.select().from(migrationRecords).where(eq(migrationRecords.id, id));
      return record;
    } catch (error) {
      console.error(`Error getting migration record ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get migration records by source location
   * @param sourceLocation Source file location
   * @returns Array of migration records
   */
  async getMigrationsBySourceLocation(sourceLocation: string): Promise<MigrationRecord[]> {
    try {
      return await db.select().from(migrationRecords).where(eq(migrationRecords.sourceLocation, sourceLocation));
    } catch (error) {
      console.error(`Error getting migration records for ${sourceLocation}:`, error);
      throw error;
    }
  }

  /**
   * Get migration records by status
   * @param status Migration status to filter by
   * @param limit Maximum number of records to return
   * @returns Array of migration records
   */
  async getMigrationsByStatus(status: MigrationStatus, limit = 100): Promise<MigrationRecord[]> {
    try {
      return await db.select().from(migrationRecords)
        .where(eq(migrationRecords.migrationStatus, status))
        .limit(limit);
    } catch (error) {
      console.error(`Error getting migration records with status ${status}:`, error);
      throw error;
    }
  }

  /**
   * Update a migration record's status
   * @param id Migration record ID
   * @param status New migration status
   * @param errorMessage Optional error message (for failed migrations)
   * @returns Updated migration record
   */
  async updateMigrationStatus(id: number, status: MigrationStatus, errorMessage?: string | null): Promise<MigrationRecord> {
    try {
      const updateValues: Partial<MigrationRecord> = {
        migrationStatus: status,
        updatedAt: new Date()
      };

      // Set migrated timestamp if status is 'migrated'
      if (status === MIGRATION_STATUS.MIGRATED) {
        updateValues.migratedAt = new Date();
      }

      // Set error message if provided
      if (errorMessage !== undefined) {
        updateValues.errorMessage = errorMessage;
      }

      const [updated] = await db.update(migrationRecords)
        .set(updateValues)
        .where(eq(migrationRecords.id, id))
        .returning();

      return updated;
    } catch (error) {
      console.error(`Error updating migration status for record ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mark a migration record as verified
   * @param id Migration record ID
   * @returns Updated migration record
   */
  async markAsVerified(id: number): Promise<MigrationRecord> {
    try {
      const [updated] = await db.update(migrationRecords)
        .set({
          verificationStatus: true,
          verifiedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(migrationRecords.id, id))
        .returning();

      return updated;
    } catch (error) {
      console.error(`Error marking migration record ${id} as verified:`, error);
      throw error;
    }
  }

  /**
   * Delete a migration record
   * @param id Migration record ID
   * @returns Boolean indicating success
   */
  async deleteMigrationRecord(id: number): Promise<boolean> {
    try {
      await db.delete(migrationRecords).where(eq(migrationRecords.id, id));
      return true;
    } catch (error) {
      console.error(`Error deleting migration record ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get migration statistics
   * @returns Object with migration counts
   */
  async getMigrationStats(): Promise<MigrationStats> {
    try {
      // Get total count
      const [totalResult] = await db.select({ count: db.count() }).from(migrationRecords);
      
      // Get count by status
      const pendingResult = await db.select({ count: db.count() })
        .from(migrationRecords)
        .where(eq(migrationRecords.migrationStatus, MIGRATION_STATUS.PENDING));
      
      const migratedResult = await db.select({ count: db.count() })
        .from(migrationRecords)
        .where(eq(migrationRecords.migrationStatus, MIGRATION_STATUS.MIGRATED));
      
      const failedResult = await db.select({ count: db.count() })
        .from(migrationRecords)
        .where(eq(migrationRecords.migrationStatus, MIGRATION_STATUS.FAILED));
      
      // Get verified count
      const verifiedResult = await db.select({ count: db.count() })
        .from(migrationRecords)
        .where(eq(migrationRecords.verificationStatus, true));

      return {
        total: Number(totalResult?.count || 0),
        pending: Number(pendingResult[0]?.count || 0),
        migrated: Number(migratedResult[0]?.count || 0),
        failed: Number(failedResult[0]?.count || 0),
        verified: Number(verifiedResult[0]?.count || 0)
      };
    } catch (error) {
      console.error('Error getting migration statistics:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const migrationService = new MigrationService();