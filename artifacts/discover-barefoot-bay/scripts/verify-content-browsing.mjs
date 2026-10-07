import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.argv[2];
if (!base?.startsWith("https://")) throw new Error("Pass the preview URL");
const port = 9500 + process.pid % 300;
const profile = `/tmp/content-browser-${process.pid}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = spawn("chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let socket;
try {
  let tab;
  for (let i = 0; i < 150 && !tab; i++) {
    try { tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page"); } catch {}
    if (!tab) await sleep(200);
  }
  if (!tab) throw new Error("Browser unavailable");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => socket.onopen = r);
  let id = 0;
  const pending = new Map(), requests = [], exceptions = [];
  let nextFault = null;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  socket.onmessage = async ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (p) m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method === "Runtime.exceptionThrown") {
      exceptions.push(m.params.exceptionDetails.text);
    } else if (m.method === "Fetch.requestPaused") {
      const { requestId, request } = m.params;
      const url = new URL(request.url);
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        return void await send("Fetch.failRequest", { requestId, errorReason: "Aborted" });
      }
      if (url.pathname === "/api/forum/stories") requests.push(url.searchParams.toString());
      const nextPage = url.pathname === "/api/forum/stories" && Number(url.searchParams.get("offset")) > 0;
      if (nextFault === "revision" && nextPage) {
        nextFault = null; url.searchParams.set("revision", "outdated");
        return void await send("Fetch.continueRequest", { requestId, url: url.href });
      }
      if ((nextFault === "more-error" && nextPage) ||
          (nextFault === "community-error" && url.pathname === "/api/community-directory")) {
        if (nextFault === "more-error") nextFault = null;
        return void await send("Fetch.fulfillRequest", { requestId, responseCode: 503,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body: Buffer.from('{"message":"Test temporary failure"}').toString("base64") });
      }
      // A failed category-count request must never hold the story grid hostage.
      if (url.pathname === "/api/forum/categories") {
        return void await send("Fetch.fulfillRequest", { requestId, responseCode: 503,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body: Buffer.from('{"message":"Test count failure"}').toString("base64") });
      }
      await send("Fetch.continueRequest", { requestId });
    }
  };
  const ev = async expression => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 200; i++) {
      if (await ev(`!!(${expression})`)) return;
      await sleep(100);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const countExpr = 'document.querySelectorAll(\'[data-testid="story-grid"] a\').length';
  const clickMore = () => ev(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Load More Stories'))?.click()`);
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/*" }] });
  await send("Page.navigate", { url: base + "/forum" });
  await until(`${countExpr}===12`);
  for (let i = 1; i <= 5; i++) {
    await clickMore(); await until(`${countExpr}===${12 * (i + 1)}`);
  }
  const loadedIds = await ev(`Array.from(document.querySelectorAll('[data-testid="story-grid"] a')).map(a=>a.getAttribute('href'))`);
  assert.equal(new Set(loadedIds).size, 72);
  assert.deepEqual(requests.slice(0, 6).map(p => Number(new URLSearchParams(p).get("offset"))), [0, 12, 24, 36, 48, 60]);
  console.log("Real UI: 72 unique cards; only next batches downloaded; failed categories do not block cards");
  nextFault = "revision";
  await clickMore(); await until(`${countExpr}===12`);
  console.log("Real UI: actual server 409 automatically restarts the changing feed");
  nextFault = "more-error";
  await clickMore();
  await until(`document.querySelector('[role="alert"]')?.textContent.includes("load more stories")`);
  assert.equal(await ev(countExpr), 12);
  await clickMore(); await until(`${countExpr}===24`);
  console.log("Real UI: temporary next-page failure keeps existing cards and retry succeeds");
  await ev(`history.pushState({},'', '/forum?categoryId=4');dispatchEvent(new PopStateEvent('popstate'));`);
  await until(`document.querySelector('[data-testid="story-grid"]') || document.body.textContent.includes("No stories yet")`);
  await sleep(500);
  assert.equal(new URLSearchParams(requests.at(-1)).get("categoryId"), "4");
  assert.equal(new URLSearchParams(requests.at(-1)).get("offset"), "0");
  console.log("Real UI: URL category filter resets pagination");
  nextFault = "community-error";
  await send("Page.navigate", { url: base + "/community/community" });
  await until(`document.querySelector('[role="alert"]')?.textContent.includes("Community pages")`);
  nextFault = null;
  await ev(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Try again'))?.click()`);
  await until(`document.querySelector('[data-testid^="vendor-banner-"],[data-testid^="vendor-card-"]')`);
  console.log("Real UI: Community failure is explicit and retry renders cards");
  assert.deepEqual(exceptions, []);
} finally {
  socket?.close(); browser.kill(); await sleep(100); await rm(profile, { recursive: true, force: true });
}
