import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../storage";
import { dbSlugToPublicUrl, isVendorPage } from "../shared-compat/vendor-url-utils";
import logger from "../logger";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://barefootbay.com").replace(/\/$/, "");

const FALLBACK_SITE_URL = "https://barefootbay.com";

// Disallowed paths kept in sync with the previous static robots.txt. Sourced from
// the legacy public/robots.txt so behaviour is unchanged besides the dynamic
// Sitemap line.
const ROBOTS_DISALLOW_PATHS = [
  "/admin",
  "/admin/",
  "/api/",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/unsubscribe",
  "/profile",
  "/subscriptions",
  "/community-settings",
  "/advanced-settings",
  "/messages",
  "/chat",
  "/my-listings",
  "/store/my-returns",
  "/store/pay/",
  "/store/order-complete/",
  "/store/track-order",
  "/for-sale/payment-complete",
  "/payment-complete",
  "/subscription/",
];

export interface RobotsRequestLike {
  protocol: string;
  get: (name: string) => string | undefined;
}

export function resolveRobotsSiteUrl(req: RobotsRequestLike): string {
  // Always advertise the sitemap on the host the crawler used to reach us, so
  // a request to a *.replit.dev preview, staging, or future production domain
  // gets a Sitemap line on the same origin. Only fall back to the canonical
  // PUBLIC_SITE_URL / barefootbay.com when no host header is available.
  const host = req.get("host");
  if (host) {
    const protocol = req.protocol || "https";
    return `${protocol}://${host}`.replace(/\/$/, "");
  }
  if (process.env.PUBLIC_SITE_URL) {
    return process.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  return FALLBACK_SITE_URL;
}

export function renderRobotsTxt(siteUrl: string): string {
  const lines: string[] = ["User-agent: *"];
  for (const path of ROBOTS_DISALLOW_PATHS) {
    lines.push(`Disallow: ${path}`);
  }
  lines.push("");
  lines.push(`Sitemap: ${siteUrl.replace(/\/$/, "")}/sitemap.xml`);
  lines.push("");
  return lines.join("\n");
}

// Google's sitemap spec caps a single sitemap at 50,000 URLs / 50 MB.
const MAX_URLS_PER_SITEMAP = 50_000;

type Entry = {
  loc: string;
  lastmod?: Date | null;
  changefreq?: string;
  priority?: number;
};

type Section = "events" | "listings" | "forum" | "pages";

const STATIC_ENTRIES: Entry[] = [
  { loc: "/", changefreq: "weekly", priority: 1.0 },
  { loc: "/calendar", changefreq: "daily", priority: 0.9 },
  { loc: "/forum", changefreq: "daily", priority: 0.9 },
  { loc: "/for-sale", changefreq: "daily", priority: 0.9 },
  { loc: "/real-estate", changefreq: "daily", priority: 0.9 },
  { loc: "/vendors", changefreq: "weekly", priority: 0.8 },
  { loc: "/amenities", changefreq: "monthly", priority: 0.7 },
  { loc: "/weather", changefreq: "daily", priority: 0.6 },
  { loc: "/store", changefreq: "weekly", priority: 0.7 },
  { loc: "/banner", changefreq: "weekly", priority: 0.5 },
  { loc: "/contact-us", changefreq: "monthly", priority: 0.5 },
];

export function communitySlugToPublicUrl(slug: string): string | null {
  if (!slug || slug.includes("#")) return null;
  const firstHyphen = slug.indexOf("-");
  if (firstHyphen <= 0) return null;
  const category = slug.substring(0, firstHyphen);
  const page = slug.substring(firstHyphen + 1);
  if (!category || !page) return null;
  return `/community/${category}/${page}`;
}

export function listingIdToPublicUrl(id: number | string, listingType: string | null | undefined): string {
  const isClassified = listingType === "Classified";
  return isClassified ? `/for-sale/${id}` : `/real-estate/${id}`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function toIsoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function renderEntry(entry: Entry): string {
  const lines = [`  <url>`, `    <loc>${escapeXml(SITE_URL + entry.loc)}</loc>`];
  const lastmod = toIsoDate(entry.lastmod);
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (typeof entry.priority === "number") {
    lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  }
  lines.push(`  </url>`);
  return lines.join("\n");
}

async function collectEvents(): Promise<Entry[]> {
  try {
    const rows = await db.execute(sql`
      SELECT id, updated_at, end_date
      FROM events
      WHERE end_date >= NOW() - INTERVAL '1 day'
    `);
    const list = (rows as any).rows ?? rows;
    const entries = (list as Array<{ id: number; updated_at: Date | null }>).map((row) => ({
      loc: `/events/${row.id}`,
      lastmod: row.updated_at,
      changefreq: "weekly",
      priority: 0.7,
    }));
    recordCollectorCount("events", entries.length);
    return entries;
  } catch (err) {
    logger.warn("sitemap: failed to load events", err);
    return [];
  }
}

async function collectListings(): Promise<Entry[]> {
  try {
    const rows = await db.execute(sql`
      SELECT id, listing_type, updated_at
      FROM real_estate_listings
      WHERE status = 'ACTIVE'
        AND (expiration_date IS NULL OR expiration_date > NOW())
    `);
    const list = (rows as any).rows ?? rows;
    const entries = (list as Array<{ id: number; listing_type: string; updated_at: Date | null }>).map((row) => ({
      loc: listingIdToPublicUrl(row.id, row.listing_type),
      lastmod: row.updated_at,
      changefreq: "weekly",
      priority: 0.6,
    }));
    recordCollectorCount("listings", entries.length);
    return entries;
  } catch (err) {
    logger.warn("sitemap: failed to load listings", err);
    return [];
  }
}

async function collectForumPosts(): Promise<Entry[]> {
  try {
    const rows = await db.execute(sql`
      SELECT id, updated_at
      FROM forum_posts
    `);
    const list = (rows as any).rows ?? rows;
    const entries = (list as Array<{ id: number; updated_at: Date | null }>).map((row) => ({
      loc: `/forum/post/${row.id}`,
      lastmod: row.updated_at,
      changefreq: "weekly",
      priority: 0.6,
    }));
    recordCollectorCount("forum", entries.length);
    return entries;
  } catch (err) {
    logger.warn("sitemap: failed to load forum posts", err);
    return [];
  }
}

async function collectPageContents(): Promise<Entry[]> {
  try {
    const rows = await db.execute(sql`
      SELECT slug, updated_at
      FROM page_contents
      WHERE slug IS NOT NULL AND slug <> ''
    `);
    const list = (rows as any).rows ?? rows;
    const entries: Entry[] = [];
    const seen = new Set<string>();
    for (const row of list as Array<{ slug: string; updated_at: Date | null }>) {
      const slug = row.slug;
      if (!slug || slug.includes("#")) continue;

      let path: string | null = null;
      if (isVendorPage(slug)) {
        const url = dbSlugToPublicUrl(slug);
        if (url.startsWith("/vendors/")) path = url;
      } else {
        // Community pages stored as `<category>-<page>` map to `/community/<category>/<page>`.
        path = communitySlugToPublicUrl(slug);
      }

      if (!path || seen.has(path)) continue;
      seen.add(path);
      entries.push({
        loc: path,
        lastmod: row.updated_at,
        changefreq: "monthly",
        priority: 0.5,
      });
    }
    recordCollectorCount("pageContents", entries.length);
    return entries;
  } catch (err) {
    logger.warn("sitemap: failed to load page contents", err);
    return [];
  }
}

const SECTION_LOADERS: Record<Section, () => Promise<Entry[]>> = {
  events: collectEvents,
  listings: collectListings,
  forum: collectForumPosts,
  // Static URLs are bundled into the "pages" section so every URL is reachable from the index.
  pages: async () => {
    const dynamic = await collectPageContents();
    return [...STATIC_ENTRIES, ...dynamic];
  },
};

const SECTIONS: Section[] = ["events", "listings", "forum", "pages"];

// In-process cache for section entries. A short TTL keeps the data fresh enough
// for crawlers while collapsing bursts of parallel requests (sitemap index +
// each section URL) down to a single DB scan per section per window. The
// in-flight promise is cached too so concurrent requests share one query.
const SECTION_CACHE_TTL_MS = 5 * 60 * 1000;

type SectionCacheEntry = {
  entries: Entry[];
  expiresAt: number;
};

const sectionCache = new Map<Section, SectionCacheEntry>();
const inflightLoads = new Map<Section, Promise<Entry[]>>();

async function getSectionEntries(section: Section): Promise<Entry[]> {
  const now = Date.now();
  const cached = sectionCache.get(section);
  if (cached && cached.expiresAt > now) {
    return cached.entries;
  }
  const existing = inflightLoads.get(section);
  if (existing) return existing;

  const loader = SECTION_LOADERS[section]()
    .then((entries) => {
      sectionCache.set(section, { entries, expiresAt: Date.now() + SECTION_CACHE_TTL_MS });
      return entries;
    })
    .finally(() => {
      inflightLoads.delete(section);
    });
  inflightLoads.set(section, loader);
  return loader;
}

export function invalidateSitemapSection(section: Section): void {
  sectionCache.delete(section);
}

export function invalidateAllSitemapSections(): void {
  sectionCache.clear();
}

/**
 * Names of the dynamic collectors that pull URLs from the DB. We track each
 * one independently — not the aggregated "section" total — because the
 * `pages` section bundles `STATIC_ENTRIES` with `collectPageContents`, and the
 * static list would mask a dynamic regression (e.g. all vendor / community
 * pages disappearing) if we only watched the section-level total. The
 * collector-level granularity lets us alert on vendor/community page drops
 * even while the static URLs still ship in the sitemap.
 */
type CollectorKey = "events" | "listings" | "forum" | "pageContents";

const COLLECTOR_KEYS: CollectorKey[] = ["events", "listings", "forum", "pageContents"];

/**
 * In-memory baseline of the largest URL count we've ever observed for each
 * collector since this process started. Used to surface the case where a
 * collector that used to produce URLs suddenly produces zero — typically a
 * broken DB query, schema rename, or permissions regression. The data lives
 * in memory only; that's enough to catch regressions during a single server
 * uptime without requiring schema changes.
 */
const collectorHighWaterMark: Record<CollectorKey, number> = {
  events: 0,
  listings: 0,
  forum: 0,
  pageContents: 0,
};

/**
 * Tracks whether we've already warned about the current zero-count streak for
 * a collector, so we don't spam the log on every sitemap request while the
 * regression persists. Reset to `false` once the collector recovers (>0).
 */
const collectorZeroWarned: Record<CollectorKey, boolean> = {
  events: false,
  listings: false,
  forum: false,
  pageContents: false,
};

export function recordCollectorCount(collector: CollectorKey, count: number): void {
  const previousMax = collectorHighWaterMark[collector];
  if (count === 0 && previousMax > 0) {
    if (!collectorZeroWarned[collector]) {
      logger.warn(
        `sitemap: collector "${collector}" returned 0 entries (previous high-water mark: ${previousMax}). ` +
          `This may indicate a broken DB query, schema rename, or permissions regression.`,
      );
      collectorZeroWarned[collector] = true;
    }
    return;
  }
  if (count > previousMax) {
    collectorHighWaterMark[collector] = count;
  }
  if (count > 0) {
    collectorZeroWarned[collector] = false;
  }
}

export function __resetSitemapBaselineForTests(): void {
  for (const key of COLLECTOR_KEYS) {
    collectorHighWaterMark[key] = 0;
    collectorZeroWarned[key] = false;
  }
}

function chunkEntries(entries: Entry[]): Entry[][] {
  if (entries.length === 0) return [[]];
  const chunks: Entry[][] = [];
  for (let i = 0; i < entries.length; i += MAX_URLS_PER_SITEMAP) {
    chunks.push(entries.slice(i, i + MAX_URLS_PER_SITEMAP));
  }
  return chunks;
}

function sectionFileName(section: Section, page: number): string {
  return page === 1 ? `sitemap-${section}.xml` : `sitemap-${section}-${page}.xml`;
}

function latestLastmod(entries: Entry[]): Date | undefined {
  let latest: Date | undefined;
  for (const entry of entries) {
    if (!entry.lastmod) continue;
    const d = entry.lastmod instanceof Date ? entry.lastmod : new Date(entry.lastmod as unknown as string);
    if (Number.isNaN(d.getTime())) continue;
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

function renderUrlset(entries: Entry[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map(renderEntry).join("\n") +
    `\n</urlset>\n`
  );
}

function sendXml(res: Response, body: string) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(body);
}

async function handleSitemapIndex(_req: Request, res: Response) {
  const sectionEntries = await Promise.all(
    SECTIONS.map(async (section) => {
      const entries = await getSectionEntries(section);
      return { section, chunks: chunkEntries(entries) };
    }),
  );

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
  for (const { section, chunks } of sectionEntries) {
    chunks.forEach((chunk, idx) => {
      const file = sectionFileName(section, idx + 1);
      const lastmod = toIsoDate(latestLastmod(chunk));
      lines.push(`  <sitemap>`);
      lines.push(`    <loc>${escapeXml(`${SITE_URL}/${file}`)}</loc>`);
      if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
      lines.push(`  </sitemap>`);
    });
  }
  lines.push(`</sitemapindex>`);
  lines.push("");

  sendXml(res, lines.join("\n"));
}

async function handleSection(section: Section, page: number, res: Response) {
  const entries = await getSectionEntries(section);
  const chunks = chunkEntries(entries);
  const chunk = chunks[page - 1];
  if (!chunk) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }
  sendXml(res, renderUrlset(chunk));
}

const sitemapRouter = Router();

sitemapRouter.get("/robots.txt", (req, res) => {
  const siteUrl = resolveRobotsSiteUrl(req);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(renderRobotsTxt(siteUrl));
});

sitemapRouter.get("/sitemap.xml", handleSitemapIndex);

for (const section of SECTIONS) {
  sitemapRouter.get(`/sitemap-${section}.xml`, (_req, res) => handleSection(section, 1, res));
  sitemapRouter.get(`/sitemap-${section}-:page.xml`, (req, res) => {
    const raw = req.params.page;
    if (!/^\d+$/.test(raw)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    const page = Number.parseInt(raw, 10);
    if (!Number.isFinite(page) || page < 1) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    handleSection(section, page, res);
  });
}

export default sitemapRouter;
export { handleSitemapIndex, handleSection };
