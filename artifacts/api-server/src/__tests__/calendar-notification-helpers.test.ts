import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCalendarNotificationRecipients,
  buildCalendarNonePreferenceResponse,
  buildCalendarNoRecipientsResponse,
  buildCalendarPartialFailureResponse,
  buildCalendarSuccessResponse,
} from '../calendar-notification-helpers';

type AnyUser = any;

function user(overrides: Partial<AnyUser>): AnyUser {
  return {
    id: 1,
    username: 'someone',
    email: 'someone@example.com',
    role: 'registered',
    isBlocked: false,
    emailNotificationsEnabled: true,
    ...overrides,
  };
}

describe('resolveCalendarNotificationRecipients', () => {
  it('returns { kind: "none" } when preference is none', () => {
    const result = resolveCalendarNotificationRecipients(
      'none',
      [user({})],
      user({ id: 99 }),
    );
    assert.deepEqual(result, { kind: 'none' });
  });

  it('returns { kind: "noRecipients" } when justme but current user has no email', () => {
    const current = user({ id: 5, email: '' });
    const result = resolveCalendarNotificationRecipients('justme', [], current);
    assert.equal(result.kind, 'noRecipients');
  });

  it('returns just the current user when preference is justme', () => {
    const current = user({ id: 5, username: 'me', email: 'me@x.com' });
    const result = resolveCalendarNotificationRecipients('justme', [], current);
    assert.equal(result.kind, 'ok');
    if (result.kind !== 'ok') return;
    assert.deepEqual(result.uniqueRecipientEmails, ['me@x.com']);
    assert.equal(result.uniqueNotifiedUsers.length, 1);
    assert.equal(result.uniqueNotifiedUsers[0].username, 'me');
  });

  it('returns only admins when preference is admins, filtering out blocked / opted-out / no-email', () => {
    const users: AnyUser[] = [
      user({ id: 1, username: 'admin1', email: 'a1@x.com', role: 'admin' }),
      user({ id: 2, username: 'admin2', email: 'a2@x.com', role: 'admin' }),
      user({ id: 3, username: 'blockedAdmin', email: 'a3@x.com', role: 'admin', isBlocked: true }),
      user({ id: 4, username: 'optoutAdmin', email: 'a4@x.com', role: 'admin', emailNotificationsEnabled: false }),
      user({ id: 5, username: 'noEmailAdmin', email: '', role: 'admin' }),
      user({ id: 6, username: 'regular', email: 'r@x.com', role: 'registered' }),
    ];
    const result = resolveCalendarNotificationRecipients('admins', users, undefined);
    assert.equal(result.kind, 'ok');
    if (result.kind !== 'ok') return;
    assert.deepEqual(result.uniqueRecipientEmails.sort(), ['a1@x.com', 'a2@x.com']);
  });

  it('returns everyone-eligible when preference is everyone (or unknown)', () => {
    const users: AnyUser[] = [
      user({ id: 1, username: 'u1', email: 'u1@x.com' }),
      user({ id: 2, username: 'u2', email: 'u2@x.com' }),
      user({ id: 3, username: 'blocked', email: 'b@x.com', isBlocked: true }),
      user({ id: 4, username: 'optedOut', email: 'o@x.com', emailNotificationsEnabled: false }),
      user({ id: 5, username: 'noEmail', email: null }),
    ];
    const result = resolveCalendarNotificationRecipients('everyone', users, undefined);
    assert.equal(result.kind, 'ok');
    if (result.kind !== 'ok') return;
    assert.deepEqual(result.uniqueRecipientEmails.sort(), ['u1@x.com', 'u2@x.com']);
  });

  it('groups users that share a mailbox into a single unique recipient (task #74/#76)', () => {
    const users: AnyUser[] = [
      user({ id: 1, username: 'spouseA', email: 'shared@x.com' }),
      user({ id: 2, username: 'spouseB', email: 'SHARED@x.com' }),
      user({ id: 3, username: 'solo', email: 'solo@x.com' }),
    ];
    const result = resolveCalendarNotificationRecipients('everyone', users, undefined);
    assert.equal(result.kind, 'ok');
    if (result.kind !== 'ok') return;
    // recipientEmails (used for sending) keeps every record so deliverability is unchanged
    assert.equal(result.recipientEmails.length, 3);
    // uniqueRecipientEmails dedupes by case-insensitive email
    assert.equal(result.uniqueRecipientEmails.length, 2);
    const shared = result.uniqueNotifiedUsers.find(u => u.email.toLowerCase() === 'shared@x.com');
    assert.ok(shared, 'shared mailbox should have a grouped entry');
    assert.equal(shared!.username, 'spouseA');
    assert.deepEqual(shared!.additionalUsernames, ['spouseB']);
  });

  it('returns noRecipients when filters eliminate every user', () => {
    const users: AnyUser[] = [
      user({ id: 1, role: 'admin', isBlocked: true }),
    ];
    const result = resolveCalendarNotificationRecipients('admins', users, undefined);
    assert.equal(result.kind, 'noRecipients');
  });
});

describe('calendar response builders', () => {
  it('buildCalendarNonePreferenceResponse marks warning with no recipients', () => {
    const r = buildCalendarNonePreferenceResponse(7);
    assert.equal(r.warning, true);
    assert.equal(r.sentCount, 0);
    assert.equal(r.totalCount, 0);
    assert.equal(r.eventCount, 7);
    assert.deepEqual(r.recipientEmails, []);
    assert.deepEqual(r.notifiedUsers, []);
  });

  it('buildCalendarNoRecipientsResponse marks warning with the event count preserved', () => {
    const r = buildCalendarNoRecipientsResponse(3);
    assert.equal(r.warning, true);
    assert.equal(r.eventCount, 3);
    assert.deepEqual(r.recipientEmails, []);
  });

  it('buildCalendarPartialFailureResponse signals failure with intended recipient list', () => {
    const r = buildCalendarPartialFailureResponse(5, 2, ['a@x.com', 'b@x.com']);
    assert.equal(r.success, false);
    assert.equal(r.warning, true);
    assert.equal(r.totalCount, 5);
    assert.equal(r.eventCount, 2);
    assert.deepEqual(r.recipientEmails, ['a@x.com', 'b@x.com']);
    assert.deepEqual(r.notifiedUsers, []);
  });

  it('buildCalendarSuccessResponse passes through unique recipient + grouped user data', () => {
    const r = buildCalendarSuccessResponse({
      message: 'ok',
      sentCount: 4,
      totalCount: 5,
      eventCount: 2,
      uniqueRecipientEmails: ['a@x.com'],
      uniqueNotifiedUsers: [{ username: 'a', email: 'a@x.com', additionalUsernames: ['a2'] }],
      success: true,
    });
    assert.equal(r.success, true);
    assert.equal(r.sentCount, 4);
    assert.equal(r.totalCount, 5);
    assert.equal(r.eventCount, 2);
    assert.deepEqual(r.recipientEmails, ['a@x.com']);
    assert.equal(r.notifiedUsers.length, 1);
    assert.deepEqual(r.notifiedUsers[0].additionalUsernames, ['a2']);
  });
});
