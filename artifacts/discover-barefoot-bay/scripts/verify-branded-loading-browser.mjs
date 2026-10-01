import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const profile = await mkdtemp("/tmp/bb-loading-browser-");
const port = 9400 + (process.pid % 500);
const browser = spawn(process.env.CHROMIUM_PATH ?? "chromium", [
  "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
let socket;
const pending = new Map();
let id = 0;
let heldRequest;
const targetUrl = process.argv[2] ?? (
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/` : "http://127.0.0.1/"
);

try {
  let page;
  for (let attempt = 0; attempt < 100 && !page; attempt++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())
        .find(candidate => candidate.type === "page");
    } catch { /* Chromium may not have opened its debug port yet. */ }
    if (!page) await sleep(100);
  }
  assert.ok(page, "Chromium starts");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const response = pending.get(message.id);
      if (!response) return;
      pending.delete(message.id);
      clearTimeout(response.timer);
      if (message.error) response.reject(new Error(message.error.message));
      else response.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      heldRequest = message.params.requestId;
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`Timed out: ${method}`));
    }, 15_000);
    pending.set(requestId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`Browser condition did not become true: ${expression}`);
  };
  await send("Page.enable");
  // Delay the real anonymous auth request, never invent an authenticated user
  // or alter its response. This exposes only the public pending shell.
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/user", requestStage: "Request" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: targetUrl });
  await waitFor("!!document.querySelector('[data-testid=\"branded-loading-mark\"]')");
  assert.ok(heldRequest, "the real account request is pending");
  const geometry = await evaluate(`(() => {
    const mark = document.querySelector('[data-testid="branded-loading-mark"]');
    const r = mark.getBoundingClientRect();
    return { width: r.width, height: r.height, x: r.x, y: r.y };
  })()`);
  assert.equal(geometry.width, 44);
  assert.equal(geometry.height, 24);
  assert.equal(await evaluate("!!document.querySelector('[data-testid=\"legal-gate-content\"]')"), false,
    "unknown authentication does not mount ordinary application content");
  assert.equal(await evaluate(`/checking your account|account loading/i.test(document.body.textContent)`), false);
  assert.equal(await evaluate(`document.querySelector('[data-testid="legal-gate-initial-check"]').textContent.trim()`), "Loading");
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.bbl-drift')).animationName`), "bbl-drift");
  const desktop = await send("Page.captureScreenshot", { format: "png" });
  await writeFile("/tmp/branded-loading-desktop.png", Buffer.from(desktop.data, "base64"));

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(100);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, "phone has no horizontal overflow");
  const mobile = await send("Page.captureScreenshot", { format: "png" });
  await writeFile("/tmp/branded-loading-mobile.png", Buffer.from(mobile.data, "base64"));

  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.bbl-drift, .bbl-ripple'))
    .map(el => getComputedStyle(el).animationName)`), ["none", "none", "none"]);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.bbl-ripple')).opacity`), "0.35",
    "reduced motion retains a visible static branded ripple");
  assert.deepEqual(await evaluate(`(() => {
    const r = document.querySelector('[data-testid="branded-loading-mark"]').getBoundingClientRect();
    return { width: r.width, height: r.height };
  })()`), { width: 44, height: 24 }, "reduced motion retains reserved geometry");
  await send("Fetch.continueRequest", { requestId: heldRequest });
  await send("Fetch.disable");
  await waitFor("!document.querySelector('[data-testid=\"legal-gate-initial-check\"]')");
  assert.equal(await evaluate("!!document.querySelector('[data-testid=\"branded-loading-mark\"]')"), false,
    "real request completion removes the animation");
  console.log(JSON.stringify({
    result: "PASS", scope: "real anonymous pending request, desktop/mobile, reduced motion and completion",
    screenshots: ["/tmp/branded-loading-desktop.png", "/tmp/branded-loading-mobile.png"],
  }));
} finally {
  for (const response of pending.values()) clearTimeout(response.timer);
  socket?.close();
  browser.kill("SIGTERM");
  await sleep(250);
  await rm(profile, { recursive: true, force: true });
}