import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  installUnreadInvalidation, isMessageWrite, parseUnreadCounts,
  unreadPollingInterval, unreadQueryKey,
} from "../lib/message-unread";

test("unread keys are account-scoped and polling stops when hidden, logged out or unauthorized", () => {
  assert.notDeepEqual(unreadQueryKey(1), unreadQueryKey(2));
  assert.notDeepEqual(unreadQueryKey(1), unreadQueryKey(null));
  assert.equal(unreadPollingInterval(1, true, false), 5000);
  assert.equal(unreadPollingInterval(null, true, false), false);
  assert.equal(unreadPollingInterval(1, false, false), false);
  assert.equal(unreadPollingInterval(1, true, true), false);
});

test("unread response validation rejects invalid counts instead of silently displaying zero", () => {
  assert.deepEqual(parseUnreadCounts({ count: 2, messageCount: 3 }), { count: 2, messageCount: 3 });
  for (const invalid of [null, [], {}, { count: "2", messageCount: 3 }, { count: -1, messageCount: 0 }, { count: 2, messageCount: 1 }]) {
    assert.throws(() => parseUnreadCounts(invalid));
  }
});

test("write classification covers every legacy mutation and excludes reads/foreign origins", () => {
  const origin = "https://barefoot.test";
  for (const [url, method] of [
    ["/api/messages/1/read", "POST"], ["/api/messages/1/read-thread", "POST"],
    ["/api/messages/mark-all-read", "POST"], ["/api/messages/1/archive", "PATCH"],
    ["/api/messages/1", "DELETE"], ["/api/messages/bulk-delete", "POST"],
    ["/api/messages", "POST"], ["/api/messages/1/reply", "POST"],
    ["/api/chat/messages", "POST"],
  ]) assert.equal(isMessageWrite(url, method, origin), true, url);
  assert.equal(isMessageWrite("/api/messages", "GET", origin), false);
  assert.equal(isMessageWrite("https://foreign.test/api/messages", "POST", origin), false);
  assert.equal(isMessageWrite("/api/admin/users", "POST", origin), false);
});

test("successful raw fetch writes immediately invalidate unread queries; failures and reads do not", async () => {
  const originalWindow = globalThis.window;
  let status = 200;
  const originalFetch = async () => new Response("{}", { status });
  globalThis.window = { fetch: originalFetch, location: { origin: "https://barefoot.test" } } as unknown as Window & typeof globalThis;
  const client = new QueryClient();
  const key = unreadQueryKey(1);
  client.setQueryData(key, { count: 1, messageCount: 2 });
  const cleanup = installUnreadInvalidation(client);
  try {
    await window.fetch("/api/messages/1/read", { method: "POST" });
    assert.equal(client.getQueryState(key)?.isInvalidated, true);
    client.setQueryData(key, { count: 1, messageCount: 2 });
    status = 500;
    await window.fetch("/api/messages/1", { method: "DELETE" });
    assert.equal(client.getQueryState(key)?.isInvalidated, false);
    status = 200;
    await window.fetch("/api/messages");
    assert.equal(client.getQueryState(key)?.isInvalidated, false);
  } finally {
    cleanup();
    assert.equal(window.fetch, originalFetch);
    globalThis.window = originalWindow;
    client.clear();
  }
});