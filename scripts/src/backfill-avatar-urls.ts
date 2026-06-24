/**
 * One-time backfill: normalize every users.avatar_url to the canonical
 *   /api/storage-proxy/direct-avatars/<filename>
 * shape.
 *
 * The DB currently stores avatar URLs in at least three shapes:
 *   1. bare path:        /avatars/<file>
 *   2. AVATARS proxy:    /api/storage-proxy/AVATARS/<file>
 *   3. canonical proxy:  /api/storage-proxy/direct-avatars/<file>
 *
 * The frontend's normalizeMediaUrl papers over the difference at render
 * time, but the inconsistency causes redirect chains and makes debugging
 * missing avatars harder. This script picks one canonical form and
 * rewrites every row to use it.
 *
 * For each user row with a non-null avatar_url:
 *   - extract the filename
 *   - if the URL is already external (http(s)://) or a data/blob URI,
 *     leave it alone
 *   - verify the file exists in the AVATARS bucket
 *   - if present, rewrite to /api/storage-proxy/direct-avatars/<filename>
 *   - if missing, set avatar_url to NULL so the UI falls back to the
 *     letter avatar intentionally instead of rendering a broken image
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run backfill-avatar-urls           # dry run
 *   pnpm --filter @workspace/scripts run backfill-avatar-urls -- --apply # write changes
 */

import { isNotNull, eq } from "drizzle-orm";
import { db, pool, users } from "@workspace/db";

const AVATARS_BUCKET = "AVATARS";
const CANONICAL_PREFIX = "/api/storage-proxy/direct-avatars/";
const APPLY = process.argv.includes("--apply");

type Outcome =
  | { kind: "skipped-external"; current: string }
  | { kind: "already-canonical" }
  | { kind: "rewrite"; from: string; to: string }
  | { kind: "missing-cleared"; from: string }
  | { kind: "unparseable"; current: string };

function extractFilename(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (!url) return null;

  // Strip query string / hash if present
  const clean = url.split("?")[0].split("#")[0];

  const knownPrefixes = [
    CANONICAL_PREFIX,
    "/api/storage-proxy/AVATARS/",
    "/api/storage-proxy/avatars/",
    "/avatars/",
    "avatars/",
    "AVATARS/",
  ];
  for (const prefix of knownPrefixes) {
    if (clean.startsWith(prefix)) {
      const rest = clean.slice(prefix.length);
      if (!rest) return null;
      // The "filename" can include sub-paths; take only the basename
      // since the AVATARS bucket is flat for new uploads.
      const basename = rest.split("/").filter(Boolean).pop() ?? "";
      return basename || null;
    }
  }

  // Last-ditch: if it looks like a bare filename, accept it.
  if (!clean.includes("/") && clean.includes(".")) {
    return clean;
  }

  return null;
}

async function fileExistsInAvatars(filename: string): Promise<boolean> {
  // Mirror the candidate keys the storage proxy itself tries when serving
  // these files (see object-storage-proxy.ts `direct-avatars` route).
  // The @replit/object-storage SDK only resolves the bucket from its
  // constructor, so we instead do a HEAD against the raw Object Storage
  // HTTP endpoint with the AVATARS bucket header — exactly what the
  // proxy's HTTP fallback does — which lets us probe any bucket cheaply.
  const candidates = [filename, `avatars/${filename}`, `AVATARS/${filename}`];
  for (const key of candidates) {
    try {
      const res = await fetch(`https://object-storage.replit.app/${key}`, {
        method: "HEAD",
        headers: { "X-Obj-Bucket": AVATARS_BUCKET },
      });
      if (res.ok) return true;
    } catch {
      // network blip — try next candidate
    }
  }
  return false;
}

async function main() {
  console.log(
    `[backfill-avatar-urls] Starting (${APPLY ? "APPLY" : "DRY RUN"})`,
  );

  const rows = await db
    .select({ id: users.id, avatarUrl: users.avatarUrl })
    .from(users)
    .where(isNotNull(users.avatarUrl));

  console.log(`[backfill-avatar-urls] ${rows.length} users have avatar_url`);

  const counts = {
    "skipped-external": 0,
    "already-canonical": 0,
    rewrite: 0,
    "missing-cleared": 0,
    unparseable: 0,
  };

  for (const row of rows) {
    const current = row.avatarUrl ?? "";
    let outcome: Outcome;

    if (
      current.startsWith("http://") ||
      current.startsWith("https://") ||
      current.startsWith("data:") ||
      current.startsWith("blob:")
    ) {
      outcome = { kind: "skipped-external", current };
    } else {
      const filename = extractFilename(current);
      if (!filename) {
        outcome = { kind: "unparseable", current };
      } else {
        const exists = await fileExistsInAvatars(filename);
        if (!exists) {
          outcome = { kind: "missing-cleared", from: current };
          if (APPLY) {
            await db
              .update(users)
              .set({ avatarUrl: null })
              .where(eq(users.id, row.id));
          }
        } else {
          const canonical = `${CANONICAL_PREFIX}${filename}`;
          if (current === canonical) {
            outcome = { kind: "already-canonical" };
          } else {
            outcome = { kind: "rewrite", from: current, to: canonical };
            if (APPLY) {
              await db
                .update(users)
                .set({ avatarUrl: canonical })
                .where(eq(users.id, row.id));
            }
          }
        }
      }
    }

    counts[outcome.kind]++;
    switch (outcome.kind) {
      case "rewrite":
        console.log(
          `[user ${row.id}] rewrite  ${outcome.from}  ->  ${outcome.to}`,
        );
        break;
      case "missing-cleared":
        console.log(
          `[user ${row.id}] missing  ${outcome.from}  ->  NULL (file not found in AVATARS)`,
        );
        break;
      case "unparseable":
        console.log(
          `[user ${row.id}] could not parse filename from: ${outcome.current}`,
        );
        break;
      case "skipped-external":
        console.log(
          `[user ${row.id}] skipped external url: ${outcome.current}`,
        );
        break;
      case "already-canonical":
        // quiet
        break;
    }
  }

  console.log("[backfill-avatar-urls] summary:", counts);
  if (!APPLY) {
    console.log(
      "[backfill-avatar-urls] dry run only — re-run with `-- --apply` to persist changes",
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error("[backfill-avatar-urls] FAILED:", err);
  process.exitCode = 1;
  pool.end().catch(() => {});
});
