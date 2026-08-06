import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FEATURED_LISTING_CREDIT_COST,
  getFeaturedListingCreditCost,
  validateFeatureUpgrade,
} from '../featured-listing';

// ---------------------------------------------------------------------------
// Featured Listing credit upgrade: pricing config + who may feature what.
// The atomic no-double-charge behaviour lives in storage.claimFeaturedListing
// (UPDATE ... WHERE featured=false RETURNING) and is exercised at runtime.
// ---------------------------------------------------------------------------

describe('getFeaturedListingCreditCost', () => {
  it('defaults when the env var is unset or invalid', () => {
    assert.equal(getFeaturedListingCreditCost({}), DEFAULT_FEATURED_LISTING_CREDIT_COST);
    assert.equal(getFeaturedListingCreditCost({ FEATURED_LISTING_CREDIT_COST: 'abc' }), DEFAULT_FEATURED_LISTING_CREDIT_COST);
    assert.equal(getFeaturedListingCreditCost({ FEATURED_LISTING_CREDIT_COST: '0' }), DEFAULT_FEATURED_LISTING_CREDIT_COST);
    assert.equal(getFeaturedListingCreditCost({ FEATURED_LISTING_CREDIT_COST: '-3' }), DEFAULT_FEATURED_LISTING_CREDIT_COST);
    assert.equal(getFeaturedListingCreditCost({ FEATURED_LISTING_CREDIT_COST: '2.5' }), DEFAULT_FEATURED_LISTING_CREDIT_COST);
  });

  it('honors a valid positive integer override', () => {
    assert.equal(getFeaturedListingCreditCost({ FEATURED_LISTING_CREDIT_COST: '3' }), 3);
    assert.equal(getFeaturedListingCreditCost({ FEATURED_LISTING_CREDIT_COST: '10' }), 10);
  });
});

describe('validateFeatureUpgrade', () => {
  const NOW = new Date('2026-08-05T16:00:00Z');
  const base = {
    id: 1,
    status: 'ACTIVE',
    featured: false,
    expirationDate: new Date('2026-08-20T00:00:00Z'),
    createdBy: 7,
  };

  it('allows the owner to feature an active, unexpired, unfeatured listing', () => {
    assert.equal(validateFeatureUpgrade(base, 7, false, NOW), null);
  });

  it('allows an admin to feature any listing', () => {
    assert.equal(validateFeatureUpgrade(base, 99, true, NOW), null);
  });

  it('rejects a missing listing', () => {
    assert.equal(validateFeatureUpgrade(null, 7, false, NOW)?.code, 'not_found');
  });

  it('rejects a non-owner', () => {
    assert.equal(validateFeatureUpgrade(base, 8, false, NOW)?.code, 'forbidden');
  });

  it('rejects draft and expired-status listings', () => {
    assert.equal(validateFeatureUpgrade({ ...base, status: 'DRAFT' }, 7, false, NOW)?.code, 'not_active');
    assert.equal(validateFeatureUpgrade({ ...base, status: 'EXPIRED' }, 7, false, NOW)?.code, 'not_active');
  });

  it('rejects a listing past its expiration date even if still marked ACTIVE', () => {
    const stale = { ...base, expirationDate: new Date('2026-08-01T00:00:00Z') };
    assert.equal(validateFeatureUpgrade(stale, 7, false, NOW)?.code, 'expired');
  });

  it('rejects an already-featured listing', () => {
    assert.equal(validateFeatureUpgrade({ ...base, featured: true }, 7, false, NOW)?.code, 'already_featured');
  });
});
