// Anonymous read-only checks. Only banner/media fixtures are synthesized;
// authentication and legal responses are always genuine, and API writes fail.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
const base = process.argv[2];
if (!base?.startsWith("https://")) throw Error("Pass the preview https URL");
const port = 9300 + process.pid % 300;
const profile = `/tmp/banner-check-${process.pid}`;
const clip = `/tmp/banner-check-${process.pid}.webm`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ffmpeg = spawnSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i",
  "color=c=blue:s=160x90:d=1", "-an", "-c:v", "libvpx", "-y", clip]);
if (ffmpeg.status !== 0) throw Error("Could not create test-only video");
const videoBytes = (await readFile(clip)).toString("base64");
const actual = await (await fetch(base + "/api/pages/banner-slides")).json();
const slides = JSON.parse(actual.content);
const fixtureSrc = "/api/storage-proxy/BANNER/banner-slides/banner-fixture.webm";
const browser = spawn("chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage",
  "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let socket, mode = "normal", errors = [];
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
  const fulfill = (requestId, body, responseCode = 200, type = "application/json") =>
    send("Fetch.fulfillRequest", { requestId, responseCode, responseHeaders: [
      { name: "Content-Type", value: type }, { name: "Cache-Control", value: "no-store" },
    ], body: type === "video/webm" ? body : Buffer.from(body).toString("base64") });
  socket.onmessage = async ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (p) m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
    else if (m.method === "Fetch.requestPaused") {
      const { requestId, request } = m.params;
      try {
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
          await send("Fetch.failRequest", { requestId, errorReason: "Aborted" }); return;
        }
        if (request.url.includes("banner-fixture.webm")) {
          await fulfill(requestId, videoBytes, 200, "video/webm"); return;
        }
        if (new URL(request.url).pathname === "/api/pages/banner-slides") {
          if (mode === "error") { await fulfill(requestId, "{}", 503); return; }
          if (mode === "empty") { await fulfill(requestId, JSON.stringify({ ...actual, content: "[]" })); return; }
          if (mode === "malformed") { await fulfill(requestId, JSON.stringify({ ...actual, content: "broken" })); return; }
          if (mode === "slow") await sleep(9000);
          if (mode === "mixed") {
            await fulfill(requestId, JSON.stringify({ ...actual, content: JSON.stringify([
              slides[0], { ...slides[1], src: fixtureSrc, mediaType: "video" }, slides[2],
            ]) })); return;
          }
        }
        if (mode === "image-error" && request.url.includes("/banner-slides/")) {
          await send("Fetch.failRequest", { requestId, errorReason: "Failed" }); return;
        }
        await send("Fetch.continueRequest", { requestId });
      } catch { /* A bounded request may have been cancelled while held. */ }
    }
  };
  const ev = async expression => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
    return r.result.value;
  };
  async function wait(expression, timeout = 10000) {
    for (let t = 0; t < timeout; t += 100) {
      if (await ev(expression)) return;
      await sleep(100);
    }
    throw Error(`Timed out: ${expression}`);
  }
  const navigate = async (nextMode, mobile = false) => {
    mode = nextMode;
    await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1365, height: 900, deviceScaleFactor: 1, mobile });
    await send("Page.navigate", { url: base + "/" });
  };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/*" }] });
  await navigate("normal");
  await wait("!!document.querySelector('[data-testid=\"community-banner\"] img[fetchpriority=\"high\"]')?.complete");
  await ev("document.querySelector('[aria-label=\"Go to slide 2\"]').click()");
  await wait(`document.querySelector('[data-testid="community-banner"] img[fetchpriority="high"]')?.src.includes(${JSON.stringify(slides[1].src.split("/").at(-1))})`);
  console.log("PASS desktop navigation and current-slide priority");
  await navigate("normal", true);
  await wait("!!document.querySelector('[data-testid=\"community-banner\"] img[fetchpriority=\"high\"]')?.complete");
  await ev(`(()=>{const el=document.querySelector('.touch-pan-y');const touch=x=>new Touch({identifier:1,target:el,clientX:x,clientY:200});el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch(300)]}));el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[touch(50)]}));})()`);
  await wait(`document.querySelector('[data-testid="community-banner"] img[fetchpriority="high"]')?.src.includes(${JSON.stringify(slides[1].src.split("/").at(-1))})`);
  console.log("PASS phone swipe navigation and current-slide priority");
  for (const failure of ["error", "malformed", "slow"]) {
    await navigate(failure);
    await wait("!!document.querySelector('[data-testid=\"banner-error\"]')", 15000);
    assert.ok(await ev("!!document.querySelector('main .event-title')"), "banner failure must not block homepage events");
    mode = "normal";
    await ev("document.querySelector('[data-testid=\"banner-error\"] button').click()");
    await wait("!!document.querySelector('[data-testid=\"community-banner\"]')");
    console.log(`PASS ${failure} metadata, independent page content and explicit retry`);
  }
  await navigate("empty");
  await wait("!!document.querySelector('[data-testid=\"banner-empty\"]')");
  assert.equal(await ev("!!document.querySelector('[data-testid=\"community-banner\"]')"), false);
  console.log("PASS true-empty configuration without invented/default slides");
  await navigate("image-error");
  await wait("!!document.querySelector('[data-testid=\"community-banner\"] [role=\"alert\"] button')");
  mode = "normal";
  await ev("document.querySelector('[data-testid=\"community-banner\"] [role=\"alert\"] button').click()");
  await wait("document.querySelector('[data-testid=\"community-banner\"] img[fetchpriority=\"high\"]')?.naturalWidth > 0");
  console.log("PASS derivative + original failure and image retry recovery");
  for (const mobile of [false, true]) {
    await navigate("mixed", mobile);
    await wait("!!document.querySelector('[data-testid=\"community-banner\"] img[fetchpriority=\"high\"]')?.complete");
    if (mobile) {
      await ev(`(()=>{const el=document.querySelector('.touch-pan-y');const touch=x=>new Touch({identifier:1,target:el,clientX:x,clientY:200});el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch(300)]}));el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[touch(50)]}));})()`);
    } else await ev("document.querySelector('[aria-label=\"Go to slide 2\"]').click()");
    await wait("!!document.querySelector('[data-testid=\"community-banner\"] video')?.readyState");
    assert.equal(await ev("document.querySelectorAll('[data-testid=\"community-banner\"] video').length"), 1);
    console.log(`PASS ${mobile ? "phone" : "desktop"} mixed media with one playable video element`);
  }
  assert.deepEqual(errors, []);
} finally {
  socket?.close(); browser.kill(); await sleep(300);
  await rm(profile, { recursive: true, force: true, maxRetries: 5 });
  await rm(clip, { force: true });
}
