/**
 * One-time backfill: normalize legacy bare-path media URLs across
 * forum posts/comments, banner slides, and vendor pages to their
 * canonical `/api/storage-proxy/direct-*` form.
 *
 * Motivated by task #105. The frontend's `normalizeMediaUrl`
 * (artifacts/discover-barefoot-bay/src/lib/object-storage-helper.ts)
 * currently papers over bare `/forum-media/<file>`, `/banner-slides/<file>`,
 * and `/vendor-media/<file>` URLs by rewriting them at render time.
 * That hides redirect chains and makes missing-file debugging painful.
 * This script picks one canonical form per media type and rewrites the
 * underlying DB rows so the stored value is what the browser actually
 * fetches.
 *
 * Tables/columns covered:
 *   - forum_posts.media_urls       (text[])
 *   - forum_comments.media_urls    (text[])
 *   - page_contents.media_urls     (text[], for slug LIKE 'vendors-%')
 *   - page_contents.content        (JSON array, for slug = 'banner-slides';
 *                                   each slide.src is normalized)
 *
 * For each URL:
 *   - external URLs (http(s)://) and data:/blob: URIs are left alone
 *   - URLs already in `/api/storage-proxy/direct-*` canonical form are
 *     left alone (after re-verifying the file still exists)
 *   - URLs in legacy/proxy shapes are rewritten to the canonical
 *     `/api/storage-proxy/direct-<kind>/<basename>` form, *after*
 *     verifying the file exists in the corresponding bucket via the
 *     same HEAD-with-`X-Obj-Bucket` probe the storage proxy uses
 *   - if the file is missing, the URL is dropped from the array (or
 *     the banner slide entry is dropped from the JSON array). If a
 *     row's media list becomes empty, the column is set to NULL so the
 *     UI's "no media" fallback is intentional rather than a render of
 *     a broken thumbnail.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run backfill-media-urls            # dry run
 *   pnpm --filter @workspace/scripts run backfill-media-urls -- --apply # write changes
 */

import { isNotNull, eq, like, and } from "drizzle-orm";
import {
  db,
  pool,
  forumPosts,
  forumComments,
  pageContents,
} from "@workspace/db";

const APPLY = process.argv.includes("--apply");

type MediaKind = "forum" | "banner" | "vendors" | "content";

interface MediaConfig {
  bucket: string;
  canonicalPrefix: string;
  /** Candidate keys to probe in the bucket for a given basename. */
  candidateKeys: (filename: string) => string[];
  /** Legacy / alternate URL prefixes that mean "this is a <kind> media URL". */
  legacyPrefixes: string[];
}

const MEDIA: Record<MediaKind, MediaConfig> = {
  forum: {
    bucket: "FORUM",
    canonicalPrefix: "/api/storage-proxy/direct-forum/",
    // Mirrors the candidateKeys list in
    // artifacts/api-server/src/object-storage-proxy.ts `direct-forum` route.
    candidateKeys: (f) => [f, `forum/${f}`, `FORUM/${f}`],
    legacyPrefixes: [
      "/api/storage-proxy/direct-forum/",
      "/api/storage-proxy/FORUM/forum/",
      "/api/storage-proxy/FORUM/",
      "/api/storage-proxy/forum/",
      "/forum-media/",
      "/forum/",
      "forum-media/",
    ],
  },
  banner: {
    bucket: "BANNER",
    canonicalPrefix: "/api/storage-proxy/direct-banner/",
    // The `direct-banner` route stores everything under banner-slides/<filename>.
    candidateKeys: (f) => [`banner-slides/${f}`, f, `BANNER/${f}`],
    legacyPrefixes: [
      "/api/storage-proxy/direct-banner/",
      "/api/storage-proxy/BANNER/banner-slides/",
      "/api/storage-proxy/BANNER/",
      "/api/storage-proxy/banner-slides/",
      "/banner-slides/",
      "/uploads/banner-slides/",
      "banner-slides/",
    ],
  },
  vendors: {
    bucket: "VENDORS",
    canonicalPrefix: "/api/storage-proxy/direct-vendors/",
    // Mirrors the candidateKeys list in `direct-vendors` route.
    candidateKeys: (f) => [
      f,
      `vendors/${f}`,
      `VENDORS/${f}`,
      `vendor-media/${f}`,
    ],
    legacyPrefixes: [
      "/api/storage-proxy/direct-vendors/",
      "/api/storage-proxy/VENDORS/",
      "/api/storage-proxy/vendors/",
      "/api/storage-proxy/vendor-media/",
      "/vendor-media/",
      "/vendors/",
      "vendor-media/",
    ],
  },
  content: {
    // Legacy content-media files were migrated with type `content-media`,
    // which has no explicit MEDIA_TYPE_TO_BUCKET mapping and therefore
    // lives in the DEFAULT bucket. Mirrors the `direct-content` route.
    bucket: "DEFAULT",
    canonicalPrefix: "/api/storage-proxy/direct-content/",
    candidateKeys: (f) => [
      `content-media/${f}`,
      f,
      `uploads/content-media/${f}`,
      `DEFAULT/content-media/${f}`,
    ],
    legacyPrefixes: [
      "/api/storage-proxy/direct-content/",
      "/api/storage-proxy/DEFAULT/content-media/",
      "/api/storage-proxy/content-media/",
      "/content-media/",
      "/uploads/content-media/",
      "content-media/",
    ],
  },
};

