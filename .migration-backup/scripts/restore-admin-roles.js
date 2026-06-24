/**
 * Helper script to restore admin role privileges for users
 * 
 * This script can be run manually if an admin user's role gets changed
 * incorrectly after a subscription cancellation.
 * 
 * Usage:
 * node scripts/restore-admin-roles.js
 */

const { Client } = require('pg');

// List of admin usernames that should always have admin role
const ADMIN_USERNAMES = ['michael'];

async function main() {
  try {
    // Connect to the database
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    console.log('Connected to database');

    // Find users with incorrect roles
    for (const username of ADMIN_USERNAMES) {
      const result = await client.query(
        'SELECT id, username, role FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        console.log(`User "${username}" not found`);
        continue;
      }

      const user = result.rows[0];
      console.log(`Checking admin privileges for user "${username}" (${user.id})`);

      if (user.role !== 'admin') {
        console.log(`Restoring admin role for user "${username}" (${user.id}), currently has role: ${user.role}`);
        
        await client.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['admin', user.id]
        );
        
        console.log(`✓ Successfully restored admin role for user "${username}" (${user.id})`);
      } else {
        console.log(`✓ User "${username}" already has admin role`);
      }
    }

    // Close database connection
    await client.end();
    console.log('Finished updating admin roles');
  } catch (error) {
    console.error('Error updating admin roles:', error);
    process.exit(1);
  }
}

main();