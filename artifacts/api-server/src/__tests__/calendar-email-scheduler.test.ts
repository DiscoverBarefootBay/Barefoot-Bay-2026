import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  runCalendarEmailScheduleTick,
  runCalendarEmailWatchdog,
  computeCalendarEmailHealth,
  type CalendarEmailSchedulerDeps,
} from '../calendar-email-scheduler';

// ---------------------------------------------------------------------------
// These tests lock the *timing* behaviour of the automatic calendar email
// scheduler: when a tick decides to send (configured time reached, not already
// sent today) and — crucially — when it must NOT send again (same ET day,
// across server restarts, or after a send failure that was pre-marked). The
// "who receives it" logic lives in calendar-notification-helpers and is tested
// separately. All clock math is Florida/Eastern, so the day-rollover and DST
// cases use real UTC instants that map to specific ET wall-clock times.
// ---------------------------------------------------------------------------

type AnySchedule = any;

function makeSchedule(overrides: Partial<AnySchedule> = {}): AnySchedule {
  return {
    id: 1,
    enabled: true,
    sendTime: '08:00',
    notifyPreference: 'everyone',
    adminUserId: null,
    customEventOrder: null,
    attachImageEventIds: null,
    lastSentAt: null,
    updatedAt: null,
    ...overrides,
  };
}

// An event whose Florida-local calendar date is `flDate`. 17:00 UTC is 12:00
// EST / 13:00 EDT — comfortably mid-day in ET either side of a DST switch, so
// the event's FL date is unambiguous.
function eventOnFLDate(flDate: string, id = 1): any {
  return {
    id,
    startDate: `${flDate}T17:00:00Z`,
    endDate: `${flDate}T18:00:00Z`,
    category: null,
    parentEventId: null,
  };
}

const oneRecipient = [
  {
    id: 10,
    username: 'resident',
    email: 'resident@example.com',
    role: 'registered',
    isBlocked: false,
    emailNotificationsEnabled: true,
  },
] as any[];

// An eligible admin (used as the target for non-completion escalation emails).
const adminUser = {
  id: 99,
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
  isBlocked: false,
  emailNotificationsEnabled: true,
} as any;

interface Harness {
  deps: CalendarEmailSchedulerDeps;
  getSchedule: () => AnySchedule;
  claims: number;
  sends: Array<{ recipientEmails: string[]; daysAhead: number; eventCount: number }>;
  runs: Array<{ status?: string | null; detail?: string | null }>;
  escalations: Array<{ adminEmails: string[]; reason: string; severity: 'alert' | 'info' }>;
  setEvents: (events: any[]) => void;
  setUsers: (users: any[]) => void;
  setSendBehavior: (fn: () => Promise<{ success: boolean; sentCount: number; totalCount: number }>) => void;
}

function sameInstant(a: Date | null | undefined, b: Date | null | undefined): boolean {
  const at = a ? new Date(a).getTime() : null;
  const bt = b ? new Date(b).getTime() : null;
  return at === bt;
}

