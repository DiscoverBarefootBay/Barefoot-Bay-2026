/**
 * Create message tables in the database
 * 
 * This script creates the necessary tables for the messaging system.
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function createMessageTables() {
  console.log('Creating message tables...');
  
  try {
    // Create tables based on the schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" SERIAL PRIMARY KEY,
        "subject" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "sender_id" INTEGER NOT NULL,
        "message_type" TEXT NOT NULL DEFAULT 'user',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "message_recipients" (
        "id" SERIAL PRIMARY KEY,
        "message_id" INTEGER NOT NULL,
        "recipient_id" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "read_at" TIMESTAMP,
        "target_role" TEXT,
        "status" TEXT
      );

      CREATE TABLE IF NOT EXISTS "message_attachments" (
        "id" VARCHAR PRIMARY KEY,
        "message_id" INTEGER NOT NULL,
        "filename" VARCHAR NOT NULL,
        "url" VARCHAR NOT NULL,
        "size" VARCHAR,
        "content_type" VARCHAR,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Message tables created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating message tables:', error);
    process.exit(1);
  }
}

createMessageTables();