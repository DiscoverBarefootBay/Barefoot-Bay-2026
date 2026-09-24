import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  collectEvents,
  collectForumPosts,
  collectListings,
  collectPageContents,
} from "../routes/sitemap";
import { ogTagsMiddleware } from "../og-tags-middleware";

const BASE = "http://localhost:80";

async function request(path: string): Promise<{ status: number; body: any; text: string }> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* non-JSON response */ }
  return { status: response.status, body, text };
}

function containsId(value: any, id: number): boolean {
  if (Array.isArray(value)) return value.some((item) => containsId(item, id));
  if (!value || typeof value !== "object") return false;
  if (Number(value.id) === id) return true;
  return Object.values(value).some((item) => containsId(item, id));
}

function containsSlug(value: any, slug: string): boolean {
  if (Array.isArray(value)) return value.some((item) => containsSlug(item, slug));
  if (!value || typeof value !== "object") return false;
  if (value.slug === slug) return true;
  return Object.values(value).some((item) => containsSlug(item, slug));
}

function assertRemovedDetail(result: { status: number; body: any }, label: string) {
  assert.equal(result.status, 404, `${label} should return 404`);
  assert.equal(result.body?.removed, true, `${label} should return the generic removed marker`);
}

describe("DMCA visibility on public loaders", () => {
  it("removes hidden forum, event, listing, and page content from every anonymous surface", async (t) => {
    try {
      await request("/api/health");
    } catch {
      t.skip("live API at localhost:80 is unreachable");
      return;
    }

    const selected = await db.execute(sql`
      SELECT
        (SELECT json_build_object('id', p.id, 'categoryId', p.category_id, 'title', p.title)
           FROM forum_posts p WHERE p.visibility_status = 'published' ORDER BY p.id LIMIT 1) AS post,
        (SELECT json_build_object('id', e.id)
           FROM events e WHERE e.visibility_status = 'published' ORDER BY e.id LIMIT 1) AS event,
        (SELECT json_build_object('id', l.id)
           FROM real_estate_listings l WHERE l.visibility_status = 'published' ORDER BY l.id LIMIT 1) AS listing,
        (SELECT json_build_object('id', p.id, 'slug', p.slug)
           FROM page_contents p WHERE p.visibility_status = 'published' AND p.slug LIKE 'vendors-%' ORDER BY p.id LIMIT 1) AS page,
        (SELECT json_build_object('id', p.id, 'slug', p.slug)
           FROM page_contents p WHERE p.visibility_status = 'published' AND p.slug = 'banner-slides' LIMIT 1) AS banner,
        (SELECT json_build_object('id', p.id, 'slug', p.slug)
           FROM page_contents p WHERE p.visibility_status = 'published' AND p.slug LIKE 'social-%' ORDER BY p.id LIMIT 1) AS social`);
    const seed = selected.rows[0] as any;
    if (!seed?.post || !seed?.event || !seed?.listing || !seed?.page || !seed?.banner || !seed?.social) {
      t.skip("dev database lacks one or more published rows required by the public-loader matrix");
      return;
    }
    const post = seed.post;
    const event = seed.event;
    const listing = seed.listing;
    const page = seed.page;
    const banner = seed.banner;
    let bannerIds: number[] = [];
    const social = seed.social;
    const titleWord = String(post.title).split(/\s+/).find((word: string) => word.replace(/\W/g, "").length >= 4)?.replace(/\W/g, "") || String(post.id);

    try {
      await db.execute(sql`UPDATE forum_posts SET visibility_status = 'dmca_hidden' WHERE id = ${Number(post.id)}`);
      await db.execute(sql`UPDATE events SET visibility_status = 'dmca_hidden' WHERE id = ${Number(event.id)}`);
      await db.execute(sql`UPDATE real_estate_listings SET visibility_status = 'dmca_hidden' WHERE id = ${Number(listing.id)}`);
      await db.execute(sql`UPDATE page_contents SET visibility_status = 'dmca_hidden' WHERE id = ${Number(page.id)}`);
      // banner-slides may exist as duplicate rows; hide every published copy (restored below).
      bannerIds = ((await db.execute(sql`SELECT id FROM page_contents WHERE slug = 'banner-slides' AND visibility_status = 'published'`)).rows as any[]).map((r) => Number(r.id));
      await db.execute(sql`UPDATE page_contents SET visibility_status = 'dmca_hidden' WHERE id = ${Number(social.id)} OR (slug = 'banner-slides' AND visibility_status = 'published')`);

      assertRemovedDetail(await request(`/api/forum/posts/${post.id}`), "forum post detail");
      assertRemovedDetail(await request(`/api/forum/posts/${post.id}/comments`), "forum comments");
      const category = await request(`/api/forum/categories/${post.categoryId}/posts`);
      assert.equal(category.status, 200);
      assert.equal(containsId(category.body, Number(post.id)), false);
      const stories = await request(`/api/forum/stories?categoryId=${post.categoryId}&limit=50`);
      assert.equal(stories.status, 200);
      assert.equal(containsId(stories.body, Number(post.id)), false);

      assertRemovedDetail(await request(`/api/events/${event.id}`), "event detail");
      const events = await request("/api/events");
      assert.equal(events.status, 200);
      assert.equal(containsId(events.body, Number(event.id)), false);
      assertRemovedDetail(await request(`/api/events/${event.id}/comments`), "event comments");

      assertRemovedDetail(await request(`/api/listings/${listing.id}`), "listing detail");
      assertRemovedDetail(await request(`/api/pages/${encodeURIComponent(page.slug)}`), "page detail");
      const pages = await request("/api/pages");
      assert.equal(pages.status, 200);
      assert.equal(containsSlug(pages.body, page.slug), false);
      assertRemovedDetail(await request(`/api/vendors/${encodeURIComponent(page.slug)}/comments`), "vendor comments");
      const bannerSlides = await request("/api/pages/banner-slides");
      assert.equal(bannerSlides.status, 404, "hidden banner-slides page must 404 publicly");
      const socialClubs = await request("/api/social-clubs");
      assert.equal(socialClubs.status, 200);
      assert.equal(containsId(socialClubs.body, Number(social.id)), false);
      const eventMedia = await request("/api/debug/check-event-media");
      assert.equal(eventMedia.status, 200);
      assert.equal(containsId(eventMedia.body?.events, Number(event.id)), false);

      const search = await request(`/api/search?q=${encodeURIComponent(titleWord)}`);
      assert.equal(search.status, 200);
      assert.equal(containsId(search.body, Number(post.id)), false);

      assert.equal((await collectForumPosts()).some((entry) => entry.loc.includes(`/${post.id}`)), false);
      assert.equal((await collectEvents()).some((entry) => entry.loc.includes(`/${event.id}`)), false);
      assert.equal((await collectListings()).some((entry) => entry.loc.includes(`/${listing.id}`)), false);
      assert.equal((await collectPageContents()).some((entry) => entry.loc.includes(String(page.slug))), false);

      let nextCalled = false;
      let emitted = "";
      const req: any = {
        path: `/forum/post/${post.id}`,
        protocol: "http",
        get(name: string) {
          if (name.toLowerCase() === "user-agent") return "facebookexternalhit/1.1";
          if (name.toLowerCase() === "host") return "localhost";
          return undefined;
        },
      };
      const res: any = {
        send(value: unknown) { emitted = String(value); return this; },
        setHeader() {},
        type() { return this; },
      };
      await ogTagsMiddleware(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, true, "hidden OG post should fall through without a post preview");
      assert.equal(emitted.includes(String(post.title)), false);
    } finally {
      await db.execute(sql`UPDATE forum_posts SET visibility_status = 'published' WHERE id = ${Number(post.id)}`);
      await db.execute(sql`UPDATE events SET visibility_status = 'published' WHERE id = ${Number(event.id)}`);
      await db.execute(sql`UPDATE real_estate_listings SET visibility_status = 'published' WHERE id = ${Number(listing.id)}`);
      await db.execute(sql`UPDATE page_contents SET visibility_status = 'published' WHERE id = ${Number(page.id)}`);
      await db.execute(sql`UPDATE page_contents SET visibility_status = 'published' WHERE id = ${Number(social.id)} OR id = ANY(ARRAY[${sql.join([Number(banner.id), ...bannerIds].map((id) => sql`${id}`), sql`, `)}]::int[])`);
    }
  });
});