// Simulated frontend regression checks only: all /api requests are intercepted.
// No real account is created, no authenticated API is contacted, and no email is sent.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const base = process.argv.slice(2).find((arg) => arg !== "--")
  ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1");
const origin = new URL(base).origin;
const port = 9300 + process.pid % 500;
const profile = `/tmp/bb-legal-consent-browser-${process.pid}`;
const names = ["terms", "privacy", "dmca"];
const titles = { terms: "Terms and Agreements", privacy: "Privacy Policy", dmca: "Copyright/DMCA Policy" };
const urls = { terms: "/terms", privacy: "/privacy", dmca: "/dmca" };
const caseNumber = "DMCA-2026-000001";
const caseSummary = {
  caseNumber, status: "content_disabled", statusLabel: "Content disabled",
  disabledAt: "2026-01-15T12:00:00.000Z",
  counterNoticeSubmittedAt: null, waitingPeriod: null, restoredAt: null, closedAt: null,
  items: [{
    contentType: "forum_post", contentTypeLabel: "Forum Post",
    originalUrl: "/forum/post/987654", title: "Simulated affected upload", removed: true,
  }],
  canSubmitCounterNotice: true,
};
const caseDetail = {
  ...caseSummary,
  notice: {
    receivedAt: "2026-01-14T12:00:00.000Z",
    claimantName: "Simulated claimant",
    copyrightedWork: "Simulated copyrighted work",
    claimDescription: "Simulated claim description",
  },
  howToRespond: "A counter-notice may be submitted for this affected upload.",
  counterNoticeUrl: `/copyright-notices/${caseNumber}/counter-notice`,
  templateStatus: "pending_counsel_review",
};
const policies = (versions = [101, 102, 103]) => names.map((key, i) => ({
  key, versionId: versions[i], title: titles[key], url: urls[key],
  publishedAt: "2026-01-15T12:00:00.000Z",
  contentHtml: `<p>Simulated ${key} policy version ${versions[i]} browser fixture</p>`,
  changeNotes: null,
}));

class CDP {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else {
        for (const listener of this.listeners.get(message.method) ?? []) {
          Promise.resolve(listener(message.params)).catch((error) => {
            this.listenerErrors.push(error);
          });
        }
      }
    });
    this.listenerErrors = [];
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
  }
  close() { this.socket.close(); }
}

async function evalIn(client, expression) {
  const reply = await client.send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (reply.exceptionDetails) throw new Error(JSON.stringify(reply.exceptionDetails));
  return reply.result.value;
}
async function waitFor(client, expression, message, timeout = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evalIn(client, expression)) return;
    await sleep(150);
  }
  const diagnostics = await evalIn(client, `({url:location.href,text:document.body?.innerText?.slice(0,1400)})`);
  throw new Error(`${message}: ${JSON.stringify(diagnostics)}`);
}

