// Read-only anonymous banner probe. Run sequentially, with builds/tests idle.
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
const base = process.argv[2];
if (!base?.startsWith("https://")) throw Error("Pass the verified preview https URL");
const mobile = process.argv.includes("--mobile");
const port = 9500 + process.pid % 300;
const profile = `/tmp/banner-probe-${process.pid}`;
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
  if (!tab) throw Error("Chromium unavailable");
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
      const read = ["GET", "HEAD", "OPTIONS"].includes(request.method);
      await send(read ? "Fetch.continueRequest" : "Fetch.failRequest",
        read ? { requestId } : { requestId, errorReason: "Aborted" });
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
    window.__bannerTimes={};
    window.__checkBanner=()=>{
      const t=window.__bannerTimes;
      if(t.navigation===undefined&&document.querySelector('nav'))t.navigation=performance.now();
      const imgs=[...document.querySelectorAll('main img')].filter(e=>e.src.includes('/banner-slides/')||e.dataset.bannerImage!==undefined);
      const visible=imgs.find(e=>{let n=e;while(n&&n!==document.body){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;n=n.parentElement;}const r=e.getBoundingClientRect();return r.width>0&&r.left<innerWidth&&r.right>0});
      if(visible&&t.metadataRendered===undefined)t.metadataRendered=performance.now();
      if(visible?.complete&&visible.naturalWidth>0&&t.firstImage===undefined){t.firstImage=performance.now();t.src=visible.currentSrc;t.width=visible.naturalWidth;}
    };
    setInterval(window.__checkBanner,16);` });
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Page.navigate", { url: base + "/" });
  await sleep(7000);
  for (const kind of ["cold", "in-app-return"]) {
    if (kind === "in-app-return") {
      await send("Network.setCacheDisabled", { cacheDisabled: false });
      await ev("history.pushState({},'','/terms');dispatchEvent(new PopStateEvent('popstate'));");
      await sleep(600);
      await ev("window.__bannerTimes={};window.__since=performance.now();history.pushState({},'','/');dispatchEvent(new PopStateEvent('popstate'));");
      await sleep(3500);
    }
    console.log(JSON.stringify({ mobile, kind, ...await ev(`({
      timings:Object.fromEntries(Object.entries(window.__bannerTimes).map(([k,v])=>[k,typeof v==='number'&&k!=='width'?Math.round(v-(window.__since||0)):v])),
      metadata:performance.getEntriesByType('resource').filter(e=>e.startTime>=(window.__since||0)&&e.name.includes('/api/pages/banner-slides')).map(e=>({start:Math.round(e.startTime-(window.__since||0)),ms:Math.round(e.duration),bytes:e.decodedBodySize})),
      media:performance.getEntriesByType('resource').filter(e=>e.startTime>=(window.__since||0)&&e.name.includes('/banner-slides/')&&!e.name.endsWith('.tsx')).map(e=>({url:new URL(e.name).pathname+new URL(e.name).search,start:Math.round(e.startTime-(window.__since||0)),ms:Math.round(e.duration),bytes:e.decodedBodySize})),
      startup:performance.getEntriesByType('navigation').map(e=>({ttfb:Math.round(e.responseStart),dom:Math.round(e.domContentLoadedEventEnd)}))
    })`) }));
  }
} finally {
  socket?.close(); browser.kill(); await sleep(300);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
