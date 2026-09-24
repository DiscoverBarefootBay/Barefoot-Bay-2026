import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  assertContentDeletable,
  assertTableDeletable,
  assertUserDeletable,
  LegalHoldError,
} from "../dmca/legal-hold";
import {
  installLegalHoldGuards,
  isLegalHoldDbError,
  legalHoldResponseMiddleware,
} from "../dmca/storage-guards";
import { storage } from "../storage";

describe("legal-hold wrappers", () => {
  it("prevents a wrapped delete from reaching storage", async () => {
    let called = false;
    const storage = { async remove(_id: number) { called = true; } };
    installLegalHoldGuards(storage, {
      remove: async () => { throw new LegalHoldError("Test item", [7]); },
    });
    await assert.rejects(() => storage.remove(7), (error: unknown) =>
      error instanceof LegalHoldError && error.statusCode === 423);
    assert.equal(called, false);
  });

  it("recognizes direct and wrapped database backstop errors", () => {
    assert.equal(isLegalHoldDbError({ code: "BBLH1" }), true);
    assert.equal(isLegalHoldDbError({ cause: { code: "BBLH1" } }), true);
    assert.equal(isLegalHoldDbError(new Error("LEGAL_HOLD: held row")), true);
    assert.equal(isLegalHoldDbError(new Error("other")), false);
  });

  it("translates a generic 500 response when a hold error arose in context", () => {
    const state: any = { statusCode: 200, body: null, headersSent: false };
    const res: any = {
      get statusCode() { return state.statusCode; },
      set statusCode(v: number) { state.statusCode = v; },
      get headersSent() { return state.headersSent; },
      status(code: number) { state.statusCode = code; return this; },
      json(body: unknown) { state.body = body; return this; },
      send(body: unknown) { state.body = body; return this; },
    };
    legalHoldResponseMiddleware()({} as any, res, () => {
      new LegalHoldError("Held post", [12]);
      res.status(500).json({ error: "generic" });
    });
    assert.equal(state.statusCode, 423);
    assert.deepEqual(state.body.heldIds, [12]);
    assert.equal(state.body.error, "legal_hold");
  });
});

