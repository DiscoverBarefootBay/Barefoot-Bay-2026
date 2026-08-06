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
  const n = Number(env.FEATURED_LISTING_CREDIT_COST);
  return Number.isInteger(n) && n >= 1 ? n : DEFAULT_FEATURED_LISTING_CREDIT_COST;
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