function makeHarness(initial: AnySchedule, opts: { events?: any[]; users?: any[] } = {}): Harness {
  let schedule: AnySchedule = initial ? { ...initial } : initial;
  let events: any[] = opts.events ?? [];
  let users: any[] = opts.users ?? oneRecipient;
  const counters = { claims: 0 };
  const sends: Array<{ recipientEmails: string[]; daysAhead: number; eventCount: number }> = [];
  const runs: Array<{ status?: string | null; detail?: string | null }> = [];
  const escalations: Array<{ adminEmails: string[]; reason: string; severity: 'alert' | 'info' }> = [];
  let sendBehavior = async () => ({ success: true, sentCount: 1, totalCount: 1 });

  const deps: CalendarEmailSchedulerDeps = {
    getCalendarEmailSchedule: async () => (schedule ? { ...schedule } : (undefined as any)),
    // Mirrors storage.claimCalendarEmailSend: an atomic conditional UPDATE that
    // only succeeds when the stored lastSentAt still equals the value the tick
    // observed (expectedLastSentAt). On success it marks lastSentAt and clears
    // the one-shot fields. This is the cross-process once-per-day guard. The
    // tick only reaches the claim AFTER it has validated events + recipients, so
    // a claim implies an actual send is about to happen.
    claimCalendarEmailSend: async (scheduleId, expectedLastSentAt, now) => {
      if (!schedule || schedule.id !== scheduleId) return false;
      if (!sameInstant(schedule.lastSentAt, expectedLastSentAt)) return false;
      schedule = {
        ...schedule,
        lastSentAt: now,
        customEventOrder: null,
        attachImageEventIds: null,
      };
      counters.claims += 1;
      return true;
    },
    // Mirrors storage.claimCalendarEmailEscalation: a CAS that only succeeds when
    // the stored lastEscalationAt still equals what the tick observed, so admins
    // are notified at most once per day even across concurrent instances.
    claimCalendarEmailEscalation: async (scheduleId, expectedLastEscalationAt, now) => {
      if (!schedule || schedule.id !== scheduleId) return false;
      if (!sameInstant(schedule.lastEscalationAt, expectedLastEscalationAt)) return false;
      schedule = { ...schedule, lastEscalationAt: now };
      return true;
    },
    // Mirrors storage.claimCalendarEmailWatchdog: a CAS that only succeeds when
    // the stored lastWatchdogAt still equals what the watchdog observed, so a
    // fully-missed send day alerts admins at most once across instances.
    claimCalendarEmailWatchdog: async (scheduleId, expectedLastWatchdogAt, now) => {
      if (!schedule || schedule.id !== scheduleId) return false;
      if (!sameInstant(schedule.lastWatchdogAt, expectedLastWatchdogAt)) return false;
      schedule = { ...schedule, lastWatchdogAt: now };
      return true;
    },
    // Mirrors storage.claimCalendarEmailHeartbeat: a CAS that only succeeds when
    // the stored lastHeartbeatAt still equals what the tick observed, so the
    // once-daily "all healthy" heartbeat goes out at most once per day.
    claimCalendarEmailHeartbeat: async (scheduleId, expectedLastHeartbeatAt, now) => {
      if (!schedule || schedule.id !== scheduleId) return false;
      if (!sameInstant(schedule.lastHeartbeatAt, expectedLastHeartbeatAt)) return false;
      schedule = { ...schedule, lastHeartbeatAt: now };
      return true;
    },
    getEvents: async () => events.slice(),
    getUsers: async () => users.slice(),
    sendCalendarEventNotificationEmail: async (evts, recipientEmails, daysAhead) => {
      sends.push({ recipientEmails: recipientEmails.slice(), daysAhead, eventCount: evts.length });
      return sendBehavior();
    },
    // Mirrors storage.upsertCalendarEmailSchedule: merges the partial run-outcome
    // fields into the persisted row without touching the lastSentAt guard.
    recordCalendarEmailRun: async (data: any) => {
      if (schedule) schedule = { ...schedule, ...data };
      if ('lastRunStatus' in data || 'lastRunDetail' in data) {
        runs.push({ status: data.lastRunStatus, detail: data.lastRunDetail });
      }
      return schedule;
    },
    sendCalendarScheduleEscalationEmail: async (adminEmails: string[], info: any) => {
      escalations.push({ adminEmails: adminEmails.slice(), reason: info.reason, severity: info.severity });
      return true;
    },
  };

  return {
    deps,
    getSchedule: () => schedule,
    get claims() {
      return counters.claims;
    },
    sends,
    runs,
    escalations,
    setEvents: (e: any[]) => {
      events = e;
    },
    setUsers: (u: any[]) => {
      users = u;
    },
    setSendBehavior: (fn) => {
      sendBehavior = fn;
    },
  };
}

// 2026-01-15 is winter (EST, UTC-5). 14:00Z == 09:00 ET (past an 08:00 sendTime).
const JAN15_0900_ET = new Date('2026-01-15T14:00:00Z');
// 12:00Z == 07:00 ET (before an 08:00 sendTime).
const JAN15_0700_ET = new Date('2026-01-15T12:00:00Z');
// Next ET day, past send time.
const JAN16_0900_ET = new Date('2026-01-16T14:00:00Z');

