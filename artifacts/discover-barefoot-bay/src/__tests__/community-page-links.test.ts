import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  communityPageMatchesCategory,
  communityPageName,
  communityPageHref,
} from '../components/community/community-page-links';

/** Mirror of GenericContentPage's slug derivation for /community/<a>/<b> URLs */
function deriveSlugFromHref(href: string): string | null {
  const parts = href.split('/').filter(Boolean);
  if (parts[0] !== 'community' || parts.length < 3) return null;
  return `${parts[1]}-${parts[2]}`;
}

test('matches pages by slug prefix (no explicit category)', () => {
  assert.ok(communityPageMatchesCategory({ slug: 'government-bbrd' }, 'government'));
  assert.ok(!communityPageMatchesCategory({ slug: 'services-hospitals' }, 'government'));
  // The category's own page is excluded
  assert.ok(!communityPageMatchesCategory({ slug: 'government' }, 'government'));
});

test('explicit category field takes precedence over slug prefix', () => {
  // Included despite non-matching slug prefix
  assert.ok(
    communityPageMatchesCategory({ slug: 'local-food-pantry', category: 'services' }, 'services'),
  );
  // Excluded despite matching slug prefix
  assert.ok(
    !communityPageMatchesCategory({ slug: 'services-hospitals', category: 'government' }, 'services'),
  );
});

test('handles null/undefined pages safely', () => {
  assert.ok(!communityPageMatchesCategory(null, 'services'));
  assert.ok(!communityPageMatchesCategory({ slug: '' }, 'services'));
});

test('page name strips the category prefix when present', () => {
  assert.equal(communityPageName('government-bbrd', 'government'), 'bbrd');
  assert.equal(communityPageName('local-food-pantry', 'services'), 'local-food-pantry');
});

test('prefixed slugs produce canonical hrefs that round-trip', () => {
  const href = communityPageHref('government-fees-and-passes', 'government');
  assert.equal(href, '/community/government/fees-and-passes');
  assert.equal(deriveSlugFromHref(href), 'government-fees-and-passes');
});

test('explicit-category non-prefixed slugs still round-trip to the real slug', () => {
  const href = communityPageHref('local-food-pantry', 'services');
  assert.equal(href, '/community/local/food-pantry');
  assert.equal(deriveSlugFromHref(href), 'local-food-pantry');
});

test('every real category segment round-trips its prefixed pages', () => {
  for (const slug of [
    'advertise-platinum-sponsor-packages-limited-availability',
    'map-map-of-baredoot-bay',
    'social-aa-meeting',
    'annual-christmas-golf-cart-parade',
  ]) {
    const category = slug.split('-')[0];
    assert.equal(deriveSlugFromHref(communityPageHref(slug, category)), slug);
  }
});
