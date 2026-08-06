import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCampaignWeekRange,
  formatWeekRangeLabel,
  selectListingsForWeek,
  resolveWeeklyEmailRecipients,
  renderWeeklyListingsEmail,
  mergeWeeklyListingsEmailConfig,
  getDefaultWeeklyListingsEmailConfig,
  getDefaultWeeklyEmailTemplate,
  WEEKLY_EMAIL_PLACEHOLDERS,
  type WeekRange,
} from '../weekly-listings-email';
import {
  executeWeeklySend,
  runWeeklyListingsEmailTick,
  getNextScheduledSend,
  type WeeklySendDeps,
  type WeeklySchedulerDeps,
} from '../weekly-listings-scheduler';

// ---------------------------------------------------------------------------
// These tests lock the weekly "Currently, On The Market" campaign behaviour:
// the rolling 7-ET-day window a send covers, which listings and recipients
// qualify, the render contract (subject/heading format, unsubscribe link),
// and — crucially — the per-cycle idempotency: a campaign whose window
// overlaps an already-terminal one can never send twice, while a failed
// attempt may retry.
// ---------------------------------------------------------------------------

// --------------------------- week range ----------------------------------

describe('getCampaignWeekRange', () => {
  it('covers the rolling 7 ET days ending today', () => {
    // Wednesday July 29 2026, noon ET (16:00 UTC) → July 23–29 inclusive.
    const range = getCampaignWeekRange(new Date('2026-07-29T16:00:00Z'));
    assert.equal(range.weekStart, '2026-07-23');
    assert.equal(range.weekEnd, '2026-07-29');
    assert.equal(range.label, 'July 23\u201329, 2026');
  });

  it('a Saturday send covers the 7 days ending that Saturday', () => {
    // Saturday July 25 2026, 10:00 ET → July 19–25.
    const range = getCampaignWeekRange(new Date('2026-07-25T14:00:00Z'));
    assert.equal(range.weekStart, '2026-07-19');
    assert.equal(range.weekEnd, '2026-07-25');
    assert.equal(range.label, 'July 19\u201325, 2026');
  });

  it('respects the ET day boundary, not UTC', () => {
    // Monday July 27 2026 01:00 UTC is still Sunday July 26 in ET → Jul 20–26.
    const range = getCampaignWeekRange(new Date('2026-07-27T01:00:00Z'));
    assert.equal(range.weekStart, '2026-07-20');
    assert.equal(range.weekEnd, '2026-07-26');
  });

  it('handles a window containing the spring-forward DST transition', () => {
    // Monday March 9 2026, 09:00 ET (EDT, UTC-4) → Mar 3–9 contains the
    // spring-forward transition (Mar 8, 2:00 AM) and stays 7 calendar days.
    const range = getCampaignWeekRange(new Date('2026-03-09T13:00:00Z'));
    assert.equal(range.weekStart, '2026-03-03');
    assert.equal(range.weekEnd, '2026-03-09');
  });

  it('handles a fall-back DST window spanning a month boundary', () => {
    // Monday November 2 2026, 09:00 ET (EST, UTC-5) → Oct 27–Nov 2 contains
    // the fall-back transition and spans a month boundary.
    const range = getCampaignWeekRange(new Date('2026-11-02T14:00:00Z'));
    assert.equal(range.weekStart, '2026-10-27');
    assert.equal(range.weekEnd, '2026-11-02');
    assert.equal(range.label, 'October 27\u2013November 2, 2026');
  });

  it('handles a window spanning a year boundary', () => {
    // Friday January 1 2027, noon ET → Dec 26, 2026–Jan 1, 2027.
    const range = getCampaignWeekRange(new Date('2027-01-01T17:00:00Z'));
    assert.equal(range.weekStart, '2026-12-26');
    assert.equal(range.weekEnd, '2027-01-01');
    assert.equal(range.label, 'December 26, 2026\u2013January 1, 2027');
  });
});

describe('getNextScheduledSend', () => {
  const CFG = { enabled: true, sendDay: 1, sendTime: '09:00', sendWhenEmpty: false, template: getDefaultWeeklyEmailTemplate() };

  it('returns null when the automation is disabled', () => {
    assert.equal(getNextScheduledSend({ ...CFG, enabled: false }), null);
  });

  it('same day before the send time → today', () => {
    // Monday July 27 2026 08:00 ET
    const n = getNextScheduledSend(CFG, new Date('2026-07-27T12:00:00Z'));
    assert.equal(n?.dateEt, '2026-07-27');
    assert.ok(n?.label.includes('Monday, July 27, 2026 at 09:00 ET'));
  });

  it('same day at/after the send time → next week', () => {
    // Monday July 27 2026 09:00 ET exactly
    const n = getNextScheduledSend(CFG, new Date('2026-07-27T13:00:00Z'));
    assert.equal(n?.dateEt, '2026-08-03');
  });

  it('mid-week → the coming configured day', () => {
    // Wednesday July 29 2026
    const n = getNextScheduledSend(CFG, new Date('2026-07-29T16:00:00Z'));
    assert.equal(n?.dateEt, '2026-08-03');
    const fri = getNextScheduledSend({ ...CFG, sendDay: 5 }, new Date('2026-07-29T16:00:00Z'));
    assert.equal(fri?.dateEt, '2026-07-31');
  });
});

