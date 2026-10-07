import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { readSocialClubSummaries } from "../social-club-summary";

test("social club choices select only public metadata and preserve duplicate precedence", async () => {
  let statement = "";
  const result = await readSocialClubSummaries({ execute: async (query: any) => {
    statement = new PgDialect().sqlToQuery(query).sql;
    return { rows: [
      { id: 1, slug: "social-z", title: "Z Club", visibilityStatus: "published", content: "Never returned" },
      { id: 2, slug: "social-a", title: "A Club", visibilityStatus: "published" },
      { id: 3, slug: "social-removed", title: "Removed", visibilityStatus: "dmca_hidden" },
      { id: 4, slug: "social-moderated", title: "Moderated", visibilityStatus: "moderation_hidden" },
    ] };
  } } as any);
  assert.deepEqual(result, [{ id: 2, slug: "social-a", title: "A Club" }, { id: 1, slug: "social-z", title: "Z Club" }]);
  assert.match(statement, /DISTINCT ON \(slug\)/);
  assert.match(statement, /slug LIKE 'social-%' AND is_hidden = false/);
  assert.match(statement, /ORDER BY slug, "order", updated_at DESC, id DESC/);
  assert.ok(!statement.includes("content,"));
  assert.ok(!statement.includes("visibility_status ="), "do not filter takedowns before deduplication");
});
