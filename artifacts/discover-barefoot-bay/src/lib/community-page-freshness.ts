import type { QueryClient } from "@tanstack/react-query";

const PAGE_LIST_KEYS = [["/api/pages"], ["/api/pages/navigation"], ["/api/community-directory"], ["/api/social-clubs"]] as const;

export function managementPagesKey(userId: number | null, role: string) {
  return ["/api/pages", { userId, role, includeHidden: true }] as const;
}

export function isManagedLegacyGolfCartPage(page: { id: number; slug: string }) {
  return page.id === 397 && page.slug === "social-page";
}

export async function invalidateCommunityPages(client: QueryClient) {
  // Cancel older reads before refetching so they cannot reinstate a ghost entry.
  await Promise.all(PAGE_LIST_KEYS.map(queryKey => client.cancelQueries({ queryKey })));
  await Promise.all(PAGE_LIST_KEYS.map(queryKey => client.invalidateQueries({ queryKey })));
}

export function managementCategoryNames(known: readonly string[], grouped: Record<string, { slug: string }[]>) {
  // Previously only configured category cards rendered. Uncategorized/legacy
  // pages could exist in the response but be impossible to see or manage.
  return [...new Set([...known, ...Object.keys(grouped).filter(name =>
    grouped[name].some(page => !/^vendors?(?:-|\/)/.test(page.slug)),
  )])];
}

export function communityPageHref(slug: string, prefix: string) {
  if (slug.startsWith(`${prefix}-`)) return `/community/${prefix}/${slug.slice(prefix.length + 1)}`;
  const dash = slug.indexOf("-");
  return dash > 0 ? `/community/${slug.slice(0, dash)}/${slug.slice(dash + 1)}` : `/community/${slug}`;
}
