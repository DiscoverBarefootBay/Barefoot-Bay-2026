import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mkdtemp, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

test("real feature hook waits for settings despite global empty placeholders", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://test.invalid" });
  const previous = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage,
    fetch: globalThis.fetch, IS_REACT_ACT_ENVIRONMENT: (globalThis as any).IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
  let resolve!: (response: Response) => void;
  globalThis.fetch = (async () => new Promise<Response>(r => resolve = r)) as typeof fetch;
  const directory = await mkdtemp(path.join(process.cwd(), ".flag-test-"));
  const client = new QueryClient({ defaultOptions: { queries: { placeholderData: [], retry: false } } });
  const root = createRoot(document.getElementById("root")!);
  try {
    const outfile = path.join(directory, "hook.mjs");
    await build({
      entryPoints: ["src/hooks/use-flags.tsx"], outfile, bundle: true, format: "esm", platform: "node",
      packages: "external", plugins: [{
        name: "test-guest-auth",
        setup(b) {
          b.onResolve({ filter: /^@\/hooks\/use-auth$/ }, () => ({ path: "guest", namespace: "fixture" }));
          b.onResolve({ filter: /^@shared\/schema$/ }, () => ({ path: "schema", namespace: "fixture" }));
          b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
            contents: args.path === "guest" ? 'export const useAuth=()=>({user:null,effectiveRole:"guest"});'
              : 'export const FeatureFlagName={};', loader: "js",
          }));
        },
      }],
    });
    const { useFlags } = await import(pathToFileURL(outfile).href);
    function View() {
      const flags = useFlags();
      return React.createElement("p", null, flags.isLoading ? "checking" : flags.isFeatureEnabled("vendors") ? "allowed" : "denied");
    }
    await act(async () => root.render(React.createElement(QueryClientProvider, { client }, React.createElement(View))));
    assert.equal(document.body.textContent, "checking", "no premature guest denial before authoritative settings");
    await act(async () => {
      resolve(Response.json([{ name: "nav-vendors", isActive: true, enabledForRoles: ["guest"] }]));
      await new Promise(r => setTimeout(r, 25));
    });
    assert.equal(document.body.textContent, "allowed");
    await act(async () => {
      client.setQueryData(["/api/feature-flags"], [{ name: "nav-vendors", isActive: false, enabledForRoles: ["guest"] }]);
      await new Promise(r => setTimeout(r, 25));
    });
    assert.equal(document.body.textContent, "denied");
  } finally {
    await act(async () => root.unmount());
    client.clear(); dom.window.close(); Object.assign(globalThis, previous);
    await rm(directory, { recursive: true, force: true });
  }
});
