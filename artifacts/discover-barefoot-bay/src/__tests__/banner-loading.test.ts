import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bannerImageSrcSet, bannerQueryKey, parseBannerContent, readBannerSlides } from "../hooks/use-banner-slides";

const slide = { src: "/api/storage-proxy/BANNER/banner-slides/bannerImage-test.png",
  caption: "Community notice", alt: "Notice", link: "/calendar", bgPosition: "30% 60%", mediaType: "image" };
test("metadata preserves captions, links, positions and genuine empty configurations", () => {
  const row = { id: 2, updatedAt: "2026-10-06T10:00:00Z", content: JSON.stringify([slide]) };
  assert.deepEqual(parseBannerContent(row).slides, [slide]);
  assert.equal(parseBannerContent(row).revision, `2-${new Date(row.updatedAt).getTime()}`);
  assert.deepEqual(parseBannerContent({ ...row, content: "[]" }).slides, []);
  assert.equal(parseBannerContent({ ...row, content: JSON.stringify([{ ...slide, link: "https://barefootbay.com/amenities#golf" }]) }).slides[0].link, "/banner#slide1");
  assert.throws(() => parseBannerContent({ ...row, content: "{}" }));
  assert.throws(() => parseBannerContent({ ...row, content: "[null]" }));
});
test("viewer keys isolate admin/private snapshots; derivatives are limited to local raster originals", () => {
  assert.notDeepEqual(bannerQueryKey("2:admin"), bannerQueryKey("anonymous:public"));
  assert.match(bannerImageSrcSet(slide.src, "2-123")!, /width=480&v=2-123 480w/);
  assert.match(bannerImageSrcSet(slide.src, "2-123")!, /width=1920&v=2-123 1920w/);
  assert.equal(bannerImageSrcSet("https://example.com/image.png", "2-123"), undefined);
  assert.equal(bannerImageSrcSet(slide.src.replace(".png", ".mp4"), "2-123"), undefined);
});
test("reads are cache-buster-free, credentialed and explicit on missing, failed or corrupt metadata", async () => {
  const before = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "/api/pages/banner-slides");
      assert.equal(init?.credentials, "include");
      assert.ok(init?.signal);
      return new Response(JSON.stringify({ id: 2, updatedAt: "2026-10-06", content: "[]" }));
    };
    assert.deepEqual((await readBannerSlides()).slides, []);
    globalThis.fetch = async () => new Response("", { status: 404 });
    assert.deepEqual((await readBannerSlides()).slides, []);
    globalThis.fetch = async () => new Response("", { status: 503 });
    await assert.rejects(readBannerSlides(), /503/);
    globalThis.fetch = async () => new Response(JSON.stringify({ content: "broken" }));
    await assert.rejects(readBannerSlides());
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.signal?.aborted, true);
      throw new DOMException("Aborted", "AbortError");
    };
    const abort = new AbortController(); abort.abort();
    await assert.rejects(readBannerSlides(abort.signal), /Aborted/);
  } finally { globalThis.fetch = before; }
});
test("save/editor contracts do not acknowledge failed writes or use persistent slide fallbacks", () => {
  const editor = readFileSync(new URL("../components/home/banner-slide-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /await onSave\(index, finalSlideData\)/);
  assert.ok(editor.indexOf("await onSave") < editor.indexOf('description: "Banner slide updated successfully"'));
  const showcase = readFileSync(new URL("../components/home/community-showcase.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(showcase, /communityBannerSlides|Return a mock successful/);
  assert.match(showcase, /createVersion: true/);
  assert.match(showcase, /queryClient\.setQueryData\(bannerQueryKey\(viewer\), fresh\)/);
});
