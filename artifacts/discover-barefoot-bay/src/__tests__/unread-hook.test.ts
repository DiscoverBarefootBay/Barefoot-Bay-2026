import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUnreadMessages } from "../hooks/use-unread-messages";
import { unreadQueryKey } from "../lib/message-unread";

test("real unread hook disables hidden/logout requests and isolates account switches and late responses", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://barefoot.test" });
  const prior = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  let visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  let requests = 0;
  let firstSignal: AbortSignal | undefined;
  let resolveFirst!: (response: Response) => void;
  globalThis.fetch = async (_input, init) => {
    requests++;
    if (requests === 1) {
      firstSignal = init?.signal as AbortSignal;
      return new Promise<Response>(resolve => { resolveFirst = resolve; });
    }
    return new Response(JSON.stringify({ count: 2, messageCount: 4 }), { status: 200 });
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(document.getElementById("root")!);
  function Badge({ userId }: { userId: number | null }) {
    const { data } = useUnreadMessages(userId);
    return React.createElement("span", null, data ? `${data.count}/${data.messageCount}` : "unknown");
  }
  const render = async (userId: number | null) => {
    await act(async () => {
      root.render(React.createElement(QueryClientProvider, { client }, React.createElement(Badge, { userId })));
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  };
  try {
    await render(1);
    assert.equal(requests, 1);
    await render(2);
    assert.equal(firstSignal?.aborted, true, "old user's request is canceled");
    assert.equal(document.body.textContent, "2/4");
    await act(async () => {
      resolveFirst(new Response(JSON.stringify({ count: 99, messageCount: 99 })));
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    assert.equal(document.body.textContent, "2/4", "late old-user responses cannot replace the current badge");
    assert.equal(client.getQueryData(unreadQueryKey(1)), undefined, "unobserved account data is discarded");

    await act(async () => {
      visibility = "hidden";
      document.dispatchEvent(new dom.window.Event("visibilitychange"));
    });
    assert.equal(client.getQueryCache().find({ queryKey: unreadQueryKey(2) })?.isActive(), false);
    const beforeHidden = requests;
    await act(async () => { await client.invalidateQueries({ queryKey: unreadQueryKey(2) }); });
    assert.equal(requests, beforeHidden, "mutations in a hidden tab do not trigger network polling");

    await act(async () => {
      visibility = "visible";
      document.dispatchEvent(new dom.window.Event("visibilitychange"));
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    assert.ok(requests > beforeHidden, "becoming visible revalidates");
    await render(null);
    assert.equal(document.body.textContent, "unknown", "logout immediately hides the prior user's badge");
    const beforeLogout = requests;
    await act(async () => { await client.invalidateQueries({ queryKey: [unreadQueryKey(2)[0]] }); });
    assert.equal(requests, beforeLogout);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    dom.window.close();
    Object.assign(globalThis, prior);
  }
});