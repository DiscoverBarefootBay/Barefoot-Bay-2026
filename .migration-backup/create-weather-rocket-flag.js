/**
 * This script creates the weather_rocket_icons feature flag in the database
 * It directly executes SQL to add the feature flag
 */
import pg from 'pg';
const { Pool } = pg;

async function createWeatherRocketFlag() {
  // Create PostgreSQL connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log("Checking if weather_rocket_icons flag already exists...");
    
    // Check if the flag already exists
    const checkResult = await pool.query(
      "SELECT * FROM feature_flags WHERE name = 'weather_rocket_icons'"
    );
    
    if (checkResult.rows.length > 0) {
      console.log("Feature flag already exists:", checkResult.rows[0]);
      return checkResult.rows[0];
    }
    
    // Create the new feature flag with all roles enabled by default
    const newFlag = {
      name: 'weather_rocket_icons',
      display_name: 'Weather & Rocket Icons',
      enabled_for_roles: ['guest', 'registered', 'badge_holder', 'paid', 'moderator', 'admin'],
      description: 'Show weather temperature and rocket icon in the navigation bar',
      is_active: true
    };
    
    console.log("Creating new feature flag:", newFlag);
    
    const result = await pool.query(
      `INSERT INTO feature_flags 
       (name, display_name, enabled_for_roles, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [
        newFlag.name,
        newFlag.display_name,
        newFlag.enabled_for_roles,
        newFlag.description,
        newFlag.is_active
      ]
    );
    
    console.log("Feature flag created successfully:", result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error("Error creating weather_rocket_icons feature flag:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Self-invoking async function to run the script
(async () => {
  try {
    await createWeatherRocketFlag();
    console.log("Operation completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
})();