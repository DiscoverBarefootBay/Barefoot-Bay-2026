import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

class DevToolsClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(JSON.stringify(message.error)));
        } else {
          pending.resolve(message.result);
        }
        return;
      }

      for (const listener of this.listeners.get(message.method) ?? []) {
        Promise.resolve(listener(message.params)).catch((error) => {
          console.error(`DevTools listener failed for ${message.method}:`, error);
        });
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    this.socket.close();
  }
}

const preloadScript = `(() => {
  const trace = [];
  const ids = new WeakMap();
  let nextId = 1;
  const idFor = (node) => {
    if (!node) return null;
    if (!ids.has(node)) ids.set(node, nextId++);
    return ids.get(node);
  };
  const detailsFromNodes = (nodes) => [...nodes].flatMap((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    return [
      ...(node.matches("details") ? [node] : []),
      ...node.querySelectorAll("details"),
    ];
  });

  window.__bbDisclosureCheck = {
    clear() {
      trace.length = 0;
    },
    read(index) {
      const summaries = document.querySelectorAll(
        ".vendor-content-container summary",
      );
      const summary = summaries[index];
      const details = summary?.closest("details");
      return {
        found: Boolean(summary && details),
        label: summary?.textContent?.trim(),
        nodeId: idFor(details),
        open: details?.open,
        connected: details?.isConnected,
        mutations: trace.filter((entry) => entry.kind === "details-replaced"),
        events: trace.filter((entry) => entry.kind === "event"),
      };
    },
  };

  document.addEventListener("click", (event) => {
    const details = event.target?.closest?.("details");
    if (!details) return;
    trace.push({
      kind: "event",
      type: "click",
      trusted: event.isTrusted,
      detail: event.detail,
      button: event.button,
      pointerType: event.pointerType,
      nodeId: idFor(details),
      open: details.open,
    });
  }, true);

  document.addEventListener("toggle", (event) => {
    if (!(event.target instanceof HTMLDetailsElement)) return;
    trace.push({
      kind: "event",
      type: "toggle",
      trusted: event.isTrusted,
      nodeId: idFor(event.target),
      open: event.target.open,
    });
  }, true);

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type !== "childList") continue;
      const added = detailsFromNodes(record.addedNodes);
      const removed = detailsFromNodes(record.removedNodes);
      if (!added.length && !removed.length) continue;
      trace.push({
        kind: "details-replaced",
        added: added.map(idFor),
        removed: removed.map(idFor),
      });
    }
  }).observe(document, { childList: true, subtree: true });
})();`;

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function waitFor(client, expression, timeout = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await evaluate(client, expression)) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function activateSummary(client, index, mode) {
  const point = await evaluate(
    client,
    `(() => {
      const summary = document.querySelectorAll(
        ".vendor-content-container summary",
      )[${index}];
      summary.scrollIntoView({ block: "center" });
      const rect = summary.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`,
  );

  if (mode === "mouse") {
    await client.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    });
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    });
    return;
  }

  if (mode === "touch") {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        {
          x: point.x,
          y: point.y,
          radiusX: 2,
          radiusY: 2,
          force: 1,
          id: 1,
        },
      ],
    });
    await sleep(80);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    return;
  }

  await evaluate(
    client,
    `document.querySelectorAll(
      ".vendor-content-container summary",
    )[${index}].focus()`,
  );
  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "char",
    text: "\r",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
}

async function verifyInteraction(
  client,
  targetUrl,
  mode,
  index,
  requestCount,
  telemetry,
) {
  const mobile = mode === "touch";
  if (mobile) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await client.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    });
  } else {
    await client.send("Emulation.clearDeviceMetricsOverride");
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  }

  telemetry.browser.length = 0;
  telemetry.network.length = 0;
  await client.send("Page.navigate", {
    url: `${targetUrl}?disclosure-check=${mode}-${Date.now()}`,
  });
  try {
    await waitFor(
      client,
      `document.querySelectorAll(
        ".vendor-content-container summary",
      ).length >= 2`,
    );
  } catch (error) {
    const diagnostics = await evaluate(
      client,
      `({
        url: location.href,
        title: document.title,
        text: document.body?.innerText?.slice(0, 1_000),
        summaries: document.querySelectorAll("summary").length,
      })`,
    );
    throw new Error(
      `${error.message}\n${JSON.stringify(
        {
          ...diagnostics,
          browser: telemetry.browser.slice(-80),
          network: telemetry.network.slice(-80),
        },
        null,
        2,
      )}`,
    );
  }

  await sleep(1_500);
  requestCount.reset();
  await evaluate(client, "window.__bbDisclosureCheck.clear()");
  await sleep(700);

  let state = await evaluate(
    client,
    `window.__bbDisclosureCheck.read(${index})`,
  );
  assert.equal(requestCount.read(), 0, `${mode}: CMS refetched after settling`);
  assert.deepEqual(state.mutations, [], `${mode}: details changed before click`);

  const originalNodeId = state.nodeId;
  await activateSummary(client, index, mode);
  await sleep(500);
  state = await evaluate(client, `window.__bbDisclosureCheck.read(${index})`);
  assert.equal(state.open, true, `${mode}: ${state.label} did not stay open`);
  assert.equal(state.nodeId, originalNodeId, `${mode}: details node was replaced`);
  const activationClick = state.events.find((event) => event.type === "click");
  const openingToggle = state.events.find(
    (event) => event.type === "toggle" && event.open === true,
  );
  assert.equal(
    activationClick?.trusted,
    true,
    `${mode}: activation click was not browser-trusted`,
  );
  assert.equal(
    openingToggle?.trusted,
    true,
    `${mode}: opening toggle was not browser-trusted`,
  );
  assert.equal(activationClick?.button, 0, `${mode}: activation was not primary`);
  assert.equal(
    activationClick?.pointerType,
    mode === "keyboard" ? "" : mode,
    `${mode}: activation used the wrong input path`,
  );
  assert.equal(
    activationClick?.detail,
    mode === "keyboard" ? 0 : 1,
    `${mode}: activation click count was unexpected`,
  );

  await sleep(1_000);
  state = await evaluate(client, `window.__bbDisclosureCheck.read(${index})`);
  assert.equal(state.open, true, `${mode}: ${state.label} reset after opening`);
  assert.equal(requestCount.read(), 0, `${mode}: clicking triggered a CMS refetch`);
  assert.deepEqual(state.mutations, [], `${mode}: clicking replaced CMS details`);

  await activateSummary(client, index, mode);
  await sleep(500);
  state = await evaluate(client, `window.__bbDisclosureCheck.read(${index})`);
  assert.equal(state.open, false, `${mode}: second activation did not close`);
  assert.equal(state.nodeId, originalNodeId, `${mode}: details node was replaced`);

  console.log(`PASS ${mode}: ${state.label}`);
}

