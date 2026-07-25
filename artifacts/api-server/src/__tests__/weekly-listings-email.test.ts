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
  type WeekRange,
} from '../weekly-listings-email';
import {
  executeWeeklySend,
  runWeeklyListingsEmailTick,
  type WeeklySendDeps,
  type WeeklySchedulerDeps,
} from '../weekly-listings-scheduler';

// ---------------------------------------------------------------------------
// These tests lock the weekly "Currently, On The Market" campaign behaviour:
// which Monday–Sunday ET week a send covers, which listings and recipients
// qualify, the render contract (subject/heading format, unsubscribe link),
// and — crucially — the per-week idempotency: a week that reached a terminal
// status can never send twice, while a failed week may retry.
// ---------------------------------------------------------------------------

// --------------------------- week range ----------------------------------

describe('getCampaignWeekRange', () => {
  it('mid-week send promotes the previous completed Mon–Sun week', () => {
    // Wednesday July 29 2026, noon ET (16:00 UTC)
    const range = getCampaignWeekRange(new Date('2026-07-29T16:00:00Z'));
    assert.equal(range.weekStart, '2026-07-20');
    assert.equal(range.weekEnd, '2026-07-26');
  });

  it('Monday itself still promotes the week that just ended', () => {
    // Monday July 27 2026, 09:00 ET
    const range = getCampaignWeekRange(new Date('2026-07-27T13:00:00Z'));
    assert.equal(range.weekStart, '2026-07-20');
    assert.equal(range.weekEnd, '2026-07-26');
  });

  it('Sunday belongs to the current (incomplete) week, so the prior week is promoted', () => {
    // Sunday July 26 2026, 10:00 ET — the current week is Jul 20–26, still
    // incomplete until Monday, so the campaign covers Jul 13–19.
    const range = getCampaignWeekRange(new Date('2026-07-26T14:00:00Z'));
    assert.equal(range.weekStart, '2026-07-13');
    assert.equal(range.weekEnd, '2026-07-19');
  });

  it('respects the ET day boundary, not UTC', () => {
    // Monday July 27 2026 01:00 UTC is still Sunday July 26 in ET.
    const range = getCampaignWeekRange(new Date('2026-07-27T01:00:00Z'));
    assert.equal(range.weekStart, '2026-07-13');
    assert.equal(range.weekEnd, '2026-07-19');
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
  it('includes ACTIVE listings created inside the campaign week', () => {
    const out = selectListingsForWeek([listing()], RANGE, NOW);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, 1);
    assert.equal(out[0]!.photo, 'https://example.com/cart.jpg');
  });

  it('excludes listings created outside the week', () => {
    const out = selectListingsForWeek(
      [
        listing({ id: 2, createdAt: new Date('2026-07-19T15:00:00Z') }), // Sunday before
        listing({ id: 3, createdAt: new Date('2026-07-27T15:00:00Z') }), // Monday after
      ],
      RANGE,
      NOW,
    );
    assert.equal(out.length, 0);
  });

  it('uses the ET calendar date for the week boundary', () => {
    // 2026-07-27T02:00:00Z is still Sunday July 26 in ET → inside the week.
    const out = selectListingsForWeek(
      [listing({ id: 4, createdAt: new Date('2026-07-27T02:00:00Z') })],
      RANGE,
      NOW,
    );
    assert.equal(out.length, 1);
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
    assert.ok(r.html.includes(`Currently, On The Market | ${RANGE.label}`));
    assert.ok(r.text.startsWith(`Currently, On The Market | ${RANGE.label}`));
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

  it('renders an empty-week variant without listing cards', () => {
    const r = renderWeeklyListingsEmail([], RANGE, 'https://barefootbay.com');
    assert.ok(r.html.includes('No new listings'));
    assert.ok(!r.html.includes('View Listing<'));
  });
});

// --------------------------- config merge -----------------------------------

describe('mergeWeeklyListingsEmailConfig', () => {
  it('defaults: disabled, Monday 09:00, skip empty weeks', () => {
    const d = getDefaultWeeklyListingsEmailConfig();
    assert.deepEqual(d, { enabled: false, sendDay: 1, sendTime: '09:00', sendWhenEmpty: false });
  });

  it('rejects malformed values field-by-field', () => {
    const m = mergeWeeklyListingsEmailConfig({ enabled: 'yes', sendDay: 9, sendTime: '9am', sendWhenEmpty: true });
    assert.deepEqual(m, { enabled: false, sendDay: 1, sendTime: '09:00', sendWhenEmpty: true });
  });
});

// --------------------------- send execution ---------------------------------

interface FakeState {
  rows: Map<string, any>;
  nextId: number;
  sends: Array<{ to: string; subject: string }>;
  sendResult: boolean;
}

function makeDeps(state: FakeState, opts: { listings?: any[]; users?: any[] } = {}): WeeklySendDeps {
  return {
    getListings: async () => opts.listings ?? [listing()],
    getUsers: async () => opts.users ?? [user(), user({ email: 'b@example.com' })],
    sendEmail: (async (o: any) => {
      state.sends.push({ to: o.to, subject: o.subject });
      return state.sendResult;
    }) as any,
    claimWeeklySend: async (range, triggeredBy) => {
      const existing = state.rows.get(range.weekStart);
      if (!existing) {
        const row = {
          id: state.nextId++,
          weekStart: range.weekStart,
          weekEnd: range.weekEnd,
          status: 'sending',
          triggeredBy,
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
    baseUrl: 'https://barefootbay.com',
  };
}

function freshState(sendResult = true): FakeState {
  return { rows: new Map(), nextId: 1, sends: [], sendResult };
}

const CONFIG = { enabled: true, sendDay: 1, sendTime: '09:00', sendWhenEmpty: false };

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

  it('never sends the same week twice', async () => {
    const state = freshState();
    const deps = makeDeps(state);
    await executeWeeklySend(RANGE, CONFIG, 'scheduler', deps, NOW);
    const second = await executeWeeklySend(RANGE, CONFIG, 'manual', deps, NOW);
    assert.equal(second.status, 'already_sent');
    assert.equal(state.sends.length, 2); // only the first run's two sends
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
    assert.equal(res?.weekStart, '2026-07-20');
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

  it('subsequent ticks after a successful send do nothing (idempotent)', async () => {
    const state = freshState();
    const deps = tickDeps(state, CONFIG);
    await runWeeklyListingsEmailTick(dueMoment, deps);
    const again = await runWeeklyListingsEmailTick(new Date('2026-07-27T13:06:00Z'), deps);
    assert.equal(again, null);
    assert.equal(state.sends.length, 2);
  });
});
