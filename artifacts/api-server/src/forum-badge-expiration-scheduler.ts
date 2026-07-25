import { logger } from "./lib/logger";
import { db } from "./db";
import { forumPosts } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const BOOT_DELAY_MS = 60 * 1000; // 1 minute after boot

let started = false;
let ticking = false;

async function expireStaleUpdatedBadges(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    logger.info("[ForumBadgeExpiration] Skipping — editorially_updated_at column not yet provisioned in DB");
  } catch (err) {
    logger.error({ err }, "[ForumBadgeExpiration] Failed to clear stale badges");
  } finally {
    ticking = false;
  }
}

export function startForumBadgeExpirationScheduler(): void {
  if (started) return;
  started = true;

  logger.info(
    { intervalMs: CHECK_INTERVAL_MS },
    "[ForumBadgeExpiration] Starting 'Updated' badge auto-expiration scheduler (dormant until DB column is provisioned)",
  );

  setTimeout(() => {
    void expireStaleUpdatedBadges();
  }, BOOT_DELAY_MS).unref?.();

  const timer = setInterval(() => {
    void expireStaleUpdatedBadges();
  }, CHECK_INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
}