// These inspect user-facing text, labels, native checkboxes, and ARIA checkboxes;
// intentionally no test-only attributes or internal React state.
const helper = `(() => {
  const visible = (el) => !!el && !!el.getClientRects().length &&
    getComputedStyle(el).visibility !== "hidden";
  const label = (el) => [el.getAttribute("aria-label"),
    el.getAttribute("aria-labelledby")?.split(/\\s+/).map(id => document.getElementById(id)?.textContent).join(" "),
    el.labels && [...el.labels].map(node => node.textContent).join(" "),
    el.closest("label")?.textContent,
    el.parentElement?.textContent].filter(Boolean).join(" ").trim();
  const boxes = () => [...document.querySelectorAll('input[type="checkbox"],[role="checkbox"]')]
    .filter(visible).map(el => ({
      el, name:label(el), checked: el.matches("input") ? el.checked : el.getAttribute("aria-checked") === "true",
    }));
  window.__legalBrowser = {
    boxes: () => boxes().map(({name,checked}) => ({name,checked})),
    clickBox: (key) => {
      const re = key === "dmca" ? /copyright|dmca/i : new RegExp(key, "i");
      const match = boxes().find(item => re.test(item.name));
      if (!match) throw Error("No visible checkbox for " + key);
      match.el.click();
    },
    gate: () => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')]
      .filter(visible).find(el => /terms|privacy|copyright|dmca|polic/i.test(el.textContent))?.innerText ?? "",
    links: () => [...document.querySelectorAll("a[href]")]
      .filter(visible).map(el => ({name:(el.closest("section")?.querySelector("h3")?.textContent ?? "") +
        " " + el.textContent.trim(), href:el.getAttribute("href")})),
    read: (key) => {
      const re = key === "dmca" ? /copyright|dmca/i : new RegExp(key, "i");
      const section = [...document.querySelectorAll("section")].find(el =>
        re.test(el.querySelector("h3")?.textContent ?? ""));
      const button = [...(section?.querySelectorAll("button") ?? [])]
        .find(el => /read full text/i.test(el.textContent));
      if (!button) throw Error("Missing read full text control for " + key);
      button.click();
    },
    readSignup: (key) => {
      const re = key === "dmca" ? /copyright|dmca/i : new RegExp(key, "i");
      const item = boxes().find(box => re.test(box.name));
      const button = [...(item?.el.parentElement?.querySelectorAll("button") ?? [])]
        .find(el => /read it|read.*policy/i.test(el.textContent));
      if (!button) throw Error("Missing signup policy reader for " + key);
      button.click();
    },
    continue: () => {
      const buttons = [...document.querySelectorAll("button")].filter(visible);
      const button = buttons.find(el => /^(continue|accept|agree|save|submit)/i.test(el.textContent.trim()));
      if (!button) throw Error("No visible consent continue button");
      if (button.disabled) return false;
      button.click(); return true;
    },
    outsideClick: () => document.body.click(),
    overflow: () => {
      const root = document.documentElement;
      const gate = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')]
        .find(visible);
      return { pageWidth:root.scrollWidth, viewport:innerWidth,
        gateWidth:gate?.getBoundingClientRect().width,
        gateHeight:gate?.getBoundingClientRect().height,
        windowHeight:innerHeight,
        scrollable:gate && [gate, ...gate.querySelectorAll("*"), ...(() => {
          const parents = []; let p = gate.parentElement;
          while (p) { parents.push(p); p = p.parentElement; }
          return parents;
        })()].some(el =>
          el.scrollHeight > el.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(el).overflowY)),
      };
    },
  };
})();`;

async function navigate(client, path) {
  await client.send("Page.navigate", { url: `${origin}${path}` });
  await waitFor(client, "!!window.__legalBrowser && !!document.querySelector('#root')", "page initialization");
}
async function boxState(client) { return evalIn(client, "window.__legalBrowser.boxes()"); }
function namedBoxes(boxes) {
  return names.map((key) => boxes.find((box) =>
    (key === "dmca" ? /copyright|dmca/i : new RegExp(key, "i")).test(box.name)));
}
async function assertUnselected(client, expectedKeys) {
  const boxes = await boxState(client);
  for (const key of expectedKeys) {
    const box = namedBoxes(boxes)[names.indexOf(key)];
    assert.ok(box, `Missing visible ${key} checkbox: ${JSON.stringify(boxes)}`);
    assert.equal(box.checked, false, `${key} should begin unchecked`);
  }
}
async function assertOverflow(client, mode) {
  const layout = await evalIn(client, "window.__legalBrowser.overflow()");
  assert.ok(layout.pageWidth <= layout.viewport + 2, `${mode}: horizontal document overflow ${JSON.stringify(layout)}`);
  assert.ok(layout.gateWidth <= layout.viewport + 2, `${mode}: dialog wider than viewport`);
  if (layout.gateHeight > layout.windowHeight) {
    assert.ok(layout.scrollable, `${mode}: tall dialog has no scrollable content`);
  }
}
async function checkGate(client, expectedKeys) {
  await waitFor(client, "!!window.__legalBrowser.gate()", "authenticated consent gate");
  const gate = await evalIn(client, "window.__legalBrowser.gate()");
  for (const key of expectedKeys) {
    assert.match(gate, key === "dmca" ? /copyright|dmca/i : new RegExp(key, "i"));
  }
  await assertUnselected(client, expectedKeys);
}
async function checkLinks(client, expectedKeys) {
  const links = await evalIn(client, "window.__legalBrowser.links()");
  for (const key of expectedKeys) {
    assert.ok(links.some(({ name, href }) =>
      (key === "dmca" ? /copyright|dmca/i : new RegExp(key, "i")).test(name)
      && href && new URL(href, origin).pathname === urls[key]),
    `${key}: missing readable public policy link: ${JSON.stringify(links)}`);
  }
}
async function checkReadableGate(client, expectedKeys, currentPolicies) {
  for (const key of expectedKeys) {
    await evalIn(client, `window.__legalBrowser.read(${JSON.stringify(key)})`);
    const policy = currentPolicies.find((item) => item.key === key);
    await waitFor(client,
      `window.__legalBrowser.gate().includes(${JSON.stringify(`Simulated ${key} policy version ${policy.versionId}`)})`,
      `${key} full policy text`);
  }
}
async function clickLabeled(client, selector, label) {
  await evalIn(client, `(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(el =>
      el.getClientRects().length && el.textContent.trim().includes(${JSON.stringify(label)}));
    if (!el) throw Error(${JSON.stringify(`Missing visible action: ${label}`)});
    el.click();
  })()`);
}

