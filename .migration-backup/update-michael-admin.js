
/**
 * Script to update user michael to admin role
 */

import { Client } from 'pg';

const ADMIN_USERNAME = 'michael';

async function main() {
  try {
    // Connect to the database
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    console.log('Connected to database');

    // Check current user role
    const result = await client.query(
      'SELECT id, username, role FROM users WHERE username = $1',
      [ADMIN_USERNAME]
    );

    if (result.rows.length === 0) {
      console.log(`User "${ADMIN_USERNAME}" not found`);
      return;
    }

    const user = result.rows[0];
    console.log(`Current user "${ADMIN_USERNAME}" (${user.id}) has role: ${user.role}`);

    if (user.role !== 'admin') {
      console.log(`Updating user "${ADMIN_USERNAME}" to admin role`);
      
      await client.query(
        'UPDATE users SET role = $1, updated_at = NOW() WHERE username = $2',
        ['admin', ADMIN_USERNAME]
      );
      
      console.log(`✓ Successfully updated user "${ADMIN_USERNAME}" to admin role`);
    } else {
      console.log(`✓ User "${ADMIN_USERNAME}" already has admin role`);
    }

    // Close database connection
    await client.end();
    console.log('Finished updating user role');
  } catch (error) {
    console.error('Error updating user role:', error);
    process.exit(1);
  }
}

main();
