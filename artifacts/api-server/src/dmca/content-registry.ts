/**
 * Registry of every user-generated content type that the DMCA system can
 * target. One entry per type describes where its rows live, who owns them,
 * and which columns hold stored-file URLs, so takedown / restore / legal hold
 * / quarantine can treat every type uniformly.
 */

export const DmcaContentType = {
  FORUM_POST: "forum_post",
  FORUM_COMMENT: "forum_comment",
  LISTING: "listing",
  EVENT: "event",
  EVENT_COMMENT: "event_comment",
  PAGE: "page",
  VENDOR_COMMENT: "vendor_comment",
  AVATAR: "avatar",
} as const;
export type DmcaContentType = typeof DmcaContentType[keyof typeof DmcaContentType];

export interface ContentTypeDef {
  type: DmcaContentType;
  table: string;
  ownerColumn: string;
  /** text[] columns that hold file URLs */
  mediaArrayColumns: string[];
  /** scalar text columns that hold a single file URL */
  mediaScalarColumns: string[];
  /** HTML/text column that may embed file URLs */
  htmlColumn?: string;
  /**
   * true when the table carries the common visibility columns
   * (visibility_status, legal_hold, hidden_*, dmca_case_id, restored_*).
   * Avatars live on users and are taken down by detaching avatar_url.
   */
  hasVisibilityColumns: boolean;
  /** Public path for the item (used for original URL + audit), if routable. */
  publicPath?: (row: Record<string, any>) => string | null;
}

export const CONTENT_TYPES: Readonly<Record<DmcaContentType, ContentTypeDef>> = {
  forum_post: {
    type: "forum_post",
    table: "forum_posts",
    ownerColumn: "user_id",
    mediaArrayColumns: ["media_urls"],
    mediaScalarColumns: ["featured_image"],
    htmlColumn: "content",
    hasVisibilityColumns: true,
    publicPath: (r) => `/forum/post/${r.id}`,
  },
  forum_comment: {
    type: "forum_comment",
    table: "forum_comments",
    ownerColumn: "author_id",
    mediaArrayColumns: ["media_urls"],
    mediaScalarColumns: [],
    htmlColumn: "content",
    hasVisibilityColumns: true,
    publicPath: (r) => (r.post_id ? `/forum/post/${r.post_id}#comment-${r.id}` : null),
  },
  listing: {
    type: "listing",
    table: "real_estate_listings",
    ownerColumn: "created_by",
    mediaArrayColumns: ["photos"],
    mediaScalarColumns: [],
    htmlColumn: "description",
    hasVisibilityColumns: true,
    publicPath: (r) => `/for-sale/${r.id}`,
  },
  event: {
    type: "event",
    table: "events",
    ownerColumn: "created_by",
    mediaArrayColumns: ["media_urls"],
    mediaScalarColumns: [],
    htmlColumn: "description",
    hasVisibilityColumns: true,
    publicPath: (r) => `/events/${r.id}`,
  },
  event_comment: {
    type: "event_comment",
    table: "event_comments",
    ownerColumn: "user_id",
    mediaArrayColumns: [],
    mediaScalarColumns: [],
    htmlColumn: "content",
    hasVisibilityColumns: true,
    publicPath: (r) => (r.event_id ? `/events/${r.event_id}` : null),
  },
  page: {
    type: "page",
    table: "page_contents",
    ownerColumn: "updated_by",
    mediaArrayColumns: ["media_urls"],
    mediaScalarColumns: [],
    htmlColumn: "content",
    hasVisibilityColumns: true,
    publicPath: (r) => (r.slug ? `/${String(r.slug).replace(/^\/+/, "")}` : null),
  },
  vendor_comment: {
    type: "vendor_comment",
    table: "vendor_comments",
    ownerColumn: "user_id",
    mediaArrayColumns: [],
    mediaScalarColumns: [],
    htmlColumn: "content",
    hasVisibilityColumns: true,
    publicPath: (r) => (r.page_slug ? `/${String(r.page_slug).replace(/^\/+/, "")}` : null),
  },
  avatar: {
    type: "avatar",
    table: "users",
    ownerColumn: "id",
    mediaArrayColumns: [],
    mediaScalarColumns: ["avatar_url"],
    hasVisibilityColumns: false,
  },
};

export function isDmcaContentType(v: unknown): v is DmcaContentType {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CONTENT_TYPES, v);
}

export function getContentTypeDef(type: string): ContentTypeDef {
  if (!isDmcaContentType(type)) throw new Error(`Unknown DMCA content type: ${type}`);
  return CONTENT_TYPES[type];
}

/**
 * Matches URLs that point at files we serve (storage proxy, legacy upload
 * dirs, raw object-storage URLs). External links (YouTube etc.) never match.
 */
const STORED_FILE_URL_RE =
  /(?:https?:\/\/object-storage\.replit\.app\/[^\s"'<>)]+|\/(?:api\/storage-proxy|uploads|media|forum-media|calendar|content-media|real-estate-media|vendor-media|community-media|avatars|banner-slides|attachments)\/[^\s"'<>)]+)/gi;

const FILE_EXT_RE = /\.[a-z0-9]{2,5}$/i;

/** Placeholder/default images shared by many rows must never be quarantined. */
export function isSharedPlaceholder(url: string): boolean {
  const base = fileBasename(url).toLowerCase();
  return base.startsWith("default-") || base.includes("placeholder") || base === "default.svg";
}

export function fileBasename(url: string): string {
  const noQuery = url.split(/[?#]/)[0];
  const parts = noQuery.split("/").filter(Boolean);
  let last = parts[parts.length - 1] || "";
  try {
    last = decodeURIComponent(last);
  } catch {
    /* keep raw */
  }
  return last;
}

/** Extract stored-file URLs embedded in an HTML/text blob. */
export function extractStoredFileUrls(html: string | null | undefined): string[] {
  if (!html) return [];
  const out = new Set<string>();
  for (const m of html.matchAll(STORED_FILE_URL_RE)) {
    const url = m[0].replace(/&amp;/g, "&");
    if (FILE_EXT_RE.test(url.split(/[?#]/)[0])) out.add(url);
  }
  return [...out];
}

/**
 * Collect every stored file that belongs to a content row — array columns,
 * scalar columns, and URLs embedded in its HTML — as one group. Placeholders
 * and external URLs are excluded.
 */
export function collectContentFileUrls(def: ContentTypeDef, row: Record<string, any>): string[] {
  const urls = new Set<string>();
  for (const col of def.mediaArrayColumns) {
    const v = row[col];
    if (Array.isArray(v)) for (const u of v) if (typeof u === "string" && u) urls.add(u);
  }
  for (const col of def.mediaScalarColumns) {
    const v = row[col];
    if (typeof v === "string" && v) urls.add(v);
  }
  if (def.htmlColumn) for (const u of extractStoredFileUrls(row[def.htmlColumn])) urls.add(u);
  return [...urls].filter((u) => {
    if (isSharedPlaceholder(u)) return false;
    if (u.startsWith("data:")) return false;
    if (/^https?:\/\//i.test(u) && !/object-storage\.replit\.app/i.test(u)) {
      // absolute URL on another host — only accept if it points back at our proxy paths
      return /\/(api\/storage-proxy|uploads)\//i.test(u);
    }
    return FILE_EXT_RE.test(fileBasename(u)) || /\/(api\/storage-proxy|uploads)\//i.test(u);
  });
}