describe('formatWeekRangeLabel', () => {
  it('same-month week', () => {
    assert.equal(formatWeekRangeLabel('2026-07-20', '2026-07-26'), 'July 20\u201326, 2026');
  });
  it('cross-month week', () => {
    assert.equal(formatWeekRangeLabel('2026-11-30', '2026-12-06'), 'November 30\u2013December 6, 2026');
  });
  it('cross-year week', () => {
    assert.equal(formatWeekRangeLabel('2026-12-28', '2027-01-03'), 'December 28, 2026\u2013January 3, 2027');
  });
});

// --------------------------- listing selection ----------------------------

const RANGE: WeekRange = { weekStart: '2026-07-20', weekEnd: '2026-07-26', label: 'July 20–26, 2026' };
const NOW = new Date('2026-07-29T16:00:00Z');

function listing(overrides: any = {}): any {
  return {
    id: 1,
    title: 'Golf cart',
    price: 3500,
    listingType: 'Classified',
    description: 'Nice cart',
    photos: ['https://example.com/cart.jpg'],
    status: 'ACTIVE',
    createdAt: new Date('2026-07-22T15:00:00Z'), // Wed of campaign week
    expirationDate: null,
    ...overrides,
  };
}

describe('selectListingsForWeek', () => {
  it('includes ACTIVE listings created inside the campaign week, flagged isNew', () => {
    const out = selectListingsForWeek([listing()], RANGE, NOW);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, 1);
    assert.equal(out[0]!.photo, 'https://example.com/cart.jpg');
    assert.equal(out[0]!.isNew, true);
  });

  it('includes active listings created outside the week, flagged NOT new, sorted after new ones', () => {
    const out = selectListingsForWeek(
      [
        listing({ id: 2, createdAt: new Date('2026-05-19T15:00:00Z') }), // months ago, still active
        listing({ id: 3, createdAt: new Date('2026-07-22T15:00:00Z') }), // inside the week
      ],
      RANGE,
      NOW,
    );
    assert.deepEqual(out.map((l) => [l.id, l.isNew]), [[3, true], [2, false]]);
  });

  it('uses the ET calendar date for the isNew week boundary', () => {
    // 2026-07-27T02:00:00Z is still Sunday July 26 in ET → inside the week.
    const out = selectListingsForWeek(
      [listing({ id: 4, createdAt: new Date('2026-07-27T02:00:00Z') })],
      RANGE,
      NOW,
    );
    assert.equal(out.length, 1);
    assert.equal(out[0]!.isNew, true);
  });

  it('excludes non-ACTIVE and already-expired listings', () => {
    const out = selectListingsForWeek(
      [
        listing({ id: 5, status: 'DRAFT' }),
        listing({ id: 6, status: 'EXPIRED' }),
        listing({ id: 7, expirationDate: new Date('2026-07-25T00:00:00Z') }), // expired before NOW
      ],
      RANGE,
      NOW,
    );
    assert.equal(out.length, 0);
  });

  it('sorts newest first and drops seller contact info', () => {
    const out = selectListingsForWeek(
      [
        listing({ id: 8, createdAt: new Date('2026-07-21T12:00:00Z'), contactInfo: { phone: '555' } }),
        listing({ id: 9, createdAt: new Date('2026-07-24T12:00:00Z') }),
      ],
      RANGE,
      NOW,
    );
    assert.deepEqual(out.map((l) => l.id), [9, 8]);
    assert.ok(!('contactInfo' in out[0]!));
  });
});

// --------------------------- recipients -----------------------------------

function user(overrides: any = {}): any {
  return {
    email: 'a@example.com',
    isBlocked: false,
    emailNotificationsEnabled: true,
    marketingEmailsEnabled: true,
    ...overrides,
  };
}

describe('resolveWeeklyEmailRecipients', () => {
  it('includes opted-in users and dedupes by mailbox', () => {
    const out = resolveWeeklyEmailRecipients([
      user(),
      user({ email: 'A@Example.com' }), // same mailbox, different case
      user({ email: 'b@example.com' }),
    ]);
    assert.equal(out.length, 2);
  });

  it('excludes marketing opt-outs, unsubscribed, blocked, and invalid emails', () => {
    const out = resolveWeeklyEmailRecipients([
      user({ marketingEmailsEnabled: false }),
      user({ email: 'c@example.com', emailNotificationsEnabled: false }),
      user({ email: 'd@example.com', isBlocked: true }),
      user({ email: '' }),
      user({ email: 'not-an-email' }),
      user({ email: null }),
    ]);
    assert.equal(out.length, 0);
  });

  it('treats missing/null preference fields as opted in (legacy rows)', () => {
    const out = resolveWeeklyEmailRecipients([
      user({ marketingEmailsEnabled: null, emailNotificationsEnabled: null }),
    ]);
    assert.equal(out.length, 1);
  });
});

// --------------------------- rendering -------------------------------------

