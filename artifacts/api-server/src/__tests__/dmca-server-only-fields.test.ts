import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  installServerOnlyFieldStripping,
  stripKeys,
  stripServerOnlyBodyFieldsMiddleware,
} from "../dmca/server-only-fields";

describe("DMCA server-only field stripping", () => {
  it("stripKeys is shallow, immutable when changed, and preserves non-objects", () => {
    const input = { title: "ok", legalHold: true, nested: { legalHold: true } };
    const result = stripKeys(input, new Set(["legalHold"]));
    assert.deepEqual(result, { title: "ok", nested: { legalHold: true } });
    assert.notEqual(result, input);
    assert.equal(stripKeys("value", new Set(["x"])), "value");
  });

  it("body middleware strips DMCA fields but deliberately retains deletedAt", () => {
    const req: any = {
      path: "/api/forum/posts",
      body: {
        title: "safe",
        visibilityStatus: "dmca_hidden",
        visibility_status: "dmca_hidden",
        legalHold: true,
        dmcaCaseId: 9,
        hiddenReason: "client supplied",
        deletedAt: "2026-01-01",
      },
    };
    let next = false;
    stripServerOnlyBodyFieldsMiddleware()(req, {} as any, () => { next = true; });
    assert.equal(next, true);
    assert.deepEqual(req.body, { title: "safe", deletedAt: "2026-01-01" });
  });

  it("does not strip the trusted DMCA API namespace", () => {
    const req: any = { path: "/api/dmca/cases", body: { legalHold: true } };
    stripServerOnlyBodyFieldsMiddleware()(req, {} as any, () => {});
    assert.deepEqual(req.body, { legalHold: true });
  });

  it("wraps storage writes and strips the complete server-only set", async () => {
    let received: any;
    const storage = {
      async createForumPost(value: any) {
        received = value;
        return value;
      },
    };
    const installed = installServerOnlyFieldStripping(storage);
    assert.equal(installed, storage);
    const result = await storage.createForumPost({
      title: "safe",
      visibilityStatus: "published",
      legalHold: true,
      dmcaCaseId: 2,
      deletedAt: new Date(),
    });
    assert.deepEqual(result, { title: "safe" });
    assert.deepEqual(received, { title: "safe" });
    assert.equal(installServerOnlyFieldStripping(storage), storage);
  });
});