async function verifyStatutoryDiscovery(client, fixture) {
  fixture.signedIn = true;
  fixture.noEmail = true; // No uploader email on file; discovery must not depend on emailed links.
  fixture.outstanding = names;
  fixture.failure = null;
  await navigate(client, "/profile");
  await checkGate(client, names);
  await clickLabeled(client, '[role="dialog"] a[href]', "Copyright notices and counter-notices");
  await waitFor(client,
    `location.pathname === "/copyright-notices" &&
      document.body.innerText.includes("Notices about your uploads") &&
      document.body.innerText.includes(${JSON.stringify(caseNumber)})`,
    "pending-consent uploader reaches own case list via the prompt");
  // The separate filed-claims endpoint is intentionally not exempt server-side.
  // Surface the misleading list error without stopping the statutory flow check.
  await sleep(8_000);
  const claimsError = await evalIn(client,
    `document.body.innerText.includes("Could not load filed claims")`);
  if (claimsError) console.warn(
    "OBSERVED UI BUG: uploader case list shows 'Could not load filed claims' while consent is pending; " +
    "/api/dmca/my-claims is intentionally not in the server's statutory exception.",
  );
  assert.ok(!await evalIn(client, "!!window.__legalBrowser.gate()"),
    "statutory uploader list remained behind the consent prompt");
  await clickLabeled(client, "button", "View notice information");
  await waitFor(client,
    `location.pathname === ${JSON.stringify(`/copyright-notices/${caseNumber}`)} &&
      document.body.innerText.includes("Simulated claimant") &&
      document.body.innerText.includes("Simulated copyrighted work")`,
    "pending-consent uploader reaches own case detail");
  await clickLabeled(client, "button", "Submit counter-notice");
  await waitFor(client,
    `location.pathname === ${JSON.stringify(`/copyright-notices/${caseNumber}/counter-notice`)} &&
      !!document.querySelector("form textarea") &&
      document.body.innerText.includes("Identification of removed material")`,
    "counter-notice form is available despite pending policy consent");
  const form = await evalIn(client, `(() => {
    const form = document.querySelector("form");
    return {
      material:form?.querySelector("textarea")?.value,
      fields:[...form.querySelectorAll("input,textarea,[role=checkbox]")].length,
      email:[...form.querySelectorAll('input[type="email"]')].map(el => el.value),
      consentGate:!!window.__legalBrowser.gate(),
    };
  })()`);
  assert.match(form.material, /Simulated affected upload/);
  assert.ok(form.fields >= 8, `counter-notice form incomplete: ${JSON.stringify(form)}`);
  assert.deepEqual(form.email, [""], "fixture uploader without email must not invent an address");
  assert.equal(form.consentGate, false, "counter-notice form blocked by consent gate");
  assert.equal(fixture.dmcaPosts.length, 0, "test must never submit a counter-notice");
  console.log("PASS simulated no-email uploader: gate link → owned list → detail → usable counter-notice form");

  fixture.failure = "read";
  await navigate(client, "/profile");
  await waitFor(client, `document.body.innerText.includes("Normal site access stays paused")`,
    "consent read failure blocks ordinary routes");
  await clickLabeled(client, 'a[href]', "Copyright notices and counter-notices");
  await waitFor(client,
    `location.pathname === "/copyright-notices" &&
      document.body.innerText.includes(${JSON.stringify(caseNumber)})`,
    "error gate must still link to uploader case discovery");
  assert.equal(fixture.dmcaPosts.length, 0);
  console.log("PASS simulated consent-read error: statutory discovery link still works");
}

