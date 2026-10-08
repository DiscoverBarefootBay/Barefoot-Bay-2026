import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { communityPageHref, invalidateCommunityPages, managementCategoryNames, managementPagesKey, isManagedLegacyGolfCartPage } from "../lib/community-page-freshness";
import { clubMembershipSelected, socialClubOptions, toggleClubMembership } from "../lib/social-clubs";

const club = { id: 447, slug: "social-golf-cart-club", title: "Golf Cart Club", aliases: ["social-page"] };

test("orphan categories remain manageable without mixing in vendor management", () => {
  assert.deepEqual(managementCategoryNames(["Community Information"], {
    Social: [{ slug: club.slug }, { slug: "social-page" }],
    Uncategorized: [{ slug: "legacy" }],
    Vendors: [{ slug: "vendors-plumbers-example" }],
  }), ["Community Information", "Social", "Uncategorized"]);
});

test("Manage cannot reuse a guest's filtered page list or another administrator's snapshot", () => {
  assert.notDeepEqual(managementPagesKey(null, "guest"), managementPagesKey(1, "admin"));
  assert.notDeepEqual(managementPagesKey(1, "admin"), managementPagesKey(2, "admin"));
  assert.equal(managementPagesKey(1, "admin")[1].includeHidden, true);
});

test("Manage labels only the confirmed legacy record, not unrelated generic clubs", () => {
  assert.equal(isManagedLegacyGolfCartPage({ id: 397, slug: "social-page" }), true);
  assert.equal(isManagedLegacyGolfCartPage({ id: 407, slug: "social-page" }), false);
  assert.equal(isManagedLegacyGolfCartPage({ id: 397, slug: "social-a-new-club" }), false);
});

test("Manage links retain the whole multi-word club slug", () => {
  assert.equal(communityPageHref(club.slug, "social"), "/community/social/golf-cart-club");
  assert.equal(communityPageHref("social-page", "social"), "/community/social/page");
  assert.equal(communityPageHref(club.slug, "unmatched"), "/community/social/golf-cart-club");
});

test("legacy preferences appear selected without silently rewriting stored values", () => {
  const selected = ["social-page", "social-chess"];
  assert.equal(clubMembershipSelected(club, selected), true);
  assert.equal(toggleClubMembership(club, selected, true), selected);
  assert.deepEqual(selected, ["social-page", "social-chess"]);
  assert.deepEqual(toggleClubMembership(club, selected, false), ["social-chess"]);
  assert.deepEqual(toggleClubMembership(club, ["social-chess"], true), ["social-chess", club.slug]);
  assert.equal(clubMembershipSelected({ ...club, slug: "social-cart-riders", aliases: [club.slug, "social-page"] }, [club.slug]), true);
});

test("all viewer-scoped consumers become stale, without clearing unrelated forms", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity } } });
  const keys = [
    ["/api/pages"],
    managementPagesKey(1, "admin"),
    ["/api/pages", club.slug],
    ["/api/pages/navigation", { userId: 1, role: "admin" }],
    ["/api/social-clubs", { userId: null, role: "guest" }],
    ["/api/social-clubs", { userId: 1, role: "resident" }],
    ["/api/community-directory", "social"],
  ];
  for (const key of keys) client.setQueryData(key, [club]);
  client.setQueryData(["unrelated-form"], { draft: "unsaved" });
  await invalidateCommunityPages(client);
  for (const key of keys) {
    assert.equal(client.getQueryState(key)?.isInvalidated, true);
  }
  assert.equal(client.getQueryState(["unrelated-form"])?.isInvalidated, false);
  assert.deepEqual(client.getQueryData(["unrelated-form"]), { draft: "unsaved" });
  client.clear();
});

test("short refresh window and account-scoped keys replace the five-minute menu cache", () => {
  const anonymous = socialClubOptions();
  const resident = socialClubOptions(1, "resident");
  assert.notDeepEqual(anonymous.queryKey, resident.queryKey);
  assert.equal(anonymous.staleTime, 30_000);
  assert.equal(anonymous.refetchInterval, 30_000);
  assert.equal(anonymous.refetchIntervalInBackground, false);
  assert.equal(anonymous.placeholderData, undefined);
});
