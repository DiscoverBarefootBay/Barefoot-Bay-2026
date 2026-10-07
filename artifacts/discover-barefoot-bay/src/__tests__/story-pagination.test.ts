import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient, InfiniteQueryObserver } from "@tanstack/react-query";
import { nextStoryPage, storyPageUrl, uniqueStories } from "../lib/story-pagination";
import { installVendorDirectoryInvalidation } from "../lib/vendor-directory-cache";

const story = (id: number) => ({ id } as any);
const page = (offset: number, count = 12) => ({
  stories: Array.from({ length: Math.min(count, 73 - offset) }, (_, i) => story(offset + i + 1)),
  total: 73, nextOffset: Math.min(offset + count, 73), hasMore: offset + count < 73, revision: "stable",
});
test("incremental requests advance beyond 50, finish correctly and preserve filters", () => {
  const pages = [page(0), page(12), page(24), page(36), page(48), page(60), page(72)];
  assert.equal(uniqueStories(pages).length, 73);
  assert.deepEqual(nextStoryPage(pages[4]), { offset: 60, revision: "stable" });
  assert.equal(nextStoryPage(pages[6]), undefined);
  const url = new URL(storyPageUrl(4, "oldest_comment", "a & b", nextStoryPage(pages[4])!), "http://test");
  assert.equal(url.searchParams.get("limit"), "12");
  assert.equal(url.searchParams.get("offset"), "60");
  assert.equal(url.searchParams.get("categoryId"), "4");
  assert.equal(url.searchParams.get("search"), "a & b");
  assert.equal(url.searchParams.get("revision"), "stable");
  assert.equal(uniqueStories([page(0), page(0)]).length, 12);
});
test("React Query Load More only fetches the next page; account/filter keys isolate caches", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const requested: number[] = [];
  const key = ["/api/forum/stories", { userId: 1, role: "resident", categoryId: 4 }];
  const observer = new InfiniteQueryObserver(client, {
    queryKey: key, initialPageParam: { offset: 0 },
    queryFn: async ({ pageParam }) => { requested.push(pageParam.offset); return page(pageParam.offset); },
    getNextPageParam: nextStoryPage,
  });
  await observer.refetch();
  await observer.fetchNextPage();
  await observer.fetchNextPage();
  assert.deepEqual(requested, [0, 12, 24]);
  assert.equal(uniqueStories(observer.getCurrentResult().data!.pages).length, 36);
  assert.equal(client.getQueryData(["/api/forum/stories", { userId: 2, role: "resident", categoryId: 4 }]), undefined);
  assert.equal(client.getQueryData(["/api/forum/stories", { userId: 1, role: "guest", categoryId: 4 }]), undefined);
  assert.equal(client.getQueryData(["/api/forum/stories", { userId: 1, role: "resident", categoryId: 7 }]), undefined);
  client.clear();
});
test("CMS edits and forum mutations refresh all scoped lightweight lists without invalidation loops", async () => {
  const client = new QueryClient();
  const uninstall = installVendorDirectoryInvalidation(client);
  const community = ["/api/community-directory", { category: "safety", userId: 1 }];
  const stories = ["/api/forum/stories", { userId: 1 }];
  client.setQueryData(community, []);
  client.setQueryData(stories, { pages: [page(0)] });
  client.setQueryData(["/api/pages", "safety-pet-rules"], {});
  client.setQueryData(["/api/forum/categories"], []);
  await client.invalidateQueries({ queryKey: ["/api/pages"] });
  assert.equal(client.getQueryState(community)?.isInvalidated, true);
  await client.invalidateQueries({ queryKey: ["/api/forum/categories"] });
  assert.equal(client.getQueryState(stories)?.isInvalidated, true);
  uninstall(); client.clear();
});
