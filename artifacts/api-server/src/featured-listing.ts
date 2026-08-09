/**
 * Featured Listing credit upgrade — pure, testable helpers.
 *
 * A seller spends credits to upgrade an ACTIVE listing to "Featured":
 * priority placement on the On The Market page and a Featured Listings
 * section at the top of the weekly email. Featured status follows the
 * listing's own expiration — there is no separate featured timer, and
 * publishing/republishing resets the flag.
 */

/** Flat credit price of a Featured upgrade (owner-adjustable via env). */
export const DEFAULT_FEATURED_LISTING_CREDIT_COST = 5;

/**
 * Credit cost of a Featured upgrade. Server-configurable through the
 * FEATURED_LISTING_CREDIT_COST environment variable (positive integer);
 * anything unset/invalid falls back to the default.
 */
export function getFeaturedListingCreditCost(env: Record<string, string | undefined> = process.env): number {
  // Same bounds as admin-set prices: whole credits within [floor, ceiling].
  // An out-of-range env override must not bypass the pricing ceiling.
  const n = parseFeaturedListingCreditCost(env.FEATURED_LISTING_CREDIT_COST);
  return n ?? DEFAULT_FEATURED_LISTING_CREDIT_COST;
}

/** Admin-set prices may never go below this floor. */
export const MIN_FEATURED_LISTING_CREDIT_COST = 1;

/** Sanity ceiling — keeps admin typos and unsafe numbers out of pricing. */
export const MAX_FEATURED_LISTING_CREDIT_COST = 1000000;

/** Site-settings key holding the admin-configured Featured price. */
export const FEATURED_LISTING_COST_SETTING_KEY = 'featured_listing_credit_cost';

/**
 * Parse an admin-supplied Featured price. Returns the price when it is a
 * safe whole number within [floor, ceiling], otherwise null.
 */
export function parseFeaturedListingCreditCost(raw: unknown): number | null {
  // Only accept numbers or numeric strings; Number(true) === 1 would
  // otherwise slip through now that the floor is 1 credit.
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) &&
    n >= MIN_FEATURED_LISTING_CREDIT_COST &&
    n <= MAX_FEATURED_LISTING_CREDIT_COST
    ? n
    : null;
}

/**
 * The effective Featured price: the admin-configured site setting when valid,
 * otherwise the env/default fallback. Read errors fall back too — pricing
 * must never take the feature down.
 */
export async function resolveFeaturedListingCreditCost(
  getSettingValue: (key: string) => Promise<string | null>,
): Promise<number> {
  try {
    const stored = parseFeaturedListingCreditCost(await getSettingValue(FEATURED_LISTING_COST_SETTING_KEY));
    if (stored !== null) return stored;
  } catch (error) {
    console.error('[FeaturedListing] Failed to read configured credit cost, using default:', error);
  }
  return getFeaturedListingCreditCost();
}

export interface FeatureUpgradeListing {
  id: number;
  status: string;
  featured?: boolean | null;
  expirationDate?: Date | string | null;
  createdBy?: number | null;
}

export type FeatureUpgradeRejection =
  | { code: 'not_found'; httpStatus: 404; message: string }
  | { code: 'forbidden'; httpStatus: 403; message: string }
  | { code: 'not_active'; httpStatus: 400; message: string }
  | { code: 'expired'; httpStatus: 400; message: string }
  | { code: 'already_featured'; httpStatus: 400; message: string };

/**
 * Validate that `listing` may be upgraded to Featured by `userId`.
 * Returns null when the upgrade is allowed, or a rejection describing why not.
 * Admins may feature any listing; sellers only their own. Only ACTIVE,
 * non-expired, not-yet-featured listings qualify.
 */
export function validateFeatureUpgrade(
  listing: FeatureUpgradeListing | null | undefined,
  userId: number,
  isAdmin: boolean,
  now: Date = new Date(),
): FeatureUpgradeRejection | null {
  if (!listing) {
    return { code: 'not_found', httpStatus: 404, message: 'Listing not found' };
  }
  if (listing.createdBy !== userId && !isAdmin) {
    return { code: 'forbidden', httpStatus: 403, message: 'You do not have permission to feature this listing' };
  }
  if (listing.status !== 'ACTIVE') {
    return { code: 'not_active', httpStatus: 400, message: 'Only active listings can be featured' };
  }
  if (listing.expirationDate && new Date(listing.expirationDate).getTime() <= now.getTime()) {
    return { code: 'expired', httpStatus: 400, message: 'This listing has expired and can no longer be featured' };
  }
  if (listing.featured) {
    return { code: 'already_featured', httpStatus: 400, message: 'This listing is already featured' };
  }
  return null;
}
