/**
 * Script to test case insensitive email search in database
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './shared/schema.ts';
import { sql } from 'drizzle-orm';

// Initialize database client
const connectionString = process.env.DATABASE_URL;
const queryClient = postgres(connectionString);
const db = drizzle(queryClient);

// Function to search for users with case-insensitive email match
async function findUserCaseInsensitive(email) {
  console.log(`Looking for user with email (case insensitive): ${email}`);

  try {
    // Use ILIKE for case-insensitive search
    const result = await db.select().from(users).where(
      sql`LOWER(${users.email}) = LOWER(${email})`
    );
    
    console.log(`Found ${result.length} matching users`);
    
    if (result.length > 0) {
      result.forEach((user, index) => {
        console.log(`User ${index + 1}:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Username: ${user.username}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Registered: ${user.createdAt}`);
        console.log('---');
      });
    } else {
      console.log('No users found with this email (case insensitive)');
    }
  } catch (error) {
    console.error('Error searching for user:', error);
  }
}

// Get email from command line or use default
const email = process.argv[2] || 'mag092503@gmail.com';

// Run the case-insensitive search
findUserCaseInsensitive(email)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });