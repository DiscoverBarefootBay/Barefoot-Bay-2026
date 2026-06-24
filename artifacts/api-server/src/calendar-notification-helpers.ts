// Shared helpers for the three /api/admin/send-calendar-events/{week,today,day}
// endpoints. Each used to inline the same notify-preference resolution +
// dedupe + response shaping; centralising it keeps them in lock-step.

import type { User } from "@workspace/db";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays } from "date-fns";
import { groupNotifiedUsersByEmail } from "./sendgrid-service";

const FLORIDA_TZ = "America/New_York";

export type NotifyPreference = "none" | "justme" | "admins" | "everyone" | string;

export interface CalendarNotifiedUser {
  username: string;
  email: string;
  additionalUsernames?: string[];
}

export type CalendarRecipientResolution =
  | { kind: "none" }
  | { kind: "noRecipients" }
  | {
      kind: "ok";
      recipientEmails: string[];
      uniqueNotifiedUsers: CalendarNotifiedUser[];
      uniqueRecipientEmails: string[];
    };

export function resolveCalendarNotificationRecipients(
  notifyPreference: NotifyPreference,
  allUsers: User[],
  currentUser: User | undefined,
): CalendarRecipientResolution {
  if (notifyPreference === "none") {
    return { kind: "none" };
  }

  let recipientEmails: string[] = [];
  let notifiedUsers: CalendarNotifiedUser[] = [];

  if (notifyPreference === "justme") {
    if (currentUser?.email) {
      recipientEmails = [currentUser.email];
      notifiedUsers = [{ username: currentUser.username, email: currentUser.email }];
    }
  } else if (notifyPreference === "admins") {
    const adminUsers = allUsers.filter(
      user => user.email && !user.isBlocked && user.role === "admin" && user.emailNotificationsEnabled !== false,
    );
    recipientEmails = adminUsers.map(user => user.email);
    notifiedUsers = adminUsers.map(user => ({ username: user.username, email: user.email }));
  } else {
    // "everyone" or default
    const eligibleUsers = allUsers.filter(
      user => user.email && !user.isBlocked && user.emailNotificationsEnabled !== false,
    );
    recipientEmails = eligibleUsers.map(user => user.email);
    notifiedUsers = eligibleUsers.map(user => ({ username: user.username, email: user.email }));
  }

  if (recipientEmails.length === 0) {
    return { kind: "noRecipients" };
  }

  // Group users sharing a mailbox so reported counts reflect unique mailboxes
  // contacted (task #74), while still surfacing every user record covered by
  // each mailbox to the admin alert (task #76). Sending still uses the full
  // list so deliverability is unchanged.
  const uniqueNotifiedUsers = groupNotifiedUsersByEmail(notifiedUsers);
  const uniqueRecipientEmails = uniqueNotifiedUsers.map(u => u.email);

  return { kind: "ok", recipientEmails, uniqueNotifiedUsers, uniqueRecipientEmails };
}

export function buildCalendarNonePreferenceResponse(eventCount: number) {
  return {
    message: "No notifications sent (notify preference set to 'none')",
    sentCount: 0,
    totalCount: 0,
    eventCount,
    recipientEmails: [] as string[],
    notifiedUsers: [] as CalendarNotifiedUser[],
    warning: true,
  };
}

export function buildCalendarNoRecipientsResponse(eventCount: number) {
  return {
    message: "No users with email addresses found for the selected notification preference",
    sentCount: 0,
    totalCount: 0,
    eventCount,
    recipientEmails: [] as string[],
    notifiedUsers: [] as CalendarNotifiedUser[],
    warning: true,
  };
}

export function buildCalendarPartialFailureResponse(
  totalCount: number,
  eventCount: number,
  uniqueRecipientEmails: string[],
) {
  return {
    message: `Failed to send notifications - no emails were delivered to ${totalCount} intended recipients`,
    sentCount: 0,
    totalCount,
    eventCount,
    recipientEmails: uniqueRecipientEmails,
    notifiedUsers: [] as CalendarNotifiedUser[],
    success: false,
    warning: true,
  };
}

export function buildCalendarSuccessResponse(args: {
  message: string;
  sentCount: number;
  totalCount: number;
  eventCount: number;
  uniqueRecipientEmails: string[];
  uniqueNotifiedUsers: CalendarNotifiedUser[];
  success: boolean;
}) {
  return {
    message: args.message,
    sentCount: args.sentCount,
    totalCount: args.totalCount,
    eventCount: args.eventCount,
    recipientEmails: args.uniqueRecipientEmails,
    notifiedUsers: args.uniqueNotifiedUsers,
    success: args.success,
  };
}

