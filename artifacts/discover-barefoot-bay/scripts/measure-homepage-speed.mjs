// Anonymous, single-browser probes only. Does not log in or alter site data.
// Usage: node scripts/measure-homepage-speed.mjs https://host/ [mobile] [--checks]
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const target = process.argv[2];
if (!target || !/^https?:\/\//.test(target)) throw new Error("Provide a homepage URL");
const mobile = process.argv[3] === "mobile";
const checkStates = process.argv.includes("--checks");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const port = 9400 + process.pid % 400;
const profile = `/tmp/bb-home-speed-${process.pid}`;
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
  let startedRequests = [];
  let eventOverride = null;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (item) message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      failures.push(message.params.exceptionDetails.exception?.description?.split("\n")[0] ?? message.params.exceptionDetails.text);
    } else if (message.method === "Network.requestWillBeSent") {
      startedRequests.push({ path: new URL(message.params.request.url).pathname + new URL(message.params.request.url).search, at: performance.now() });
    } else if (message.method === "Fetch.requestPaused") {
      const { requestId } = message.params;
      if (eventOverride === "empty" || eventOverride === "error-once") {
        const error = eventOverride === "error-once";
        if (error) eventOverride = null;
        send("Fetch.fulfillRequest", {
          requestId, responseCode: error ? 503 : 200,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body: Buffer.from(error ? '{"message":"Probe failure"}' : "[]").toString("base64"),
        }).catch(e => failures.push(e.message));
      } else {
        send("Fetch.continueRequest", { requestId }).catch(e => failures.push(e.message));
      }
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
  await send("Emulation.setDeviceMetricsOverride", {
    width: mobile ? 390 : 1365, height: mobile ? 844 : 900,
    deviceScaleFactor: 1, mobile,
  });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    performance.setResourceTimingBufferSize(10000);
    window.__bbHomeProbe = {longTasks:[],shellAt:null,eventsAt:null};
    new PerformanceObserver(list => window.__bbHomeProbe.longTasks.push(...list.getEntries().map(e => ({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
    new MutationObserver(() => {
      const probe = window.__bbHomeProbe;
      if (probe.shellAt === null && document.querySelector('nav')) probe.shellAt = performance.now();
      const section = [...document.querySelectorAll('main section')].find(s => s.querySelector('h2')?.textContent.includes('Events for'));
      if (probe.eventsAt === null && section && (section.querySelector('a[href*="/events/"]') || section.querySelector('[data-testid="status-home-events-empty"]'))) probe.eventsAt = performance.now();
    }).observe(document, {childList:true,subtree:true});
  ` });
  const waitReady = async calendar => {
    const start = performance.now();
    while (performance.now() - start < 75000) {
      const ready = await evaluate(`(() => {
        if (/Something went wrong/.test(document.body?.innerText || '')) return false;
        if (${calendar}) return !!document.querySelector('input[placeholder="Search events..."]')
          && !document.querySelector('[data-testid="status-calendar-loading"],[data-testid="status-calendar-error"]');
        const section = [...document.querySelectorAll('main section')].find(s => s.querySelector('h2')?.textContent.includes('Events for'));
        return !!section && !!(section.querySelector('a[href*="/events/"]') || section.querySelector('[data-testid="status-home-events-empty"]'))
          && !section.querySelector('[data-testid="status-home-events-loading"],[data-testid="status-home-events-error"]');
      })()`);
      if (ready) {
        await evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
        return true;
      }
      await sleep(100);
    }
    return false;
  };
  const metrics = async since => evaluate(`(() => {
    const nav=performance.getEntriesByType('navigation')[0];
    const entries=performance.getEntriesByType('resource').filter(e => e.startTime >= ${since});
    const requests=entries.filter(e=>/\\/api\\//.test(e.name)).map(e=>({
      path:new URL(e.name).pathname + new URL(e.name).search,
      startMs:Math.round(e.startTime),ttfbMs:Math.round(e.responseStart-e.requestStart),
      responseEndMs:Math.round(e.responseEnd),downloadMs:Math.round(e.responseEnd-e.responseStart),
      decodedBytes:e.decodedBodySize,transferredBytes:e.transferSize
    }));
    const eventRequests=requests.filter(e=>/^\\/api\\/events(?:\\?|$)/.test(e.path));
    const probe=window.__bbHomeProbe;
    return {
      htmlTtfbMs:Math.round(nav.responseStart-nav.requestStart),
      shellAtMs:probe.shellAt === null ? null : Math.round(probe.shellAt),
      eventsAtMs:probe.eventsAt === null ? null : Math.round(probe.eventsAt),
       postResponseRenderMs:${since} !== 0 || probe.eventsAt === null || !eventRequests.length ? null : Math.round(probe.eventsAt-eventRequests.at(-1).responseEndMs),
      eventRequests,accountPolicyRequests:requests.filter(e=>/^\\/api\\/(?:user$|legal\\/)/.test(e.path)),
      otherApiRequests:requests.filter(e=>!/^\\/api\\/(?:events(?:\\?|$)|user$|legal\\/|storage-proxy\\/)/.test(e.path)),
      scriptDecodedBytes:entries.filter(e=>e.initiatorType==='script'||/\\.js(?:\\?|$)/.test(e.name)).reduce((n,e)=>n+e.decodedBodySize,0),
       scriptTransferredBytes:entries.filter(e=>e.initiatorType==='script'||/\\.js(?:\\?|$)/.test(e.name)).reduce((n,e)=>n+e.transferSize,0),
      mediaTransferredBytes:entries.filter(e=>e.initiatorType==='img'||e.initiatorType==='video').reduce((n,e)=>n+e.transferSize,0),
      longTasks:probe.longTasks.filter(e=>e.start>=${since}),
      eventLinkCount:document.querySelectorAll('main a[href*="/events/"]').length
    };
  })()`);
  for (const warmth of ["cold", "warm"]) {
    failures = [];
    startedRequests = [];
    const start = performance.now();
    await send("Page.navigate", { url: target });
    const ready = await waitReady(false);
    console.log(JSON.stringify({
      profile: mobile ? "mobile-390-unthrottled" : "desktop-1365-unthrottled",
      warmth, route: "home", ready, usableMs: Math.round(performance.now()-start), failures, ...await metrics(0),
      startedEventRequests: startedRequests.filter(r => /^\/api\/events(?:\?|$)/.test(r.path)).map(r => r.path),
      startedBannerFiles: [...new Set(startedRequests.filter(r => /storage-proxy\/(?:BANNER\/banner-slides|direct-banner)\//.test(r.path)).map(r => r.path.split("/").at(-1)))],
    }));
    if (!ready) throw new Error("Homepage events did not become usable");
    const since = await evaluate("performance.now()");
    const navigationStart = performance.now();
    const clicked = await evaluate(`(() => {
      const section = [...document.querySelectorAll('main section')].find(s => s.querySelector('h2')?.textContent.includes('Events for'));
      const link = section?.querySelector('a[href$="/calendar"]');
      if (!link) return false;
      link.click(); return true;
    })()`);
    if (!clicked) throw new Error("View All Events link was not found");
    const calendarReady = await waitReady(true);
    console.log(JSON.stringify({
      profile: mobile ? "mobile-390-unthrottled" : "desktop-1365-unthrottled",
      warmth, route: "home-to-calendar", ready: calendarReady,
      usableMs: Math.round(performance.now()-navigationStart), failures, ...await metrics(since),
    }));
    if (!calendarReady) throw new Error("Calendar navigation did not become usable");
  }
  if (checkStates) {
    // Read-only anonymous browser fixtures; never intercept account/legal data.
    const waitFor = async expression => {
      const start = performance.now();
      while (performance.now() - start < 15000) {
        if (await evaluate(expression)) return;
        await sleep(100);
      }
      throw new Error(`Browser state check timed out: ${expression}`);
    };
    const selector = name => `!!document.querySelector('[data-testid="${name}"]')`;
    await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/events?start=*", requestStage: "Request" }] });
    eventOverride = "empty";
    await send("Page.navigate", { url: target });
    await waitFor(selector("status-home-events-empty"));
    if (await evaluate(selector("status-home-events-loading"))) throw new Error("Empty response left skeletons visible");
    eventOverride = "error-once";
    await send("Page.navigate", { url: target });
    await waitFor(selector("status-home-events-error"));
    await evaluate(`document.querySelector('[data-testid="button-retry-home-events"]').click()`);
    if (!await waitReady(false)) throw new Error("Retry did not restore today's events");
    await send("Fetch.disable");
    const archiveBeforeTyping = startedRequests.filter(r => r.path === "/api/events").length;
    if (archiveBeforeTyping) throw new Error("Idle homepage still fetched the event archive");
    await evaluate(`(() => {
      const input = document.querySelector('[data-testid="input-search-homepage"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'budget');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(`!!document.querySelector('[data-testid^="search-result-"]') || /No results found for/.test(document.body.innerText)`);
    if (!startedRequests.some(r => r.path === "/api/events")) throw new Error("Typing did not activate historical event search");
    console.log(JSON.stringify({ route: "browser-state-checks", profile: mobile ? "mobile" : "desktop", empty: true, error: true, retry: true, idleArchiveRequests: archiveBeforeTyping, searchActivated: true, failures }));
  }
} finally {
  socket?.close();
  browser.kill("SIGTERM");
  await sleep(500);
  if (browser.exitCode === null) browser.kill("SIGKILL");
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}