describe('runCalendarEmailScheduleTick — timing safety', () => {
  beforeEach(() => {
    // The module guards against overlapping runs with a `ticking` flag, but each
    // tick is fully awaited here so it always resets to false between tests.
  });

  it('does nothing when the schedule is disabled', async () => {
    const h = makeHarness(makeSchedule({ enabled: false }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.sends.length, 0);
    assert.equal(h.claims, 0);
  });

  it('does nothing when there is no schedule row at all', async () => {
    const h = makeHarness(undefined as any, { events: [eventOnFLDate('2026-01-16')] });
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.sends.length, 0);
    assert.equal(h.claims, 0);
  });

  it('does nothing before the configured send time', async () => {
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    await runCalendarEmailScheduleTick(JAN15_0700_ET, h.deps);
    assert.equal(h.sends.length, 0);
    assert.equal(h.claims, 0);
  });

  it('sends once when the configured time has been reached', async () => {
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);

    assert.equal(h.sends.length, 1);
    assert.equal(h.sends[0].daysAhead, 1);
    assert.equal(h.sends[0].eventCount, 1);
    assert.deepEqual(h.sends[0].recipientEmails, ['resident@example.com']);

    // lastSentAt was pre-marked with the tick's `now`.
    assert.equal(h.claims, 1);
    assert.equal((h.getSchedule().lastSentAt as Date).getTime(), JAN15_0900_ET.getTime());
  });

  it('does not send a heartbeat after a successful send when heartbeat is disabled (default)', async () => {
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.sends.length, 1);
    // No escalation-channel email (the heartbeat reuses that channel) should fire.
    assert.equal(h.escalations.length, 0);
    assert.equal(h.getSchedule().lastHeartbeatAt ?? null, null);
  });

  it('sends an info heartbeat after a successful send when heartbeat is enabled', async () => {
    const h = makeHarness(makeSchedule({ sendTime: '08:00', heartbeatEnabled: true }), {
      events: [eventOnFLDate('2026-01-16')],
      users: [...oneRecipient, adminUser],
    });
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.sends.length, 1);
    // Exactly one heartbeat went out, addressed to the eligible admin, as info.
    assert.equal(h.escalations.length, 1);
    assert.equal(h.escalations[0].reason, 'heartbeat_ok');
    assert.equal(h.escalations[0].severity, 'info');
    assert.deepEqual(h.escalations[0].adminEmails, ['admin@example.com']);
    assert.equal((h.getSchedule().lastHeartbeatAt as Date).getTime(), JAN15_0900_ET.getTime());
  });

  it('sends the heartbeat at most once per ET day', async () => {
    const h = makeHarness(makeSchedule({ sendTime: '08:00', heartbeatEnabled: true }), {
      events: [eventOnFLDate('2026-01-16')],
      users: [...oneRecipient, adminUser],
    });
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.escalations.length, 1);
    // A later tick the same ET day must not send a second heartbeat.
    const laterSameDay = new Date('2026-01-15T20:00:00Z'); // 15:00 ET
    await runCalendarEmailScheduleTick(laterSameDay, h.deps);
    assert.equal(h.escalations.length, 1);
  });

  it('does not send a heartbeat when the send did not succeed', async () => {
    const h = makeHarness(makeSchedule({ sendTime: '08:00', heartbeatEnabled: true }), {
      events: [eventOnFLDate('2026-01-16')],
      users: [...oneRecipient, adminUser],
    });
    // Every delivery fails — this should produce a failure escalation, NOT a heartbeat.
    h.setSendBehavior(async () => ({ success: false, sentCount: 0, totalCount: 1 }));
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.escalations.length, 1);
    assert.equal(h.escalations[0].reason, 'partial_failure');
    assert.equal(h.getSchedule().lastHeartbeatAt ?? null, null);
  });

  it('sends exactly at the configured minute (boundary, HH:mm equal)', async () => {
    // 13:00Z == 08:00 ET, exactly the sendTime.
    const at0800 = new Date('2026-01-15T13:00:00Z');
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    await runCalendarEmailScheduleTick(at0800, h.deps);
    assert.equal(h.sends.length, 1);
  });

  it('does not re-send on a second tick the same ET day', async () => {
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.sends.length, 1);

    // A later tick the same ET day must be a no-op (lastSentAt blocks it).
    const laterSameDay = new Date('2026-01-15T20:00:00Z'); // 15:00 ET
    await runCalendarEmailScheduleTick(laterSameDay, h.deps);
    assert.equal(h.sends.length, 1);
    assert.equal(h.claims, 1);
  });

  it('does not re-send after a restart on the same ET day (persisted lastSentAt)', async () => {
    // Simulate a restart by starting from a schedule that already has today's
    // lastSentAt persisted in the DB.
    const h = makeHarness(
      makeSchedule({ sendTime: '08:00', lastSentAt: new Date('2026-01-15T13:30:00Z') }),
      { events: [eventOnFLDate('2026-01-16')] },
    );
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.sends.length, 0);
    assert.equal(h.claims, 0);
  });

  it('allows the next day to send after an ET-day rollover', async () => {
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    // Day 1 send.
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.sends.length, 1);

    // Day 2: tomorrow's events change, and the rolled-over ET day permits a send.
    h.setEvents([eventOnFLDate('2026-01-17')]);
    await runCalendarEmailScheduleTick(JAN16_0900_ET, h.deps);
    assert.equal(h.sends.length, 2);
    assert.equal((h.getSchedule().lastSentAt as Date).getTime(), JAN16_0900_ET.getTime());
  });

  it('does not re-send the same day after a send failure (pre-mark protects against re-fire)', async () => {
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    h.setSendBehavior(async () => {
      throw new Error('SendGrid exploded');
    });

    // First tick attempts the send (which throws); the error is swallowed but
    // lastSentAt was already pre-marked before the send.
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.sends.length, 1);
    assert.equal(h.claims, 1);
    assert.equal((h.getSchedule().lastSentAt as Date).getTime(), JAN15_0900_ET.getTime());

    // A retry the same ET day must NOT blast the community a second time.
    h.setSendBehavior(async () => ({ success: true, sentCount: 1, totalCount: 1 }));
    const retry = new Date('2026-01-15T18:00:00Z'); // 13:00 ET, same day
    await runCalendarEmailScheduleTick(retry, h.deps);
    assert.equal(h.sends.length, 1);
  });

  it('does not claim the day inside the grace window when there are no events yet', async () => {
    // No events for tomorrow, but we are only 60 min past sendTime (within the
    // 120-min catch-up window). The tick must NOT claim/pre-mark lastSentAt — it
    // records a transient "waiting" status and keeps re-evaluating, so events
    // added later in the window can still trigger a real send.
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), { events: [] });
    await runCalendarEmailScheduleTick(JAN15_0900_ET, h.deps);
    assert.equal(h.sends.length, 0);
    assert.equal(h.claims, 0);
    assert.equal(h.getSchedule().lastSentAt, null);
    assert.equal(h.runs.at(-1)?.status, 'waiting_no_events');

    // Events appear later but still inside the window → the send now goes out.
    h.setEvents([eventOnFLDate('2026-01-16')]);
    const stillInWindow = new Date('2026-01-15T15:00:00Z'); // 10:00 ET, 120 min past
    await runCalendarEmailScheduleTick(stillInWindow, h.deps);
    assert.equal(h.sends.length, 1);
    assert.equal(h.claims, 1);
  });

  it('finalizes as no_events (with a soft info escalation) once the grace window expires', async () => {
    // No events for tomorrow and we are well past the catch-up window. The day
    // is finalized as "no_events" so it stops retrying, and admins get a softer
    // (info-severity) heads-up rather than an alarming alert.
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [],
      users: [...oneRecipient, adminUser],
    });
    const wayPast = new Date('2026-01-15T20:00:00Z'); // 15:00 ET, ~7h past 08:00
    await runCalendarEmailScheduleTick(wayPast, h.deps);
    assert.equal(h.sends.length, 0);
    assert.equal(h.claims, 0);
    assert.equal(h.getSchedule().lastSentAt, null);
    assert.equal(h.runs.at(-1)?.status, 'no_events');
    assert.equal(h.escalations.length, 1);
    assert.equal(h.escalations[0].severity, 'info');

    // A later tick the same ET day is a no-op — the terminal status blocks it
    // and the escalation is de-duped (no second email).
    const evenLater = new Date('2026-01-15T22:00:00Z'); // 17:00 ET
    await runCalendarEmailScheduleTick(evenLater, h.deps);
    assert.equal(h.escalations.length, 1);
  });

  it('flags missed_window and alerts admins when events exist but the window expired', async () => {
    // Events AND recipients exist, but the server only evaluated long after the
    // window — sending the digest hours late is the original bug. Instead the
    // run is flagged "missed_window" and admins get an alert so they can send it
    // manually; the digest is NOT blasted out very late.
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
      users: [...oneRecipient, adminUser],
    });
    const wayPast = new Date('2026-01-15T20:00:00Z'); // 15:00 ET, ~7h past 08:00
    await runCalendarEmailScheduleTick(wayPast, h.deps);
    assert.equal(h.sends.length, 0);
    assert.equal(h.claims, 0);
    assert.equal(h.getSchedule().lastSentAt, null);
    assert.equal(h.runs.at(-1)?.status, 'missed_window');
    assert.equal(h.escalations.length, 1);
    assert.equal(h.escalations[0].severity, 'alert');
  });

  it('escalates at most once per day when two instances race on a terminal non-send', async () => {
    // Two API server instances both evaluate the same terminal "no_events" run
    // past the grace window. They share one persisted schedule row, so the
    // atomic escalation claim (CAS on lastEscalationAt) must let only one of
    // them actually email admins.
    const events: any[] = [];
    const users = [...oneRecipient, adminUser];
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), { events, users });

    // A second "instance" that shares the SAME underlying schedule + claim by
    // reusing the first harness's deps (the CAS guards the shared row).
    const wayPast = new Date('2026-01-15T20:00:00Z'); // 15:00 ET, ~7h past 08:00

    // Run both ticks against the same deps; the module's `ticking` re-entrancy
    // guard is per-process, but each await fully resolves here, so sequential
    // awaits faithfully model two processes each completing a tick that both
    // observed lastEscalationAt === null before either wrote it. The CAS makes
    // the second a no-op.
    await runCalendarEmailScheduleTick(wayPast, h.deps);
    await runCalendarEmailScheduleTick(wayPast, h.deps);

    assert.equal(h.escalations.length, 1);
    assert.equal(h.escalations[0].severity, 'info');
  });

  it('catches up within the grace window after downtime (first tick is late)', async () => {
    // Models the real "missed send" worry: the server was down through the
    // configured 08:00 ET send time and the FIRST tick only happens 90 minutes
    // later (well inside the 120-min grace window). Events and recipients exist,
    // so the digest must still go out — exactly once — rather than being dropped.
    const at0930 = new Date('2026-01-15T14:30:00Z'); // 09:30 ET, 90 min past 08:00
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    await runCalendarEmailScheduleTick(at0930, h.deps);
    assert.equal(h.sends.length, 1);
    assert.equal(h.claims, 1);
    assert.equal((h.getSchedule().lastSentAt as Date).getTime(), at0930.getTime());

    // A later tick the same ET day must not re-send.
    const at1100 = new Date('2026-01-15T16:00:00Z'); // 11:00 ET
    await runCalendarEmailScheduleTick(at1100, h.deps);
    assert.equal(h.sends.length, 1);
  });

  it('still sends at the exact grace-window boundary (120 min late)', async () => {
    // The catch-up window is inclusive: a tick exactly 120 minutes past the send
    // time is still inside the window and must send.
    const at1000 = new Date('2026-01-15T15:00:00Z'); // 10:00 ET, exactly 120 min past 08:00
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
    });
    await runCalendarEmailScheduleTick(at1000, h.deps);
    assert.equal(h.sends.length, 1);
    assert.equal(h.claims, 1);
  });

  it('flags missed_window one minute past the grace boundary (121 min late)', async () => {
    // One minute past the 120-min grace window the send is considered MISSED:
    // events exist but we will not fire the digest late — we flag missed_window
    // and alert admins so they can send it manually.
    const at1001 = new Date('2026-01-15T15:01:00Z'); // 10:01 ET, 121 min past 08:00
    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-01-16')],
      users: [...oneRecipient, adminUser],
    });
    await runCalendarEmailScheduleTick(at1001, h.deps);
    assert.equal(h.sends.length, 0);
    assert.equal(h.claims, 0);
    assert.equal(h.getSchedule().lastSentAt, null);
    assert.equal(h.runs.at(-1)?.status, 'missed_window');
    assert.equal(h.escalations.length, 1);
    assert.equal(h.escalations[0].severity, 'alert');
  });

  it('survives an ET-day rollover across the spring-forward DST boundary', async () => {
    // US DST 2026 begins 2026-03-08 02:00. Day 1 = 2026-03-07 (EST, UTC-5),
    // Day 2 = 2026-03-08 (EDT after the jump, UTC-4).
    // 2026-03-07 14:00Z == 09:00 EST.
    const mar7_0900 = new Date('2026-03-07T14:00:00Z');
    // 2026-03-08 13:00Z == 09:00 EDT (UTC-4 after the spring-forward).
    const mar8_0900 = new Date('2026-03-08T13:00:00Z');

    const h = makeHarness(makeSchedule({ sendTime: '08:00' }), {
      events: [eventOnFLDate('2026-03-08')],
    });
    await runCalendarEmailScheduleTick(mar7_0900, h.deps);
    assert.equal(h.sends.length, 1);

    // Same wall-clock-day re-tick after the DST jump must not re-send day 1.
    h.setEvents([eventOnFLDate('2026-03-09')]);
    await runCalendarEmailScheduleTick(mar8_0900, h.deps);
    assert.equal(h.sends.length, 2);
  });
});

