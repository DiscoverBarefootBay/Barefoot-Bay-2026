/**
 * One-off sweep: find users whose `avatar_url` points at a file that
 * no longer exists in the AVATARS bucket and either clear the value
 * (forcing the UI's letter-avatar fallback) or flag the affected
 * accounts so admins can ask the user to re-upload.
 *
 * Task #103 already prevents *new* avatar uploads from saving URLs that
 * point at nothing, but it doesn't retroactively repair users whose
 * `avatar_url` was written under the old behaviour. This sweep closes
 * that gap (see task #108).
 *
 * Scope:
 *   - Only inspects rows whose `avatar_url` references the storage
 *     proxy (`/api/storage-proxy/...`) or the raw Object Storage host
 *     (`https://object-storage.replit.app/AVATARS/...`). External
 *     URLs, data/blob URIs, and unparseable values are left untouched
 *     and reported separately.
 *   - Probes the AVATARS bucket via the same HEAD-with-`X-Obj-Bucket`
 *     dance the storage proxy itself uses, so the result matches what
 *     the user would actually see in the browser.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run sweep-missing-avatars            # dry run + report
 *   pnpm --filter @workspace/scripts run sweep-missing-avatars -- --apply # clear missing rows
 *   pnpm --filter @workspace/scripts run sweep-missing-avatars -- --flag-only
 *       # dry-run-but-list-only: prints the affected user ids without
 *       # changing anything, suitable for an admin handoff.
 */

import { isNotNull, eq } from "drizzle-orm";
import { db, pool, users } from "@workspace/db";

const AVATARS_BUCKET = "AVATARS";
const STORAGE_PROXY_PREFIX = "/api/storage-proxy/";
const RAW_AVATARS_HOST_PREFIX = "https://object-storage.replit.app/AVATARS/";

const APPLY = process.argv.includes("--apply");
const FLAG_ONLY = process.argv.includes("--flag-only");

type Row = { id: number; username: string | null; avatarUrl: string | null };

type Outcome =
  | { kind: "ok" }
  | { kind: "skipped-non-proxy"; current: string }
  | { kind: "unparseable"; current: string }
  | { kind: "missing"; current: string; filename: string };

function extractAvatarFilename(rawUrl: string): string | null {
  const clean = rawUrl.trim().split("?")[0].split("#")[0];
  if (!clean) return null;

  let rest: string | null = null;
  if (clean.startsWith(STORAGE_PROXY_PREFIX)) {
    // /api/storage-proxy/<segment>/<...>
    const afterProxy = clean.slice(STORAGE_PROXY_PREFIX.length);
    const slashIdx = afterProxy.indexOf("/");
    if (slashIdx < 0) return null;
    const segment = afterProxy.slice(0, slashIdx);
    // Only consider segments that we know map to avatars
    if (
      segment !== "direct-avatars" &&
      segment !== "AVATARS" &&
      segment !== "avatars"
    ) {
      return null;
    }
    rest = afterProxy.slice(slashIdx + 1);
  } else if (clean.startsWith(RAW_AVATARS_HOST_PREFIX)) {
    rest = clean.slice(RAW_AVATARS_HOST_PREFIX.length);
  }

  if (!rest) return null;
  const basename = rest.split("/").filter(Boolean).pop() ?? "";
  return basename || null;
}

function isAvatarProxyUrl(rawUrl: string): boolean {
  const clean = rawUrl.trim();
  if (clean.startsWith(RAW_AVATARS_HOST_PREFIX)) return true;
  if (!clean.startsWith(STORAGE_PROXY_PREFIX)) return false;
  const afterProxy = clean.slice(STORAGE_PROXY_PREFIX.length);
  const slashIdx = afterProxy.indexOf("/");
  if (slashIdx < 0) return false;
  const segment = afterProxy.slice(0, slashIdx);
  return (
    segment === "direct-avatars" ||
    segment === "AVATARS" ||
    segment === "avatars"
  );
}

async function fileExistsInAvatars(filename: string): Promise<boolean> {
  // Mirror the candidate keys the `direct-avatars` proxy route tries
  // (see artifacts/api-server/src/object-storage-proxy.ts).
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
  if (APPLY && FLAG_ONLY) {
    console.error(
      "[sweep-missing-avatars] --apply and --flag-only are mutually exclusive",
    );
    process.exitCode = 1;
    return;
  }

  const mode = APPLY ? "APPLY" : FLAG_ONLY ? "FLAG-ONLY" : "DRY RUN";
  console.log(`[sweep-missing-avatars] Starting (${mode})`);

  const rows: Row[] = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(isNotNull(users.avatarUrl));

  console.log(`[sweep-missing-avatars] ${rows.length} users have avatar_url`);

  const counts = {
    ok: 0,
    "skipped-non-proxy": 0,
    unparseable: 0,
    missing: 0,
  };
  const missingUsers: Array<{
    id: number;
    username: string | null;
    avatarUrl: string;
    filename: string;
  }> = [];

  for (const row of rows) {
    const current = row.avatarUrl ?? "";
    let outcome: Outcome;

    if (!isAvatarProxyUrl(current)) {
      outcome = { kind: "skipped-non-proxy", current };
    } else {
      const filename = extractAvatarFilename(current);
      if (!filename) {
        outcome = { kind: "unparseable", current };
      } else {
        const exists = await fileExistsInAvatars(filename);
        outcome = exists
          ? { kind: "ok" }
          : { kind: "missing", current, filename };
      }
    }

    counts[outcome.kind]++;

    if (outcome.kind === "missing") {
      missingUsers.push({
        id: row.id,
        username: row.username,
        avatarUrl: outcome.current,
        filename: outcome.filename,
      });
      if (APPLY) {
        await db
          .update(users)
          .set({ avatarUrl: null })
          .where(eq(users.id, row.id));
        console.log(
          `[user ${row.id} ${row.username ?? ""}] cleared (file ${outcome.filename} missing in AVATARS)`,
        );
      } else {
        console.log(
          `[user ${row.id} ${row.username ?? ""}] missing: ${outcome.current}  (filename=${outcome.filename})`,
        );
      }
    } else if (outcome.kind === "unparseable") {
      console.log(
        `[user ${row.id} ${row.username ?? ""}] unparseable avatar_url: ${outcome.current}`,
      );
    }
  }

  console.log("");
  console.log("[sweep-missing-avatars] report:");
  console.log(`  total users with avatar_url:  ${rows.length}`);
  console.log(`  ok (file exists):             ${counts.ok}`);
  console.log(`  skipped (non-proxy URL):      ${counts["skipped-non-proxy"]}`);
  console.log(`  unparseable:                  ${counts.unparseable}`);
  console.log(`  MISSING backing file:         ${counts.missing}`);

  if (missingUsers.length > 0) {
    console.log("");
    console.log("[sweep-missing-avatars] affected user ids:");
    for (const u of missingUsers) {
      console.log(
        `  - id=${u.id}  username=${u.username ?? "(none)"}  file=${u.filename}`,
      );
    }
  }

  if (!APPLY) {
    console.log("");
    console.log(
      "[sweep-missing-avatars] no changes written — re-run with `-- --apply` to clear avatar_url for the rows listed above (forcing the letter-avatar fallback).",
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error("[sweep-missing-avatars] FAILED:", err);
  process.exitCode = 1;
  pool.end().catch(() => {});
});
