/**
 * Test script to insert an event directly into the database
 * This script bypasses the API to test database insertion directly
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './shared/schema.ts';

// Simple wrapper function for logging
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function main() {
  try {
    log('Starting test event insertion');

    // Connect to the database
    log('Connecting to database with URL: ' + process.env.DATABASE_URL);
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    const client = postgres(connectionString);
    const db = drizzle(client, { schema });
    
    log('Connected to database');
    
    // Create a test event
    const testEvent = {
      title: 'Test Event via Direct Insert',
      description: 'This event was created directly via the database to test insertion',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000), // 1 hour from now
      location: 'Test Location',
      category: 'social',
      businessName: 'Test Business',
      contactInfo: {
        name: 'Test Person',
        phone: '(555) 555-5555',
        email: 'test@example.com',
        website: ''
      },
      hoursOfOperation: {
        "Monday": {"isOpen": true, "openTime": "09:00", "closeTime": "17:00"},
        "Tuesday": {"isOpen": true, "openTime": "09:00", "closeTime": "17:00"},
        "Wednesday": {"isOpen": true, "openTime": "09:00", "closeTime": "17:00"},
        "Thursday": {"isOpen": true, "openTime": "09:00", "closeTime": "17:00"},
        "Friday": {"isOpen": true, "openTime": "09:00", "closeTime": "17:00"},
        "Saturday": {"isOpen": true, "openTime": "09:00", "closeTime": "17:00"},
        "Sunday": {"isOpen": true, "openTime": "09:00", "closeTime": "17:00"}
      },
      mediaUrls: [],
      createdBy: 6, // Admin user ID
      isRecurring: false
    };
    
    log('Inserting test event with data:');
    log(JSON.stringify(testEvent, null, 2));
    
    // Attempt to insert directly using Drizzle
    const result = await db.insert(schema.events).values(testEvent).returning();
    
    log('Insertion result:');
    log(JSON.stringify(result, null, 2));
    
    // Query to verify the event was actually created
    const count = await db.select({ count: db.fn.count() }).from(schema.events);
    log(`Event count in database: ${count[0].count}`);
    
    // Clean up connection
    await client.end();
    log('Test completed successfully');
    
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

main();