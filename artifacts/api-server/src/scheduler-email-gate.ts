/**
 * Shared environment gate for background schedulers that send email.
 *
 * Only the deployed production server should ever send scheduler-driven
 * emails. The development workspace runs the very same scheduler code with
 * the same SendGrid credentials but reads a stale dev database, so it can
 * see bogus conditions (e.g. "no active listings for 8 days") and email real
 * admins false alerts — this actually happened for both the calendar digest
 * and the listing-expiration reminder.
 *
 * Detection matches the rest of the API server (see app.ts and
 * calendar-email-scheduler.ts): production means NODE_ENV=production or
 * REPLIT_DEPLOYMENT=true. For deliberate testing in a dev workspace, each
 * scheduler has its own explicit opt-in env var (set it to "true").
 */
export function isSchedulerEmailSendingEnabled(
  devOptInVar: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env[devOptInVar] === "true") return true;
  return env["NODE_ENV"] === "production" || env["REPLIT_DEPLOYMENT"] === "true";
}

/** Dev opt-in flag for the listing-expiration scheduler (mirrors CALENDAR_SCHEDULER_DEV_SENDING). */
export const LISTING_SCHEDULER_DEV_SENDING = "LISTING_SCHEDULER_DEV_SENDING";

/** Dev opt-in flag for the weekly "Currently, On The Market" email scheduler. */
export const WEEKLY_LISTINGS_SCHEDULER_DEV_SENDING = "WEEKLY_LISTINGS_SCHEDULER_DEV_SENDING";

/** Deliberate development opt-in for DMCA scheduler-generated staff email. */
export const DMCA_SCHEDULER_DEV_SENDING = "DMCA_SCHEDULER_DEV_SENDING";

/** Environment gate for the listing-expiration scheduler's emails. */
export function isListingExpirationEmailSendingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isSchedulerEmailSendingEnabled(LISTING_SCHEDULER_DEV_SENDING, env);
}

/** Environment gate for the weekly listings email scheduler. */
export function isWeeklyListingsEmailSendingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isSchedulerEmailSendingEnabled(WEEKLY_LISTINGS_SCHEDULER_DEV_SENDING, env);
}

export function isDmcaSchedulerEmailSendingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isSchedulerEmailSendingEnabled(DMCA_SCHEDULER_DEV_SENDING, env);
}