describe('renderWeeklyListingsEmail', () => {
  const listings = selectListingsForWeek([listing()], RANGE, NOW);

  it('subject and heading follow the required format', () => {
    const r = renderWeeklyListingsEmail(listings, RANGE, 'https://barefootbay.com');
    assert.equal(r.subject, `Currently, On The Market | ${RANGE.label}`);
    // Header shows the title with the week range beneath it (not the whole
    // subject as one heading).
    assert.ok(r.html.includes('>Currently, On The Market</h1>'));
    assert.ok(r.html.includes(`>${RANGE.label}</p>`));
    assert.ok(r.text.startsWith(`Currently, On The Market | ${RANGE.label}`));
  });

  it('uses the approved intro copy when listings exist', () => {
    const r = renderWeeklyListingsEmail(listings, RANGE, 'https://barefootbay.com');
    const intro = `Here&#39;s what&#39;s On The Market in Barefoot Bay this week (${RANGE.label}). Whether you&#39;re searching for a new home, a rental, a yard sale, an open house, or unique items from your neighbors, you&#39;ll find them here. Take a look at what&#39;s new this week.`;
    assert.ok(r.html.includes(intro));
    assert.ok(r.text.includes(`Here's what's On The Market in Barefoot Bay this week (${RANGE.label}).`));
  });

  it('closing block uses the approved copy with the Post a Listing button', () => {
    const r = renderWeeklyListingsEmail(listings, RANGE, 'https://barefootbay.com');
    assert.ok(r.html.includes('Have something to sell?'));
    assert.ok(r.html.includes('From homes and rentals to yard sales and everyday treasures, On The Market is Barefoot Bay&#39;s place to buy and sell.'));
    assert.ok(r.html.includes('Post a Listing'));
    assert.ok(r.html.includes('View All Listings'));
    assert.ok(r.text.includes('Have something to sell?'));
    assert.ok(r.text.includes("From homes and rentals to yard sales and everyday treasures, On The Market is Barefoot Bay's place to buy and sell."));
  });

  it('includes listing card, link, price, and unsubscribe in both parts', () => {
    const r = renderWeeklyListingsEmail(listings, RANGE, 'https://barefootbay.com');
    assert.ok(r.html.includes('Golf cart'));
    assert.ok(r.html.includes('https://barefootbay.com/for-sale/1'));
    assert.ok(r.html.includes('$3,500'));
    assert.ok(r.html.includes('/unsubscribe'));
    assert.ok(r.text.includes('Golf cart'));
    assert.ok(r.text.includes('https://barefootbay.com/for-sale/1'));
    assert.ok(r.text.includes('/unsubscribe'));
  });

  it('escapes HTML in listing content', () => {
    const evil = selectListingsForWeek(
      [listing({ title: '<script>alert(1)</script>' })],
      RANGE,
      NOW,
    );
    const r = renderWeeklyListingsEmail(evil, RANGE, 'https://barefootbay.com');
    assert.ok(!r.html.includes('<script>alert(1)</script>'));
    assert.ok(r.html.includes('&lt;script&gt;'));
  });

  it('renders a no-active-listings variant without listing cards', () => {
    const r = renderWeeklyListingsEmail([], RANGE, 'https://barefootbay.com');
    assert.ok(r.html.includes('no active listings'));
    assert.ok(!r.html.includes('View Listing<'));
  });

  it('converts relative photo paths to absolute URLs', () => {
    const rel = selectListingsForWeek(
      [listing({ photos: ['/api/storage-proxy/REAL_ESTATE/real-estate-media/photo.jpg'] })],
      RANGE,
      NOW,
    );
    const r = renderWeeklyListingsEmail(rel, RANGE, 'https://barefootbay.com');
    assert.ok(
      r.html.includes('src="https://barefootbay.com/api/storage-proxy/REAL_ESTATE/real-estate-media/photo.jpg"'),
    );
    assert.ok(!r.html.includes('src="/api/storage-proxy'));
  });

  it('leaves absolute photo URLs untouched', () => {
    const r = renderWeeklyListingsEmail(listings, RANGE, 'https://barefootbay.com');
    assert.ok(r.html.includes('src="https://example.com/cart.jpg"'));
  });

  it('groups listings under category headings in the fixed order, hiding empty categories', () => {
    const mixed = selectListingsForWeek(
      [
        listing({ id: 1, title: 'Cozy villa', listingType: 'FSBO' }),
        listing({ id: 2, title: 'Lakeside rental', listingType: 'Rent' }),
        listing({ id: 3, title: 'Golf cart classified', listingType: 'Classified' }),
        listing({ id: 4, title: 'Saturday sale', listingType: 'GarageSale' }),
      ],
      RANGE,
      NOW,
    );
    const r = renderWeeklyListingsEmail(mixed, RANGE, 'https://barefootbay.com');
    // Non-empty sections appear in the fixed order…
    const order = ['>Homes</h2>', '>Rentals</h2>', '>Yard Sales</h2>', '>Classifieds &amp; More</h2>']
      .map((h) => r.html.indexOf(h));
    assert.ok(order.every((i) => i >= 0), `missing a section: ${JSON.stringify(order)}`);
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    // …empty categories are hidden entirely.
    assert.ok(!r.html.includes('Open Houses'));
    assert.ok(!r.html.includes('Featured Listings'));
    // Legacy two-section headings are gone.
    assert.ok(!r.html.includes('New This Week'));
    assert.ok(!r.html.includes('>On The Market</h2>'));
    // Plain text mirrors the grouping.
    assert.ok(r.text.includes('\nHOMES\n'));
    assert.ok(r.text.includes('\nRENTALS\n'));
    assert.ok(r.text.includes('\nYARD SALES\n'));
    assert.ok(r.text.includes('\nCLASSIFIEDS & MORE\n'));
    assert.ok(!r.text.includes('OPEN HOUSES'));
  });

  it('maps every listing type to the right category, including agent homes, open houses, and wanted', () => {
    const mixed = selectListingsForWeek(
      [
        listing({ id: 1, title: 'Agent home', listingType: 'Agent' }),
        listing({ id: 2, title: 'Sunday open house', listingType: 'OpenHouse' }),
        listing({ id: 3, title: 'Looking for a kayak', listingType: 'Wanted' }),
      ],
      RANGE,
      NOW,
    );
    const r = renderWeeklyListingsEmail(mixed, RANGE, 'https://barefootbay.com');
    assert.ok(r.html.indexOf('>Homes</h2>') < r.html.indexOf('Agent home'));
    assert.ok(r.html.indexOf('>Open Houses</h2>') < r.html.indexOf('Sunday open house'));
    assert.ok(r.html.indexOf('>Classifieds &amp; More</h2>') < r.html.indexOf('Looking for a kayak'));
  });

  it('puts Classified listings with the Garage/Yard Sale category under Yard Sales', () => {
    const mixed = selectListingsForWeek(
      [
        listing({ id: 1, title: 'Driveway sale', listingType: 'Classified', category: 'Garage/Yard Sale' }),
        listing({ id: 2, title: 'Old lamp', listingType: 'Classified', category: 'Furniture' }),
      ],
      RANGE,
      NOW,
    );
    const r = renderWeeklyListingsEmail(mixed, RANGE, 'https://barefootbay.com');
    assert.ok(r.html.indexOf('>Yard Sales</h2>') < r.html.indexOf('Driveway sale'));
    assert.ok(r.html.indexOf('Driveway sale') < r.html.indexOf('>Classifieds &amp; More</h2>'));
    assert.ok(r.html.indexOf('>Classifieds &amp; More</h2>') < r.html.indexOf('Old lamp'));
  });

  it('shows a Featured Listings section first when featured listings exist', () => {
    const mixed = selectListingsForWeek(
      [
        listing({ id: 1, title: 'Premium villa', listingType: 'FSBO', featured: true }),
        listing({ id: 2, title: 'Regular villa', listingType: 'FSBO' }),
      ],
      RANGE,
      NOW,
    );
    const r = renderWeeklyListingsEmail(mixed, RANGE, 'https://barefootbay.com');
    // Featured listing appears ONLY in the Featured section (priority placement).
    assert.ok(r.html.indexOf('>Featured Listings</h2>') < r.html.indexOf('>Homes</h2>'));
    assert.ok(r.html.indexOf('Premium villa') < r.html.indexOf('>Homes</h2>'));
    assert.equal(r.html.split('Premium villa').length, 3); // title + img alt, once each
  });

  it('never renders a Featured section when no listing is featured', () => {
    // A storage row where the seller has not bought the Featured upgrade
    // (or a legacy row without the field at all) must never produce the section.
    const row = {
      id: 42,
      title: 'Plain FSBO home',
      price: 250000,
      listingType: 'FSBO',
      category: null,
      description: 'Nice place',
      photos: [],
      status: 'ACTIVE',
      createdAt: new Date('2026-07-22T15:00:00Z'),
      expirationDate: null,
      contactInfo: { phone: '555' },
    };
    const out = selectListingsForWeek([row as any], RANGE, NOW);
    assert.equal(out[0]!.featured, false);
    const r = renderWeeklyListingsEmail(out, RANGE, 'https://barefootbay.com');
    assert.ok(!r.html.includes('Featured Listings'));
    assert.ok(r.html.includes('>Homes</h2>'));
  });

  it('marks new-this-week listings with a NEW badge and sorts them first within their category', () => {
    const mixed = selectListingsForWeek(
      [
        listing({ id: 1, title: 'Fresh cart', listingType: 'Classified' }),
        listing({ id: 2, title: 'Older cart', listingType: 'Classified', createdAt: new Date('2026-05-05T15:00:00Z') }),
      ],
      RANGE,
      NOW,
    );
    const r = renderWeeklyListingsEmail(mixed, RANGE, 'https://barefootbay.com');
    assert.ok(r.html.includes('>NEW</span>'));
    assert.ok(r.html.indexOf('Fresh cart') < r.html.indexOf('Older cart'));
    assert.ok(r.text.includes('- [NEW] Fresh cart'));
    assert.ok(r.text.includes('- Older cart'));
  });

  it('keeps the no-new-listings intro when nothing new was posted', () => {
    const onlyOld = selectListingsForWeek(
      [listing({ id: 2, createdAt: new Date('2026-05-05T15:00:00Z') })],
      RANGE,
      NOW,
    );
    const r = renderWeeklyListingsEmail(onlyOld, RANGE, 'https://barefootbay.com');
    assert.ok(!r.html.includes('>NEW</span>'));
    assert.ok(r.html.includes('No new listings were posted this week'));
    assert.ok(r.html.includes('>Classifieds &amp; More</h2>'));
  });

  it('uses the brand gradient header', () => {
    const r = renderWeeklyListingsEmail(listings, RANGE, 'https://barefootbay.com');
    assert.ok(r.html.includes('linear-gradient(135deg, #90C9D4 0%, #6BB5C1 100%)'));
  });
});

