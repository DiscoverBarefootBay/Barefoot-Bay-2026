import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  communitySlugToPublicUrl,
  listingIdToPublicUrl,
  escapeXml,
  toIsoDate,
  renderRobotsTxt,
  resolveRobotsSiteUrl,
  recordCollectorCount,
  __resetSitemapBaselineForTests,
} from '../routes/sitemap';
import { dbSlugToPublicUrl } from '../shared-compat/vendor-url-utils';
import logger from '../logger';

describe('dbSlugToPublicUrl (vendor slug mapping)', () => {
  it('maps a simple vendor slug to /vendors/category/name', () => {
    assert.equal(
      dbSlugToPublicUrl('vendors-landscaping-acme-lawn'),
      '/vendors/landscaping/acme-lawn',
    );
  });

  it('handles compound categories like home-services', () => {
    assert.equal(
      dbSlugToPublicUrl('vendors-home-services-bobs-handyman'),
      '/vendors/home-services/bobs-handyman',
    );
  });

  it('handles compound categories like hvac-and-air-quality', () => {
    assert.equal(
      dbSlugToPublicUrl('vendors-hvac-and-air-quality-cool-breeze'),
      '/vendors/hvac-and-air-quality/cool-breeze',
    );
  });

  it('returns the slug unchanged when it is not a vendor slug', () => {
    assert.equal(dbSlugToPublicUrl('community-faq'), 'community-faq');
  });
});

describe('communitySlugToPublicUrl', () => {
  it('maps <category>-<page> to /community/<category>/<page>', () => {
    assert.equal(communitySlugToPublicUrl('amenities-pool'), '/community/amenities/pool');
  });

  it('keeps multi-hyphen page portion intact', () => {
    assert.equal(
      communitySlugToPublicUrl('government-board-of-trustees'),
      '/community/government/board-of-trustees',
    );
  });

  it('returns null for slugs without a hyphen', () => {
    assert.equal(communitySlugToPublicUrl('about'), null);
  });

  it('returns null for slugs containing a fragment marker', () => {
    assert.equal(communitySlugToPublicUrl('amenities-pool#hours'), null);
  });

  it('returns null for empty input', () => {
    assert.equal(communitySlugToPublicUrl(''), null);
  });

  it('returns null when leading hyphen leaves an empty category', () => {
    assert.equal(communitySlugToPublicUrl('-page'), null);
  });
});

describe('listingIdToPublicUrl', () => {
  it('maps Classified listings to /for-sale/:id', () => {
    assert.equal(listingIdToPublicUrl(42, 'Classified'), '/for-sale/42');
  });

  it('maps non-Classified listings to /real-estate/:id', () => {
    assert.equal(listingIdToPublicUrl(7, 'OpenHouse'), '/real-estate/7');
    assert.equal(listingIdToPublicUrl(8, 'FSBO'), '/real-estate/8');
    assert.equal(listingIdToPublicUrl(9, 'Agent'), '/real-estate/9');
  });

  it('treats null/undefined listing type as non-Classified', () => {
    assert.equal(listingIdToPublicUrl(1, null), '/real-estate/1');
    assert.equal(listingIdToPublicUrl(2, undefined), '/real-estate/2');
  });
});

describe('escapeXml', () => {
  it('escapes ampersands, angle brackets, and quotes', () => {
    assert.equal(
      escapeXml(`a & b < c > d "e" 'f'`),
      'a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;',
    );
  });

  it('escapes ampersands before other entities to avoid double-encoding', () => {
    assert.equal(escapeXml('&lt;'), '&amp;lt;');
  });

  it('returns an empty string unchanged', () => {
    assert.equal(escapeXml(''), '');
  });
});

describe('resolveRobotsSiteUrl', () => {
  const originalEnv = process.env.PUBLIC_SITE_URL;
  const makeReq = (host: string | undefined, protocol = 'https') => ({
    protocol,
    get: (name: string) => (name.toLowerCase() === 'host' ? host : undefined),
  });

  it('always uses the request host, even when PUBLIC_SITE_URL is set', () => {
    process.env.PUBLIC_SITE_URL = 'https://barefootbay.com';
    try {
      assert.equal(
        resolveRobotsSiteUrl(makeReq('preview.replit.dev', 'https')),
        'https://preview.replit.dev',
      );
    } finally {
      if (originalEnv === undefined) delete process.env.PUBLIC_SITE_URL;
      else process.env.PUBLIC_SITE_URL = originalEnv;
    }
  });

  it('uses the request host and protocol when PUBLIC_SITE_URL is unset', () => {
    delete process.env.PUBLIC_SITE_URL;
    try {
      assert.equal(
        resolveRobotsSiteUrl(makeReq('preview.replit.dev', 'https')),
        'https://preview.replit.dev',
      );
      assert.equal(
        resolveRobotsSiteUrl(makeReq('localhost:8080', 'http')),
        'http://localhost:8080',
      );
    } finally {
      if (originalEnv !== undefined) process.env.PUBLIC_SITE_URL = originalEnv;
    }
  });

  it('falls back to PUBLIC_SITE_URL when no host header is available', () => {
    process.env.PUBLIC_SITE_URL = 'https://staging.barefootbay.com/';
    try {
      assert.equal(
        resolveRobotsSiteUrl(makeReq(undefined)),
        'https://staging.barefootbay.com',
      );
    } finally {
      if (originalEnv === undefined) delete process.env.PUBLIC_SITE_URL;
      else process.env.PUBLIC_SITE_URL = originalEnv;
    }
  });

  it('falls back to the canonical barefootbay.com URL when neither host nor env are set', () => {
    delete process.env.PUBLIC_SITE_URL;
    try {
      assert.equal(resolveRobotsSiteUrl(makeReq(undefined)), 'https://barefootbay.com');
    } finally {
      if (originalEnv !== undefined) process.env.PUBLIC_SITE_URL = originalEnv;
    }
  });
});

