// Anonymous, read-only CDP smoke checks and navigation timings. No auth bypass.
// Usage: node scripts/verify-calendar-previews-browser.mjs https://host [mobile] [baseline]
// Baseline mode requires an unlinked .local/probes/calendar-baseline.tsx copy
// in this artifact; it overrides the module ONLY in this anonymous CDP session.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) throw new Error("Provide the preview base URL.");
const mobile = process.argv[3] === "mobile";
const baseline = process.argv.includes("baseline");
const baselineModule = baseline ? await (await fetch(base + "/@fs" +
  fileURLToPath(new URL("../.local/probes/calendar-baseline.tsx", import.meta.url)))).text() : null;
if (baseline && !baselineModule.includes("CalendarPage")) throw new Error("Baseline module was not transformed by Vite.");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const port = 9500 + process.pid % 300;
const profile = `/tmp/bb-calendar-check-${process.pid}`;
const browser = spawn(process.env.CHROMIUM_PATH ?? "chromium", [
  "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
let socket;
try {
  let tab;
  for (let i = 0; i < 60 && !tab; i++) {
    try { tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.type === "page"); } catch {}
    if (!tab) await sleep(200);
  }
  if (!tab) throw new Error("Browser failed to start.");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const failures = [];
  let override = null;
  let dayRequests = [];
  let summaryRequests = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      failures.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    } else if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      if (baseline && url.pathname === "/src/pages/calendar-page.tsx") {
        send("Fetch.fulfillRequest", { requestId, responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: "text/javascript" }],
          body: Buffer.from(baselineModule).toString("base64"),
        }).catch(e => failures.push(e.message));
        return;
      }
      const summary = url.pathname === "/api/events/month-previews";
      const day = url.pathname === "/api/events" && url.searchParams.has("start");
      if (summary) summaryRequests.push(url.pathname + url.search);
      if (day) dayRequests.push(url.pathname + url.search);
      const applies = override && ((summary && override.startsWith("summary")) || (day && override.startsWith("day")));
      if (applies) {
        const error = override.endsWith("error");
        const body = error ? '{"message":"Calendar probe failure"}' : summary ? '{"days":{}}' : "[]";
        send("Fetch.fulfillRequest", { requestId, responseCode: error ? 503 : 200,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body: Buffer.from(body).toString("base64"),
        }).catch(e => failures.push(e.message));
      } else send("Fetch.continueRequest", { requestId }).catch(e => failures.push(e.message));
    }
  };
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async expression => {
    const start = performance.now();
    while (performance.now() - start < 35000) {
      if (await evaluate(expression)) {
        await evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
        return Math.round(performance.now() - start);
      }
      await sleep(60);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  const loaded = `!!document.querySelector('input[placeholder="Search events..."]') &&
    !document.querySelector('[data-testid="status-calendar-loading"],[data-testid="status-calendar-month-loading"]')`;
  const clickButton = label => evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(label)});
    if (!button) throw new Error('Missing button: '+${JSON.stringify(label)});
    button.click();
  })()`);
  const cards = `document.querySelectorAll('a[href^="/events/"]:not(.mobile-calendar-event)').length`;
  const previews = `document.querySelectorAll('td.calendar-cell a.mobile-calendar-event').length`;
  const navigate = async path => {
    dayRequests = []; summaryRequests = [];
    await send("Page.navigate", { url: base + path });
    await wait(loaded);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*api/events*" },
    ...(baseline ? [{ urlPattern: "*src/pages/calendar-page.tsx*" }] : [])] });
  await send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
  await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1365, height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile });
  await navigate("/calendar");
  const initial = { dayRequests: [...dayRequests], summaryRequests: [...summaryRequests] };
  assert.equal(dayRequests.length, 1);
  assert.equal(summaryRequests.length, mobile || baseline ? 0 : 1);
  if (!mobile) {
    const counts = await evaluate(`[...document.querySelectorAll('td.calendar-cell')].map(e => e.querySelectorAll('a.mobile-calendar-event').length)`);
    assert.ok(counts.length >= 28 && counts.every(n => n <= 3));
    dayRequests = []; summaryRequests = [];
    const start = performance.now();
    await evaluate(`(() => {
      const month = new Date();
      const prefix = month.getFullYear() + '-' + String(month.getMonth()+1).padStart(2,'0') + '-';
      const link = [...document.querySelectorAll('td.calendar-cell a[href^="/calendar?date="]')]
        .find(e => e.getAttribute('href').includes(prefix));
      if (!link) throw new Error('No overflow day to test');
      link.click();
    })()`);
    await wait(loaded);
    assert.equal(dayRequests.length, baseline ? 0 : 1);
    assert.equal(summaryRequests.length, 0);
    assert.ok(await evaluate(cards) > 3);
    console.log(JSON.stringify({ check: "overflow-full-day", ms: Math.round(performance.now() - start), cards: await evaluate(cards), dayRequests }));
    const previewHref = await evaluate(`document.querySelector('td.calendar-cell a.mobile-calendar-event').getAttribute('href')`);
    assert.match(previewHref, /returnDate=\d{4}-\d{2}-\d{2}/);
    // Measure month arrows without changing the independently selected date.
    dayRequests = []; summaryRequests = [];
    const monthStart = performance.now();
    await evaluate(`document.querySelector('button[aria-label*="next" i][aria-label*="month" i]').click()`);
    await wait(loaded);
    assert.equal(summaryRequests.length, baseline ? 0 : 1);
    // Legacy month changes also request the selected day outside the new window,
    // since that day has not yet been cached separately.
    assert.equal(dayRequests.length, baseline ? 2 : 0);
    console.log(JSON.stringify({ check: "next-month", ms: Math.round(performance.now() - monthStart), dayRequests, summaryRequests }));
  }
  await clickButton("Week"); await wait(loaded);
  await clickButton("Day"); await wait(loaded);
  assert.ok(await evaluate(cards) > 0);
  console.log(JSON.stringify({ check: "week-day-switch", passed: true }));
  // Real historical search and selection of an initially uncached date.
  await evaluate(`(() => {
    const input = document.querySelector('input[placeholder="Search events..."]');
    input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Bingo');
    input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await wait(`!!document.querySelector('button[data-testid^="suggestion-"]')`);
  await evaluate(`document.querySelector('button[data-testid^="suggestion-"]').click()`);
  await wait(loaded);
  assert.ok(await evaluate(cards) > 0);
  console.log(JSON.stringify({ check: "historical-search-selected-day", passed: true }));
  // Returning from homepage via SPA must reuse its fresh selected-day cache.
  await send("Page.navigate", { url: base + "/" });
  await wait(`(() => {
    const section = document.querySelector('[data-testid="section-home-events"]');
    return !!section && !!section.querySelector('a[href*="/events/"],[data-testid="status-home-events-empty"]') &&
      !section.querySelector('[data-testid="status-home-events-loading"],[data-testid="status-home-events-error"]');
  })()`);
  dayRequests = []; summaryRequests = [];
  const spaStart = performance.now();
  await evaluate(`document.querySelector('a[href="/calendar"]').click()`);
  await wait(loaded);
  assert.equal(dayRequests.length, baseline && !mobile ? 1 : 0);
  assert.equal(summaryRequests.length, mobile || baseline ? 0 : 1);
  console.log(JSON.stringify({ check: "homepage-to-calendar", ms: Math.round(performance.now() - spaStart), dayRequests, summaryRequests }));
  for (const mode of baseline ? [] : mobile ? ["day-empty", "day-error"] : ["summary-empty", "summary-error", "day-empty", "day-error"]) {
    override = mode;
    await navigate("/calendar");
    if (mode.endsWith("empty")) {
      assert.ok(await evaluate(`!!document.querySelector('[data-testid="status-calendar-empty"]')`));
    } else {
      await wait(`!!document.querySelector('[data-testid="status-calendar-error"]')`);
      if (!mobile) assert.ok(await evaluate(mode.startsWith("summary") ? cards : previews) > 0);
      override = null;
      await evaluate(`document.querySelector('[data-testid="button-retry-calendar"]').click()`);
      await wait(`${loaded} && !document.querySelector('[data-testid="status-calendar-error"]')`);
    }
    console.log(JSON.stringify({ check: mode, retry: mode.endsWith("error"), passed: true }));
    override = null;
  }
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ profile: mobile ? "mobile" : "desktop", baseline, initial, uncaughtExceptions: failures, passed: true }));
} finally {
  socket?.close(); browser.kill("SIGTERM"); await sleep(300);
  if (browser.exitCode === null) browser.kill("SIGKILL");
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}