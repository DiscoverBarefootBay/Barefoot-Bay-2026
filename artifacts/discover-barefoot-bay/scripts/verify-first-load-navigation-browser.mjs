// Anonymous, read-only browser verification. Delay genuine responses/modules;
// never replace account or consent responses, or bypass authentication.
// Usage: node scripts/verify-first-load-navigation-browser.mjs https://preview [mobile|tablet] [screenshot.png]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";

const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) throw new Error("Provide the preview URL.");
const viewport = process.argv[3] ?? "desktop";
const mobile = viewport === "mobile" || viewport === "tablet";
const width = viewport === "tablet" ? 820 : mobile ? 390 : 1680;
const height = viewport === "tablet" ? 1180 : mobile ? 844 : 1000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const port = 9400 + process.pid % 300;
const profile = `/tmp/bb-initial-navigation-${process.pid}`;
const browser = spawn(process.env.CHROMIUM_PATH ?? "chromium", [
  "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
let socket;
const heldAccounts = [];
const heldModules = [];
let holdAccount = true;
let holdModule = true;
const errors = [];
const requests = [];
try {
  let tab;
  for (let i = 0; i < 60 && !tab; i++) {
    try { tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page"); } catch {}
    if (!tab) await sleep(200);
  }
  assert.ok(tab, "Chromium started");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter?.reject(new Error(JSON.stringify(message.error)));
      else waiter?.resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (message.method === "Network.requestWillBeSent") requests.push(new URL(message.params.request.url).pathname);
    if (message.method === "Fetch.requestPaused") {
      const params = message.params;
      const account = new URL(params.request.url).pathname === "/api/user";
      if (account && holdAccount) heldAccounts.push(params.requestId);
      else if (!account && holdModule) heldModules.push(params.requestId);
      else send(account ? "Fetch.continueResponse" : "Fetch.continueRequest", { requestId: params.requestId }).catch(error => errors.push(error.message));
    }
  };
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, label) => {
    for (let i = 0; i < 300; i++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await sleep(100);
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  // Dispatch actual browser input, not element.click(): the topmost painted
  // element must receive the event, which catches stacking-context regressions.
  const tapPoint = async ({ x, y }) => {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(80);
  };
  const tap = async selector => {
    const point = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error("Missing tap target");
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    assert.ok(point.x > 0 && point.x < width && point.y > 0 && point.y < height, `visible tap target: ${selector}`);
    await tapPoint(point);
  };
  const layeringFailures = () => evaluate(`(() => {
    const panel = document.querySelector('[data-testid="mobile-menu-panel"]');
    const backdrop = document.querySelector('[data-testid="mobile-menu-backdrop"]');
    const r = panel.getBoundingClientRect();
    const failures = [];
    for (let y = 20; y < innerHeight; y += 70) {
      for (const x of [Math.max(5, r.left / 2), r.left + 10, r.left + r.width / 2, r.right - 10]) {
        const top = document.elementFromPoint(x, y);
        if (x < r.left ? top !== backdrop : !panel.contains(top)) {
          failures.push({ x, y, tag: top?.tagName, text: top?.textContent?.trim().slice(0, 45) });
        }
      }
    }
    return failures;
  })()`);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width, height,
    deviceScaleFactor: 1, mobile,
  });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Fetch.enable", { patterns: [
    { urlPattern: "*/api/user", requestStage: "Response" },
    { urlPattern: "*/src/pages/home-page.tsx*", requestStage: "Request" },
  ] });
  await send("Page.navigate", { url: base });
  await until('document.querySelector(".nav-container") && document.querySelector(".nav-container a[href=\\"/calendar\\"]")', "normal public navigation");
  assert.ok(heldAccounts.length, "the genuine account response remains delayed");
  assert.equal(await evaluate('!!document.querySelector("[data-testid=\\"legal-check-shell\\"]")'), true);
  assert.equal(await evaluate('!!document.querySelector(".nav-container a[href=\\"/auth\\"]")'), false, "unknown identity is not treated as logged out");
  assert.equal(await evaluate('!!document.querySelector(".nav-container a[href=\\"/terms\\"], .nav-container a[href=\\"/privacy\\"], .nav-container a[href=\\"/copyright-notices\\"]")'), false);
  await until('document.querySelector(".nav-container img")?.complete && document.querySelector(".nav-container img")?.naturalWidth > 0', "initial logo image dimensions");
  await evaluate('window.__initialNav = document.querySelector(".nav-container"); window.__initialLogoNode = document.querySelector(".nav-container img"); window.__initialLogo = window.__initialLogoNode.getBoundingClientRect().toJSON()');
  if (mobile) {
    await tap('[aria-label="Open navigation menu"]');
    await until('document.querySelector("[aria-label=\\"Close navigation menu\\"]")', "initial mobile menu");
    assert.equal(await evaluate('!!document.querySelector("[data-testid=\\"button-mobile-login\\"]")'), false);
    assert.deepEqual(await layeringFailures(), [], "the initial menu receives taps across its entire panel and backdrop");
    await tap('[data-testid="mobile-menu-panel"] a[href="/calendar"]');
  } else {
    await evaluate('document.querySelector(".nav-container a[href=\\"/calendar\\"]").click()');
  }
  await until('location.pathname === "/calendar"', "public calendar navigation during the account check");
  await evaluate('document.querySelector(".nav-container a[href=\\"/\\"]").click()');
  await until('location.pathname === "/"', "returning home without reloading");
  assert.equal(await evaluate('window.__initialNav === document.querySelector(".nav-container")'), true);
  const accountBound = /\/api\/(?:messages|dmca\/my-activity|vendors\/unvisited|forum\/unread-count|products\/new-products-count|real-estate\/new-listings-count|pages$|community-categories|social-clubs|vendor-categories)/;
  assert.deepEqual(requests.filter(path => accountBound.test(path)), [], "pending navigation starts no private/menu requests");

  holdAccount = false;
  for (const requestId of heldAccounts.splice(0)) await send("Fetch.continueResponse", { requestId });
  await until('document.querySelector("[data-testid=\\"status-route-loading\\"]")', "delayed page-module loading");
  assert.equal(await evaluate('window.__initialNav === document.querySelector(".nav-container")'), true, "the same header survives account resolution");
  assert.equal(await evaluate('!!document.querySelector("[data-testid=\\"legal-check-shell\\"]")'), false);
  assert.equal(await evaluate('!!document.querySelector(".nav-container a[href=\\"/auth\\"]")'), true, "confirmed guest navigation shows login");
  const before = await evaluate("window.__initialLogo");
  const after = await evaluate('document.querySelector(".nav-container img").getBoundingClientRect().toJSON()');
  assert.equal(await evaluate('window.__initialLogoNode === document.querySelector(".nav-container img")'), true, "the logo stays mounted");
  // Enabled weather/rocket widgets can flex the logo width on narrow screens.
  // Keep that separate from the header's identity, position, and height.
  assert.deepEqual([after.x, after.y, after.height], [before.x, before.y, before.height], "the logo stays anchored when checks finish");
  assert.ok(heldModules.length, "the actual page module remains delayed");
  if (mobile) {
    await tap('[aria-label="Open navigation menu"]');
    await until('document.querySelector("[data-testid=\\"mobile-menu-overlay\\"]")', "menu during delayed page download");
    await evaluate('window.__loadingMenu = document.querySelector("[data-testid=\\"mobile-menu-overlay\\"]"); undefined');
    assert.deepEqual(await layeringFailures(), [], "the menu covers page-download feedback too");
  }
  holdModule = false;
  for (const requestId of heldModules.splice(0)) await send("Fetch.continueRequest", { requestId });
  await until('document.querySelector("[data-testid=\\"section-home-events\\"]")', "homepage content");
  if (mobile) {
    assert.equal(await evaluate('window.__loadingMenu === document.querySelector("[data-testid=\\"mobile-menu-overlay\\"]")'), true,
      "finishing the page download preserves the open menu");
    await until('!document.querySelector("[data-testid=\\"status-home-events-loading\\"]")', "populated or confirmed-empty events");
    assert.deepEqual(await layeringFailures(), [], "the populated homepage never paints or receives taps above the menu");
    const scrollPositions = await evaluate('Array.from(new Set([innerHeight / 2, document.documentElement.scrollHeight / 2, document.documentElement.scrollHeight - innerHeight])).filter(y => y > 0)');
    for (const y of scrollPositions) {
      await evaluate(`window.scrollTo(0, ${y})`);
      await sleep(80);
      assert.deepEqual(await layeringFailures(), [], `the fixed menu covers lower-page cards at scroll offset ${y}`);
    }
    await evaluate('window.scrollTo(0, 0)');
    await sleep(80);

    // Negative control: reproduce the original parent-level tie in this
    // isolated browser only, proving the hit-test detects the reported bug.
    await evaluate('document.querySelector("[data-testid=\\"legal-gate-navigation\\"]").classList.replace("z-50", "z-10")');
    const originalFailures = await layeringFailures();
    await evaluate('document.querySelector("[data-testid=\\"legal-gate-navigation\\"]").classList.replace("z-10", "z-50")');
    assert.ok(originalFailures.length > 0, "the hit-test rejects the original broken stacking relationship");
    assert.deepEqual(await layeringFailures(), []);
    await evaluate('window.__pageClicks = 0; document.querySelector("main").addEventListener("click", () => window.__pageClicks++)');
    await tap('[data-testid="mobile-nav-social-clubs-trigger"]');
    await until('document.querySelector("[data-testid=\\"mobile-nav-social-clubs-all\\"]")', "nested menu section");
    assert.deepEqual(await layeringFailures(), [], "expanded sections remain above the page");
    if (process.argv[4]) {
      const screenshot = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(process.argv[4], Buffer.from(screenshot.data, "base64"));
    }
    await tap('[aria-label="Close navigation menu"]');
    await until('!document.querySelector("[data-testid=\\"mobile-menu-overlay\\"]")', "close-button dismissal");
    assert.equal(await evaluate(`(() => {
      const input = document.querySelector('main input');
      const r = input.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === input;
    })()`), true, "closing the menu restores page hit targets");
    await tap('[aria-label="Open navigation menu"]');
    assert.deepEqual(await layeringFailures(), []);
    const backdropPoint = await evaluate(`(() => {
      const r = document.querySelector('[data-testid="mobile-menu-panel"]').getBoundingClientRect();
      return { x: Math.max(5, r.left / 2), y: innerHeight / 2 };
    })()`);
    await tapPoint(backdropPoint);
    await until('!document.querySelector("[data-testid=\\"mobile-menu-overlay\\"]")', "backdrop dismissal");
    assert.equal(await evaluate('window.__pageClicks'), 0, "panel and backdrop taps never activate the page underneath");
    await tap('[aria-label="Open navigation menu"]');
    await tap('[data-testid="mobile-menu-panel"] a[href="/calendar"]');
    await until('location.pathname === "/calendar" && !document.querySelector("[data-testid=\\"mobile-menu-overlay\\"]")', "menu link navigation and dismissal");
  }
  assert.equal(await evaluate('window.__initialNav === document.querySelector(".nav-container")'), true);
  assert.equal(await evaluate('document.querySelectorAll(".nav-container").length'), 1);
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, "no horizontal overflow");
  assert.deepEqual(errors, [], "no browser exceptions");
  console.log(JSON.stringify({ viewport, delayedAccount: true, usablePublicNavigation: true, stableHeader: true, stableLogoAnchor: true, logoWidthChange: after.width - before.width, delayedModule: true, menuHitTesting: mobile, dismissAndNavigate: mobile, privateRequestsWhilePending: 0, browserExceptions: errors.length }));
} finally {
  socket?.close();
  browser.kill("SIGTERM");
  await sleep(200);
  await rm(profile, { recursive: true, force: true });
}