// Recipient resolution for the *automatic* (scheduled) calendar email send.
//
// This differs from resolveCalendarNotificationRecipients (used by the manual
// admin endpoints) only in how "justme" is handled: a scheduled send has no
// logged-in request user, so "justme" is resolved from the stored adminUserId
// (the admin who configured the schedule). If that admin can no longer receive
// mail (deleted, blocked, notifications off, or no stored id) we return
// `noRecipients` so the scheduler skips the send and escalates to all admins,
// rather than silently fanning the digest out to every admin (which surprised
// admins who had deliberately set the schedule to "just me").
//
// This MUST stay in lock-step with the `context=schedule` branch of the
// GET /api/admin/calendar-email-recipients preview endpoint so the admin UI's
// "who will receive this" preview matches what the scheduler actually does.
export function resolveScheduledCalendarRecipients(
  notifyPreference: NotifyPreference,
  allUsers: User[],
  adminUserId: number | null | undefined,
): CalendarRecipientResolution {
  if (notifyPreference === "none") {
    return { kind: "none" };
  }

  const eligibleAdmins = allUsers.filter(
    user => user.email && !user.isBlocked && user.role === "admin" && user.emailNotificationsEnabled !== false,
  );

  let notifiedUsers: CalendarNotifiedUser[] = [];

  if (notifyPreference === "justme") {
    const adminUser = adminUserId ? allUsers.find(user => user.id === adminUserId) : undefined;
    if (adminUser?.email && !adminUser.isBlocked && adminUser.emailNotificationsEnabled !== false) {
      notifiedUsers = [{ username: adminUser.username, email: adminUser.email }];
    } else {
      // Stored admin missing/ineligible — do NOT fall back to all admins.
      // Return noRecipients so the scheduled send is skipped and escalated.
      return { kind: "noRecipients" };
    }
  } else if (notifyPreference === "admins") {
    notifiedUsers = eligibleAdmins.map(user => ({ username: user.username, email: user.email }));
  } else {
    // "everyone" or default
    const eligibleUsers = allUsers.filter(
      user => user.email && !user.isBlocked && user.emailNotificationsEnabled !== false,
    );
    notifiedUsers = eligibleUsers.map(user => ({ username: user.username, email: user.email }));
  }

  if (notifiedUsers.length === 0) {
    return { kind: "noRecipients" };
  }

  const recipientEmails = notifiedUsers.map(user => user.email);
  const uniqueNotifiedUsers = groupNotifiedUsersByEmail(notifiedUsers);
  const uniqueRecipientEmails = uniqueNotifiedUsers.map(u => u.email);

  return { kind: "ok", recipientEmails, uniqueNotifiedUsers, uniqueRecipientEmails };
}

interface TomorrowSelectableEvent {
  id: number;
  startDate: string | Date;
  endDate: string | Date;
  category?: string | null;
  parentEventId?: number | null;
}

// Selects the events an automatic "tomorrow" calendar email should include.
//
// Mirrors the filtering used by POST /api/admin/send-calendar-events/day (the
// endpoint the manual "Send Now with These Settings" button calls), so the
// scheduled send contains exactly the same events an admin would preview:
//   - events whose Florida-local start date is tomorrow, PLUS
//   - active platinum sponsors (ongoing across tomorrow), deduped by
//     parentEventId so a sponsor only appears once.
// All date math is done in Florida/Eastern time to match the rest of the
// calendar email feature.
export function selectCalendarEventsForTomorrow<T extends TomorrowSelectableEvent>(
  allEvents: T[],
  now: Date,
): T[] {
  const todayDateFL = formatInTimeZone(now, FLORIDA_TZ, "yyyy-MM-dd");
  // Parse at noon UTC to avoid DST edge cases, then add a day.
  const todayDate = new Date(todayDateFL + "T12:00:00Z");
  const tomorrowDateFL = addDays(todayDate, 1).toISOString().split("T")[0];
  const tomorrowStartUTC = fromZonedTime(tomorrowDateFL + "T00:00:00", FLORIDA_TZ);
  const tomorrowEndUTC = fromZonedTime(tomorrowDateFL + "T23:59:59.999", FLORIDA_TZ);

  const rawEvents = allEvents.filter(event => {
    const eventStartDate = new Date(event.startDate);
    const eventEndDate = new Date(event.endDate);
    const eventDateInFlorida = formatInTimeZone(eventStartDate, FLORIDA_TZ, "yyyy-MM-dd");
    const isTomorrow = eventDateInFlorida === tomorrowDateFL;
    const isPlatinumSponsor = event.category === "platinum_sponsor";
    const isActiveSponsor =
      isPlatinumSponsor && eventStartDate <= tomorrowEndUTC && eventEndDate >= tomorrowStartUTC;
    return isTomorrow || isActiveSponsor;
  });

  // Deduplicate platinum sponsors by parentEventId.
  const seenSponsorKeys = new Set<number>();
  return rawEvents.filter(event => {
    if (event.category !== "platinum_sponsor") return true;
    const key = event.parentEventId ?? event.id;
    if (seenSponsorKeys.has(key)) return false;
    seenSponsorKeys.add(key);
    return true;
  });
}
