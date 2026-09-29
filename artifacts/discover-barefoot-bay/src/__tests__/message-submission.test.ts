import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { submitMessageForm, createMessageSubmitter } from "../components/chat/message-submission";

const originalFetch = globalThis.fetch;
const values = new Map<string, string>();
let calls: RequestInit[];
beforeEach(() => {
  values.clear(); calls = [];
  const heldLocks = new Set<string>();
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    locks: { request: async (name: string, options: { ifAvailable: boolean }, callback: (lock: object | null) => Promise<any>) => {
      assert.equal(options.ifAvailable, true);
      if (heldLocks.has(name)) return callback(null);
      heldLocks.add(name);
      try { return await callback({ name }); }
      finally { heldLocks.delete(name); }
    }},
  }});
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }});
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent: () => true } });
});
afterEach(() => { globalThis.fetch = originalFetch; });
function form() {
  const data = new FormData();
  data.append("content", "Intentional\n\nparagraph");
  data.append("sendEmail", "true");
  return data;
}

test("lost response and revisit retry retain the exact idempotency key", async () => {
  globalThis.fetch = async (_url, init) => {
    calls.push(init!);
    throw new Error("connection lost");
  };
  await assert.rejects(submitMessageForm("/api/messages", form(), 44), /connection lost/);
  assert.equal(values.size, 1);
  globalThis.fetch = async (_url, init) => {
    calls.push(init!);
    return new Response(JSON.stringify({ message: { id: 8 } }), { status: 201 });
  };
  const result = await submitMessageForm("/api/messages", form(), 44);
  assert.equal(result.message.id, 8);
  assert.deepEqual(calls[0].headers, calls[1].headers);
  assert.equal(values.size, 0);
});

test("uncertain server response remains retryable only with same key and surfaces its error", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Submission interrupted; check progress" }), { status: 409 });
  await assert.rejects(submitMessageForm("/api/messages", form(), 44), /Submission interrupted/);
  assert.equal(values.size, 1);
});

test("simultaneous repeated clicks create only one HTTP request", async () => {
  let release!: (value: Response) => void;
  globalThis.fetch = async (_url, init) => {
    calls.push(init!);
    return new Promise(resolve => { release = resolve; });
  };
  const first = submitMessageForm("/api/messages", form(), 44);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(submitMessageForm("/api/messages", form(), 44), /already being submitted/);
  release(new Response(JSON.stringify({ message: { id: 3 } })));
  await first;
  assert.equal(calls.length, 1);
});

test("independent tabs sharing storage cannot allocate distinct submission keys", async () => {
  const tabA = createMessageSubmitter();
  const tabB = createMessageSubmitter();
  let release!: (value: Response) => void;
  globalThis.fetch = async (_url, init) => {
    calls.push(init!);
    return new Promise(resolve => { release = resolve; });
  };
  const first = tabA("/api/messages", form(), 44);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const allocated = [...values.values()];
  await assert.rejects(tabB("/api/messages", form(), 44), /another tab/);
  assert.deepEqual([...values.values()], allocated);
  assert.equal(calls.length, 1);
  release(new Response(JSON.stringify({ message: { id: 3 } })));
  await first;
});

test("missing cross-tab coordination fails closed without storage allocation or HTTP", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  globalThis.fetch = async () => { assert.fail("must not submit"); };
  await assert.rejects(submitMessageForm("/api/messages", form(), 44), /requires a browser with Web Locks/);
  assert.equal(values.size, 0);
});

test("desktop composer is wired to submission-specific loading and in-overlay progress", async () => {
  const chat = await readFile(new URL("../components/chat/Chat.tsx", import.meta.url), "utf8");
  const composer = await readFile(new URL("../components/chat/EnhancedMessageComposer.tsx", import.meta.url), "utf8");
  assert.match(chat, /const \[submitting, setSubmitting\] = useState\(false\)/);
  assert.match(chat, /<EnhancedMessageComposer\s+loading=\{submitting\}/);
  assert.match(chat, /setSubmitting\(true\)/);
  assert.match(chat, /finally\s*\{\s*setSubmitting\(false\)/);
  assert.match(composer, /\{loading && <MessageSendProgress \/>\}/);
  assert.match(composer, /disabled=\{loading\}/);
});