// ---------------------------------------------------------------------------
// The watchdog closes the one gap the minute-by-minute tick can't: an outage
// that spans an entire send+grace window AND rolls past end-of-day, so no run
// was ever recorded and the missed day would otherwise be silently forgotten.
// When the server comes back, the watchdog notices the missing run for the most
// recent fully-elapsed expected-send day and alerts admins exactly once.
// ---------------------------------------------------------------------------
describe('runCalendarEmailWatchdog — missed-day catch-up', () => {
  it('alerts admins when a prior day fully elapsed with no recorded run', async () => {
    // Baseline: the digest last ran two days ago, then the server was down
    // through all of Jan 15. Now it's Jan 16 09:00 ET — Jan 15's window long
    // elapsed and nothing was recorded for it.
    const h = makeHarness(
      makeSchedule({
        sendTime: '08:00',
        lastRunAt: new Date('2026-01-14T13:30:00Z'), // ran on Jan 14
        lastSentAt: new Date('2026-01-14T13:30:00Z'),
      }),
      { users: [...oneRecipient, adminUser] },
    );
    const result = await runCalendarEmailWatchdog(JAN16_0900_ET, h.deps);
    assert.equal(h.escalations.length, 1);
    assert.equal(h.escalations[0].severity, 'alert');
    assert.equal(h.escalations[0].reason, 'watchdog_missed_day');
    assert.deepEqual(h.escalations[0].adminEmails, ['admin@example.com']);
    // The result drives the external verifier endpoint's HTTP status (503 + alert).
    assert.equal(result.healthy, false);
    assert.equal(result.missed, true);
    assert.equal(result.alerted, true);
    assert.equal(result.reason, 'alerted');
    assert.equal(result.expectedDay, '2026-01-15');
  });

  it('does not alert when the expected day already has a recorded run', async () => {
    // Today's send happened normally — nothing missed.
    const h = makeHarness(
      makeSchedule({
        sendTime: '08:00',
        lastRunAt: new Date('2026-01-15T13:30:00Z'),
        lastSentAt: new Date('2026-01-15T13:30:00Z'),
      }),
      { users: [...oneRecipient, adminUser] },
    );
    // Jan 15 09:00 ET: today's window has elapsed and today HAS a run.
    const result = await runCalendarEmailWatchdog(JAN15_0900_ET, h.deps);
    assert.equal(h.escalations.length, 0);
    // Healthy result → external verifier endpoint returns HTTP 200.
    assert.equal(result.healthy, true);
    assert.equal(result.missed, false);
    assert.equal(result.alerted, false);
    assert.equal(result.reason, 'ran');
  });

  it('REGRESSION (#216): stays silent the next morning when yesterday sent cleanly', async () => {
    // The exact false-alarm shape from production: the 16:15 ET digest sent
    // cleanly on Jun 26 (16:15 ET == 20:15 UTC in EDT), and the watchdog is
    // evaluated mid-afternoon the NEXT day — Jun 27 14:07 ET (18:07 UTC) —
    // BEFORE that day's 16:15 send + 2h grace window has elapsed. The most
    // recent fully-elapsed expected day is therefore Jun 26, which HAS a run,
    // so the watchdog must stay completely silent. An older deployed build was
    // alerting here even though Jun 26 was sent; this locks the correct verdict.
    const h = makeHarness(
      makeSchedule({
        sendTime: '16:15',
        lastRunAt: new Date('2026-06-26T20:15:00Z'),
        lastSentAt: new Date('2026-06-26T20:15:00Z'),
        lastRunStatus: 'sent',
      }),
      { users: [...oneRecipient, adminUser] },
    );
    const jun27_1407_ET = new Date('2026-06-27T18:07:00Z');
    const result = await runCalendarEmailWatchdog(jun27_1407_ET, h.deps);
    assert.equal(h.escalations.length, 0);
    assert.equal(result.healthy, true);
    assert.equal(result.missed, false);
    assert.equal(result.alerted, false);
    assert.equal(result.reason, 'ran');
    assert.equal(result.expectedDay, '2026-06-26');
    // No dedup timestamp should be burned when nothing was alerted.
    assert.equal(h.getSchedule().lastWatchdogAt ?? null, null);
  });

  it('does not alert before the expected window has fully elapsed', async () => {
    // It's Jan 15 07:00 ET — today's 08:00 window hasn't even started, and the
    // last run was yesterday (Jan 14), which is the right cadence so far.
    const h = makeHarness(
      makeSchedule({
        sendTime: '08:00',
        lastRunAt: new Date('2026-01-14T13:30:00Z'),
        lastSentAt: new Date('2026-01-14T13:30:00Z'),
      }),
      { users: [...oneRecipient, adminUser] },
    );
    await runCalendarEmailWatchdog(JAN15_0700_ET, h.deps);
    assert.equal(h.escalations.length, 0);
  });

  it('does not alert for a brand-new schedule that has never run', async () => {
    // Enabled but no baseline at all — there is no established cadence to have
    // "stopped", so the watchdog must stay quiet.
    const h = makeHarness(
      makeSchedule({ sendTime: '08:00', lastRunAt: null, lastSentAt: null }),
      { users: [...oneRecipient, adminUser] },
    );
    await runCalendarEmailWatchdog(JAN16_0900_ET, h.deps);
    assert.equal(h.escalations.length, 0);
  });

  it('does nothing when the schedule is disabled or set to notify no one', async () => {
    const disabled = makeHarness(
      makeSchedule({ enabled: false, lastRunAt: new Date('2026-01-14T13:30:00Z') }),
      { users: [...oneRecipient, adminUser] },
    );
    await runCalendarEmailWatchdog(JAN16_0900_ET, disabled.deps);
    assert.equal(disabled.escalations.length, 0);

    const none = makeHarness(
      makeSchedule({ notifyPreference: 'none', lastRunAt: new Date('2026-01-14T13:30:00Z') }),
      { users: [...oneRecipient, adminUser] },
    );
    await runCalendarEmailWatchdog(JAN16_0900_ET, none.deps);
    assert.equal(none.escalations.length, 0);
  });

  it('alerts at most once per missed day, even across repeated checks or instances', async () => {
    const h = makeHarness(
      makeSchedule({
        sendTime: '08:00',
        lastRunAt: new Date('2026-01-14T13:30:00Z'),
        lastSentAt: new Date('2026-01-14T13:30:00Z'),
      }),
      { users: [...oneRecipient, adminUser] },
    );
    await runCalendarEmailWatchdog(JAN16_0900_ET, h.deps);
    // A second check the same day (or a second instance sharing the row) is a
    // no-op — the CAS on lastWatchdogAt blocks a duplicate alert.
    await runCalendarEmailWatchdog(new Date('2026-01-16T18:00:00Z'), h.deps);
    assert.equal(h.escalations.length, 1);
  });
});