async function main() {
  const urlArgument = process.argv.slice(2).find((argument) => argument !== "--");
  const targetUrl =
    urlArgument ??
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/community/social/aa-meeting`
      : "http://127.0.0.1/community/social/aa-meeting");
  const port = 9_300 + (process.pid % 500);
  const profileDirectory = `/tmp/bb-disclosure-browser-${process.pid}`;
  const chromium = spawn(
    process.env.CHROMIUM_PATH ?? "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDirectory}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let chromiumLog = "";
  chromium.stderr.on("data", (chunk) => {
    chromiumLog += chunk.toString();
  });

  let client;
  try {
    let page;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        const pages = await response.json();
        page = pages.find((candidate) => candidate.type === "page");
        if (page) break;
      } catch {
        // Chromium is still starting.
      }
      await sleep(250);
    }
    if (!page) throw new Error(`Chromium did not start:\n${chromiumLog}`);

    client = new DevToolsClient(page.webSocketDebuggerUrl);
    await client.connect();

    const pageRequests = { value: 0 };
    const telemetry = { browser: [], network: [] };
    client.on("Network.requestWillBeSent", ({ request }) => {
      if (request.url.includes("/api/pages/social-aa-meeting")) {
        pageRequests.value += 1;
      }
      if (
        request.url.includes("/api/user") ||
        request.url.includes("/api/pages") ||
        request.url.includes("/api/feature")
      ) {
        telemetry.network.push(`REQUEST ${request.method} ${request.url}`);
      }
    });
    client.on("Network.responseReceived", ({ response }) => {
      if (
        response.url.includes("/api/user") ||
        response.url.includes("/api/pages") ||
        response.url.includes("/api/feature")
      ) {
        telemetry.network.push(`RESPONSE ${response.status} ${response.url}`);
      }
    });
    client.on("Runtime.consoleAPICalled", ({ type, args }) => {
      const message = args
        .map((argument) => argument.value ?? argument.description ?? "")
        .join(" ");
      if (
        message.includes("GenericContentPage") ||
        message.includes("community") ||
        type === "error"
      ) {
        telemetry.browser.push(`${type.toUpperCase()} ${message}`);
      }
    });
    client.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      telemetry.browser.push(
        `EXCEPTION ${exceptionDetails.exception?.description ?? exceptionDetails.text}`,
      );
    });
    const requestCount = {
      read: () => pageRequests.value,
      reset: () => {
        pageRequests.value = 0;
      },
    };

    client.on("Fetch.requestPaused", async ({ requestId, request }) => {
      const url = new URL(request.url);
      if (url.pathname !== "/api/user") {
        await client.send("Fetch.continueRequest", { requestId });
        return;
      }
      const user = {
        id: 999_999,
        username: "browser-check",
        email: "browser-check@example.test",
        fullName: "Browser Check",
        role: "registered",
        isApproved: true,
      };
      await client.send("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Cache-Control", value: "no-store" },
        ],
        body: Buffer.from(JSON.stringify(user)).toString("base64"),
      });
    });

    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Network.enable"),
      client.send("Fetch.enable", {
        patterns: [{ urlPattern: "*://*/api/user*", requestStage: "Request" }],
      }),
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: preloadScript,
    });

    await verifyInteraction(
      client,
      targetUrl,
      "mouse",
      0,
      requestCount,
      telemetry,
    );
    await verifyInteraction(
      client,
      targetUrl,
      "touch",
      1,
      requestCount,
      telemetry,
    );
    await verifyInteraction(
      client,
      targetUrl,
      "keyboard",
      0,
      requestCount,
      telemetry,
    );
  } finally {
    client?.close();
    const chromiumExited = new Promise((resolve) => {
      chromium.once("exit", resolve);
    });
    chromium.kill("SIGTERM");
    await Promise.race([chromiumExited, sleep(3_000)]);
    if (chromium.exitCode === null) {
      chromium.kill("SIGKILL");
      await Promise.race([chromiumExited, sleep(1_000)]);
    }
    await rm(profileDirectory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});