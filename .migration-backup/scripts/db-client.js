/**
 * Simple database client for scripts
 * Creates a connection to the PostgreSQL database using the DATABASE_URL
 * from the .env file or environment variables
 */
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize dotenv
dotenv.config();

// Get current file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file if it exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('Loading environment from .env file');
  dotenv.config({ path: envPath });
}

// Create a new PostgreSQL client
const { Pool } = pg;

// Get database connection string from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL not set in environment or .env file');
  process.exit(1);
}

// Create the database pool
const pool = new Pool({
  connectionString: databaseUrl,
  // Add SSL options if needed (for production)
  // ssl: {
  //   rejectUnauthorized: false
  // }
});

/**
 * Simple database client with basic query functionality
 */
export const db = {
  /**
   * Execute a SQL query
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  query: async (text, params) => {
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`Executed query in ${duration}ms: ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}`);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  end: async () => {
    try {
      await pool.end();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
      throw error;
    }
  }
};

export default db;