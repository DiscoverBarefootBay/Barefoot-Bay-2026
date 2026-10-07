import assert from "node:assert/strict";
import { test } from "node:test";
import { requestVendorDirectory } from "../lib/vendor-directory-request";

test("directory deadline covers headers and body; query cancellation is preserved", async () => {
  const original = globalThis.fetch;
  const keepAlive = setInterval(() => {}, 1000);
  try {
    for (const bodyStalls of [false, true]) {
      globalThis.fetch = (async (_url, { signal }: any) => {
        const stalled = () => new Promise((_resolve, reject) => {
          if (signal.aborted) { reject(signal.reason); return; }
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
        return bodyStalls ? { ok: true, json: stalled } : stalled();
      }) as typeof fetch;
      await assert.rejects(requestVendorDirectory("/api/vendors/directory", undefined, 20), /took too long/);
    }
    const controller = new AbortController();
    const request = requestVendorDirectory("/api/vendors/directory", controller.signal, 500);
    controller.abort(new Error("Account changed"));
    await assert.rejects(request, /Account changed/);
    globalThis.fetch = (async () => new Response("{}", { status: 401 })) as typeof fetch;
    await assert.rejects(requestVendorDirectory("/api/vendors/directory"), /sign in/);
    globalThis.fetch = (async () => Response.json({ vendors: [], categories: [] })) as typeof fetch;
    assert.deepEqual(await requestVendorDirectory("/api/vendors/directory"), { vendors: [], categories: [] });
  } finally {
    clearInterval(keepAlive);
    globalThis.fetch = original;
  }
});
