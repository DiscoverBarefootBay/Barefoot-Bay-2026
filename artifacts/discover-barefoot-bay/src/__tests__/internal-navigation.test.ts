import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  INTERNAL_ROUTE_PATTERNS,
  installInternalNavigation,
  isInternalAppRoute,
} from "../lib/internal-navigation";

function setup(url = "https://barefootbay.com/") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
  const calls: string[] = [];
  const cleanup = installInternalNavigation(dom.window.document, (to) => calls.push(to));
  return { dom, calls, cleanup };
}

function click(
  window: Window,
  element: Element,
  options: MouseEventInit = {},
): MouseEvent {
  const event = new window.MouseEvent("click", { bubbles: true, cancelable: true, ...options });
  element.dispatchEvent(event);
  return event;
}

test("route allowlist matches registered CMS routes and exact root only", () => {
  assert.equal(isInternalAppRoute("/"), true);
  assert.equal(isInternalAppRoute("/community/government/fees-and-passes"), true);
  assert.equal(isInternalAppRoute("/vendors/home-services/plumber"), true);
  assert.equal(isInternalAppRoute("/more/community/page"), true);
  assert.equal(isInternalAppRoute("/banner"), true);
  assert.equal(isInternalAppRoute("/not-a-route"), false);
  assert.equal(isInternalAppRoute("/banner/subpage"), false);
  assert.equal(isInternalAppRoute("/api/pages/home"), false);
  assert.equal(isInternalAppRoute("/community/government/map.png"), false);
});

test("allowlist contains every literal Route and ProtectedRoute path from App.tsx", () => {
  const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const appRoutePaths = [
    ...appSource.matchAll(/<(?:Route|ProtectedRoute)\b[^>]*\bpath="([^"]+)"/g),
  ].map((match) => match[1]);
  const appRoutePathSet = new Set(appRoutePaths);
  const allowlistedPatterns = new Set<string>(INTERNAL_ROUTE_PATTERNS);
  const missingPatterns = [...appRoutePathSet]
    .filter((path) => !allowlistedPatterns.has(path))
    .sort();
  const nonRoutePatterns = [...allowlistedPatterns]
    .filter((path) => !appRoutePathSet.has(path))
    .sort();

  assert.ok(appRoutePaths.length > 0, "expected to find literal route paths in App.tsx");
  assert.deepEqual(missingPatterns, []);
  // /launch is handled by Router's location check rather than a Route element.
  assert.deepEqual(nonRoutePatterns, ["/launch"]);
});

test("base prefix is matched on its boundary and removed for Wouter", () => {
  assert.equal(isInternalAppRoute("/preview/community/government", "/preview/"), true);
  assert.equal(isInternalAppRoute("/preview/", "/preview"), true);
  assert.equal(isInternalAppRoute("/previewish/community/government", "/preview"), false);

  const dom = new JSDOM("<a href='/preview/community/government/news?sort=recent#top'>go</a>", {
    url: "https://barefootbay.com/preview/",
  });
  const calls: string[] = [];
  const cleanup = installInternalNavigation(dom.window.document, (to) => calls.push(to), "/preview/");
  const link = dom.window.document.querySelector("a")!;
  const event = click(dom.window as unknown as Window, link);

  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, ["/community/government/news?sort=recent#top"]);
  cleanup();
  dom.window.close();
});

test("bubbling listener finds an anchor from a nested clicked element and preserves query/hash", () => {
  const { dom, calls, cleanup } = setup("https://barefootbay.com/");
  const anchor = dom.window.document.createElement("a");
  anchor.href = "/community/government/fees?from=banner#details";
  const inner = dom.window.document.createElement("span");
  inner.textContent = "Read more";
  anchor.append(inner);
  dom.window.document.body.append(anchor);

  const event = click(dom.window as unknown as Window, inner);

  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, ["/community/government/fees?from=banner#details"]);
  cleanup();
  dom.window.close();
});

test("does not intercept hash scrolling on the same pathname", () => {
  const { dom, calls, cleanup } = setup("https://barefootbay.com/community/government?tab=one");
  const anchor = dom.window.document.createElement("a");
  anchor.href = "#section";
  dom.window.document.body.append(anchor);

  const event = click(dom.window as unknown as Window, anchor);

  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(calls, []);
  cleanup();
  dom.window.close();
});

test("same-route self-links are canceled without invoking Wouter navigate", () => {
  const { dom, calls, cleanup } = setup("https://barefootbay.com/?from=home#top");
  const anchor = dom.window.document.createElement("a");
  anchor.href = "/?from=home#top";
  dom.window.document.body.append(anchor);

  const event = click(dom.window as unknown as Window, anchor);

  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, []);
  cleanup();
  dom.window.close();
});

