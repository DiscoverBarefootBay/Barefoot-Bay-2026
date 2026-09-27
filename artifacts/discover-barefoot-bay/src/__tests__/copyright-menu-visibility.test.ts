import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const desktop = source("../components/layout/nav-bar.tsx");
const mobile = source("../components/layout/mobile-menu.tsx");
const hook = source("../hooks/use-copyright-activity.ts");

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
});