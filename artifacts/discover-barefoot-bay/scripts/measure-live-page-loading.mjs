// Real anonymous GET responses only. No auth fixtures, cookies, or production writes.
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
const base = process.argv[2];
if (!base?.startsWith("https://")) throw Error("Pass the verified production or preview https URL");
const mobile = process.argv.includes("--mobile");
const firstEntry = process.argv.includes("--first-in-app");
const routeArg = process.argv.find(a => a.startsWith("--routes="));
const routes = routeArg ? routeArg.slice("--routes=".length).split(",") : ["/", "/calendar", "/vendors", "/community/community"];
const port = 9500 + process.pid % 300;
const profile = `/tmp/live-page-probe-${process.pid}`;
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
  if (!tab) throw Error("Chromium did not expose a debugging tab within 30 seconds");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => socket.onopen = r);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  socket.onmessage = async ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (p) m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method === "Fetch.requestPaused") {
      const { requestId, request } = m.params;
      // Allow unmodified reads; prevent analytics, visits, and other writes.
      await send(["GET", "HEAD", "OPTIONS"].includes(request.method) ? "Fetch.continueRequest" : "Fetch.failRequest",
        ["GET", "HEAD", "OPTIONS"].includes(request.method) ? { requestId } : { requestId, errorReason: "Aborted" });
    }
  };
  const ev = async expression => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
    return r.result.value;
  };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/*" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1365, height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    performance.setResourceTimingBufferSize(5000);
    window.__firstUsable=null;window.__longTasks=[];
    new PerformanceObserver(l=>window.__longTasks.push(...l.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
    new MutationObserver(()=>{
      const selector=location.pathname==='/'
        ? 'main .event-title'
        : location.pathname==='/calendar' ? 'main [data-event-title],main .event-title,main a[href^="/events/"],[data-testid="status-calendar-empty"]'
        : location.pathname.startsWith('/vendors')||location.pathname.startsWith('/community')
          ? '[data-testid^="vendor-card-"],[data-testid^="vendor-banner-"],[data-testid^="community-card-"],[data-testid^="community-banner-"]'
          : location.pathname.startsWith('/forum') ? '[data-testid="story-grid"] a' : null;
      if(window.__firstUsable===null&&selector&&document.querySelector(selector))window.__firstUsable=performance.now();
    }).observe(document,{childList:true,subtree:true});` });
  for (const path of firstEntry ? [routeArg ? routes[0] : "/vendors"] : routes) {
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    let since = 0;
    if (firstEntry) {
      await send("Page.navigate", { url: base + "/" }); await sleep(6500);
      since = await ev("window.__firstUsable=null;performance.now()");
      await ev(`history.pushState({},'',${JSON.stringify(path)});dispatchEvent(new PopStateEvent('popstate'));`);
    } else await send("Page.navigate", { url: base + path });
    await sleep(path === "/vendors" ? 12000 : 6500);
    console.log(JSON.stringify({ base, path, mobile, kind: firstEntry ? "first-in-app" : "cold-direct", ...await ev(`({
      usableMs:window.__firstUsable===null?null:window.__firstUsable-${since}, skeleton:!!document.querySelector('[data-testid="status-vendors-loading"]'),
      heading:document.querySelector('main h1')?.textContent, mainPresent:!!document.querySelector('main'),
      visibleStatus:document.body.innerText.slice(0,550),
      testIds:[...document.querySelectorAll('main [data-testid]')].slice(0,35).map(e=>e.dataset.testid),
      nav:performance.getEntriesByType('navigation').map(e=>({ttfb:e.responseStart,dom:e.domContentLoadedEventEnd})),
      resources:performance.getEntriesByType('resource').filter(e=>e.startTime>=${since}&&(e.name.includes('/api/')||e.name.includes('/assets/'))).map(e=>({path:new URL(e.name).pathname,start:Math.round(e.startTime-${since}),ms:Math.round(e.duration),bytes:e.decodedBodySize})),
      longTasks:window.__longTasks
    })`) }));
    // These are revisits after the initial route load, not first-ever entries.
    await send("Network.setCacheDisabled", { cacheDisabled: false });
    for (const kind of ["in-app-return", "warm-return"]) {
      await ev(`history.pushState({},'','/terms');dispatchEvent(new PopStateEvent('popstate'));`);
      await sleep(500);
      const since = await ev(`window.__firstUsable=null;performance.now()`);
      await ev(`history.pushState({},'',${JSON.stringify(path)});dispatchEvent(new PopStateEvent('popstate'));`);
      await sleep(1200);
      console.log(JSON.stringify({ base, path, mobile, kind, ...await ev(`({
        usableMs:window.__firstUsable===null?null:Math.round(window.__firstUsable-${since}),
        skeleton:!!document.querySelector('[data-testid="status-vendors-loading"]'),
        resources:performance.getEntriesByType('resource').filter(e=>e.startTime>=${since}&&e.name.includes('/api/')).map(e=>({path:new URL(e.name).pathname,start:Math.round(e.startTime-${since}),ms:Math.round(e.duration)}))
      })`) }));
    }
  }
} finally {
  socket?.close(); browser.kill(); await sleep(300);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
