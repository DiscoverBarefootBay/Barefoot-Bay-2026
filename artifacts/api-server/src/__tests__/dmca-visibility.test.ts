import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  ANONYMOUS_VIEWER,
  canViewerSee,
  enforceVisibilityOnJson,
  filterForViewer,
  filterByHiddenIndex,
  isContentIdPublic,
  publicOnly,
  resolveDetailForViewer,
  withVisibilityFlag,
} from "../dmca/content-visibility";

const published = { id: 1, userId: 10, visibilityStatus: "published" };
const hidden = {
  id: 2,
  userId: 10,
  visibilityStatus: "dmca_hidden",
  hiddenAt: new Date("2026-01-02T00:00:00Z"),
  hiddenReason: "notice",
  dmcaCaseId: 4,
  legalHold: true,
};

function response() {
  const state: any = { statusCode: 200, body: undefined };
  state.status = (code: number) => { state.statusCode = code; return state; };
  state.json = (body: unknown) => { state.body = body; return state; };
  return state;
}

describe("central DMCA visibility policy", () => {
  it("publicOnly returns only published rows", () => {
    assert.deepEqual(publicOnly([published, hidden]), [published]);
    assert.deepEqual(publicOnly(undefined), []);
  });

  it("allows published content, owners, and privileged viewers", () => {
    assert.equal(canViewerSee(published, ANONYMOUS_VIEWER, 10), true);
    assert.equal(canViewerSee(hidden, ANONYMOUS_VIEWER, 10), false);
    assert.equal(canViewerSee(hidden, { userId: 10, canViewHidden: false }, 10), true);
    assert.equal(canViewerSee(hidden, { userId: 99, canViewHidden: true }, 10), true);
  });

  it("flags hidden rows without changing published rows", () => {
    assert.equal(withVisibilityFlag(published), published);
    const flagged = withVisibilityFlag(hidden);
    assert.deepEqual(flagged.contentVisibility, {
      status: "dmca_hidden",
      removed: true,
      dmcaCaseId: 4,
      hiddenAt: "2026-01-02T00:00:00.000Z",
      reason: "notice",
      legalHold: true,
    });
  });

  it("filterForViewer implements public, owner, and opt-in admin lists", () => {
    const ownerOf = (row: any) => row.userId;
    assert.deepEqual(filterForViewer([published, hidden], ANONYMOUS_VIEWER, ownerOf), [published]);
    assert.equal(filterForViewer([published, hidden], { userId: 10, canViewHidden: false }, ownerOf).length, 2);
    assert.deepEqual(filterForViewer([published, hidden], { userId: 99, canViewHidden: true }, ownerOf), [published]);
    assert.equal(filterForViewer(
      [published, hidden],
      { userId: 99, canViewHidden: true },
      ownerOf,
      { includeHiddenForAdmins: true },
    ).length, 2);
  });

  it("resolveDetailForViewer returns a generic removed 404 to anonymous users", async () => {
    const req: any = { isAuthenticated: () => false };
    const res = response();
    assert.equal(await resolveDetailForViewer(req, res, hidden, 10, "Post"), null);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { message: "Post is no longer available", removed: true });
  });

  it("resolveDetailForViewer returns a flagged row to its authenticated owner", async () => {
    const req: any = { isAuthenticated: () => true, user: { id: 10, role: "member" } };
    const res = response();
    const row = await resolveDetailForViewer(req, res, hidden, 10);
    assert.equal(row?.contentVisibility?.removed, true);
    assert.equal(res.body, undefined);
  });

  it("enforceVisibilityOnJson polices both single rows and arrays", async () => {
    const req: any = { isAuthenticated: () => false };
    const single = response();
    await enforceVisibilityOnJson(req, single, (row) => row.userId, "Post");
    single.json(hidden);
    assert.equal(single.statusCode, 404);
    assert.equal(single.body.removed, true);

    const list = response();
    await enforceVisibilityOnJson(req, list, (row) => row.userId);
    list.json([published, hidden]);
    assert.deepEqual(list.body, [published]);
  });

  it("filters a hidden id against the database index and restores its row", async (t) => {
    let postId: number | null = null;
    try {
      const seed = await db.execute(sql`
        SELECT u.id AS user_id, c.id AS category_id
        FROM users u CROSS JOIN forum_categories c LIMIT 1`);
      if (!seed.rows.length) {
        t.skip("dev database has no user/category seed needed for an FK-safe throwaway post");
        return;
      }
      const userId = Number((seed.rows[0] as any).user_id);
      const categoryId = Number((seed.rows[0] as any).category_id);
      const inserted = await db.execute(sql`
        INSERT INTO forum_posts (title, content, category_id, user_id, visibility_status)
        VALUES (${"dmca visibility test"}, ${"throwaway"}, ${categoryId}, ${userId}, 'dmca_hidden')
        RETURNING id`);
      postId = Number((inserted.rows[0] as any).id);

      assert.equal(await isContentIdPublic("forum_post", postId), false);
      assert.deepEqual(await filterByHiddenIndex("forum_post", [{ id: postId }]), []);
      const ownerRows = await filterByHiddenIndex(
        "forum_post",
        [{ id: postId, title: "owned" }],
        { userId, canViewHidden: false },
      );
      assert.equal(ownerRows.length, 1);
      assert.equal(ownerRows[0].contentVisibility.status, "dmca_hidden");

      await db.execute(sql`UPDATE forum_posts SET visibility_status = 'published' WHERE id = ${postId}`);
      assert.equal(await isContentIdPublic("forum_post", postId), true);
    } finally {
      if (postId != null) {
        await db.execute(sql`UPDATE forum_posts SET visibility_status = 'published', legal_hold = false WHERE id = ${postId}`);
        await db.execute(sql`DELETE FROM forum_posts WHERE id = ${postId}`);
      }
    }
  });
});