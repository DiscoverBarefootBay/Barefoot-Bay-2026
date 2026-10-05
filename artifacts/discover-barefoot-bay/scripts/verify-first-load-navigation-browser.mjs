// Anonymous, read-only browser verification. Delay genuine responses/modules;
// never replace account or consent responses, or bypass authentication.
// Usage: node scripts/verify-first-load-navigation-browser.mjs https://preview [mobile]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) throw new Error("Provide the preview URL.");
const mobile = process.argv[3] === "mobile";
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
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: mobile ? 390 : 1680, height: mobile ? 844 : 1000,
    deviceScaleFactor: 1, mobile,
  });
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
  await evaluate('window.__initialNav = document.querySelector(".nav-container"); window.__initialLogo = document.querySelector(".nav-container img").getBoundingClientRect().toJSON()');
  if (mobile) {
    await evaluate('document.querySelector("[aria-label=\\"Open navigation menu\\"]").click()');
    await until('document.querySelector("[aria-label=\\"Close navigation menu\\"]")', "initial mobile menu");
    assert.equal(await evaluate('!!document.querySelector("[data-testid=\\"button-mobile-login\\"]")'), false);
    await evaluate('Array.from(document.querySelectorAll(".nav-container a[href=\\"/calendar\\"]")).at(-1).click()');
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
  assert.deepEqual([after.x, after.y, after.width, after.height], [before.x, before.y, before.width, before.height], "the logo does not jump when checks finish");
  assert.ok(heldModules.length, "the actual page module remains delayed");
  holdModule = false;
  for (const requestId of heldModules.splice(0)) await send("Fetch.continueRequest", { requestId });
  await until('document.querySelector("[data-testid=\\"section-home-events\\"]")', "homepage content");
  assert.equal(await evaluate('window.__initialNav === document.querySelector(".nav-container")'), true);
  assert.equal(await evaluate('document.querySelectorAll(".nav-container").length'), 1);
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, "no horizontal overflow");
  assert.deepEqual(errors, [], "no browser exceptions");
  console.log(JSON.stringify({ viewport: mobile ? "mobile" : "desktop", delayedAccount: true, usablePublicNavigation: true, stableHeader: true, stableLogo: true, delayedModule: true, privateRequestsWhilePending: 0, browserExceptions: errors.length }));
} finally {
  socket?.close();
  browser.kill("SIGTERM");
  await sleep(200);
  await rm(profile, { recursive: true, force: true });
}
