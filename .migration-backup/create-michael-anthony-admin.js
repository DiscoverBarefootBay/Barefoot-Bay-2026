/**
 * Create MichaelAnthony admin account
 * This script creates the missing admin account that the user is trying to access
 */

import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import pkg from 'pg';
const { Pool } = pkg;

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function createMichaelAnthonyAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Creating MichaelAnthony admin account...');
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, username FROM users WHERE username ILIKE $1',
      ['MichaelAnthony']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('User MichaelAnthony already exists with ID:', existingUser.rows[0].id);
      return;
    }
    
    // Generate secure password hash
    const securePassword = 'TempPassword123!'; // User will reset this via password reset
    const hashedPassword = await hashPassword(securePassword);
    
    // Create the admin user
    const result = await pool.query(`
      INSERT INTO users (
        username, 
        password, 
        email, 
        full_name, 
        role, 
        is_approved, 
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, username, email, role
    `, [
      'MichaelAnthony',
      hashedPassword,
      'michaelanthonygodoy@gmail.com', // Using the email from the password reset attempt
      'Michael Anthony',
      'admin',
      true
    ]);
    
    console.log('Successfully created MichaelAnthony admin account:');
    console.log('- ID:', result.rows[0].id);
    console.log('- Username:', result.rows[0].username);
    console.log('- Email:', result.rows[0].email);
    console.log('- Role:', result.rows[0].role);
    console.log('- Temporary Password:', securePassword);
    console.log('\nThe user can now:');
    console.log('1. Login with username: MichaelAnthony and password: TempPassword123!');
    console.log('2. Or use password reset with email: michaelanthonygodoy@gmail.com');
    
  } catch (error) {
    console.error('Error creating MichaelAnthony admin account:', error);
  } finally {
    await pool.end();
  }
}

createMichaelAnthonyAdmin();