import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import logger from "./logger";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure PostgreSQL connection pool with production optimizations
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  // Production-optimized settings
  max: 20,                        // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,       // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000,  // Return an error after 5 seconds if connection not established
  allowExitOnIdle: false          // Don't allow the app to exit if pool is idle
};

logger.info(`PostgreSQL connection pool optimized for ${process.env.NODE_ENV || 'development'} with settings:`, poolConfig);

export const pool = new Pool(poolConfig);
export const db = drizzle({ client: pool, schema });

// Log successful database connection
pool.on('connect', () => {
  logger.info('✅ Database connected successfully');
});

// Log connection errors
pool.on('error', (err) => {
  logger.error('❌ Database connection error:', err);
});