type Outcome =
  | { kind: "skipped-external"; current: string }
  | { kind: "skipped-unknown"; current: string }
  | { kind: "already-canonical"; current: string }
  | { kind: "rewrite"; from: string; to: string }
  | { kind: "missing-dropped"; from: string }
  | { kind: "unparseable"; current: string };

const counts: Record<Outcome["kind"], number> = {
  "skipped-external": 0,
  "skipped-unknown": 0,
  "already-canonical": 0,
  rewrite: 0,
  "missing-dropped": 0,
  unparseable: 0,
};

// HEAD probes are expensive; cache results within a single run.
const existsCache = new Map<string, boolean>();

function classify(url: string): MediaKind | null {
  const clean = url.trim().split("?")[0].split("#")[0];
  for (const kind of Object.keys(MEDIA) as MediaKind[]) {
    for (const prefix of MEDIA[kind].legacyPrefixes) {
      if (clean.startsWith(prefix)) return kind;
    }
  }
  return null;
}

function extractBasename(url: string, kind: MediaKind): string | null {
  const clean = url.trim().split("?")[0].split("#")[0];
  if (!clean) return null;
  for (const prefix of MEDIA[kind].legacyPrefixes) {
    if (clean.startsWith(prefix)) {
      const rest = clean.slice(prefix.length);
      const basename = rest.split("/").filter(Boolean).pop() ?? "";
      return basename || null;
    }
  }
  return null;
}

async function fileExists(kind: MediaKind, filename: string): Promise<boolean> {
  const cacheKey = `${kind}:${filename}`;
  const cached = existsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const { bucket, candidateKeys } = MEDIA[kind];
  for (const key of candidateKeys(filename)) {
    try {
      const res = await fetch(`https://object-storage.replit.app/${key}`, {
        method: "HEAD",
        headers: { "X-Obj-Bucket": bucket },
      });
      if (res.ok) {
        existsCache.set(cacheKey, true);
        return true;
      }
    } catch {
      // network blip — try next candidate
    }
  }
  existsCache.set(cacheKey, false);
  return false;
}

/**
 * Resolve one URL. Returns:
 *   - the canonical URL string (rewritten or unchanged), or
 *   - null if the URL should be dropped from the array (missing file).
 * Also updates `counts` and logs verbose outcomes.
 */
async function resolveUrl(
  url: string,
  rowLabel: string,
): Promise<string | null> {
  const current = (url ?? "").trim();
  if (!current) {
    counts["unparseable"]++;
    return null;
  }

  if (
    current.startsWith("http://") ||
    current.startsWith("https://") ||
    current.startsWith("data:") ||
    current.startsWith("blob:")
  ) {
    counts["skipped-external"]++;
    return current;
  }

  const kind = classify(current);
  if (!kind) {
    counts["skipped-unknown"]++;
    console.log(`${rowLabel} skipped (unknown media url shape): ${current}`);
    return current;
  }

  const filename = extractBasename(current, kind);
  if (!filename) {
    counts["unparseable"]++;
    console.log(`${rowLabel} unparseable ${kind} url: ${current}`);
    return current;
  }

  const exists = await fileExists(kind, filename);
  if (!exists) {
    counts["missing-dropped"]++;
    console.log(
      `${rowLabel} missing ${kind} file ${filename} (was ${current}) — dropping`,
    );
    return null;
  }

  const canonical = `${MEDIA[kind].canonicalPrefix}${filename}`;
  if (current === canonical) {
    counts["already-canonical"]++;
    return current;
  }

  counts["rewrite"]++;
  console.log(`${rowLabel} rewrite ${current}  ->  ${canonical}`);
  return canonical;
}

/**
 * Process a text[] media_urls column. Returns the new array value
 * (possibly null if the array becomes empty and the column is nullable).
 * Returns `undefined` if no change is needed.
 */
async function processMediaUrlsArray(
  current: string[] | null | undefined,
  rowLabel: string,
): Promise<string[] | null | undefined> {
  if (!current || current.length === 0) return undefined;

  const next: string[] = [];
  let changed = false;
  for (const url of current) {
    const resolved = await resolveUrl(url, rowLabel);
    if (resolved === null) {
      changed = true;
      continue;
    }
    if (resolved !== url) changed = true;
    next.push(resolved);
  }

  if (!changed) return undefined;
  return next.length === 0 ? null : next;
}