// --------------------------- config merge -----------------------------------

describe('mergeWeeklyListingsEmailConfig', () => {
  it('defaults: disabled, Monday 09:00, skip empty weeks', () => {
    const d = getDefaultWeeklyListingsEmailConfig();
    assert.deepEqual(d, { enabled: false, sendDay: 1, sendTime: '09:00', sendWhenEmpty: false, template: getDefaultWeeklyEmailTemplate() });
  });

  it('rejects malformed values field-by-field', () => {
    const m = mergeWeeklyListingsEmailConfig({ enabled: 'yes', sendDay: 9, sendTime: '9am', sendWhenEmpty: true });
    assert.deepEqual(m, { enabled: false, sendDay: 1, sendTime: '09:00', sendWhenEmpty: true, template: getDefaultWeeklyEmailTemplate() });
  });

  it('advertises every supported placeholder token', () => {
    const tokens = WEEKLY_EMAIL_PLACEHOLDERS.map((p) => p.token);
    for (const t of ['{{weekRange}}', '{{intro}}', '{{listings}}', '{{listingCount}}', '{{forSaleUrl}}', '{{baseUrl}}', '{{subject}}']) {
      assert.ok(tokens.includes(t), `missing placeholder ${t}`);
    }
  });

  it('a stored copy of the OLD default template does not override the new default copy', () => {
    // Simulate an admin who "saved" the previous built-in template verbatim:
    // the legacy header heading and closing line must not survive the merge.
    const legacyHtml = getDefaultWeeklyEmailTemplate().html
      .replace(
        /<h1[^>]*>Currently, On The Market<\/h1>\s*<p[^>]*>\{\{weekRange\}\}<\/p>/,
        '<h1 style="margin:0;font-size:24px;line-height:32px;color:#ffffff;">{{subject}}</h1>',
      )
      .replace(
        /<p[^>]*>Have something to sell\?<\/p>\s*<p[^>]*>From homes and rentals[^<]*<\/p>/,
        '<p style="margin:24px 0 12px 0;font-size:15px;line-height:22px;">Have something to sell? Post it on On The Market today.</p>',
      );
    const m = mergeWeeklyListingsEmailConfig({ template: { subject: 'Currently, On The Market | {{weekRange}}', html: legacyHtml } });
    assert.equal(m.template.html, getDefaultWeeklyEmailTemplate().html);
  });

  it('accepts a custom template and falls back to defaults for empty fields', () => {
    const m = mergeWeeklyListingsEmailConfig({ template: { subject: 'Hi {{weekRange}}', html: '<p>{{listings}}</p>' } });
    assert.deepEqual(m.template, { subject: 'Hi {{weekRange}}', html: '<p>{{listings}}</p>' });
    const empty = mergeWeeklyListingsEmailConfig({ template: { subject: '', html: '   ' } });
    assert.deepEqual(empty.template, getDefaultWeeklyEmailTemplate());
    const junk = mergeWeeklyListingsEmailConfig({ template: 'nope' });
    assert.deepEqual(junk.template, getDefaultWeeklyEmailTemplate());
  });
});

// --------------------------- send execution ---------------------------------

interface FakeState {
  rows: Map<string, any>;
  nextId: number;
  sends: Array<{ to: string; subject: string }>;
  activity: Array<{ event: string; weekStart?: string | null; detail?: string | null }>;
  sendResult: boolean;
  failAddresses?: Set<string>;
}

function makeDeps(state: FakeState, opts: { listings?: any[]; users?: any[] } = {}): WeeklySendDeps {
  return {
    getListings: async () => opts.listings ?? [listing()],
    getUsers: async () => opts.users ?? [user(), user({ email: 'b@example.com' })],
    sendEmail: (async (o: any) => {
      state.sends.push({ to: o.to, subject: o.subject });
      if (state.failAddresses?.has(o.to)) return false;
      return state.sendResult;
    }) as any,
    claimWeeklySend: async (range, triggeredBy, triggeredByUser, scheduleKey) => {
      const existing = state.rows.get(range.weekStart);
      if (!existing) {
        const row = {
          id: state.nextId++,
          weekStart: range.weekStart,
          weekEnd: range.weekEnd,
          status: 'sending',
          triggeredBy,
          triggeredByUser: triggeredByUser ?? null,
          scheduleKey: scheduleKey ?? null,
          listingCount: 0,
          recipientCount: 0,
          sentCount: 0,
          error: null,
          sentAt: null,
        };
        state.rows.set(range.weekStart, row);
        return row as any;
      }
      if (existing.status === 'failed') {
        existing.status = 'sending';
        existing.triggeredBy = triggeredBy;
        existing.triggeredByUser = triggeredByUser ?? null;
        existing.scheduleKey = scheduleKey ?? null;
        return existing;
      }
      return null;
    },
    finalizeWeeklySend: async (id, update) => {
      for (const row of state.rows.values()) {
        if (row.id === id) Object.assign(row, update);
      }
    },
    getWeeklySendForWeek: async (weekStart) => state.rows.get(weekStart),
    getOverlappingBlockingSend: async (range, currentScheduleKey) => {
      // Mirrors the real implementation: terminal rows block only when their
      // scheduleKey is unknown (legacy NULL) or matches the current schedule;
      // "sending" rows always block.
      const BLOCKING = new Set(['sent', 'partially_failed', 'skipped_no_listings', 'sending']);
      for (const row of state.rows.values()) {
        if (
          BLOCKING.has(row.status) &&
          row.weekStart <= range.weekEnd &&
          row.weekEnd >= range.weekStart
        ) {
          if (
            !currentScheduleKey ||
            row.status === 'sending' ||
            row.scheduleKey == null ||
            row.scheduleKey === currentScheduleKey
          ) {
            return row;
          }
        }
      }
      return undefined;
    },
    logActivity: async (entry) => {
      state.activity.push(entry);
    },
    baseUrl: 'https://barefootbay.com',
  };
}

function freshState(sendResult = true): FakeState {
  return { rows: new Map(), nextId: 1, sends: [], activity: [], sendResult };
}

