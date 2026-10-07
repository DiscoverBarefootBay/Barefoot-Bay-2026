import type { ForumStoryFeed } from "@workspace/api-client-react";

export interface StoryPageParam { offset: number; revision?: string }

export function nextStoryPage(page: ForumStoryFeed): StoryPageParam | undefined {
  return page.hasMore ? { offset: page.nextOffset, revision: page.revision } : undefined;
}

export function storyPageUrl(categoryId: number | null, sort: string, search: string, page: StoryPageParam) {
  const params = new URLSearchParams({ limit: "12", offset: String(page.offset), sort });
  if (categoryId) params.set("categoryId", String(categoryId));
  if (search) params.set("search", search);
  if (page.revision) params.set("revision", page.revision);
  return `/api/forum/stories?${params}`;
}

export function uniqueStories(pages: ForumStoryFeed[]) {
  const seen = new Set<number>();
  return pages.flatMap(p => p.stories).filter(s => !seen.has(s.id) && !!seen.add(s.id));
}