describe("legal-hold database enforcement", () => {
  it("blocks direct, cascading, table, and raw-SQL deletion", async (t) => {
    let postId: number | null = null;
    let commentId: number | null = null;
    let caseId: number | null = null;
    try {
      const seed = await db.execute(sql`
        SELECT u.id AS user_id, c.id AS category_id
        FROM users u CROSS JOIN forum_categories c LIMIT 1`);
      if (!seed.rows.length) {
        t.skip("dev database has no user/category seed needed for FK-safe throwaway rows");
        return;
      }
      const userId = Number((seed.rows[0] as any).user_id);
      const categoryId = Number((seed.rows[0] as any).category_id);
      const p = await db.execute(sql`
        INSERT INTO forum_posts (title, content, category_id, user_id)
        VALUES (${"dmca legal hold test"}, ${"throwaway"}, ${categoryId}, ${userId}) RETURNING id`);
      postId = Number((p.rows[0] as any).id);
      const c = await db.execute(sql`
        INSERT INTO forum_comments (content, post_id, author_id)
        VALUES (${"held throwaway"}, ${postId}, ${userId}) RETURNING id`);
      commentId = Number((c.rows[0] as any).id);

      await db.execute(sql`UPDATE forum_posts SET legal_hold = true WHERE id = ${postId}`);
      await assert.rejects(() => assertContentDeletable("forum_post", postId!), LegalHoldError);
      await assert.rejects(() => assertTableDeletable("forum_post"), LegalHoldError);

      await db.execute(sql`UPDATE forum_posts SET legal_hold = false WHERE id = ${postId}`);
      await db.execute(sql`UPDATE forum_posts SET visibility_status = 'dmca_hidden' WHERE id = ${postId}`);
      await assert.rejects(() => assertContentDeletable("forum_post", postId!), LegalHoldError);
      await assert.rejects(() => assertTableDeletable("forum_post"), LegalHoldError);
      await assert.rejects(() => assertUserDeletable(userId), LegalHoldError);
      let hiddenDeleteError: unknown;
      try {
        await db.execute(sql`DELETE FROM forum_posts WHERE id = ${postId}`);
      } catch (error) {
        hiddenDeleteError = error;
      }
      assert.equal(isLegalHoldDbError(hiddenDeleteError), true);
      await db.execute(sql`UPDATE forum_posts SET visibility_status = 'published' WHERE id = ${postId}`);
      await db.execute(sql`UPDATE forum_comments SET visibility_status = 'dmca_hidden' WHERE id = ${commentId}`);
      await assert.rejects(() => assertContentDeletable("forum_post", postId!), LegalHoldError);
      let hiddenCascadeError: unknown;
      try {
        await db.execute(sql`DELETE FROM forum_posts WHERE id = ${postId}`);
      } catch (error) {
        hiddenCascadeError = error;
      }
      assert.equal(isLegalHoldDbError(hiddenCascadeError), true);
      await db.execute(sql`UPDATE forum_comments SET visibility_status = 'published' WHERE id = ${commentId}`);

      const activeCase = await db.execute(sql`
        INSERT INTO dmca_cases (case_number, status_token)
        VALUES (${`BB-DMCA-2099-${String(postId).padStart(6, "0")}`}, ${`legal-hold-test-${postId}`})
        RETURNING id`);
      caseId = Number((activeCase.rows[0] as any).id);
      await db.execute(sql`
        INSERT INTO dmca_targets (dmca_case_id, content_type, content_id, uploader_user_id, status)
        VALUES (${caseId}, 'forum_post', ${postId}, ${userId}, 'taken_down')`);
      await assert.rejects(() => assertUserDeletable(userId), LegalHoldError);
      await db.execute(sql`UPDATE forum_comments SET legal_hold = true WHERE id = ${commentId}`);
      await assert.rejects(() => assertContentDeletable("forum_post", postId!), LegalHoldError);

      let rawError: unknown;
      try {
        await db.execute(sql`DELETE FROM forum_posts WHERE id = ${postId}`);
      } catch (error) {
        rawError = error;
      }
      assert.ok(rawError, "database trigger should refuse a cascade containing a held child");
      assert.equal(isLegalHoldDbError(rawError), true);
    } finally {
      if (commentId != null) await db.execute(sql`UPDATE forum_comments SET legal_hold = false WHERE id = ${commentId}`);
      if (postId != null) await db.execute(sql`UPDATE forum_posts SET legal_hold = false WHERE id = ${postId}`);
      if (commentId != null) await db.execute(sql`UPDATE forum_comments SET visibility_status = 'published' WHERE id = ${commentId}`);
      if (postId != null) await db.execute(sql`UPDATE forum_posts SET visibility_status = 'published' WHERE id = ${postId}`);
      if (caseId != null) {
        await db.execute(sql`DELETE FROM dmca_targets WHERE dmca_case_id = ${caseId}`);
        await db.execute(sql`DELETE FROM dmca_cases WHERE id = ${caseId}`);
      }
      if (commentId != null) await db.execute(sql`DELETE FROM forum_comments WHERE id = ${commentId}`);
      if (postId != null) await db.execute(sql`DELETE FROM forum_posts WHERE id = ${postId}`);
    }
  });

  it("listing expiration excludes hidden and legally held evidence", async (t) => {
    const ids: number[] = [];
    try {
      const user = await db.execute(sql`SELECT id FROM users LIMIT 1`);
      if (!user.rows.length) {
        t.skip("dev database has no user seed for throwaway listings");
        return;
      }
      const userId = Number((user.rows[0] as any).id);
      for (const [title, visibility, held] of [
        ["DMCA expiry visible", "published", false],
        ["DMCA expiry hidden", "dmca_hidden", false],
        ["DMCA expiry held", "published", true],
      ] as const) {
        const row = await db.execute(sql`
          INSERT INTO real_estate_listings
            (listing_type, title, price, address, bedrooms, bathrooms, square_feet, year_built,
             contact_info, status, expiration_date, visibility_status, legal_hold, created_by)
          VALUES ('Classified', ${title}, 1, 'test', 0, 0, 0, 2000,
            '{}'::jsonb, 'ACTIVE', now() - interval '2 days',
            ${visibility}, ${held}, ${userId})
          RETURNING id`);
        ids.push(Number((row.rows[0] as any).id));
      }
      const expired = await storage.getExpiredListings(new Date());
      const returned = new Set(expired.map((row: any) => Number(row.id)));
      assert.equal(returned.has(ids[0]), true);
      assert.equal(returned.has(ids[1]), false);
      assert.equal(returned.has(ids[2]), false);
    } finally {
      if (ids.length) {
        await db.execute(sql`
          UPDATE real_estate_listings SET legal_hold = false, visibility_status = 'published'
          WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
        await db.execute(sql`
          DELETE FROM real_estate_listings
          WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
      }
    }
  });
});