const CONFIG = { enabled: true, sendDay: 1, sendTime: '09:00', sendWhenEmpty: false, template: getDefaultWeeklyEmailTemplate() };

describe('executeWeeklySend', () => {
  it('sends to all eligible recipients and records the week as sent', async () => {
    const state = freshState();
    const res = await executeWeeklySend(RANGE, CONFIG, 'manual', makeDeps(state), NOW);
    assert.equal(res.status, 'sent');
    assert.equal(res.listingCount, 1);
    assert.equal(res.recipientCount, 2);
    assert.equal(res.sentCount, 2);
    assert.equal(state.sends.length, 2);
    assert.equal(state.rows.get(RANGE.weekStart)!.status, 'sent');
  });

  it('never sends the same window twice', async () => {
    const state = freshState();
    const deps = makeDeps(state);
    await executeWeeklySend(RANGE, CONFIG, 'scheduler', deps, NOW);
    const second = await executeWeeklySend(RANGE, CONFIG, 'manual', deps, NOW);
    assert.equal(second.status, 'already_sent');
    assert.equal(state.sends.length, 2); // only the first run's two sends
  });

  it('blocks a shifted rolling window that overlaps an already-sent campaign', async () => {
    const state = freshState();
    const deps = makeDeps(state);
    // Manual send Friday: window Jul 18–24.
    const friday: WeekRange = { weekStart: '2026-07-18', weekEnd: '2026-07-24', label: 'July 18–24, 2026' };
    await executeWeeklySend(friday, CONFIG, 'manual', deps, NOW);
    // Scheduled send the following Monday: window Jul 21–27 — overlaps.
    const monday: WeekRange = { weekStart: '2026-07-21', weekEnd: '2026-07-27', label: 'July 21–27, 2026' };
    const second = await executeWeeklySend(monday, CONFIG, 'scheduler', deps, NOW);
    assert.equal(second.status, 'already_sent');
    assert.equal(state.sends.length, 2); // only Friday's sends

    // A window a full week later (Jul 25–31) no longer overlaps — it proceeds
    // as a fresh campaign (the still-active fake listing from Jul 22 is
    // featured under "Still On The Market", so it sends — NOT already_sent).
    const nextCycle: WeekRange = { weekStart: '2026-07-25', weekEnd: '2026-07-31', label: 'July 25–31, 2026' };
    const third = await executeWeeklySend(nextCycle, CONFIG, 'scheduler', deps, NOW);
    assert.equal(third.status, 'sent');
  });

  it('an overlapping in-progress ("sending") row from another day blocks a new send', async () => {
    const state = freshState();
    const deps = makeDeps(state);
    // A campaign claimed Friday (Jul 18–24) is still mid-send.
    state.rows.set('2026-07-18', {
      id: 50,
      weekStart: '2026-07-18',
      weekEnd: '2026-07-24',
      status: 'sending',
      listingCount: 0,
      recipientCount: 0,
      sentCount: 0,
      error: null,
    });
    const monday: WeekRange = { weekStart: '2026-07-21', weekEnd: '2026-07-27', label: 'July 21–27, 2026' };
    const res = await executeWeeklySend(monday, CONFIG, 'scheduler', deps, NOW);
    assert.equal(res.status, 'claim_lost');
    assert.equal(state.sends.length, 0);
  });

  it('a failed attempt on an earlier day does not block a later shifted window', async () => {
    const state = freshState(false); // all sends fail
    const deps = makeDeps(state);
    const friday: WeekRange = { weekStart: '2026-07-18', weekEnd: '2026-07-24', label: 'July 18–24, 2026' };
    const first = await executeWeeklySend(friday, CONFIG, 'scheduler', deps, NOW);
    assert.equal(first.status, 'failed');

    state.sendResult = true;
    const monday: WeekRange = { weekStart: '2026-07-21', weekEnd: '2026-07-27', label: 'July 21–27, 2026' };
    const retry = await executeWeeklySend(monday, CONFIG, 'scheduler', deps, NOW);
    assert.equal(retry.status, 'sent');
  });

  it('skips empty weeks (and skip is terminal — no later send)', async () => {
    const state = freshState();
    const deps = makeDeps(state, { listings: [] });
    const res = await executeWeeklySend(RANGE, CONFIG, 'scheduler', deps, NOW);
    assert.equal(res.status, 'skipped_no_listings');
    assert.equal(state.sends.length, 0);
    const second = await executeWeeklySend(RANGE, CONFIG, 'manual', deps, NOW);
    assert.equal(second.status, 'already_sent');
  });

  it('sends an empty week when sendWhenEmpty is on', async () => {
    const state = freshState();
    const deps = makeDeps(state, { listings: [] });
    const res = await executeWeeklySend(RANGE, { ...CONFIG, sendWhenEmpty: true }, 'manual', deps, NOW);
    assert.equal(res.status, 'sent');
    assert.equal(res.listingCount, 0);
    assert.equal(state.sends.length, 2);
  });

  it('marks the week failed when every send fails, and allows a retry', async () => {
    const state = freshState(false); // sendEmail returns false (SendGrid contract)
    const deps = makeDeps(state);
    const res = await executeWeeklySend(RANGE, CONFIG, 'scheduler', deps, NOW);
    assert.equal(res.status, 'failed');
    assert.equal(state.rows.get(RANGE.weekStart)!.status, 'failed');

    state.sendResult = true; // outage over
    const retry = await executeWeeklySend(RANGE, CONFIG, 'scheduler', deps, NOW);
    assert.equal(retry.status, 'sent');
  });

  it('records a partial failure distinctly, and it is terminal (no double-send retry)', async () => {
    const state = freshState();
    state.failAddresses = new Set(['b@example.com']);
    const deps = makeDeps(state);
    const res = await executeWeeklySend(RANGE, CONFIG, 'scheduler', deps, NOW);
    assert.equal(res.status, 'partially_failed');
    assert.equal(res.sentCount, 1);
    assert.equal(res.recipientCount, 2);
    assert.equal(res.error, '1 of 2 sends failed');
    const row = state.rows.get(RANGE.weekStart)!;
    assert.equal(row.status, 'partially_failed');
    assert.equal(row.error, '1 of 2 sends failed');

    // Terminal: a retry must NOT re-send to the recipient who already got it.
    state.failAddresses = undefined;
    const retry = await executeWeeklySend(RANGE, CONFIG, 'manual', deps, NOW);
    assert.equal(retry.status, 'already_sent');
    assert.equal(state.sends.length, 2);
  });

  it('records which admin triggered a manual send', async () => {
    const state = freshState();
    const res = await executeWeeklySend(RANGE, CONFIG, 'manual', makeDeps(state), NOW, 'michael.admin');
    assert.equal(res.status, 'sent');
    assert.equal(state.rows.get(RANGE.weekStart)!.triggeredByUser, 'michael.admin');
  });

  it('a schedule change re-arms the cycle: an overlapping campaign sent under the OLD schedule does not block', async () => {
    const state = freshState();
    const deps = makeDeps(state);
    // Monday 09:00 campaign already went out (window Jul 21–27).
    const monday: WeekRange = { weekStart: '2026-07-21', weekEnd: '2026-07-27', label: 'July 21–27, 2026' };
    await executeWeeklySend(monday, CONFIG, 'scheduler', deps, NOW);
    assert.equal(state.rows.get('2026-07-21')!.scheduleKey, '1@09:00');

    // Admin changes the schedule to Friday 18:00 → the Friday send (window
    // Jul 25–31, overlapping) must still go out.
    const fridayCfg = { ...CONFIG, sendDay: 5, sendTime: '18:00' };
    const friday: WeekRange = { weekStart: '2026-07-25', weekEnd: '2026-07-31', label: 'July 25–31, 2026' };
    const res = await executeWeeklySend(friday, fridayCfg, 'scheduler', deps, NOW);
    assert.equal(res.status, 'sent');
    assert.equal(state.rows.get('2026-07-25')!.scheduleKey, '5@18:00');
    assert.equal(state.sends.length, 4);
  });

  it('with NO schedule change, an overlapping sent campaign still blocks (restart safety)', async () => {
    const state = freshState();
    const deps = makeDeps(state);
    const friday: WeekRange = { weekStart: '2026-07-25', weekEnd: '2026-07-31', label: 'July 25–31, 2026' };
    const cfg = { ...CONFIG, sendDay: 5, sendTime: '18:00' };
    await executeWeeklySend(friday, cfg, 'scheduler', deps, NOW);
    // Server restarts minutes later, same schedule, same window → no resend.
    const again = await executeWeeklySend(friday, cfg, 'scheduler', deps, NOW);
    assert.equal(again.status, 'already_sent');
    assert.equal(state.sends.length, 2);
    // And the skip is visible in the activity log.
    assert.ok(state.activity.some((a) => a.event === 'skipped_already_sent'));
  });

  it('a legacy campaign with no recorded schedule (NULL) still blocks for safety', async () => {
    const state = freshState();
    const deps = makeDeps(state);
    state.rows.set('2026-07-21', {
      id: 70, weekStart: '2026-07-21', weekEnd: '2026-07-27', status: 'sent',
      scheduleKey: null, listingCount: 1, recipientCount: 2, sentCount: 2, error: null,
    });
    const friday: WeekRange = { weekStart: '2026-07-25', weekEnd: '2026-07-31', label: 'July 25–31, 2026' };
    const res = await executeWeeklySend(friday, { ...CONFIG, sendDay: 5, sendTime: '18:00' }, 'scheduler', deps, NOW);
    assert.equal(res.status, 'already_sent');
    assert.equal(state.sends.length, 0);
  });

  it('records send outcomes in the activity log', async () => {
    const state = freshState();
    await executeWeeklySend(RANGE, CONFIG, 'manual', makeDeps(state), NOW, 'michael.admin');
    assert.deepEqual(state.activity.map((a) => a.event), ['sent']);
    const emptyState = freshState();
    await executeWeeklySend(RANGE, CONFIG, 'scheduler', makeDeps(emptyState, { listings: [] }), NOW);
    assert.deepEqual(emptyState.activity.map((a) => a.event), ['skipped_no_listings']);
  });

  it('excludes opted-out users from the actual send', async () => {
    const state = freshState();
    const deps = makeDeps(state, {
      users: [user(), user({ email: 'optout@example.com', marketingEmailsEnabled: false })],
    });
    const res = await executeWeeklySend(RANGE, CONFIG, 'manual', deps, NOW);
    assert.equal(res.status, 'sent');
    assert.equal(res.recipientCount, 1);
    assert.ok(!state.sends.some((s) => s.to === 'optout@example.com'));
  });
});

