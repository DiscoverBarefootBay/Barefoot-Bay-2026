import { logger } from "./lib/logger";
import { checkExpiredListings, resolveAdminRecipientEmails } from "./listing-expiration-service";
import { storage } from "./storage";
import { sendNoActiveListingsAdminEmail } from "./sendgrid-service";
import { loadForSaleEmailConfig } from "./forsale-email-config";

// How often to scan for newly-expired listings. The expiration window is
// measured in days, so an hourly cadence is more than enough precision while
// keeping the database load negligible.
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// site_settings key holding the empty-For-Sale-page tracking state, persisted as
// JSON: { emptySince: ISO|null, lastReminderAt: ISO|null }.
const EMPTY_LISTINGS_SETTING_KEY = "forsale_empty_listings_state";
const DAY_MS = 24 * 60 * 60 * 1000;

interface EmptyListingsState {
  emptySince: string | null;
  lastReminderAt: string | null;
}

async function readEmptyListingsState(): Promise<EmptyListingsState> {
  try {
    const setting = await storage.getSiteSettingByKey(EMPTY_LISTINGS_SETTING_KEY);
    if (setting?.value) {
      const parsed = JSON.parse(setting.value) as Partial<EmptyListingsState>;
      return {
        emptySince: parsed.emptySince ?? null,
        lastReminderAt: parsed.lastReminderAt ?? null,
      };
    }
  } catch (err) {
    logger.warn({ err }, "[ListingExpirationScheduler] Failed to read empty-listings state");
  }
  return { emptySince: null, lastReminderAt: null };
}

async function writeEmptyListingsState(state: EmptyListingsState): Promise<void> {
  try {
    await storage.setSiteSetting(
      EMPTY_LISTINGS_SETTING_KEY,
      JSON.stringify(state),
      "Tracks how long the public For Sale page has had no active listings, for the weekly admin reminder.",
    );
  } catch (err) {
    logger.error({ err }, "[ListingExpirationScheduler] Failed to persist empty-listings state");
  }
}

/**
 * Count listings that are publicly active right now: status ACTIVE and not past
 * their expiration date. (DRAFT and EXPIRED are excluded by the status check.)
 */
async function countPubliclyActiveListings(now: number): Promise<number> {
  const listings = await storage.getListings();
  return listings.filter((l) => {
    if (l.status !== "ACTIVE") return false;
    if (l.expirationDate && new Date(l.expirationDate).getTime() <= now) return false;
    return true;
  }).length;
}

/**
 * Weekly admin reminder while the public For Sale page has had zero active
 * listings for 7+ straight days. The "empty since" clock resets the moment any
 * active listing exists again. Idempotent across ticks via the persisted state.
 */