// ---------------------------------------------------------------------------
// computeCalendarEmailHealth is the read-only verdict that drives the admin
// panel's "healthy / attention needed" badge. It mirrors the watchdog's
// expected-day logic but never sends or claims, and additionally flags a last
// run that ended in a failed/missed outcome. All clock math is Florida/Eastern.
// ---------------------------------------------------------------------------
describe('computeCalendarEmailHealth — panel verdict', () => {
  it('is "unknown" when auto-send is disabled', () => {
    const h = computeCalendarEmailHealth(makeSchedule({ enabled: false }), JAN15_0900_ET);
    assert.equal(h.status, 'unknown');
    assert.equal(h.reason, 'disabled');
  });

  it('is "unknown" when recipients are set to notify no one', () => {
    const h = computeCalendarEmailHealth(
      makeSchedule({ notifyPreference: 'none' }),
      JAN15_0900_ET,
    );
    assert.equal(h.status, 'unknown');
    assert.equal(h.reason, 'pref_none');
  });

  it('is "unknown" (no baseline) when the schedule has never run', () => {
    const h = computeCalendarEmailHealth(
      makeSchedule({ lastRunAt: null, lastSentAt: null }),
      JAN15_0900_ET,
    );
    assert.equal(h.status, 'unknown');
    assert.equal(h.reason, 'no_baseline');
  });

  it('is "healthy" when the expected day has a recorded run', () => {
    const h = computeCalendarEmailHealth(
      makeSchedule({
        sendTime: '08:00',
        lastRunAt: new Date('2026-01-15T13:30:00Z'),
        lastSentAt: new Date('2026-01-15T13:30:00Z'),
        lastRunStatus: 'sent',
      }),
      JAN15_0900_ET,
    );
    assert.equal(h.status, 'healthy');
    assert.equal(h.reason, 'ran');
    // At 09:00 ET the 08:00 send + 2h grace window hasn't fully elapsed yet, so
    // the most recent fully-elapsed expected day is the prior day (Jan 14), and
    // the Jan 15 run satisfies it.
    assert.equal(h.expectedDay, '2026-01-14');
  });

  it('REGRESSION (#216): is "healthy" the next morning when yesterday sent cleanly', () => {
    // Mirrors the watchdog regression: the admin panel badge must read healthy
    // (not "attention needed") when checked the next afternoon before the send
    // window elapses and the prior day was sent.
    const h = computeCalendarEmailHealth(
      makeSchedule({
        sendTime: '16:15',
        lastRunAt: new Date('2026-06-26T20:15:00Z'),
        lastSentAt: new Date('2026-06-26T20:15:00Z'),
        lastRunStatus: 'sent',
      }),
      new Date('2026-06-27T18:07:00Z'),
    );
    assert.equal(h.status, 'healthy');
    assert.equal(h.reason, 'ran');
    assert.equal(h.expectedDay, '2026-06-26');
  });

  it('needs attention when the expected day fully elapsed with no run', () => {
    const h = computeCalendarEmailHealth(
      makeSchedule({
        sendTime: '08:00',
        lastRunAt: new Date('2026-01-14T13:30:00Z'),
        lastSentAt: new Date('2026-01-14T13:30:00Z'),
      }),
      JAN16_0900_ET,
    );
    assert.equal(h.status, 'attention');
    assert.equal(h.reason, 'missed_day');
    assert.equal(h.expectedDay, '2026-01-15');
  });

  it('needs attention when the most recent run finished in a failed state', () => {
    const h = computeCalendarEmailHealth(
      makeSchedule({
        sendTime: '08:00',
        lastRunAt: new Date('2026-01-15T13:30:00Z'),
        lastSentAt: new Date('2026-01-14T13:30:00Z'),
        lastRunStatus: 'partial_failure',
      }),
      JAN15_0900_ET,
    );
    assert.equal(h.status, 'attention');
    assert.equal(h.reason, 'last_run_failed');
  });
});
