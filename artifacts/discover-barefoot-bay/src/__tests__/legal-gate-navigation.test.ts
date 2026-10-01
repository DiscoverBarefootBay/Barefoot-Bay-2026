import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const policies = (termsVersion = 1) => [
  { key: "terms", versionId: termsVersion, title: `Terms v${termsVersion}`, url: "/terms", publishedAt: "2026-01-02T00:00:00Z", contentHtml: "<p>Terms.</p>", changeNotes: null },
  { key: "privacy", versionId: 2, title: "Privacy Policy", url: "/privacy", publishedAt: "2026-01-02T00:00:00Z", contentHtml: "<p>Privacy.</p>", changeNotes: null },
  { key: "dmca", versionId: 3, title: "Copyright / DMCA Policy", url: "/dmca", publishedAt: "2026-01-02T00:00:00Z", contentHtml: "<p>Copyright.</p>", changeNotes: null },
];
const accepted = () => ({ policies: policies(), outstanding: [], requiresAcceptance: false });
const reviewRequired = (version = 1) => ({
  policies: policies(version),
  outstanding: [policies(version)[0]],
  requiresAcceptance: true,
});
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("real legal gate keeps navigation and cached consent behind fresh, accessible checks", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "https://barefoot.test/",
  });
  const prior = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    HTMLElement: globalThis.HTMLElement,
    CustomEvent: globalThis.CustomEvent,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as any).IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    CustomEvent: dom.window.CustomEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const requests: Array<{
    signal: AbortSignal | undefined;
    resolve: (response: Response) => void;
    resolved: boolean;
    method: string;
    body: string | undefined;
  }> = [];
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url === "/api/resource-requiring-policy") return jsonResponse({ message: "Review required" }, 428);
    return new Promise<Response>((resolve) => {
      requests.push({
        signal: init?.signal as AbortSignal | undefined,
        resolve,
        resolved: false,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });
    });
  };
  dom.window.fetch = apiFetch as typeof dom.window.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => dom.window.fetch(input, init)) as typeof fetch;

  const directory = await mkdtemp(path.join(process.cwd(), ".legal-gate-navigation-"));
  const bundlePath = path.join(directory, "gate-harness.mjs");
  let root: Root | undefined;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: Infinity } } });
  try {
    const entry = `
      import React from "react";
      import { Router, useLocation } from "wouter";
      import { memoryLocation } from "wouter/memory-location";
      import { LegalConsentGate } from "./src/components/legal/legal-consent-gate.tsx";
      import { QueryClientProvider } from "@tanstack/react-query";
      import { setTestAuth } from "@/hooks/use-auth";
      export { LegalConsentGate, Router, memoryLocation, QueryClientProvider, setTestAuth };
      export function ProtectedContent() {
        const [location] = useLocation();
        return React.createElement("main", { "data-testid": "protected-content" },
          React.createElement("h1", null, "Private page ", location),
          React.createElement("button", { "data-testid": "protected-control" }, "Private action"));
      }
    `;
    await build({
      stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "legal-gate-harness.tsx", loader: "tsx" },
      outfile: bundlePath,
      bundle: true,
      format: "esm",
      platform: "node",
      packages: "external",
      jsx: "automatic",
      define: { "import.meta.env.BASE_URL": JSON.stringify("/") },
      plugins: [{
        name: "test-only-auth-state",
        setup(buildApi) {
          buildApi.onResolve({ filter: /^@\/hooks\/use-auth$/ }, () => ({ path: "test-auth", namespace: "test-auth" }));
          buildApi.onResolve({ filter: /^@\// }, (args) => ({
            path: (() => {
              const base = path.resolve(process.cwd(), "src", args.path.slice(2));
              return [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`].find(existsSync) ?? base;
            })(),
          }));
          buildApi.onLoad({ filter: /.*/, namespace: "test-auth" }, () => ({
            contents: `
              let currentUser = { id: 1, role: "user" };
              export function setTestAuth(user) { currentUser = user; }
              export function useAuth() {
                return {
                  user: currentUser, isLoading: false,
                  logoutMutation: { isPending: false, mutate: () => { currentUser = null; } }
                };
              }
            `,
            loader: "js",
          }));
        },
      }],
    });
    const harness = await import(pathToFileURL(bundlePath).href);
    const { LegalConsentGate, Router, memoryLocation, QueryClientProvider, setTestAuth, ProtectedContent } = harness;
    const container = document.getElementById("root")!;

    const start = async (pathName = "/") => {
      const location = memoryLocation({ path: pathName, record: true });
      root = createRoot(container);
      const render = () => root!.render(
        React.createElement(QueryClientProvider, { client },
          React.createElement(Router, { hook: location.hook },
            React.createElement(LegalConsentGate, null, React.createElement(ProtectedContent)),
          ),
        ),
      );
      await act(async () => render());
      return { ...location, render };
    };
    const stop = async () => {
      if (root) await act(async () => root!.unmount());
      root = undefined;
    };
    const untilRequestCount = async (count: number) => {
      for (let i = 0; i < 30 && requests.length < count; i++) await act(async () => delay(10));
      assert.ok(requests.length >= count, `expected ${count} consent checks, saw ${requests.length}`);
    };
    const resolveRequest = async (index: number, value: unknown, status = 200) => {
      requests[index].resolved = true;
      await act(async () => {
        requests[index].resolve(jsonResponse(value, status));
        await delay(30);
      });
    };
    const content = () => document.querySelector('[data-testid="protected-content"]') as HTMLElement | null;
    const gateContent = () => document.querySelector('[data-testid="legal-gate-content"]') as HTMLElement | null;
    const hasInitialShell = () => Boolean(document.querySelector('[data-testid="legal-check-shell"]'));
    const resolveUntilAuthorized = async (from: number) => {
      for (let i = 0; i < 6 && !content(); i++) {
        const pending = requests.findIndex((request, index) => index >= from && !request.resolved);
        if (pending < 0) await untilRequestCount(requests.length + 1);
        const next = requests.findIndex((request, index) => index >= from && !request.resolved);
        await resolveRequest(next, accepted());
      }
      assert.ok(content(), "current accepted status eventually authorizes the account");
    };

    // Slow initial check shows only the public shell; a quick response removes
    // the status immediately rather than honoring the 180ms notice as a minimum.
    let location = await start("/");
    await untilRequestCount(1);
    assert.equal(hasInitialShell(), true);
    assert.equal(document.querySelector('[data-testid="legal-gate-initial-check"]')?.getAttribute("role"), "status");
    assert.equal(content(), null, "private children are not mounted before the first server confirmation");
    await resolveUntilAuthorized(0);
    assert.ok(content());
    assert.equal(hasInitialShell(), false, "a fast successful check is not held for the delayed status notice");
    await act(async () => delay(200));
    assert.equal(document.querySelector('[data-testid="legal-gate-initial-check"]'), null, "no delayed status timer survives a successful check");

    // Remount with a cached acceptance must still wait for a fresh request.
    await stop();
    const beforeRemount = requests.length;
    location = await start("/");
    await untilRequestCount(beforeRemount + 1);
    assert.equal(hasInitialShell(), true);
    assert.equal(content(), null, "cached consent on remount is not a fresh authorization");
    await resolveUntilAuthorized(beforeRemount);
    const retained = content()!;
    assert.ok(retained);

    // Navigation/focus/storage bursts make the retained subtree inert
    // synchronously, preserve its DOM identity, and batch the server check.
    const beforeNavigation = requests.length;
    await act(async () => location.navigate("/private/next"));
    assert.equal(content(), retained, "authorized subtree remains mounted during revalidation");
    assert.equal(hasInitialShell(), false, "navigation revalidation does not replace retained content with a skeleton");
    assert.equal(gateContent()?.hasAttribute("inert"), true, "retained subtree is synchronously inert");
    assert.equal(document.querySelector('[data-testid="legal-gate-verifying"]')?.getAttribute("aria-live"), "polite");
    await act(async () => {
      location.navigate("/");
      window.dispatchEvent(new dom.window.Event("focus"));
      document.dispatchEvent(new dom.window.Event("visibilitychange"));
    });
    await untilRequestCount(beforeNavigation + 1);
    await act(async () => delay(30));
    assert.equal(requests.length, beforeNavigation + 1, "rapid navigation and tab-return signals issue one batched check");
    await resolveRequest(beforeNavigation, accepted());
    assert.equal(content(), retained, "fresh acceptance restores the same DOM subtree");
    assert.equal(gateContent()?.hasAttribute("inert"), false);
    assert.equal(document.querySelector('[data-testid="legal-gate-verifying"]'), null, "a completed check removes its status immediately without a minimum spinner duration");

    // Cross-tab storage and a real intercepted 428 both synchronously
    // revalidate; outstanding policies become an accessible prompt.
    const beforeStorage = requests.length;
    await act(async () => window.dispatchEvent(new dom.window.StorageEvent("storage", { key: "bb-legal-consent-sync", newValue: "1" })));
    assert.equal(gateContent()?.hasAttribute("inert"), true);
    await untilRequestCount(beforeStorage + 1);
    await resolveRequest(beforeStorage, reviewRequired());
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement | null;
    assert.ok(dialog);
    assert.ok(dialog?.getAttribute("aria-labelledby"));
    assert.ok(document.querySelector('[data-testid="checkbox-consent-terms"]'));

    const before428 = requests.length;
    await act(async () => { await window.fetch("/api/resource-requiring-policy"); });
    assert.equal(content(), null);
    await untilRequestCount(before428 + 1);
    await resolveRequest(before428, reviewRequired(4));
    assert.match(document.querySelector('[data-testid="consent-policy-terms"]')?.textContent ?? "", /Terms v4/);
    assert.equal(document.querySelector('[data-testid="checkbox-consent-terms"]')?.getAttribute("type"), "checkbox");

    // Errors do not reveal protected content; accessible retry can recover
    // in place. Use a 503 on a fresh recheck to avoid exercising network retry.
    const beforeError = requests.length;
    await act(async () => window.dispatchEvent(new dom.window.StorageEvent("storage", { key: "bb-legal-consent-sync", newValue: "2" })));
    await untilRequestCount(beforeError + 1);
    await resolveRequest(beforeError, { message: "Policy service unavailable" }, 503);
    await untilRequestCount(beforeError + 2);
    await resolveRequest(beforeError + 1, { message: "Policy service unavailable" }, 503);
    assert.equal(document.querySelector('[data-testid="legal-consent-error"]')?.getAttribute("role"), "alert");
    const retry = document.querySelector('[data-testid="button-retry-consent"]') as HTMLButtonElement;
    assert.ok(retry);
    await act(async () => retry.click());
    await resolveUntilAuthorized(beforeError + 1);
    assert.ok(content(), "retry recovers to the authorized page");

    // An A -> B -> A transition must not restore A's cached grant while B's
    // request is pending. A late B result must also never affect A.
    const beforeB = requests.length;
    setTestAuth({ id: 2, role: "staff" });
    await act(async () => location.render());
    await untilRequestCount(beforeB + 1);
    const pendingB = requests[beforeB];
    assert.equal(hasInitialShell(), true, "switching A to B starts in the safe initial shell");
    assert.equal(content(), null);

    const beforeReturnToA = requests.length;
    setTestAuth({ id: 1, role: "user" });
    await act(async () => location.render());
    await untilRequestCount(beforeReturnToA + 1);
    assert.equal(hasInitialShell(), true, "returning to cached A still waits in the safe initial shell");
    assert.equal(content(), null, "A's previously authorized children are not restored from cache");
    assert.equal(pendingB.signal?.aborted, true, "switching back cancels B's in-flight request");
    await resolveUntilAuthorized(beforeReturnToA);
    assert.equal(hasInitialShell(), false, "A's current server response releases the shell");
    assert.ok(content());

    pendingB.resolved = true;
    pendingB.resolve(jsonResponse(reviewRequired(9)));
    await act(async () => delay(15));
    assert.ok(content());
    assert.equal(document.querySelector('[role="dialog"]'), null, "B's late policy result cannot prompt or authorize A");

    // The real consent form posts version 1 while a concurrent fresh GET says
    // version 2 is required. A late successful POST is not current authority:
    // its per-mutation callback must prompt a confirming GET, and only that
    // GET's latest denial may remain in the gate cache.
    const beforePrompt = requests.length;
    await act(async () => window.dispatchEvent(new dom.window.StorageEvent("storage", { key: "bb-legal-consent-sync", newValue: "3" })));
    await untilRequestCount(beforePrompt + 1);
    await resolveRequest(beforePrompt, reviewRequired(1));
    const termsCheckA = document.querySelector('[data-testid="checkbox-consent-terms"]') as HTMLInputElement;
    await act(async () => termsCheckA.click());
    const acceptA = document.querySelector('[data-testid="button-consent-accept"]') as HTMLButtonElement;
    assert.equal(acceptA.disabled, false);
    const beforePostA = requests.length;
    await act(async () => acceptA.click());
    await untilRequestCount(beforePostA + 1);
    const postA = requests.findIndex((request, index) => index >= beforePostA && request.method === "POST");
    assert.ok(postA >= 0, "acceptance uses the real POST endpoint");
    assert.deepEqual(JSON.parse(requests[postA].body ?? "{}").acceptances, [
      { key: "terms", versionId: 1, accepted: true },
    ]);

    const beforeNewerGet = requests.length;
    await act(async () => window.dispatchEvent(new dom.window.StorageEvent("storage", { key: "bb-legal-consent-sync", newValue: "4" })));
    await untilRequestCount(beforeNewerGet + 1);
    await resolveRequest(beforeNewerGet, reviewRequired(2));
    assert.equal((document.querySelector('[data-testid="checkbox-consent-terms"]') as HTMLInputElement).checked, false,
      "a newer publication invalidates the old checked version");

    const beforePostCompletion = requests.length;
    await resolveRequest(postA, accepted());
    await untilRequestCount(beforePostCompletion + 1);
    const confirmingGet = requests.findIndex((request, index) => index >= beforePostCompletion && request.method === "GET");
    assert.ok(confirmingGet >= 0, "a late successful POST triggers a fresh GET rather than granting access");
    assert.equal(content(), null);
    assert.match(document.querySelector('[data-testid="consent-policy-terms"]')?.textContent ?? "", /Terms v2/);
    await resolveRequest(confirmingGet, reviewRequired(2));
    assert.equal(content(), null, "only the confirming latest denial keeps the account blocked");
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.equal(client.getQueryData(["legal", "consent", 1])?.requiresAcceptance, true,
      "the accepted POST response does not overwrite the newer denial in cache");

    // A's second POST stays pending while the gate switches to B. B's cached
    // outstanding status gets a new keyed prompt with no inherited checks;
    // the late A response cannot overwrite or approve B.
    const termsCheckA2 = document.querySelector('[data-testid="checkbox-consent-terms"]') as HTMLInputElement;
    await act(async () => termsCheckA2.click());
    const beforePostA2 = requests.length;
    await act(async () => (document.querySelector('[data-testid="button-consent-accept"]') as HTMLButtonElement).click());
    await untilRequestCount(beforePostA2 + 1);
    const postA2 = requests.findIndex((request, index) => index >= beforePostA2 && request.method === "POST");
    assert.ok(postA2 >= 0);

    // Same exact version: only the account boundary (not policy-version
    // reconciliation) can clear A's checked selection.
    const bStatus = reviewRequired(2);
    client.setQueryData(["legal", "consent", 2], bStatus);
    const beforeBMount = requests.length;
    setTestAuth({ id: 2, role: "staff" });
    await act(async () => location.render());
    assert.equal((document.querySelector('[data-testid="checkbox-consent-terms"]') as HTMLInputElement).checked, false,
      "the new account prompt does not inherit A's selected policy");
    await untilRequestCount(beforeBMount + 1);
    const bGet = requests.findIndex((request, index) => index >= beforeBMount && request.method === "GET");
    assert.ok(bGet >= 0);
    await resolveRequest(bGet, bStatus);
    await resolveRequest(postA2, accepted());
    await act(async () => delay(15));
    assert.equal(client.getQueryData(["legal", "consent", 2])?.requiresAcceptance, true);
    assert.deepEqual(client.getQueryData(["legal", "consent", 2])?.outstanding.map((policy) => policy.versionId), [2]);
    assert.equal((document.querySelector('[data-testid="checkbox-consent-terms"]') as HTMLInputElement).checked, false);
    assert.equal((document.querySelector('[data-testid="button-consent-accept"]') as HTMLButtonElement).disabled, true,
      "A's late accepted POST cannot enable B's acceptance action");
    assert.equal(content(), null);

    // Ordinary acceptance still completes promptly, but only the confirming
    // current-version GET can release protected content.
    await act(async () => (document.querySelector('[data-testid="checkbox-consent-terms"]') as HTMLInputElement).click());
    const beforeBPost = requests.length;
    await act(async () => (document.querySelector('[data-testid="button-consent-accept"]') as HTMLButtonElement).click());
    await untilRequestCount(beforeBPost + 1);
    const bPost = requests.findIndex((request, index) => index >= beforeBPost && request.method === "POST");
    assert.ok(bPost >= 0);
    const currentAccepted = { policies: policies(2), outstanding: [], requiresAcceptance: false };
    const beforeBConfirmation = requests.length;
    await resolveRequest(bPost, currentAccepted);
    assert.equal(content(), null, "a successful POST alone never releases the gate");
    await untilRequestCount(beforeBConfirmation + 1);
    const bConfirmation = requests.findIndex((request, index) => index >= beforeBConfirmation && request.method === "GET");
    assert.ok(bConfirmation >= 0);
    await resolveRequest(bConfirmation, currentAccepted);
    assert.ok(content(), "the fresh accepted GET releases the staff account immediately");
    assert.equal(document.querySelector('[data-testid="legal-gate-verifying"]'), null);

    // Staff accounts retain the same narrow statutory-route exemption.
    client.setQueryData(["legal", "consent", 3], reviewRequired(9));
    setTestAuth({ id: 3, role: "staff" });
    await act(async () => location.navigate("/terms"));
    await act(async () => delay(10));
    assert.ok(content(), "legal reading is exempt while consent is outstanding");
    assert.ok(document.querySelector('[role="status"]')?.textContent?.includes("policies to review"));
    setTestAuth(null);
    await act(async () => location.render());
    assert.ok(content(), "logout returns to public children without retaining the signed-in gate");
  } finally {
    if (root) await act(async () => root!.unmount());
    client.clear();
    await rm(directory, { recursive: true, force: true });
    dom.window.close();
    Object.assign(globalThis, prior);
  }
});