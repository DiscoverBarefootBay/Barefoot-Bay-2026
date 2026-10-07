// Public real endpoint verification. GET only; no auth or content mutations.
import assert from "node:assert/strict";
const base = process.argv[2];
if (!base?.startsWith("https://")) throw new Error("Pass the preview URL");
const sorts = ["newest_created", "oldest_created", "newest_comment", "oldest_comment", "newest_edited", "oldest_edited"];
for (const sort of sorts) {
  let offset = 0, revision, total, seen = new Set();
  do {
    const params = new URLSearchParams({ limit: "12", offset: String(offset), sort });
    if (revision) params.set("revision", revision);
    const res = await fetch(`${base}/api/forum/stories?${params}`);
    assert.equal(res.status, 200);
    const page = await res.json();
    assert.equal(page.stories.length <= 12, true);
    for (const story of page.stories) {
      assert.ok(!seen.has(story.id), "No duplicate story across tied boundaries");
      assert.ok(!("content" in story));
      assert.equal(story.isUnread, false, "Guest read-state is not personalized");
      seen.add(story.id);
    }
    if (revision) assert.equal(page.revision, revision);
    revision = page.revision; total = page.total;
    assert.ok(!page.hasMore || page.nextOffset > offset);
    offset = page.nextOffset;
    if (!page.hasMore) break;
  } while (true);
  assert.equal(seen.size, total);
  assert.ok(seen.size > 50);
  console.log(`${sort}: all ${total} stories once, 12 per request`);
}
assert.equal((await fetch(`${base}/api/forum/stories?offset=12&revision=outdated`)).status, 409);
for (const invalid of ["offset=-1", "offset=1x", "limit=0", "categoryId=4x"]) {
  assert.equal((await fetch(`${base}/api/forum/stories?${invalid}`)).status, 400);
}
const all = await (await fetch(`${base}/api/pages`)).json();
for (const category of ["community", "safety", "government", "nature", "transportation", "religion", "services"]) {
  const cards = await (await fetch(`${base}/api/community-directory?category=${category}&includeHidden=true`)).json();
  assert.ok(Array.isArray(cards));
  const expected = all.filter(p => p.slug !== category && (p.category ? p.category === category : p.slug.startsWith(`${category}-`)));
  assert.deepEqual(cards.map(p => p.slug).sort(), expected.map(p => p.slug).sort());
  for (const card of cards) {
    assert.ok(!("content" in card)); assert.ok(!("hiddenReason" in card));
    assert.equal(card.isHidden, false, "Guest includeHidden cannot elevate permissions");
    const old = expected.find(p => p.slug === card.slug);
    const snippet = (old.content ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().substring(0, 220);
    assert.equal(card.description, snippet);
  }
  console.log(`Community ${category}: ${cards.length} cards, membership/snippets match legacy`);
}
assert.equal((await fetch(`${base}/api/community-directory?category=%27%3B`)).status, 400);
assert.equal((await fetch(`${base}/api/forum/unread-count`)).status, 401);
console.log("Revision conflict, invalid parameters, private summaries and guest permission checks passed");
