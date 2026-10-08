import { sql } from "drizzle-orm";
import { db } from "./db";
import { readSocialClubIdentities } from "./social-club-summary";
import { withoutLegacyClubAlias } from "./social-club-alias";

export function communityDirectoryQuery(category: string, includeHidden: boolean) {
  const prefix = `${category.replace(/[%_\\]/g, "\\$&")}-%`;
  // Filter hidden rows before choosing the duplicate, like getAllPageContents.
  return sql`
    SELECT * FROM (
      SELECT DISTINCT ON (slug) id, slug, title, category, content, is_hidden AS "isHidden",
        created_at AS "createdAt", updated_by AS "updatedBy",
        visibility_status AS "visibilityStatus", hidden_at AS "hiddenAt",
        hidden_reason AS "hiddenReason", dmca_case_id AS "dmcaCaseId", legal_hold AS "legalHold"
      FROM page_contents
      WHERE (${includeHidden} OR is_hidden = false)
      ORDER BY slug, "order", updated_at DESC, id DESC
    ) chosen
    WHERE (category = ${category} OR
      ((category IS NULL OR category = '') AND slug LIKE ${prefix}))
      AND slug <> ${category}
    ORDER BY slug
  `;
}

export async function readCommunityDirectory(category: string, includeHidden: boolean) {
  const rows = (await db.execute(communityDirectoryQuery(category, includeHidden))).rows;
  if (category === "social") {
    const identities = await readSocialClubIdentities();
    const authoritative = new Map(identities.map(p => [p.slug, p]));
    // The generic directory loader skips manually hidden rows before grouping.
    // For clubs, do not let that expose an older copy of a hidden current row.
    const current = includeHidden ? rows as any[] : (rows as any[]).filter(p => {
      const identity = authoritative.get(p.slug);
      return !identity || identity.id === p.id;
    });
    return withoutLegacyClubAlias(current, identities);
  }
  return rows;
}

export function projectCommunityCard(page: any, category: string) {
  const name = page.slug.startsWith(`${category}-`) ? page.slug.slice(category.length + 1) : page.slug;
  const html = page.content ?? "";
  const description = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().substring(0, 220);
  const rawImage = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
  const image = rawImage && /^(https?:\/\/|\/(?!\/)|[a-z0-9._-][^:]*(?:$))/i.test(rawImage) ? rawImage : null;
  return {
    slug: page.slug,
    title: page.title || name.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    description, image,
    href: page.slug.startsWith(`${category}-`) ? `/community/${category}/${name}` :
      page.slug.includes("-") && !page.slug.endsWith("-") ?
        `/community/${page.slug.slice(0, page.slug.indexOf("-"))}/${page.slug.slice(page.slug.indexOf("-") + 1)}` :
        `/community/${category}/${page.slug}`,
    isHidden: !!page.isHidden,
    createdAt: page.createdAt ? new Date(page.createdAt).toISOString() : null,
    ...(page.contentVisibility ? { contentVisibility: {
      removed: page.contentVisibility.removed, status: page.contentVisibility.status,
    } } : {}),
  };
}
