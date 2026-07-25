import { logger } from "./lib/logger";
import { db } from "./db";
import { forumPosts } from "@workspace/db";
import { and, eq, lt, isNotNull, sql } from "drizzle-orm";

const BADGE_TTL_DAYS = 7;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const BOOT_DELAY_MS = 60 * 1000; // 1 minute after boot

let started = false;
let ticking = false;

async function expireStaleUpdatedBadges(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const result = await db
      .update(forumPosts)
      .set({
        isEditoriallyUpdated: false,
        editoriallyUpdatedAt: null,
      })
      .where(
        and(
          eq(forumPosts.isEditoriallyUpdated, true),
          isNotNull(forumPosts.editoriallyUpdatedAt),
          lt(
            forumPosts.editoriallyUpdatedAt,
            sql`NOW() - INTERVAL '${sql.raw(String(BADGE_TTL_DAYS))} days'`,
          ),
        ),
      )
      .returning({ id: forumPosts.id });

    if (result.length > 0) {
      logger.info(
        { count: result.length, ids: result.map((r) => r.id) },
        "[ForumBadgeExpiration] Cleared stale 'Updated' badges",
      );
    }
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
    { intervalMs: CHECK_INTERVAL_MS, ttlDays: BADGE_TTL_DAYS },
    "[ForumBadgeExpiration] Starting 'Updated' badge auto-expiration scheduler",
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
