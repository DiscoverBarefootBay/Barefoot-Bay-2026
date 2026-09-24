import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  dispatchOutboxOnce,
  enqueueNotification,
  nextRetryDelayMs,
} from "../dmca/outbox";

describe("DMCA notification outbox", () => {
  it("uses exponential retry delay capped at six hours", () => {
    assert.equal(nextRetryDelayMs(1), 60_000);
    assert.equal(nextRetryDelayMs(2), 120_000);
    assert.equal(nextRetryDelayMs(4), 480_000);
    assert.equal(nextRetryDelayMs(99), 360 * 60_000);
  });

  it("respects the scheduler environment gate", async () => {
    const result = await dispatchOutboxOnce({ env: { NODE_ENV: "development" } });
    assert.equal(result.skippedByGate, true);
    assert.equal(result.claimed, 0);
  });

  it("marks successful, retryable, and exhausted rows correctly", async () => {
    const ids: number[] = [];
    const env = { NODE_ENV: "development", DMCA_OUTBOX_DEV_SENDING: "true" };
    try {
      const sentId = await enqueueNotification({
        eventType: "dmca.test.sent",
        dedupeKey: `dmca-test-sent-${Date.now()}`,
        email: { to: "nobody@example.test", subject: "test", text: "test" },
      });
      assert.ok(sentId);
      ids.push(sentId);
      const sent = await dispatchOutboxOnce({ env, onlyIds: [sentId], sender: async () => true });
      assert.deepEqual({ claimed: sent.claimed, sent: sent.sent }, { claimed: 1, sent: 1 });

      const retryId = await enqueueNotification({
        eventType: "dmca.test.retry",
        dedupeKey: `dmca-test-retry-${Date.now()}`,
        maxAttempts: 2,
        email: { to: "nobody@example.test", subject: "test", text: "test" },
      });
      assert.ok(retryId);
      ids.push(retryId);
      const failed = await dispatchOutboxOnce({ env, onlyIds: [retryId], sender: async () => false });
      assert.equal(failed.failed, 1);
      await db.execute(sql`UPDATE notification_outbox SET next_attempt_at = now() WHERE id = ${retryId}`);
      const dead = await dispatchOutboxOnce({ env, onlyIds: [retryId], sender: async () => { throw new Error("expected failure"); } });
      assert.equal(dead.dead, 1);

      const rows = await db.execute(sql`
        SELECT id, status, attempts FROM notification_outbox
        WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) ORDER BY id`);
      const byId = new Map((rows.rows as any[]).map((row) => [Number(row.id), row]));
      assert.equal(byId.get(sentId)?.status, "sent");
      assert.equal(byId.get(retryId)?.status, "dead");
      assert.equal(Number(byId.get(retryId)?.attempts), 2);
    } finally {
      if (ids.length) {
        await db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL dmca.allow_purge = 'on'`);
          await tx.execute(sql`DELETE FROM notification_outbox WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
        });
      }
    }
  });

  it("concurrent dispatchers claim and send one stale due row exactly once", async () => {
    const env = { NODE_ENV: "development", DMCA_OUTBOX_DEV_SENDING: "true" };
    const id = await enqueueNotification({
      eventType: "dmca.test.concurrent",
      dedupeKey: `dmca-test-concurrent-${Date.now()}`,
      email: { to: "nobody@example.test", subject: "concurrent", text: "test" },
    });
    assert.ok(id);
    let sends = 0;
    try {
      await db.execute(sql`
        UPDATE notification_outbox SET next_attempt_at = now() - interval '16 minutes'
        WHERE id = ${id}`);
      const sender = async () => {
        sends++;
        await new Promise((resolve) => setTimeout(resolve, 75));
        return true;
      };
      const results = await Promise.all([
        dispatchOutboxOnce({ env, onlyIds: [id], sender }),
        dispatchOutboxOnce({ env, onlyIds: [id], sender }),
      ]);
      assert.equal(results.reduce((n, result) => n + result.claimed, 0), 1);
      assert.equal(results.reduce((n, result) => n + result.sent, 0), 1);
      assert.equal(sends, 1);
    } finally {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL dmca.allow_purge = 'on'`);
        await tx.execute(sql`DELETE FROM notification_outbox WHERE id = ${id}`);
      });
    }
  });
});