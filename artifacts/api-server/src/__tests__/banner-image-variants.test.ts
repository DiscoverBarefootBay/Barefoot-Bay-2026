import { mock, test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

const filename = "bannerImage-test.png";
const src = `/api/storage-proxy/BANNER/banner-slides/${filename}`;
let page: any;
let downloads = 0;
let failDownload = false;
const original = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#47759a" } }).png().toBuffer();
mock.module("../storage", { namedExports: { storage: {
  getPageContent: async (_slug: string, includeHidden: boolean) => {
    assert.equal(includeHidden, false);
    return page;
  },
} } });
mock.module("../object-storage-service", { namedExports: { objectStorageService: {
  getFile: async (key: string, bucket: string) => {
    assert.equal(key, `banner-slides/${filename}`); assert.equal(bucket, "BANNER");
    downloads++;
    await new Promise(r => setTimeout(r, 20));
    if (failDownload) throw Error("Unavailable");
    return original;
  },
} } });
mock.module("../dmca/content-visibility", { namedExports: {
  isPubliclyVisible: (row: any) => row.visibilityStatus === "published",
} });
mock.module("../lib/logger", { namedExports: { logger: { warn() {} } } });
const { serveBannerImageVariant } = await import("../banner-image-variants");
function reset(id: number) {
  page = { id, updatedAt: "2026-10-06T10:00:00Z", isHidden: false,
    visibilityStatus: "published", content: JSON.stringify([{ src, mediaType: "image" }]) };
  failDownload = false;
}
async function request(query: any = {}, headers: any = {}, name = filename) {
  const state: any = { statusCode: 200, headers: {}, body: undefined, next: false };
  state.setHeader = (key: string, value: unknown) => { state.headers[key] = value; return state; };
  state.type = (value: string) => { state.headers["Content-Type"] = value; return state; };
  state.status = (code: number) => { state.statusCode = code; return state; };
  state.end = () => state;
  state.send = state.json = (body: unknown) => { state.body = body; return state; };
  await serveBannerImageVariant({ params: { filename: [name] }, query, headers } as any, state,
    () => { state.next = true; });
  return state;
}
const query = (width = 480) => ({ width: String(width), v: `${page.id}-${new Date(page.updatedAt).getTime()}` });

test("original requests are untouched; invalid sizes and traversal are rejected", async () => {
  reset(1);
  assert.equal((await request()).next, true);
  assert.equal((await request(query(200))).statusCode, 400);
  assert.equal((await request(query(), {}, "../bad.png")).statusCode, 400);
});
test("responsive WebP preserves aspect ratio and caches/coalesces work without changing originals", async () => {
  reset(2);
  const before = downloads;
  const [a, b] = await Promise.all([request(query()), request(query())]);
  assert.equal(a.statusCode, 200); assert.deepEqual(a.body, b.body);
  assert.equal(downloads - before, 1);
  const meta = await sharp(a.body).metadata();
  assert.equal(meta.format, "webp"); assert.equal(meta.width, 480); assert.equal(meta.height, 320);
  assert.equal((await request(query())).body.length, a.body.length);
  assert.equal(downloads - before, 1);
  const big = await request(query(1920));
  assert.equal((await sharp(big.body).metadata()).width, 1200, "never upscale the original");
});
test("cache and conditional responses always recheck publication and current revision", async () => {
  reset(3);
  const a = await request(query());
  const etag = a.headers.ETag;
  assert.equal((await request(query(), { "if-none-match": etag })).statusCode, 304);
  page.isHidden = true;
  assert.equal((await request(query(), { "if-none-match": etag })).statusCode, 404);
  page.isHidden = false; page.visibilityStatus = "dmca_hidden";
  assert.equal((await request(query())).statusCode, 404);
  page.visibilityStatus = "published";
  assert.equal((await request({ ...query(), v: "old-revision" })).statusCode, 404);
  page.content = "[]";
  assert.equal((await request(query())).statusCode, 404);
});
test("videos are not transformed; missing objects fail explicitly and a subsequent retry can recover", async () => {
  reset(4);
  page.content = JSON.stringify([{ src, mediaType: "video" }]);
  assert.equal((await request(query())).statusCode, 404);
  page.content = JSON.stringify([{ src, mediaType: "image" }]); failDownload = true;
  assert.equal((await request(query())).statusCode, 503);
  failDownload = false;
  assert.equal((await request(query())).statusCode, 200);
});
