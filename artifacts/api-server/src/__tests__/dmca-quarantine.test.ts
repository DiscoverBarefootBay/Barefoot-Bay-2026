import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  __setQuarantineTestHooks,
  candidateObjectKeys,
  createEvidenceLink,
  isQuarantinedFileName,
  quarantineGateMiddleware,
  quarantineKeyFor,
  refreshQuarantineRegistry,
  reverseMoves,
  verifyEvidenceSignature,
} from "../dmca/quarantine";

afterEach(() => {
  __setQuarantineTestHooks({ adapter: null, localRoot: null });
});

describe("DMCA quarantine key handling", () => {
  it("maps legacy and direct proxy URLs to safe candidate object keys", () => {
    assert.deepEqual(
      candidateObjectKeys("/api/storage-proxy/direct-forum/topic/photo.jpg?x=1").slice(0, 1),
      ["forum/topic/photo.jpg"],
    );
    const keys = candidateObjectKeys("https://object-storage.replit.app/BUCKET/forum/item.png");
    assert.ok(keys.includes("forum/item.png"));
    assert.ok(keys.every((key) => !key.includes("../")));
  });

  it("creates a case-scoped quarantine key and rejects unsafe case numbers", () => {
    assert.equal(
      quarantineKeyFor("BB-DMCA-2026-000142", "/forum/item.jpg"),
      "dmca-quarantine/BB-DMCA-2026-000142/forum/item.jpg",
    );
    assert.throws(() => quarantineKeyFor("../bad", "item.jpg"));
  });

  it("refreshes the in-process registry from an injected executor", async () => {
    const executor: any = {
      execute: async () => ({ rows: [{ file_basename: "Held-Photo.JPG" }] }),
    };
    await refreshQuarantineRegistry(executor);
    assert.equal(isQuarantinedFileName("held-photo.jpg"), true);
    assert.equal(isQuarantinedFileName("other.jpg"), false);
  });

  it("always gates direct access to the private quarantine prefix", async () => {
    const middleware = quarantineGateMiddleware();
    const req: any = { method: "GET", path: "/media/dmca-quarantine/case/private.jpg" };
    const state: any = { code: 200, body: null };
    const res: any = {
      status(code: number) { state.code = code; return this; },
      send(body: unknown) { state.body = body; return this; },
    };
    let next = false;
    await middleware(req, res, () => { next = true; });
    assert.equal(next, false);
    assert.equal(state.code, 404);
  });

  it("reverseMoves compensates completed object moves in reverse order", async () => {
    const objects = new Map<string, Buffer>([
      ["dmca-quarantine/CASE/two.jpg", Buffer.from("two")],
      ["dmca-quarantine/CASE/one.jpg", Buffer.from("one")],
    ]);
    __setQuarantineTestHooks({
      adapter: {
        async get(key) { return objects.get(key) ?? null; },
        async put(key, data) { objects.set(key, Buffer.from(data)); },
        async del(key) { objects.delete(key); },
      },
    });
    await reverseMoves([
      { location: "object_storage", fromKey: "one.jpg", toKey: "dmca-quarantine/CASE/one.jpg" },
      { location: "object_storage", fromKey: "two.jpg", toKey: "dmca-quarantine/CASE/two.jpg" },
    ]);
    assert.equal(objects.get("one.jpg")?.toString(), "one");
    assert.equal(objects.get("two.jpg")?.toString(), "two");
    assert.equal(objects.has("dmca-quarantine/CASE/one.jpg"), false);
    assert.equal(objects.has("dmca-quarantine/CASE/two.jpg"), false);
  });
});

describe("signed DMCA evidence links", () => {
  it("accepts an unexpired signature and binds it to the admin", () => {
    const now = Date.UTC(2026, 0, 1);
    const link = createEvidenceLink(42, 7, 600, now);
    const url = new URL(link.path, "https://example.test");
    const exp = Number(url.searchParams.get("exp"));
    const sig = String(url.searchParams.get("sig"));
    assert.equal(verifyEvidenceSignature(42, 7, exp, sig, now), "ok");
    assert.equal(verifyEvidenceSignature(42, 8, exp, sig, now), "invalid");
    assert.equal(verifyEvidenceSignature(43, 7, exp, sig, now), "invalid");
    assert.equal(verifyEvidenceSignature(42, 7, exp, `${sig.slice(0, -1)}0`, now), "invalid");
    assert.equal(verifyEvidenceSignature(42, 7, exp, sig, (exp + 1) * 1000), "expired");
  });

  it("clamps evidence TTL to the allowed 5–15 minute range", () => {
    assert.equal(createEvidenceLink(1, 2, 1).ttlSeconds, 300);
    assert.equal(createEvidenceLink(1, 2, 99999).ttlSeconds, 900);
  });
});