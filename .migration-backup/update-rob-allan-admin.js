
/**
 * Script to update user Rob Allan to admin role
 */

import { Client } from 'pg';

const TARGET_USER = 'Rob Allan';

async function main() {
  try {
    // Connect to the database
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    console.log('Connected to database');

    // Try to find Rob Allan by various username patterns
    const usernamePatterns = ['RobAllan', 'Rob Allan', 'roballan', 'rob.allan', 'robAllan', 'Rob_Allan'];
    
    let user = null;
    
    for (const pattern of usernamePatterns) {
      console.log(`Searching for user with username pattern: ${pattern}`);
      const result = await client.query(
        'SELECT id, username, "fullName", role FROM users WHERE LOWER(username) = LOWER($1)',
        [pattern]
      );
      
      if (result.rows.length > 0) {
        user = result.rows[0];
        console.log(`Found user by username: ${user.username} (${user.id})`);
        break;
      }
    }
    
    // If not found by username, try by full name
    if (!user) {
      console.log('Searching by full name containing "Rob" and "Allan"');
      const result = await client.query(
        `SELECT id, username, "fullName", role FROM users 
         WHERE LOWER("fullName") LIKE LOWER('%rob%allan%') 
         OR LOWER("fullName") LIKE LOWER('%allan%rob%')`
      );
      
      if (result.rows.length > 0) {
        user = result.rows[0];
        console.log(`Found user by full name: ${user.fullName} (username: ${user.username}, id: ${user.id})`);
      }
    }

    if (!user) {
      console.log(`User "${TARGET_USER}" not found with any common patterns`);
      
      // Show all users for reference
      console.log('\nAll users in the system:');
      const allUsers = await client.query('SELECT id, username, "fullName", role FROM users ORDER BY id');
      allUsers.rows.forEach(u => {
        console.log(`- ID: ${u.id}, Username: ${u.username}, Full Name: ${u.fullName}, Role: ${u.role}`);
      });
      
      return;
    }

    console.log(`Current user "${user.username}" (${user.id}) has role: ${user.role}`);

    if (user.role !== 'admin') {
      console.log(`Updating user "${user.username}" to admin role`);
      
      await client.query(
        'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
        ['admin', user.id]
      );
      
      console.log(`✅ Successfully updated user "${user.username}" (${user.fullName}) to admin role`);
    } else {
      console.log(`✅ User "${user.username}" already has admin role`);
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
