import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

test("account checks stay visually silent, accessible, and never impose a minimum loading time", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".legal-check-status-"));
  const output = path.join(directory, "status.mjs");
  const dom = new JSDOM("<div id='root'></div>", { url: "https://barefoot.test/" });
  const prior = {
    window: globalThis.window,
    document: globalThis.document,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as any).IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.getElementById("root")!);
  try {
    await build({
      entryPoints: ["src/components/legal/legal-check-status.tsx"],
      outfile: output,
      bundle: true,
      format: "esm",
      platform: "node",
      packages: "external",
      jsx: "automatic",
      define: { "import.meta.env.BASE_URL": JSON.stringify("/brand-prefix/") },
    });
    const { LegalCheckStatus, LegalCheckShell } = await import(pathToFileURL(output).href);
    const mark = () => document.querySelector('[data-testid="branded-loading-mark"]');
    const location = memoryLocation({ path: "/" });
    const render = async (child: React.ReactNode) => act(async () => {
      root.render(React.createElement(Router, { hook: location.hook }, child));
    });

    await render(React.createElement(LegalCheckShell, null, React.createElement(LegalCheckStatus)));
    const initial = document.querySelector('[data-testid="legal-gate-initial-check"]')!;
    assert.equal(initial.getAttribute("role"), "status");
    assert.equal(initial.getAttribute("aria-live"), "polite");
    assert.match(initial.textContent ?? "", /Loading/i, "neutral assistive status is available immediately");
    assert.doesNotMatch(document.body.textContent ?? "", /checking your account|account loading/i);
    assert.equal(mark(), null, "quick checks do not flash an animation");
    assert.equal(document.querySelector("header"), null, "the pending content does not introduce a replacement header");
    assert.equal(document.querySelectorAll("img").length, 0, "the shared navigation owns the single site logo");
    assert.equal(document.querySelectorAll("a").length, 0, "legal links no longer masquerade as site navigation");

    await act(async () => wait(210));
    assert.equal(mark(), null, "even a slow initial check has no visual animation");
    assert.equal(initial.querySelector("svg"), null, "no replacement graphic is introduced");
    assert.equal(initial.querySelectorAll("img").length, 0, "the pending indicator does not duplicate the full logo");
    assert.equal(initial.textContent?.trim(), "Loading", "there is no visible loading sentence");
    assert.equal(initial.querySelector(".animate-spin"), null, "generic spinning feedback is gone");

    await render(null);
    await render(React.createElement(LegalCheckStatus, { overlay: true }));
    const overlay = document.querySelector('[data-testid="legal-gate-verifying"]')!;
    assert.equal(overlay.getAttribute("role"), "status");
    assert.ok(overlay.classList.contains("fixed"));
    assert.ok(overlay.classList.contains("inset-0"), "the transparent interaction blocker is retained");
    assert.equal(mark(), null);
    await render(React.createElement("main", { "data-testid": "ready" }, "Ready"));
    assert.ok(document.querySelector('[data-testid="ready"]'), "fast completion is displayed without a minimum delay");
    await act(async () => wait(210));
    assert.equal(mark(), null, "unmounted feedback never appears after its former timer");
    assert.equal(document.querySelector('[data-testid="legal-gate-verifying"]'), null);

    await render(React.createElement(LegalCheckStatus, { overlay: true }));
    await act(async () => wait(210));
    assert.equal(mark(), null, "slow routine checks remain visually silent");
    assert.equal(document.querySelector('[data-testid="legal-gate-verifying"] svg'), null);
    assert.equal(document.querySelector('[data-testid="legal-check-shell"]'), null, "routine checks do not create a separate loading page");
    assert.doesNotMatch(document.body.textContent ?? "", /checking your account|account loading/i);
    await render(React.createElement("main", { "data-testid": "ready" }, "Ready"));
    assert.equal(document.querySelector('[data-testid="legal-gate-verifying"]'), null, "completion immediately removes the transparent blocker");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis, prior);
    await rm(directory, { recursive: true, force: true });
  }
});