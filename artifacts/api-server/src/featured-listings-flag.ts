/**
 * "Featured listings" kill switch for the On The Market marketplace.
 *
 * Backed by the shared feature_flags table (name: 'featured_listings') so
 * admins can toggle it from the admin UI. When OFF:
 *  - the feature-granting endpoints (credit upgrade + admin comp) reject,
 *  - the weekly "On The Market" email treats every listing as non-featured
 *    (no Featured Listings section, no gold highlight),
 *  - the frontend hides gold outlines, ★ Featured badges, and upgrade CTAs.
 *
 * The flag is treated as a GLOBAL switch: only isActive matters, roles are
 * ignored. Absent flag == enabled (fail open so a missed seed can't silently
 * disable a paid feature).
 */
import { storage } from './storage';
import { logger } from './lib/logger';

export const FEATURED_LISTINGS_FLAG = 'featured_listings';

/** True unless the featured_listings flag exists and is switched off. */
export async function isFeaturedListingsEnabled(): Promise<boolean> {
  try {
    const flags = await storage.getFeatureFlags();
    const flag = flags.find((f) => f.name === FEATURED_LISTINGS_FLAG);
    return flag ? Boolean(flag.isActive) : true;
  } catch (err) {
    logger.error({ err }, '[FeaturedListings] Failed to read feature flag — defaulting to enabled');
    return true;
  }
}

/**
 * Ensure the flag row exists so the admin toggle has something to PATCH.
 * Idempotent; called once at boot. Seeds ON with all roles (the flag is a
 * global switch, but roles are populated so the generic flag manager UI
 * renders it sensibly).
 */
export async function ensureFeaturedListingsFlag(): Promise<void> {
  try {
    const flags = await storage.getFeatureFlags();
    if (flags.some((f) => f.name === FEATURED_LISTINGS_FLAG)) return;
    await storage.createFeatureFlag({
      name: FEATURED_LISTINGS_FLAG,
      displayName: 'Featured Listings',
      enabledForRoles: ['guest', 'registered', 'badge_holder', 'paid', 'moderator', 'admin'],
      description:
        'On The Market featured-listing upgrades: gold highlights, ★ Featured badges, upgrade buttons, and the Featured Listings email section. Turning this off hides all of it for everyone.',
      isActive: true,
    } as Parameters<typeof storage.createFeatureFlag>[0]);
    logger.info('[FeaturedListings] Seeded featured_listings feature flag (enabled)');
  } catch (err) {
    logger.error({ err }, '[FeaturedListings] Failed to seed feature flag');
  }
}
