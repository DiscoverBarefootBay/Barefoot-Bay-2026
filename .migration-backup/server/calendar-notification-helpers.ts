// Shared helpers for the three /api/admin/send-calendar-events/{week,today,day}
// endpoints. Each used to inline the same notify-preference resolution +
// dedupe + response shaping; centralising it keeps them in lock-step.

import type { User } from "@shared/schema";
import { groupNotifiedUsersByEmail } from "./sendgrid-service";

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
