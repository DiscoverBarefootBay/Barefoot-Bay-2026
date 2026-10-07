// Read-only development checks. No authentication bypass, schema changes, writes
// or personal data output. SQL fixture values live only in a SELECT CTE.
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { badgeUnreadSql, forumCountsQuery } from "../src/forum-counts";

try {
  const fixtures = [
    [null, null, 0, null, true], [null, null, 2, 2, true],
    ["2026-01-01", 2, 2, 2, true], // post created after the read timestamp
    ["2026-02-01", null, 0, null, false],
    ["2026-02-01", null, 2, 2, true], // timestamp alone doesn't mark comments read
    ["2026-02-01", 2, 2, 2, false],
    ["2026-02-01", 2, 3, 3, true],
    ["2026-02-01", 10, 1, 1, false], // deleted newer comments
    ["2026-02-01", 0, 2, 2, true],
  ] as const;
  for (const [lastReadAt, marker, count, latestId, expected] of fixtures) {
    const result = await db.execute(sql`
      SELECT COALESCE(${badgeUnreadSql}, false) AS unread
      FROM (SELECT '2026-01-15'::timestamp AS created_at) p
      CROSS JOIN (SELECT ${lastReadAt}::timestamp AS last_read_at, ${marker}::integer AS last_read_comment_id) rs
      CROSS JOIN (SELECT ${count}::integer AS comment_count, ${latestId}::integer AS latest_id) cs
    `);
    assert.equal(result.rows[0].unread, expected);
  }
  console.log(`SQL unread-rule fixtures passed: ${fixtures.length}`);
  const indexes = await db.execute(sql`
    SELECT tablename, indexdef FROM pg_indexes
    WHERE tablename IN ('forum_posts','forum_comments','forum_read_states','page_contents')
  `);
  console.log("Existing indexes:", indexes.rows);

  // Benchmark query shape using a nonexistent viewer, not a signed-in session.
  const viewer = -1;
  const startOld = performance.now();
  const posts = await db.execute(sql`SELECT id, category_id FROM forum_posts WHERE visibility_status='published'`);
  let legacyQueries = 1;
  let legacyUnread = 0;
  for (const p of posts.rows as any[]) {
    const counts = await db.execute(sql`SELECT COUNT(*)::int AS n FROM forum_comments WHERE post_id=${p.id}`);
    const latest = await db.execute(sql`SELECT id FROM forum_comments WHERE post_id=${p.id} ORDER BY id DESC LIMIT 1`);
    legacyQueries += 2;
    if (counts.rows[0].n && latest.rows.length) {
      await db.execute(sql`SELECT created_at FROM forum_comments WHERE post_id=${p.id} ORDER BY created_at DESC LIMIT 1`);
      legacyQueries++;
    }
    legacyUnread++; // all posts are never-read for this nonexistent viewer
  }
  const legacyMs = performance.now() - startOld;
  const startNew = performance.now();
  const counts = await db.execute(forumCountsQuery(viewer));
  const optimizedMs = performance.now() - startNew;
  assert.equal(counts.rows.reduce((n, r: any) => n + r.unreadCount, 0), legacyUnread);
  console.log(JSON.stringify({ kind: "read-only SQL model, NOT signed-in browser", publishedPosts: posts.rows.length,
    legacyQueries, optimizedQueries: 1, legacyMs: Math.round(legacyMs), optimizedMs: Math.round(optimizedMs) }));
} finally {
  await pool.end();
}