// --------------------------- scheduler tick ---------------------------------

function tickDeps(state: FakeState, config: any): WeeklySchedulerDeps {
  return { ...makeDeps(state), loadConfig: async () => config };
}

describe('runWeeklyListingsEmailTick', () => {
  // Monday July 27 2026 09:05 ET = 13:05 UTC (EDT)
  const dueMoment = new Date('2026-07-27T13:05:00Z');

  it('sends when enabled and the configured Monday time has passed', async () => {
    const state = freshState();
    const res = await runWeeklyListingsEmailTick(dueMoment, tickDeps(state, CONFIG));
    assert.equal(res?.status, 'sent');
    // Rolling window: 7 ET days ending Monday July 27 → July 21–27.
    assert.equal(res?.weekStart, '2026-07-21');
    assert.equal(res?.weekEnd, '2026-07-27');
  });

  it('does not fire when a manual send earlier in the cycle already went out', async () => {
    const state = freshState();
    const deps = tickDeps(state, CONFIG);
    // Manual campaign the previous Friday (window Jul 18–24) already sent.
    state.rows.set('2026-07-18', {
      id: 99,
      weekStart: '2026-07-18',
      weekEnd: '2026-07-24',
      status: 'sent',
      listingCount: 1,
      recipientCount: 2,
      sentCount: 2,
      error: null,
    });
    const res = await runWeeklyListingsEmailTick(dueMoment, deps);
    assert.equal(res, null);
    assert.equal(state.sends.length, 0);
  });

  it('does nothing when disabled', async () => {
    const state = freshState();
    const res = await runWeeklyListingsEmailTick(dueMoment, tickDeps(state, { ...CONFIG, enabled: false }));
    assert.equal(res, null);
    assert.equal(state.sends.length, 0);
  });

  it('does nothing on the wrong day or before the send time', async () => {
    const state = freshState();
    // Tuesday
    assert.equal(await runWeeklyListingsEmailTick(new Date('2026-07-28T13:05:00Z'), tickDeps(state, CONFIG)), null);
    // Monday 08:00 ET, before 09:00
    assert.equal(await runWeeklyListingsEmailTick(new Date('2026-07-27T12:00:00Z'), tickDeps(state, CONFIG)), null);
    assert.equal(state.sends.length, 0);
  });

  it('does not fire past the catch-up grace window', async () => {
    const state = freshState();
    // Monday 13:05 ET — over 180 minutes past 09:00
    const res = await runWeeklyListingsEmailTick(new Date('2026-07-27T17:05:00Z'), tickDeps(state, CONFIG));
    assert.equal(res, null);
  });

  it('fires on the new day after a schedule change, even when the old-schedule campaign overlaps', async () => {
    const state = freshState();
    // Monday 09:00 campaign already sent under the old schedule.
    state.rows.set('2026-07-21', {
      id: 80, weekStart: '2026-07-21', weekEnd: '2026-07-27', status: 'sent',
      scheduleKey: '1@09:00', listingCount: 1, recipientCount: 2, sentCount: 2, error: null,
    });
    // Admin moves the send to Friday 18:00. Friday July 31 2026 18:05 ET = 22:05 UTC.
    const fridayCfg = { ...CONFIG, sendDay: 5, sendTime: '18:00' };
    const res = await runWeeklyListingsEmailTick(new Date('2026-07-31T22:05:00Z'), tickDeps(state, fridayCfg));
    assert.equal(res?.status, 'sent');
    assert.equal(res?.weekStart, '2026-07-25');
    assert.equal(state.sends.length, 2);
  });

  it('logs a skipped tick when this cycle already went out under the same schedule', async () => {
    const state = freshState();
    state.rows.set('2026-07-21', {
      id: 81, weekStart: '2026-07-21', weekEnd: '2026-07-27', status: 'sent',
      scheduleKey: '1@09:00', listingCount: 1, recipientCount: 2, sentCount: 2, error: null,
    });
    const res = await runWeeklyListingsEmailTick(dueMoment, tickDeps(state, CONFIG));
    assert.equal(res, null);
    assert.equal(state.sends.length, 0);
    assert.ok(state.activity.some((a) => a.event === 'skipped_already_sent'));
  });

  it('logs a missed window when the send time passed with no campaign this cycle', async () => {
    const state = freshState();
    // Monday 13:05 ET — over 180 minutes past 09:00, nothing sent this cycle.
    const res = await runWeeklyListingsEmailTick(new Date('2026-07-27T17:05:00Z'), tickDeps(state, CONFIG));
    assert.equal(res, null);
    assert.ok(state.activity.some((a) => a.event === 'skipped_window_missed'));
  });

  it('does NOT log a missed window when the cycle already went out', async () => {
    const state = freshState();
    state.rows.set('2026-07-21', {
      id: 82, weekStart: '2026-07-21', weekEnd: '2026-07-27', status: 'sent',
      scheduleKey: '1@09:00', listingCount: 1, recipientCount: 2, sentCount: 2, error: null,
    });
    const res = await runWeeklyListingsEmailTick(new Date('2026-07-27T17:05:00Z'), tickDeps(state, CONFIG));
    assert.equal(res, null);
    assert.equal(state.activity.length, 0);
  });

  it('subsequent ticks after a successful send do nothing (idempotent)', async () => {
    const state = freshState();
    const deps = tickDeps(state, CONFIG);
    await runWeeklyListingsEmailTick(dueMoment, deps);
    const again = await runWeeklyListingsEmailTick(new Date('2026-07-27T13:06:00Z'), deps);
    assert.equal(again, null);
    assert.equal(state.sends.length, 2);
  });
});
