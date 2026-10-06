// Read-only development DB comparison. Never imports server startup/schedulers.
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { storage } from "../src/storage";
import { pool } from "../src/db";
import { readVendorDirectoryPages } from "../src/vendor-directory-read";
import { projectVendorDirectory } from "../src/vendor-directory-summary";
import { filterForViewer } from "../src/dmca/content-visibility";
import { fixContentMediaUrl } from "../src/media-path-utils";
const output = console.log;
console.log = () => {};
try {
  for (const includeHidden of [false, true]) {
    for (let sample = 0; sample < 3; sample++) {
      const viewer = { userId: null, canViewHidden: includeHidden, canViewModerated: includeHidden };
      let start = performance.now();
      const oldPages = filterForViewer(await storage.getAllPageContents(includeHidden), viewer, p => p.updatedBy);
      const oldReadMs = performance.now() - start;
      const oldResponse = oldPages.map(p => ({ ...p, content: fixContentMediaUrl(p.content) }));
      const oldMs = performance.now() - start;
      start = performance.now();
      const [rows, cats] = await Promise.all([readVendorDirectoryPages(includeHidden), storage.getVendorCategories(includeHidden)]);
      const readMs = performance.now() - start;
      const summary = projectVendorDirectory(
        filterForViewer(rows, viewer, p => p.updatedBy).map(p => ({...p,content:fixContentMediaUrl(p.content)})),
        cats,
      );
      output(JSON.stringify({includeHidden,sample,oldMs:Math.round(oldMs),oldReadMs:Math.round(oldReadMs),readMs:Math.round(readMs),newMs:Math.round(performance.now()-start),
        oldBytes:Buffer.byteLength(JSON.stringify(oldResponse)),summaryBytes:Buffer.byteLength(JSON.stringify(summary)),
        vendorRows:rows.length,oldRows:oldPages.length,cards:summary.vendors.filter(v=>v.showInDirectory).length}));
      if (!includeHidden && sample === 0) writeFileSync("/tmp/vendors-after-summary.json", JSON.stringify(summary));
    }
  }
} finally { await pool.end(); }