async function backfillForumPosts() {
  console.log("\n[backfill-media-urls] === forum_posts.media_urls ===");
  const rows = await db
    .select({ id: forumPosts.id, mediaUrls: forumPosts.mediaUrls })
    .from(forumPosts)
    .where(isNotNull(forumPosts.mediaUrls));
  console.log(`  ${rows.length} forum posts have media_urls`);

  for (const row of rows) {
    const label = `[forum_post ${row.id}]`;
    const next = await processMediaUrlsArray(row.mediaUrls, label);
    if (next === undefined) continue;
    if (APPLY) {
      await db
        .update(forumPosts)
        .set({ mediaUrls: next })
        .where(eq(forumPosts.id, row.id));
    }
    console.log(
      `${label} ${APPLY ? "UPDATED" : "would update"} media_urls -> ${
        next === null ? "NULL" : JSON.stringify(next)
      }`,
    );
  }
}

async function backfillForumComments() {
  console.log("\n[backfill-media-urls] === forum_comments.media_urls ===");
  const rows = await db
    .select({ id: forumComments.id, mediaUrls: forumComments.mediaUrls })
    .from(forumComments)
    .where(isNotNull(forumComments.mediaUrls));
  console.log(`  ${rows.length} forum comments have media_urls`);

  for (const row of rows) {
    const label = `[forum_comment ${row.id}]`;
    const next = await processMediaUrlsArray(row.mediaUrls, label);
    if (next === undefined) continue;
    if (APPLY) {
      await db
        .update(forumComments)
        .set({ mediaUrls: next })
        .where(eq(forumComments.id, row.id));
    }
    console.log(
      `${label} ${APPLY ? "UPDATED" : "would update"} media_urls -> ${
        next === null ? "NULL" : JSON.stringify(next)
      }`,
    );
  }
}

async function backfillVendorPages() {
  console.log(
    "\n[backfill-media-urls] === page_contents.media_urls (vendors-*) ===",
  );
  const rows = await db
    .select({ id: pageContents.id, slug: pageContents.slug, mediaUrls: pageContents.mediaUrls })
    .from(pageContents)
    .where(
      and(like(pageContents.slug, "vendors-%"), isNotNull(pageContents.mediaUrls)),
    );
  console.log(`  ${rows.length} vendor pages have media_urls`);

  for (const row of rows) {
    const label = `[page_content ${row.id} ${row.slug}]`;
    const next = await processMediaUrlsArray(row.mediaUrls, label);
    if (next === undefined) continue;
    if (APPLY) {
      await db
        .update(pageContents)
        .set({ mediaUrls: next })
        .where(eq(pageContents.id, row.id));
    }
    console.log(
      `${label} ${APPLY ? "UPDATED" : "would update"} media_urls -> ${
        next === null ? "NULL" : JSON.stringify(next)
      }`,
    );
  }
}

async function backfillBannerSlides() {
  console.log(
    "\n[backfill-media-urls] === page_contents.content (banner-slides JSON) ===",
  );
  const rows = await db
    .select({ id: pageContents.id, content: pageContents.content })
    .from(pageContents)
    .where(eq(pageContents.slug, "banner-slides"));
  console.log(`  ${rows.length} banner-slides rows`);

  for (const row of rows) {
    const label = `[banner-slides page_content ${row.id}]`;
    let slides: Array<Record<string, unknown>>;
    try {
      const parsed = JSON.parse(row.content);
      if (!Array.isArray(parsed)) {
        console.log(`${label} content is not a JSON array — skipping`);
        continue;
      }
      slides = parsed;
    } catch (err) {
      console.log(`${label} content is not valid JSON — skipping (${err})`);
      continue;
    }

    const nextSlides: Array<Record<string, unknown>> = [];
    let changed = false;
    for (const slide of slides) {
      const src = typeof slide?.src === "string" ? (slide.src as string) : "";
      if (!src) {
        nextSlides.push(slide);
        continue;
      }
      const resolved = await resolveUrl(src, label);
      if (resolved === null) {
        changed = true;
        continue; // drop slide entirely
      }
      if (resolved !== src) {
        changed = true;
        nextSlides.push({ ...slide, src: resolved });
      } else {
        nextSlides.push(slide);
      }
    }

    if (!changed) continue;

    const newContent = JSON.stringify(nextSlides);
    if (APPLY) {
      await db
        .update(pageContents)
        .set({ content: newContent })
        .where(eq(pageContents.id, row.id));
    }
    console.log(
      `${label} ${APPLY ? "UPDATED" : "would update"} content (${slides.length} -> ${nextSlides.length} slides)`,
    );
  }
}

async function main() {
  console.log(
    `[backfill-media-urls] Starting (${APPLY ? "APPLY" : "DRY RUN"})`,
  );

  await backfillForumPosts();
  await backfillForumComments();
  await backfillVendorPages();
  await backfillBannerSlides();

  console.log("\n[backfill-media-urls] summary:", counts);
  if (!APPLY) {
    console.log(
      "[backfill-media-urls] dry run only — re-run with `-- --apply` to persist changes",
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error("[backfill-media-urls] FAILED:", err);
  process.exitCode = 1;
  pool.end().catch(() => {});
});
