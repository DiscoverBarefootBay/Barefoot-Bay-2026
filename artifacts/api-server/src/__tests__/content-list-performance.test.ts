import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { communityDirectoryQuery, projectCommunityCard } from "../community-directory";
import { forumCountsQuery, forumUnreadStatusesQuery } from "../forum-counts";
import { filterForViewer } from "../dmca/content-visibility";

const dialect = new PgDialect();
test("badge queries aggregate without post/comment bodies or per-post round trips", () => {
  for (const query of [forumCountsQuery(123), forumUnreadStatusesQuery(123, 4)]) {
    const compiled = dialect.sqlToQuery(query);
    assert.doesNotMatch(compiled.sql, /\bcontent\b|\btitle\b|SELECT \*/);
    assert.match(compiled.sql, /GROUP BY post_id/);
    assert.match(compiled.sql, /last_read_at IS NULL/);
    assert.match(compiled.sql, /p.created_at > rs.last_read_at/);
    assert.match(compiled.sql, /cs.latest_id > rs.last_read_comment_id/);
    assert.match(compiled.sql, /COALESCE\(rs.last_read_comment_id, 0\) = 0/);
    assert.match(compiled.sql, /visibility_status = 'published'/);
    assert.ok(compiled.params.includes(123));
  }
});
test("Community filters hidden before dedup and category after dedup, with bound parameters", () => {
  const query = dialect.sqlToQuery(communityDirectoryQuery("government", false));
  assert.deepEqual(query.params, [false, "government", "government-%", "government"]);
  assert.match(query.sql, /DISTINCT ON \(slug\)/);
  assert.match(query.sql, /ORDER BY slug, "order", updated_at DESC, id DESC/);
  assert.ok(query.sql.indexOf(") chosen") < query.sql.indexOf("WHERE (category"));
});
test("Community summary keeps snippets and detail round-trip while excluding privileged metadata", () => {
  const page = { slug: "important-contacts", title: "", content: '<p>A &amp; B</p><img src="/photo.jpg">', createdAt: null,
    contentVisibility: { removed: true, status: "dmca_hidden", reason: "private" }, hiddenReason: "private" };
  const card = projectCommunityCard(page, "safety");
  assert.equal(card.href, "/community/important/contacts");
  assert.equal(card.title, "Important Contacts");
  assert.equal(card.description, "A & B");
  assert.equal(card.image, "/photo.jpg");
  assert.deepEqual(card.contentVisibility, { removed: true, status: "dmca_hidden" });
  assert.ok(!("content" in card)); assert.ok(!("hiddenReason" in card));
  assert.equal(projectCommunityCard({ ...page, slug: "safety-pet-rules" }, "safety").href, "/community/safety/pet-rules");
  assert.equal(projectCommunityCard({ ...page, content: '<img src="javascript:evil">' }, "safety").image, null);
});
test("Community uses existing viewer visibility before projecting summaries", () => {
  const rows = [
    { slug: "community-public", visibilityStatus: "published", updatedBy: 1 },
    { slug: "community-removed", visibilityStatus: "dmca_hidden", updatedBy: 1 },
    { slug: "community-moderated", visibilityStatus: "moderation_hidden", updatedBy: 1 },
  ];
  assert.equal(filterForViewer(rows, { userId: null, canViewHidden: false }, p => p.updatedBy).length, 1);
  const owned = filterForViewer(rows, { userId: 1, canViewHidden: false }, p => p.updatedBy);
  assert.equal(owned.length, 2);
  assert.equal(projectCommunityCard(owned[1], "community").contentVisibility?.removed, true);
});

test("Community cards derive readable excerpts without rewriting HTML, media or public metadata", () => {
  const page = { slug: "social-artists", title: "Artists", content:
    '<style>.club-master{color:red}</style><img src="/club.jpg"><h1>Artists</h1><p>Create art together.</p>',
    isHidden: false, createdAt: "2026-01-01", hiddenReason: "private",
    contentVisibility: { removed: false, status: "published", reason: "private" } };
  const before = structuredClone(page);
  const card = projectCommunityCard(page, "social");
  assert.equal(card.description, "Create art together.");
  assert.equal(card.image, "/club.jpg");
  assert.equal(card.href, "/community/social/artists");
  assert.equal(card.title, "Artists");
  assert.deepEqual(card.contentVisibility, { removed: false, status: "published" });
  assert.ok(!("content" in card));
  assert.ok(!("hiddenReason" in card));
  assert.deepEqual(page, before);
});
