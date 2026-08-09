/**
 * Pure helpers for matching community pages to a category route segment and
 * building detail URLs that round-trip through GenericContentPage's slug
 * derivation (`/community/<a>/<b>` → page slug `a-b`).
 */

export interface CommunityPageLike {
  slug: string;
  /** Explicit category assignment (takes precedence over slug prefix) */
  category?: string | null;
}

/**
 * Does this page belong to the given community category route segment?
 * Mirrors the nav-bar's authoritative matching: prefer the page's explicit
 * `category` field, fall back to the slug-prefix convention.
 */
export function communityPageMatchesCategory(
  page: CommunityPageLike | null | undefined,
  category: string,
): boolean {
  if (!page?.slug || page.slug === category) return false;
  if (page.category) return page.category === category;
  return page.slug.startsWith(`${category}-`);
}

/** Display name segment for a page: its slug with the category prefix removed. */
export function communityPageName(slug: string, category: string): string {
  return slug.startsWith(`${category}-`) ? slug.slice(category.length + 1) : slug;
}

/**
 * Detail URL for a community page. GenericContentPage derives the page slug
 * as `<part1>-<part2>`, so the URL must split the actual slug into two parts:
 * - prefixed slugs use `/community/<category>/<rest>`
 * - explicitly-categorized pages whose slug lacks the prefix are split at the
 *   slug's own first hyphen so the derived slug still equals the real slug
 */
export function communityPageHref(slug: string, category: string): string {
  if (slug.startsWith(`${category}-`)) {
    return `/community/${category}/${slug.slice(category.length + 1)}`;
  }
  const firstDash = slug.indexOf('-');
  if (firstDash > 0 && firstDash < slug.length - 1) {
    return `/community/${slug.slice(0, firstDash)}/${slug.slice(firstDash + 1)}`;
  }
  // Single-word slug: no two-part URL can round-trip; use the category route
  return `/community/${category}/${slug}`;
}