async function checkNoActiveListingsReminder(): Promise<void> {
  const now = Date.now();

  let activeCount: number;
  try {
    activeCount = await countPubliclyActiveListings(now);
  } catch (err) {
    logger.error({ err }, "[ListingExpirationScheduler] Failed to count active listings");
    return;
  }

  const state = await readEmptyListingsState();

  // Admin-configurable timing: how long the page must stay empty before the
  // first reminder, and how often to re-send while it stays empty.
  const { emptyThresholdDays, resendIntervalDays } = (await loadForSaleEmailConfig()).timing;
  const emptyThresholdMs = emptyThresholdDays * DAY_MS;
  const reminderIntervalMs = resendIntervalDays * DAY_MS;

  // There are active listings — reset the tracking if it was set.
  if (activeCount > 0) {
    if (state.emptySince || state.lastReminderAt) {
      await writeEmptyListingsState({ emptySince: null, lastReminderAt: null });
    }
    return;
  }

  // Page is empty. Start the clock if we haven't already.
  let emptySinceMs = state.emptySince ? Date.parse(state.emptySince) : NaN;
  if (Number.isNaN(emptySinceMs)) {
    emptySinceMs = now;
    await writeEmptyListingsState({
      emptySince: new Date(emptySinceMs).toISOString(),
      lastReminderAt: state.lastReminderAt,
    });
  }

  // Not empty long enough yet.
  if (now - emptySinceMs < emptyThresholdMs) return;

  // Respect the configured re-send cadence.
  const lastReminderMs = state.lastReminderAt ? Date.parse(state.lastReminderAt) : NaN;
  if (!Number.isNaN(lastReminderMs) && now - lastReminderMs < reminderIntervalMs) return;

  let adminEmails: string[] = [];
  try {
    adminEmails = await resolveAdminRecipientEmails();
  } catch (err) {
    logger.error({ err }, "[ListingExpirationScheduler] Failed to resolve admin recipients for empty-page reminder");
    return;
  }
  if (adminEmails.length === 0) return;

  const daysEmpty = Math.max(emptyThresholdDays, Math.floor((now - emptySinceMs) / DAY_MS));
  // Load the editable email config once and reuse it across recipients. Respect
  // the enabled flag here so disabling the email stops the automated reminder.
  const emailConfig = await loadForSaleEmailConfig();
  if (!emailConfig.noActiveListings.enabled) {
    logger.info("[ListingExpirationScheduler] No-active-listings reminder is disabled; skipping send");
    return;
  }
  let sentCount = 0;
  for (const email of adminEmails) {
    try {
      // sendNoActiveListingsAdminEmail resolves false (it doesn't throw) when the
      // send fails, so check the boolean rather than relying on try/catch alone.
      const ok = await sendNoActiveListingsAdminEmail(email, daysEmpty, { config: emailConfig });
      if (ok) sentCount++;
      else logger.warn({ email }, "[ListingExpirationScheduler] Empty-page reminder send returned false");
    } catch (err) {
      logger.error({ err, email }, "[ListingExpirationScheduler] Failed to send empty-page reminder");
    }
  }

  // Only advance the weekly cadence if at least one reminder actually went out.
  // If every send failed (e.g. SendGrid outage), leave lastReminderAt unchanged
  // so the next tick retries instead of going quiet for another 7 days.
  if (sentCount === 0) {
    logger.error({ recipients: adminEmails.length }, "[ListingExpirationScheduler] No empty-page reminders sent; will retry next tick");
    return;
  }

  await writeEmptyListingsState({
    emptySince: new Date(emptySinceMs).toISOString(),
    lastReminderAt: new Date(now).toISOString(),
  });
  logger.info({ daysEmpty, sent: sentCount, recipients: adminEmails.length }, "[ListingExpirationScheduler] Sent no-active-listings admin reminder");
}

// Run the first scan shortly after boot (not immediately) so the process is
// fully up and the DB pool is ready, and so a crash-loop can't hammer the DB.
const BOOT_DELAY_MS = 30 * 1000; // 30 seconds

// Module-level guards: `started` makes start idempotent (one timer only),
// `ticking` prevents overlapping runs if a scan ever outlasts the interval.
let started = false;
let ticking = false;

async function runListingExpirationTick(): Promise<void> {
  if (ticking) {
    return;
  }
  ticking = true;
  try {
    // The weekly empty-page reminder runs after the expiration scan so any
    // listings that just flipped to EXPIRED are reflected in the active count.
    const result = await checkExpiredListings();
    // checkExpiredListings swallows its own errors and returns them on the
    // result object, so surface them here — otherwise an automatic failure
    // would be completely silent.
    if (result.error) {
      logger.error({ err: result.error }, "[ListingExpirationScheduler] Expiration check reported an error");
    }
    if (result.checked > 0) {
      logger.info(
        {
          checked: result.checked,
          expired: result.expired,
          renewed: result.renewed,
          deleted: result.deleted,
        },
        "[ListingExpirationScheduler] Processed expired listings",
      );
    }

    // Weekly admin reminder when the public For Sale page has no active listings.
    await checkNoActiveListingsReminder();
  } catch (err) {
    logger.error({ err }, "[ListingExpirationScheduler] Tick failed");
  } finally {
    ticking = false;
  }
}

/**
 * Start the background scheduler that marks date-expired real estate listings
 * as EXPIRED. Idempotent — calling it more than once is a no-op so we never end
 * up with two timers firing.
 */
export function startListingExpirationScheduler(): void {
  if (started) {
    return;
  }
  started = true;

  logger.info(
    { intervalMs: CHECK_INTERVAL_MS, bootDelayMs: BOOT_DELAY_MS },
    "[ListingExpirationScheduler] Starting automatic listing expiration scheduler",
  );

  // Catch up on anything already past its expiration date shortly after boot.
  setTimeout(() => {
    void runListingExpirationTick();
  }, BOOT_DELAY_MS).unref?.();

  const timer = setInterval(() => {
    void runListingExpirationTick();
  }, CHECK_INTERVAL_MS);

  // Don't let the timer keep the process alive on its own.
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}
