/**
 * Locks the recipient filtering that keeps unsubscribed residents
 * (email_notifications_enabled = false) out of every notification send path:
 *  - canReceiveNotificationEmail / partitionRecipientsByEmailPreference — the
 *    shared helpers used by the private-message notification routes
 *  - resolveWeeklyEmailRecipients — weekly "On The Market" campaign
 *  - resolveSellerReminderEmails — listing-expiration seller reminder
 *
 * A regression that drops one of these checks would silently resume emailing
 * unsubscribed users — a spam-complaint and deliverability risk — so these
 * tests fail loudly instead.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  canReceiveNotificationEmail,
  partitionRecipientsByEmailPreference,
} from '../sendgrid-service';
import { resolveWeeklyEmailRecipients } from '../weekly-listings-email';
import { resolveSellerReminderEmails } from '../listing-expiration-service';

describe('canReceiveNotificationEmail', () => {
  it('blocks users who explicitly unsubscribed', () => {
    assert.equal(canReceiveNotificationEmail({ emailNotificationsEnabled: false }), false);
  });

  it('allows users who are opted in', () => {
    assert.equal(canReceiveNotificationEmail({ emailNotificationsEnabled: true }), true);
  });

  it('treats legacy null/undefined as opted in (pre-flag rows keep receiving mail)', () => {
    assert.equal(canReceiveNotificationEmail({ emailNotificationsEnabled: null }), true);
    assert.equal(canReceiveNotificationEmail({}), true);
  });
});

describe('partitionRecipientsByEmailPreference', () => {
  it('splits unsubscribed users out of the send list', () => {
    const recipients = [
      { email: 'a@example.com', emailNotificationsEnabled: true },
      { email: 'b@example.com', emailNotificationsEnabled: false },
      { email: 'c@example.com', emailNotificationsEnabled: null },
      { email: 'd@example.com' },
    ];
    const { allowed, unsubscribed } = partitionRecipientsByEmailPreference(recipients);
    assert.deepEqual(allowed.map((r) => r.email), ['a@example.com', 'c@example.com', 'd@example.com']);
    assert.deepEqual(unsubscribed.map((r) => r.email), ['b@example.com']);
  });

  it('returns everything allowed when nobody unsubscribed', () => {
    const { allowed, unsubscribed } = partitionRecipientsByEmailPreference([
      { email: 'a@example.com', emailNotificationsEnabled: true },
    ]);
    assert.equal(allowed.length, 1);
    assert.equal(unsubscribed.length, 0);
  });
});

describe('resolveWeeklyEmailRecipients — unsubscribe flag', () => {
  const base = { isBlocked: false, emailNotificationsEnabled: true, marketingEmailsEnabled: true };

  it('excludes users with emailNotificationsEnabled=false', () => {
    const recipients = resolveWeeklyEmailRecipients([
      { ...base, email: 'in@example.com' },
      { ...base, email: 'out@example.com', emailNotificationsEnabled: false },
    ] as any);
    assert.deepEqual(recipients, ['in@example.com']);
  });

  it('excludes marketing opt-outs and blocked users independently of the global flag', () => {
    const recipients = resolveWeeklyEmailRecipients([
      { ...base, email: 'marketing-out@example.com', marketingEmailsEnabled: false },
      { ...base, email: 'blocked@example.com', isBlocked: true },
      { ...base, email: 'ok@example.com' },
    ] as any);
    assert.deepEqual(recipients, ['ok@example.com']);
  });
});

describe('resolveSellerReminderEmails — unsubscribe flag', () => {
  it('sends nothing when the owning account unsubscribed (contact email included)', () => {
    const emails = resolveSellerReminderEmails('contact@example.com', {
      email: 'account@example.com',
      emailNotificationsEnabled: false,
    } as any);
    assert.deepEqual(emails, []);
  });

  it('dedupes contact and account mailboxes for an opted-in seller', () => {
    const emails = resolveSellerReminderEmails('Seller@Example.com', {
      email: 'seller@example.com',
      emailNotificationsEnabled: true,
    } as any);
    assert.deepEqual(emails, ['Seller@Example.com']);
  });

  it('sends to both mailboxes when they differ and the seller is opted in', () => {
    const emails = resolveSellerReminderEmails('contact@example.com', {
      email: 'account@example.com',
      emailNotificationsEnabled: null,
    } as any);
    assert.deepEqual(emails, ['contact@example.com', 'account@example.com']);
  });

  it('still emails the listing contact when no account exists', () => {
    assert.deepEqual(resolveSellerReminderEmails('contact@example.com', undefined), ['contact@example.com']);
    assert.deepEqual(resolveSellerReminderEmails(null, undefined), []);
  });
});
