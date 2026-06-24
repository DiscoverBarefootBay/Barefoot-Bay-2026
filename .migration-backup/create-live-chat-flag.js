/**
 * This script creates the live_chat feature flag in the database
 * It directly executes SQL to add the feature flag
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { featureFlags } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Get database connection
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function createLiveChatFlag() {
  try {
    console.log("Checking if live_chat feature flag exists...");
    
    // Check if the flag already exists
    const existingFlag = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.name, 'live_chat'))
      .limit(1);
    
    if (existingFlag.length > 0) {
      console.log("Live chat feature flag already exists:", existingFlag[0]);
      return existingFlag[0];
    }
    
    // Create the new feature flag with all roles enabled by default
    const newFlag = {
      name: 'live_chat',
      displayName: 'Live Chat Icon',
      enabledForRoles: ['guest', 'registered', 'badge_holder', 'paid', 'moderator', 'admin'],
      description: 'Show live chat icon in the navigation bar',
      isActive: true
    };
    
    console.log("Creating live_chat feature flag...");
    
    const result = await db
      .insert(featureFlags)
      .values(newFlag)
      .returning();
    
    console.log("Live chat feature flag created successfully:", result[0]);
    return result[0];
    
  } catch (error) {
    console.error("Error creating live_chat feature flag:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the function
createLiveChatFlag();