async function main() {
  console.log("SIMULATED FRONTEND TESTS — intercepted legal/auth APIs; no real signup or writes");
  const chromium = spawn(process.env.CHROMIUM_PATH ?? "chromium", [
    "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chromium.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  let client;
  try {
    let page;
    for (let i = 0; i < 60; i++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        page = pages.find((candidate) => candidate.type === "page");
        if (page) break;
      } catch { /* Chromium not ready */ }
      await sleep(250);
    }
    if (!page) throw new Error(`Chromium failed to start: ${stderr}`);
    client = new CDP(page.webSocketDebuggerUrl);
    await client.connect();
    const fixture = {
      signedIn: false, noEmail: false, policies: policies(), outstanding: names,
      failure: null, posts: [], dmcaPosts: [], blocked: [], requests: [],
    };
    client.on("Fetch.requestPaused", async ({ requestId, request }) => {
      const url = new URL(request.url);
      const path = url.pathname;
      fixture.requests.push(`${request.method} ${path}`);
      let code = 503, body = { error: "SIMULATED FRONTEND TEST: unmocked API unavailable" };
      if (path === "/api/user") {
        code = fixture.signedIn ? 200 : 401;
        body = fixture.signedIn
          ? { id: 999999, username: "simulated-browser-user", email: fixture.noEmail ? null : "simulated@example.test",
            fullName: "Simulated Browser User", role: "registered", isApproved: true }
          : { message: "Not authenticated" };
      } else if (path === "/api/legal/policies" && request.method === "GET") {
        code = 200; body = { policies: fixture.policies };
      } else if (path === "/api/legal/consent" && request.method === "GET") {
        code = fixture.failure === "read" ? 500 : 200;
        body = code === 200
          ? { policies: fixture.policies, outstanding: fixture.policies.filter(p => fixture.outstanding.includes(p.key)), requiresAcceptance: fixture.outstanding.length > 0 }
          : { message: "Simulated consent read failure" };
      } else if (path === "/api/legal/consent" && request.method === "POST") {
        fixture.posts.push(JSON.parse(request.postData ?? "{}"));
        if (fixture.failure === "stale") {
          fixture.policies = policies([201, 102, 103]);
          code = 409; body = { error: "Policy version changed; review current version", policies: fixture.policies };
          fixture.failure = null;
        } else if (fixture.failure === "write") {
          code = 500; body = { message: "Simulated consent write failure" };
        } else {
          code = 200;
          body = { policies: fixture.policies, outstanding: [], requiresAcceptance: false };
          fixture.outstanding = [];
        }
      } else if (path === "/api/dmca/my-activity" && request.method === "GET") {
        // This auxiliary navigation badge is NOT on the server's narrow
        // pending-consent allowlist. Do not accidentally mock a bypass.
        code = fixture.outstanding.length ? 428 : 200;
        body = code === 200 ? { hasActivity: true } : { message: "Policy acceptance required", code: "POLICY_ACCEPTANCE_REQUIRED" };
      } else if (path === "/api/dmca/my-cases" && request.method === "GET") {
        code = 200; body = { cases: [caseSummary] };
      } else if (path === `/api/dmca/my-cases/${caseNumber}` && request.method === "GET") {
        code = 200; body = caseDetail;
      } else if (path === "/api/dmca/my-claims" && request.method === "GET") {
        code = fixture.outstanding.length ? 428 : 200;
        body = code === 200 ? { claims: [] } : { message: "Policy acceptance required", code: "POLICY_ACCEPTANCE_REQUIRED" };
      } else if (path.startsWith("/api/dmca/my-cases/") && request.method === "POST") {
        fixture.dmcaPosts.push(path);
        code = 503; body = { message: "SIMULATED FRONTEND TEST: counter-notice submission prohibited" };
      } else {
        fixture.blocked.push(`${request.method} ${path}`);
      }
      await client.send("Fetch.fulfillRequest", {
        requestId, responseCode: code,
        responseHeaders: [{ name: "Content-Type", value: "application/json" },
          { name: "Cache-Control", value: "no-store" }],
        body: Buffer.from(JSON.stringify(body)).toString("base64"),
      });
    });
    await Promise.all([
      client.send("Page.enable"), client.send("Runtime.enable"),
      client.send("Fetch.enable", { patterns: [{ urlPattern: "*://*/api/*", requestStage: "Request" }] }),
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: helper });

    await navigate(client, "/auth?tab=register");
    await waitFor(client, "window.__legalBrowser.boxes().length >= 3", "signup policy checkboxes");
    await assertUnselected(client, names);
    const signupBoxes = namedBoxes(await boxState(client));
    for (const policy of fixture.policies) {
      assert.match(signupBoxes[names.indexOf(policy.key)].name, new RegExp(`\\b${policy.versionId}\\b`),
        `${policy.key} signup checkbox must identify the exact published version`);
      await evalIn(client, `window.__legalBrowser.readSignup(${JSON.stringify(policy.key)})`);
      await waitFor(client,
        `!![...document.querySelectorAll('[role="dialog"]')].find(el => el.innerText.includes(
          ${JSON.stringify(`Simulated ${policy.key} policy version ${policy.versionId}`)}))`,
        `${policy.key} signup dialog must display the current policy snapshot`);
      await evalIn(client, `([...document.querySelectorAll('[role="dialog"] button')]
        .find(el => /^close$/i.test(el.textContent.trim())) ??
        (() => { throw Error("Missing signup policy close button"); })()).click()`);
      await waitFor(client, "!document.querySelector('[role=\"dialog\"]')", "signup reader closes");
    }
    await assertUnselected(client, names);
    assert.equal(fixture.posts.length, 0, "signup checks must never submit actual registration");
    console.log("PASS simulated signup: three independently unchecked policies and readable links");

    fixture.signedIn = true;
    await navigate(client, "/profile");
    try {
      await checkGate(client, names);
    } catch (error) {
      console.error("Simulated API requests:", fixture.requests.slice(-60));
      console.error("Intercept errors:", client.listenerErrors);
      throw error;
    }
    await checkLinks(client, names);
    await checkReadableGate(client, names, fixture.policies);
    await navigate(client, "/terms");
    await waitFor(client, `document.body.innerText.includes("Simulated terms policy version 101")`,
      "public terms remain readable while consent is outstanding");
    await navigate(client, "/profile");
    await checkGate(client, names);
    const gateBefore = await evalIn(client, "window.__legalBrowser.gate()");
    assert.ok(!/profile settings/i.test(gateBefore), "normal profile children rendered inside gate");
    assert.equal(await evalIn(client,
      `document.querySelectorAll('main input:not([type="checkbox"]), [role="dialog"] input:not([type="checkbox"])').length`),
    0, "normal account fields mounted while acceptance is outstanding");
    await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await evalIn(client, "window.__legalBrowser.outsideClick()");
    await sleep(250);
    assert.ok(await evalIn(client, "!!window.__legalBrowser.gate()"), "Escape/outside click dismissed gate");
    await assertOverflow(client, "desktop");
    await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await assertOverflow(client, "mobile");
    await client.send("Emulation.clearDeviceMetricsOverride");
    for (const key of names.slice(0, 2)) {
      await evalIn(client, `window.__legalBrowser.clickBox(${JSON.stringify(key)})`);
    }
    assert.equal(await evalIn(client, "window.__legalBrowser.continue()"), false,
      "continue should be disabled until all three policies are checked");
    assert.equal(fixture.posts.length, 0, "partial acceptance made a POST");
    await evalIn(client, 'window.__legalBrowser.clickBox("dmca")');
    fixture.failure = "write";
    assert.equal(await evalIn(client, "window.__legalBrowser.continue()"), true);
    await waitFor(client, "document.body.innerText.includes('Simulated consent write failure')", "visible write error");
    assert.ok(await evalIn(client, "!!window.__legalBrowser.gate()"), "failed write unblocked page");
    assert.deepEqual(fixture.posts.at(-1)?.acceptances,
      fixture.policies.map(({ key, versionId }) => ({ key, versionId, accepted: true })),
      "acceptance POST must contain only exact current versions");
    console.log("PASS simulated gate: modal blocking, Escape/outside, all-required, write errors, responsive bounds");

    // A fresh page simulates an already-open account revisiting a deep link.
    fixture.failure = null;
    fixture.outstanding = ["terms"];
    await navigate(client, "/profile");
    await checkGate(client, ["terms"]);
    const changedBoxes = await boxState(client);
    assert.ok(!namedBoxes(changedBoxes)[1] && !namedBoxes(changedBoxes)[2],
      `unchanged policies must not have checkboxes: ${JSON.stringify(changedBoxes)}`);
    await evalIn(client, 'window.__legalBrowser.clickBox("terms")');
    fixture.failure = "stale";
    await evalIn(client, "window.__legalBrowser.continue()");
    await waitFor(client, "document.body.innerText.includes('201') || document.body.innerText.includes('changed')",
      "stale-version review notice");
    assert.ok(await evalIn(client, "!!window.__legalBrowser.gate()"), "stale write unblocked page");
    await assertUnselected(client, ["terms"]);
    await waitFor(client, "window.__legalBrowser.gate().includes('Version 201')",
      "updated policy must appear for re-review without a page reload");
    // Refresh must also leave the replacement version unchecked.
    await navigate(client, "/profile");
    await checkGate(client, ["terms"]);
    assert.equal(fixture.posts.at(-1)?.acceptances?.[0]?.versionId, 101, "stale request did not use original version");
    fixture.failure = "read";
    await navigate(client, "/profile");
    await waitFor(client, `document.body.innerText.includes("Normal site access stays paused")`,
      "read failure must block normal site");
    assert.ok(!await evalIn(client, "!!window.__legalBrowser.gate()"), "read failure should show an error rather than stale data");
    fixture.failure = null;
    await evalIn(client, `([...document.querySelectorAll("button")].find(el =>
      /try again/i.test(el.textContent)) ?? (() => { throw Error("Missing retry control"); })()).click()`);
    await checkGate(client, ["terms"]);
    assert.match(await evalIn(client, "window.__legalBrowser.gate()"), /Version 201/);
    await evalIn(client, 'window.__legalBrowser.clickBox("terms")');
    await evalIn(client, "window.__legalBrowser.continue()");
    await waitFor(client, "!window.__legalBrowser.gate()", "successful consent resumes intended page");
    assert.deepEqual(fixture.posts.at(-1)?.acceptances,
      [{ key: "terms", versionId: 201, accepted: true }], "successful retry accepted only the changed version");
    console.log("PASS simulated changed-only prompt and stale version re-review");
    await verifyStatutoryDiscovery(client, fixture);
    assert.deepEqual(client.listenerErrors, [], "CDP interception errors");
  } finally {
    client?.close();
    const exited = new Promise((resolve) => chromium.once("exit", resolve));
    chromium.kill("SIGTERM");
    await Promise.race([exited, sleep(3000)]);
    if (chromium.exitCode === null) chromium.kill("SIGKILL");
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });