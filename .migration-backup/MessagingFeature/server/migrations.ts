/**
 * Migration Utilities
 * 
 * Provides functions to create and manage database tables for the messaging feature.
 */

import { Pool } from 'pg';

export async function createTables(pool: Pool): Promise<void> {
  try {
    // Create chat_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        contact_info JSONB
      );
    `);
    console.log('Created chat_sessions table');
    
    // Create messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS session_idx ON messages(session_id);
    `);
    console.log('Created messages table');
    
    // Create support_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        thread_id VARCHAR NOT NULL
      );
      CREATE INDEX IF NOT EXISTS user_msg_idx ON support_messages(user_id);
      CREATE INDEX IF NOT EXISTS thread_idx ON support_messages(thread_id);
    `);
    console.log('Created support_messages table');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

export async function dropTables(pool: Pool): Promise<void> {
  try {
    // Drop tables in order to respect foreign key constraints
    await pool.query('DROP TABLE IF EXISTS messages');
    console.log('Dropped messages table');
    
    await pool.query('DROP TABLE IF EXISTS chat_sessions');
    console.log('Dropped chat_sessions table');
    
    await pool.query('DROP TABLE IF EXISTS support_messages');
    console.log('Dropped support_messages table');
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw error;
  }
}

export async function createSeedData(pool: Pool): Promise<void> {
  try {
    // Create a sample chat session
    const sessionResult = await pool.query(`
      INSERT INTO chat_sessions (id, created_at)
      VALUES ('sample-session-id', NOW())
      RETURNING id
    `);
    const sessionId = sessionResult.rows[0].id;
    console.log('Created sample chat session with ID:', sessionId);
    
    // Create sample messages
    await pool.query(`
      INSERT INTO messages (session_id, role, content, timestamp)
      VALUES 
        ('${sessionId}', 'assistant', 'Hello! How can I help you today?', NOW() - INTERVAL '5 MINUTES'),
        ('${sessionId}', 'user', 'I have a question about your services.', NOW() - INTERVAL '4 MINUTES'),
        ('${sessionId}', 'assistant', 'Sure, I''d be happy to tell you about our services. What would you like to know?', NOW() - INTERVAL '3 MINUTES')
    `);
    console.log('Created sample messages');
    
    // Create sample support message
    await pool.query(`
      INSERT INTO support_messages (user_id, content, timestamp, is_read, thread_id)
      VALUES
        ('user-123', 'I need help with my account.', NOW() - INTERVAL '1 DAY', false, 'thread-abc'),
        ('user-456', 'How do I reset my password?', NOW() - INTERVAL '2 DAYS', true, 'thread-def')
    `);
    console.log('Created sample support messages');
  } catch (error) {
    console.error('Error creating seed data:', error);
    throw error;
  }
}

// Run migrations script
export async function runMigrations(connectionString: string, seedData: boolean = false): Promise<void> {
  const pool = new Pool({ connectionString });
  
  try {
    console.log('Starting database migrations for MessagingFeature...');
    
    console.log('Creating tables...');
    await createTables(pool);
    
    if (seedData) {
      console.log('Creating seed data...');
      await createSeedData(pool);
    }
    
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}