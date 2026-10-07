import type { RequestHandler } from "express";
import sharp from "sharp";
import { storage } from "./storage";
import { objectStorageService } from "./object-storage-service";
import { isPubliclyVisible } from "./dmca/content-visibility";
import { logger } from "./lib/logger";

const WIDTHS = new Set([480, 960, 1440, 1920]);
const MAX_CACHE_BYTES = 20 * 1024 * 1024;
const TTL = 5 * 60_000;
const cache = new Map<string, { bytes: Buffer; expires: number }>();
const pending = new Map<string, Promise<Buffer>>();
let cacheBytes = 0;

function remember(key: string, bytes: Buffer) {
  if (bytes.length > MAX_CACHE_BYTES) return;
  for (const [oldKey, entry] of cache) {
    if (entry.expires < Date.now() || cacheBytes + bytes.length > MAX_CACHE_BYTES || cache.size >= 96) {
      cache.delete(oldKey); cacheBytes -= entry.bytes.length;
    }
  }
  cache.set(key, { bytes, expires: Date.now() + TTL });
  cacheBytes += bytes.length;
}

// Originals and uploads are unchanged. Disposable derived bytes are bounded
// in memory, not stored on the deployment filesystem or in CMS content.
export const serveBannerImageVariant: RequestHandler = async (req, res, next) => {
  if (req.query.width === undefined) { next(); return; }
  res.setHeader("Cache-Control", "private, no-cache");
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename.join("/") : req.params.filename;
    const width = Number(req.query.width);
    if (!WIDTHS.has(width) || typeof filename !== "string" ||
      !/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(filename)) {
      res.status(400).json({ error: "Unsupported banner image variant." }); return;
    }
    // Check CURRENT publication/visibility before every cache hit or 304.
    // A derivative must not bypass the page's moderation or hidden status.
    const page = await storage.getPageContent("banner-slides", false);
    if (!page || page.isHidden || !isPubliclyVisible(page)) {
      res.status(404).end(); return;
    }
    const revision = `${page.id}-${new Date(page.updatedAt).getTime()}`;
    if (req.query.v !== revision) { res.status(404).end(); return; }
    const sourcePath = `/api/storage-proxy/BANNER/banner-slides/${filename}`;
    const slides = JSON.parse(page.content);
    if (!Array.isArray(slides) || !slides.some(s => s?.src === sourcePath && s.mediaType !== "video")) {
      res.status(404).end(); return;
    }
    const key = `${revision}/${filename}/${width}`;
    const etag = `"banner-${revision}-${filename}-${width}-webp1"`;
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) { res.status(304).end(); return; }
    let bytes = cache.get(key)?.expires! > Date.now() ? cache.get(key)!.bytes : undefined;
    if (!bytes) {
      let work = pending.get(key);
      if (!work) {
        if (pending.size >= 2) { res.status(503).json({ error: "Banner image processing is busy." }); return; }
        work = (async () => {
          const original = await objectStorageService.getFile(`banner-slides/${filename}`, "BANNER");
          if (!original?.length || original.length > 32 * 1024 * 1024) throw new Error("Image requires original delivery");
          const result = await sharp(original, { limitInputPixels: 50_000_000, animated: false })
            .rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 85 })
            .timeout({ seconds: 5 }).toBuffer();
          remember(key, result);
          return result;
        })().finally(() => pending.delete(key));
        pending.set(key, work);
      }
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        bytes = await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            deadline = setTimeout(() => reject(new Error("Banner image processing timed out")), 8000);
          }),
        ]);
      } finally {
        if (deadline) clearTimeout(deadline);
      }
    }
    res.type("image/webp").setHeader("Content-Length", bytes.length);
    res.send(bytes);
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : "Unknown image error" }, "Banner variant unavailable");
    // The image component retries the unchanged original, then exposes Retry.
    res.status(503).json({ error: "The banner image variant is unavailable." });
  }
};
