import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { copyrightActivityKey, useCopyrightActivity } from "../hooks/use-copyright-activity";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const desktop = source("../components/layout/nav-bar.tsx");
const mobile = source("../components/layout/mobile-menu.tsx");
const hook = source("../hooks/use-copyright-activity.ts");
const profile = source("../pages/profile-settings.tsx");

function renderActivity(client: QueryClient, userId: number | null): string {
  function Probe() {
    return React.createElement("span", null, useCopyrightActivity(userId) ? "visible" : "hidden");
  }
  return renderToStaticMarkup(
    React.createElement(QueryClientProvider, { client }, React.createElement(Probe)),
  );
}

describe("Copyright Notices account navigation", () => {
  it("gates both links on account activity and places them above Log Out", () => {
    for (const [menu, testId] of [
      [desktop, "link-account-copyright-notices"],
      [mobile, "link-mobile-copyright-notices"],
    ] as const) {
      const conditional = menu.indexOf("{hasCopyrightActivity && (");
      const link = menu.indexOf(`data-testid="${testId}"`);
      const logout = menu.lastIndexOf("Log Out");
      assert.ok(conditional >= 0 && conditional < link && link < logout);
      assert.equal(menu.split(`data-testid="${testId}"`).length, 2, "only one conditional link");
    }
  });

  it("uses per-account query state and hides the link while loading or after errors", () => {
    assert.match(hook, /queryKey:\s*copyrightActivityKey\(userId\)/);
    assert.match(hook, /enabled:\s*userId != null/);
    assert.match(hook, /!query\.isPlaceholderData && !query\.isError && query\.data\?\.hasActivity === true/);
    assert.match(desktop, /effectiveRole === "guest" \? null : user\?\.id/);
    assert.match(mobile, /isViewingAsGuest \? null : user\?\.id/);
  });

  it("hides the entire profile card unless the current account has activity", () => {
    const guard = profile.indexOf("{hasCopyrightActivity && (");
    const card = profile.indexOf("<Card>", guard);
    const link = profile.indexOf('data-testid="link-profile-copyright-notices"');
    const cardEnd = profile.indexOf("</Card>", link);
    const guardEnd = profile.indexOf(")}", cardEnd);
    const settingsCard = profile.indexOf("Profile Settings Card", guardEnd);
    assert.ok(guard >= 0 && guard < card && card < link && link < cardEnd && cardEnd < guardEnd && guardEnd < settingsCard);
    assert.match(profile, /effectiveRole === "guest" \? null : user\?\.id/);
    assert.match(profile, /copyright claims you filed while signed in/);
  });

  it("keeps loading, no-activity, guest, and other-account states hidden", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    assert.match(renderActivity(client, 101), /hidden/); // pending first load
    client.setQueryData(copyrightActivityKey(101), { hasActivity: false });
    assert.match(renderActivity(client, 101), /hidden/);
    client.setQueryData(copyrightActivityKey(101), { hasActivity: true });
    assert.match(renderActivity(client, 101), /visible/); // claimant or uploader, including resolved
    assert.match(renderActivity(client, 102), /hidden/); // no cached result for another account
    assert.match(renderActivity(client, null), /hidden/); // signed out or viewing as guest
    client.getQueryCache().find({ queryKey: copyrightActivityKey(101) })?.setState({
      status: "error",
      error: new Error("Activity unavailable"),
    });
    assert.match(renderActivity(client, 101), /hidden/);
  });
});