/**
 * Script to create the weather_rocket_icons feature flag in the database
 * This script adds the new feature flag to control the display of weather and rocket icons
 * in the navigation bar based on user roles
 */

import { db } from '../server/db.js';
import { featureFlags } from '../shared/schema.js';
import { UserRole, FeatureFlagName } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function createWeatherRocketFlag() {
  try {
    console.log("Checking if weather_rocket_icons flag already exists...");
    
    // Check if the flag already exists
    const existingFlag = await db.select().from(featureFlags)
      .where(eq(featureFlags.name, FeatureFlagName.WEATHER_ROCKET_ICONS));
    
    if (existingFlag.length > 0) {
      console.log("Feature flag already exists:", existingFlag[0]);
      return existingFlag[0];
    }
    
    // Create the new feature flag with all roles enabled by default
    const newFlag = {
      name: FeatureFlagName.WEATHER_ROCKET_ICONS,
      displayName: 'Weather & Rocket Icons',
      enabledForRoles: [
        UserRole.GUEST,
        UserRole.REGISTERED,
        UserRole.BADGE_HOLDER,
        UserRole.PAID,
        UserRole.MODERATOR,
        UserRole.ADMIN
      ],
      description: 'Show weather temperature and rocket icon in the navigation bar',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log("Creating new feature flag:", newFlag);
    
    const result = await db.insert(featureFlags).values(newFlag).returning();
    
    console.log("Feature flag created successfully:", result[0]);
    return result[0];
  } catch (error) {
    console.error("Error creating weather_rocket_icons feature flag:", error);
    throw error;
  }
}

// Self-invoking async function to run the script
(async () => {
  try {
    const flag = await createWeatherRocketFlag();
    console.log("Operation completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
})();