test("query-changing same-document links with a fragment are SPA navigations", () => {
  const { dom, calls, cleanup } = setup("https://barefootbay.com/community/government?tab=one");
  const anchor = dom.window.document.createElement("a");
  anchor.href = "?tab=two#section";
  dom.window.document.body.append(anchor);

  const event = click(dom.window as unknown as Window, anchor);

  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, ["/community/government?tab=two#section"]);
  cleanup();
  dom.window.close();
});

test("preserves external, non-http, resource, unknown, and opt-out navigation", () => {
  const { dom, calls, cleanup } = setup();
  const hrefs = [
    "https://other.example/community/government",
    "mailto:help@barefootbay.com",
    "/api/pages/home",
    "/assets/banner.jpg",
    "/banner.pdf",
    "/unknown-server-path",
  ];

  for (const href of hrefs) {
    const anchor = dom.window.document.createElement("a");
    anchor.href = href;
    dom.window.document.body.append(anchor);
    assert.equal(click(dom.window as unknown as Window, anchor).defaultPrevented, false, href);
  }

  const optOutContainer = dom.window.document.createElement("div");
  optOutContainer.dataset.nativeNavigation = "";
  const optOut = dom.window.document.createElement("a");
  optOut.href = "/banner";
  optOutContainer.append(optOut);
  dom.window.document.body.append(optOutContainer);
  assert.equal(click(dom.window as unknown as Window, optOut).defaultPrevented, false);
  assert.deepEqual(calls, []);
  cleanup();
  dom.window.close();
});

test("preserves targets, downloads, external rel, modified and non-left clicks", () => {
  const { dom, calls, cleanup } = setup();
  const makeAnchor = () => {
    const anchor = dom.window.document.createElement("a");
    anchor.href = "/banner";
    dom.window.document.body.append(anchor);
    return anchor;
  };

  const blankTarget = makeAnchor();
  blankTarget.target = "_blank";
  assert.equal(click(dom.window as unknown as Window, blankTarget).defaultPrevented, false);

  const inheritedTargetDom = new JSDOM(
    "<base target='_blank'><a href='/banner'>native</a>",
    { url: "https://barefootbay.com/" },
  );
  const inheritedTargetAnchor = inheritedTargetDom.window.document.querySelector("a")!;
  const inheritedTargetCleanup = installInternalNavigation(
    inheritedTargetDom.window.document,
    (to) => calls.push(to),
  );
  assert.equal(
    click(inheritedTargetDom.window as unknown as Window, inheritedTargetAnchor).defaultPrevented,
    false,
  );
  inheritedTargetCleanup();
  inheritedTargetDom.window.close();

  const download = makeAnchor();
  download.setAttribute("download", "");
  assert.equal(click(dom.window as unknown as Window, download).defaultPrevented, false);

  const externalRel = makeAnchor();
  externalRel.rel = "nofollow external";
  assert.equal(click(dom.window as unknown as Window, externalRel).defaultPrevented, false);

  const modified = makeAnchor();
  assert.equal(click(dom.window as unknown as Window, modified, { ctrlKey: true }).defaultPrevented, false);
  assert.equal(click(dom.window as unknown as Window, modified, { metaKey: true }).defaultPrevented, false);
  assert.equal(click(dom.window as unknown as Window, modified, { shiftKey: true }).defaultPrevented, false);
  assert.equal(click(dom.window as unknown as Window, modified, { altKey: true }).defaultPrevented, false);
  assert.equal(click(dom.window as unknown as Window, modified, { button: 1 }).defaultPrevented, false);
  assert.deepEqual(calls, []);
  cleanup();
  dom.window.close();
});

test("respects earlier page handlers and cleanup removes the document listener", () => {
  const { dom, calls, cleanup } = setup();
  const handledByPage = dom.window.document.createElement("a");
  handledByPage.href = "/banner";
  handledByPage.addEventListener("click", (event) => event.preventDefault());
  dom.window.document.body.append(handledByPage);

  const event = click(dom.window as unknown as Window, handledByPage);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, []);

  cleanup();
  const afterCleanup = dom.window.document.createElement("a");
  afterCleanup.href = "/banner";
  dom.window.document.body.append(afterCleanup);
  const cleanupEvent = click(dom.window as unknown as Window, afterCleanup);
  assert.equal(cleanupEvent.defaultPrevented, false);
  assert.deepEqual(calls, []);
  dom.window.close();
});

test("does not intercept native back/forward events", () => {
  const { dom, calls, cleanup } = setup();
  dom.window.history.pushState({}, "", "/banner");
  dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
  assert.deepEqual(calls, []);
  cleanup();
  dom.window.close();
});