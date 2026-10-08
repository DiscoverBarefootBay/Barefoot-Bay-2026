import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { createSocialClubLinkHandler } from "../social-club-link";

const canonical = { id: 447, slug: "social-golf-cart-club", title: "Golf Cart Club", visibilityStatus: "published", isHidden: false };
const legacy = { id: 397, slug: "social-page", title: "Golf Cart Club", visibilityStatus: "published", isHidden: false };

async function withPages(rows: typeof canonical[], check: (base: string) => Promise<void>) {
  const app = express();
  app.get("/api/pages/:slug", createSocialClubLinkHandler(async () => rows), (req, res) => {
    const page = rows.find(p => p.slug === req.params.slug);
    page ? res.json(page) : res.status(404).json({ message: "Page not found" });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try { await check(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

test("confirmed legacy detail redirects to canonical with uncached, same-origin URL", async () => {
  await withPages([canonical, legacy], async base => {
    const response = await fetch(`${base}/api/pages/social-page`, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "/api/pages/social-golf-cart-club");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });
});

for (const hidden of [false, true]) {
  test(`unrelated generic detail stays intact with canonical hidden=${hidden}`, async () => {
    const other = { ...legacy, id: 407, title: "Little Theater" };
    await withPages([{ ...canonical, isHidden: hidden }, other], async base => {
      const response = await fetch(`${base}/api/pages/social-page`, { redirect: "manual" });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("location"), null);
      assert.equal((await response.json()).id, 407);
    });
  });
}

test("absent generic record does not create an unconfirmed redirect", async () => {
  await withPages([canonical], async base => {
    const response = await fetch(`${base}/api/pages/social-page`, { redirect: "manual" });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("location"), null);
  });
});

test("canonical rename retains the original public address", async () => {
  await withPages([{ ...canonical, slug: "social-cart-riders" }, legacy], async base => {
    const response = await fetch(`${base}/api/pages/social-golf-cart-club`, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "/api/pages/social-cart-riders");
  });
});

for (const rows of [[{ ...canonical, isHidden: true }, legacy], [canonical, { ...legacy, visibilityStatus: "dmca_hidden" }], [legacy]]) {
  test(`legacy link cannot bypass canonical/source removal: ${JSON.stringify(rows.map(p => p.id))}`, async () => {
    await withPages(rows, async base => {
      const response = await fetch(`${base}/api/pages/social-page`, { redirect: "manual" });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("location"), null);
      assert.equal((await response.json()).removed, true);
    });
  });
}
