import { getApp } from "./app";
import { logger } from "./lib/logger";
import { startCalendarEmailScheduler } from "./calendar-email-scheduler";
import { startListingExpirationScheduler } from "./listing-expiration-scheduler";
import { startWeeklyListingsEmailScheduler } from "./weekly-listings-scheduler";
import { startForumBadgeExpirationScheduler } from "./forum-badge-expiration-scheduler";
import { ensureFeaturedListingsFlag } from "./featured-listings-flag";

// Catch unhandled rejections from optional services (e.g. Object Storage when
// no bucket is provisioned) so they don't crash the server process.
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  // Object Storage init failures are non-fatal — just log and continue.
  if (
    msg.includes("bucket") ||
    msg.includes("Cloud Storage") ||
    msg.includes("object-storage") ||
    msg.includes("REPLIT_BUCKET")
  ) {
    logger.warn({ reason: msg }, "Object Storage unavailable (no bucket configured) — continuing without it");
    return;
  }
  logger.error({ reason }, "Unhandled promise rejection");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

getApp().then(({ server }) => {
  server.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "Server listening");
    // Start the background scheduler that fires the daily automatic calendar
    // email at the admin-configured time. Started after the server is up so the
    // process is fully booted; idempotent so it only ever runs one timer.
    startCalendarEmailScheduler();
    // Start the background scheduler that marks date-expired real estate
    // listings as EXPIRED so their status never drifts out of sync with their
    // expiration date. Idempotent so it only ever runs one timer.
    startListingExpirationScheduler();
    // Start the weekly "Currently, On The Market" promotional email scheduler.
    // Ships disabled; the admin Email Activity tab turns it on. Idempotent.
    startWeeklyListingsEmailScheduler();
    // Start the daily job that clears the "Updated" badge from forum posts
    // once their 7-day expiration window has elapsed. Idempotent.
    startForumBadgeExpirationScheduler();
    // Seed the featured_listings feature flag so the admin toggle exists.
    // Idempotent; fire-and-forget (errors are logged inside).
    void ensureFeaturedListingsFlag();
  });

  server.on("error", (err) => {
    logger.error({ err }, "Server error");
    process.exit(1);
  });
}).catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
