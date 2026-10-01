// Guest-only read-only browser probe. No cookies, login bypass, or load testing.
// Usage: node scripts/measure-calendar-speed.mjs https://host/calendar [mobile]
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const target = process.argv[2];
if (!target || !/^https?:\/\//.test(target)) throw new Error("Provide a calendar URL");
const mobile = process.argv[3] === "mobile";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const port = 9400 + process.pid % 400;
const profile = `/tmp/bb-speed-${process.pid}`;
const browser = spawn(process.env.CHROMIUM_PATH ?? "chromium", [
  "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
let socket;
try {
  let tab;
  for (let i = 0; i < 60 && !tab; i++) {
    try { tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.type === "page"); } catch {}
    if (!tab) await sleep(250);
  }
  if (!tab) throw new Error("Browser failed to start");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  let failures = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      failures.push(message.params.exceptionDetails.exception?.description?.split("\n")[0] ?? message.params.exceptionDetails.text);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: mobile ? 390 : 1365, height: mobile ? 844 : 900,
    deviceScaleFactor: 1, mobile,
  });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__bbLongTasks = [];
    new PerformanceObserver(list => window.__bbLongTasks.push(...list.getEntries().map(e => ({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  ` });
  for (const warmth of ["cold", "warm"]) {
    failures = [];
    const start = performance.now();
    await send("Page.navigate", { url: target });
    let ready = false;
    while (performance.now() - start < 75000) {
      ready = await evaluate(`(() => {
        const requests = performance.getEntriesByType('resource').filter(e => /\\/api\\/events(?:\\?|$)/.test(e.name));
        const text = document.body?.innerText || '';
        const calendarVisible = /Calendar|Events|No events/i.test(text) || !!document.querySelector('input[placeholder="Search events..."]');
        return requests.some(e => e.responseEnd > 0) && calendarVisible && !document.querySelector('[data-testid="status-calendar-loading"],[data-testid="status-calendar-error"]') && !/Checking your account status|Something went wrong/.test(text);
      })()`);
      if (ready) break;
      await sleep(100);
    }
    // Allow the next paint after response JSON processing.
    await evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
    const usableMs = Math.round(performance.now() - start);
    const metrics = await evaluate(`(() => {
      const nav=performance.getEntriesByType('navigation')[0];
      const entries=performance.getEntriesByType('resource');
      return {
        htmlTtfbMs:Math.round(nav.responseStart-nav.requestStart),
        eventRequests:entries.filter(e=>/\\/api\\/events(?:\\?|$)/.test(e.name)).map(e=>({
          path:new URL(e.name).pathname + new URL(e.name).search,
          startMs:Math.round(e.startTime),ttfbMs:Math.round(e.responseStart-e.requestStart),
          downloadMs:Math.round(e.responseEnd-e.responseStart),decodedBytes:e.decodedBodySize,
          transferredBytes:e.transferSize
        })),
        scriptDecodedBytes:entries.filter(e=>e.initiatorType==='script'||/\\.js(?:\\?|$)/.test(e.name)).reduce((n,e)=>n+e.decodedBodySize,0),
        longTasks:window.__bbLongTasks,
        visibleText:document.body.innerText.slice(-350)
      };
    })()`);
    console.log(JSON.stringify({ profile: mobile ? "mobile-390-unthrottled" : "desktop-1365-unthrottled", warmth, ready, usableMs, failures, ...metrics }));
  }
} finally {
  socket?.close();
  browser.kill("SIGTERM");
  await sleep(500);
  if (browser.exitCode === null) browser.kill("SIGKILL");
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}