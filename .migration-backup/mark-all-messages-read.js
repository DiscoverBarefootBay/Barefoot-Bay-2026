/**
 * One-time script to mark all messages as read for every user
 * 
 * This script updates the messageRecipients table to mark all unread messages
 * as read by setting the readAt timestamp and status to 'read'.
 * 
 * Usage:
 * tsx mark-all-messages-read.js
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { messageRecipients } from './shared/schema';
import { eq, isNull, or } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function markAllMessagesAsRead() {
  try {
    console.log('Starting to mark all messages as read for all users...');
    
    // Get count of unread messages first
    const unreadMessages = await db
      .select()
      .from(messageRecipients)
      .where(
        or(
          isNull(messageRecipients.readAt),
          eq(messageRecipients.status, 'unread')
        )
      );
    
    console.log(`Found ${unreadMessages.length} unread message entries to update`);
    
    if (unreadMessages.length === 0) {
      console.log('No unread messages found. All messages are already marked as read.');
      return;
    }
    
    // Update all unread messages to read status
    const result = await db
      .update(messageRecipients)
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        or(
          isNull(messageRecipients.readAt),
          eq(messageRecipients.status, 'unread')
        )
      )
      .returning();
    
    console.log(`Successfully marked ${result.length} message entries as read`);
    console.log('All messages have been marked as read for all users.');
    
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
markAllMessagesAsRead()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });