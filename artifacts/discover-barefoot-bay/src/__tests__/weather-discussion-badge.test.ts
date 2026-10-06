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

test("weather discussion and actual header widget share unread counts and preserve badge/link interactions", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://barefoot.test/weather" });
  const previous = {
    window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch,
    HTMLElement: globalThis.HTMLElement, navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    actEnvironment: (globalThis as any).IS_REACT_ACT_ENVIRONMENT,
  };
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  let serverCount = 3;
  let markStatus = 200;
  const requests: { url: string; method: string }[] = [];
  const weather = { main: { temp: 80, humidity: 88 }, wind: { speed: 6 }, weather: [{ main: "Clouds", description: "overcast clouds" }] };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? "GET" });
    if (url.endsWith("/mark-all-read")) {
      assert.equal(init?.credentials, "include");
      if (markStatus === 200) serverCount = 0;
      return new Response("{}", { status: markStatus });
    }
    const body = url.endsWith("/unread-count") ? { unreadCount: serverCount }
      : url.includes("/forecast") ? { list: [{ ...weather, dt: 1791321913 }] } : weather;
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  };
  const key = ["/api/forum/categories/4/unread-count"];
  const client = new QueryClient({ defaultOptions: { queries: {
    retry: false, gcTime: Infinity,
    queryFn: async ({ queryKey }) => (await fetch(String(queryKey[0]))).json(),
  } } });
  const directory = await mkdtemp(path.join(process.cwd(), ".weather-badge-test-"));
  let root: Root | undefined;
  try {
    const outfile = path.join(directory, "harness.mjs");
    await build({
      stdin: {
        contents: `
          export { default as WeatherPage } from "@/pages/weather";
          export { WeatherWidget } from "@/components/shared/weather-widget";
          export { setTestUser } from "@/hooks/use-auth";
          export { Router } from "wouter";
          export { memoryLocation } from "wouter/memory-location";
        `,
        resolveDir: process.cwd(), sourcefile: "weather-badge-harness.tsx", loader: "tsx",
      },
      outfile, bundle: true, format: "esm", platform: "node", packages: "external", jsx: "automatic",
      plugins: [{
        name: "test-auth-and-permission-boundaries",
        setup(api) {
          api.onResolve({ filter: /^@\/hooks\/use-auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
          api.onResolve({ filter: /^@\/hooks\/use-permissions$/ }, () => ({ path: "permissions", namespace: "fixture" }));
          api.onResolve({ filter: /^@\/contexts\/navigation-tooltip-context$/ }, () => ({ path: "tooltip", namespace: "fixture" }));
          api.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
            contents: args.path === "auth"
              ? "let user = { id: 1 }; export const setTestUser = value => user = value; export const useAuth = () => ({ user });"
              : args.path === "permissions"
                ? "export const usePermissions = () => ({ canSeeWeatherRocketIcons: true });"
                : "export const useNavigationTooltip = () => ({ activeTooltip: null, toggleTooltip: () => {} });",
            loader: "js",
          }));
          api.onResolve({ filter: /^@\// }, args => {
            const base = path.resolve(process.cwd(), "src", args.path.slice(2));
            return { path: [base, `${base}.tsx`, `${base}.ts`].find(existsSync) ?? base };
          });
        },
      }],
    });
    const { WeatherPage, WeatherWidget, setTestUser, Router, memoryLocation } = await import(pathToFileURL(outfile).href);
    const location = memoryLocation({ path: "/weather", record: true });
    root = createRoot(document.getElementById("root")!);
    const render = () => root!.render(
      React.createElement(QueryClientProvider, { client },
        React.createElement(Router, { hook: location.hook },
          React.createElement("header", null, React.createElement(WeatherWidget)),
          React.createElement(WeatherPage))),
    );
    const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    const button = () => document.querySelector('[data-testid="weather-discussion-button"]') as HTMLElement;
    const badges = () => Array.from(document.querySelectorAll('[title*="mark all weather updates as read"], [title="Mark all weather updates as read"]')) as HTMLElement[];
    const click = (el: HTMLElement) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true })); });
    const setCount = async (count: number) => {
      serverCount = count;
      await act(async () => { client.setQueryData(key, { unreadCount: count }); });
      await settle();
    };
    await act(async () => render());
    for (let i = 0; i < 30 && (!button() || badges().length !== 2); i++) await settle();
    assert.ok(button(), "the real Weather page renders the discussion button");
    assert.ok(button().classList.contains("relative"), "the badge has a button-local positioning boundary");
    assert.equal(button().parentElement?.getAttribute("href"), "/forum?categoryId=4");
    assert.deepEqual(badges().map(badge => badge.textContent), ["3", "3"]);
    assert.ok(button().contains(badges()[1]), "the second badge belongs to the discussion button");
    assert.equal(requests.filter(request => request.url.endsWith("/unread-count")).length, 1, "both observers share one query");
    assert.equal(requests.filter(request => request.method === "POST").length, 0, "mounting never marks discussions read");
    await setCount(120);
    assert.deepEqual(badges().map(badge => badge.textContent), ["99+", "99+"]);
    await setCount(0);
    assert.equal(badges().length, 0);
    await setCount(5);
    assert.deepEqual(badges().map(badge => badge.textContent), ["5", "5"]);

    await click(badges()[1]);
    assert.ok(badges()[1].querySelector("svg"), "desktop badge click reveals the existing X control");
    assert.equal(location.history.at(-1), "/weather", "badge click does not follow the discussion link");
    assert.equal(requests.filter(request => request.method === "POST").length, 0);
    await click(badges()[1]);
    await settle();
    assert.equal(badges().length, 0, "successful mark-read updates both indicators");
    assert.equal(location.history.at(-1), "/weather");

    await setCount(7);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    await act(async () => window.dispatchEvent(new dom.window.Event("resize")));
    await click(badges()[1]);
    await settle();
    assert.equal(badges().length, 0, "mobile badge click immediately marks both indicators read");
    assert.equal(location.history.at(-1), "/weather");

    await setCount(4);
    markStatus = 500;
    await click(badges()[1]);
    await settle();
    assert.deepEqual(badges().map(badge => badge.textContent), ["4", "4"], "failed mark-read restores both counts from the shared query");
    await act(async () => { setTestUser(null); render(); });
    assert.equal(badges().length, 0, "guests do not see cached unread counts");
    await click(button());
    assert.equal(location.history.at(-1), "/forum?categoryId=4", "ordinary discussion-button clicks still navigate");
    assert.equal(requests.filter(request => request.method === "POST").length, 3, "only badge actions mark discussions read");
  } finally {
    if (root) await act(async () => root!.unmount());
    client.clear();
    await rm(directory, { recursive: true, force: true });
    Object.assign(globalThis, { window: previous.window, document: previous.document, fetch: previous.fetch, HTMLElement: previous.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: previous.actEnvironment });
    if (previous.navigator) Object.defineProperty(globalThis, "navigator", previous.navigator);
    dom.window.close();
  }
});