describe('renderRobotsTxt', () => {
  it('emits a Sitemap line pointing at the resolved host', () => {
    const body = renderRobotsTxt('https://example.com');
    assert.match(body, /^User-agent: \*/);
    assert.ok(body.includes('Sitemap: https://example.com/sitemap.xml'));
  });

  it('strips a trailing slash from the site URL before appending /sitemap.xml', () => {
    const body = renderRobotsTxt('https://example.com/');
    assert.ok(body.includes('Sitemap: https://example.com/sitemap.xml'));
    assert.ok(!body.includes('//sitemap.xml'));
  });

  it('preserves the legacy Disallow list', () => {
    const body = renderRobotsTxt('https://example.com');
    for (const path of ['/admin', '/api/', '/auth', '/messages', '/store/pay/']) {
      assert.ok(body.includes(`Disallow: ${path}`), `expected Disallow: ${path}`);
    }
  });
});

describe('recordCollectorCount (zero-collector alerting)', () => {
  const originalWarn = logger.warn.bind(logger);
  let warnings: string[] = [];

  beforeEach(() => {
    __resetSitemapBaselineForTests();
    warnings = [];
    logger.warn = (message: string, ..._args: any[]) => {
      warnings.push(message);
    };
  });

  afterEach(() => {
    logger.warn = originalWarn;
    __resetSitemapBaselineForTests();
  });

  it('does not warn when a collector has never returned entries (first boot, empty DB)', () => {
    recordCollectorCount('events', 0);
    assert.equal(warnings.length, 0);
  });

  it('does not warn when a collector returns its usual non-zero count', () => {
    recordCollectorCount('listings', 42);
    recordCollectorCount('listings', 41);
    recordCollectorCount('listings', 50);
    assert.equal(warnings.length, 0);
  });

  it('warns when a collector drops from >0 to 0', () => {
    recordCollectorCount('forum', 10);
    recordCollectorCount('forum', 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /collector "forum" returned 0 entries/);
    assert.match(warnings[0], /high-water mark: 10/);
  });

  it('does not repeat the warning while the zero streak continues', () => {
    recordCollectorCount('pageContents', 5);
    recordCollectorCount('pageContents', 0);
    recordCollectorCount('pageContents', 0);
    recordCollectorCount('pageContents', 0);
    assert.equal(warnings.length, 1);
  });

  it('warns again if the collector recovers and then drops to 0 a second time', () => {
    recordCollectorCount('events', 7);
    recordCollectorCount('events', 0);
    assert.equal(warnings.length, 1);
    recordCollectorCount('events', 9);
    recordCollectorCount('events', 0);
    assert.equal(warnings.length, 2);
  });

  it('tracks each collector independently', () => {
    recordCollectorCount('events', 3);
    recordCollectorCount('listings', 4);
    recordCollectorCount('events', 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /collector "events"/);
    recordCollectorCount('listings', 0);
    assert.equal(warnings.length, 2);
    assert.match(warnings[1], /collector "listings"/);
  });

  it('remembers the largest count ever seen as the high-water mark', () => {
    recordCollectorCount('forum', 100);
    recordCollectorCount('forum', 25);
    recordCollectorCount('forum', 0);
    assert.match(warnings[0], /high-water mark: 100/);
  });

  it('alerts on a pageContents drop to 0 — the dynamic-vs-static masking case', () => {
    // The "pages" sitemap section bundles static URLs with the dynamic
    // collectPageContents result. The static URLs would mask a dynamic
    // regression (vendors / community pages disappearing) if we only watched
    // the section-level total, so the guard tracks the dynamic collector
    // independently and must fire even when the wrapping section is non-zero.
    recordCollectorCount('pageContents', 120);
    recordCollectorCount('pageContents', 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /collector "pageContents" returned 0 entries/);
    assert.match(warnings[0], /high-water mark: 120/);
  });
});

describe('toIsoDate (lastmod formatting)', () => {
  it('formats Date instances as ISO 8601', () => {
    const d = new Date(Date.UTC(2025, 0, 15, 12, 30, 45));
    assert.equal(toIsoDate(d), '2025-01-15T12:30:45.000Z');
  });

  it('parses ISO date strings', () => {
    assert.equal(toIsoDate('2025-06-01T00:00:00Z'), '2025-06-01T00:00:00.000Z');
  });

  it('returns undefined for null/undefined/empty', () => {
    assert.equal(toIsoDate(null), undefined);
    assert.equal(toIsoDate(undefined), undefined);
    assert.equal(toIsoDate(''), undefined);
  });

  it('returns undefined for unparseable values', () => {
    assert.equal(toIsoDate('not-a-date'), undefined);
  });
});
