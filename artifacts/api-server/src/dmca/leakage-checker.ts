import { sql } from "drizzle-orm";
import { db } from "../db";
import { isDmcaSchedulerEmailSendingEnabled } from "../scheduler-email-gate";
import { raiseDmcaAdminAlert } from "./admin-alerts";
import { writeDmcaAudit } from "./audit";
import { getContentTypeDef, isDmcaContentType, CONTENT_TYPES } from "./content-registry";

export interface LeakageFailure {
  caseNumber: string;
  contentType: string;
  contentId: number;
  check: "public_page" | "public_api" | "file_url" | "search" | "sitemap";
  detail: string;
}

const removedStatus = (r: Response) => r.status === 404 || r.status === 410;
const removedBody = (body: string) => /(?:content (?:has been )?removed|no longer available|not found)/i.test(body.slice(0, 1000));
const spaShell = (body: string) => /<div id="root"><\/div>|<div id="root">/i.test(body);
function listContainsId(body: string, id: number): boolean {
  try {
    const value = JSON.parse(body);
    const rows = Array.isArray(value) ? value :
      (value && typeof value === "object" ? (value.comments ?? value.data ?? value.results) : null);
    return Array.isArray(rows) && rows.some((row: any) => Number(row?.id) === id);
  } catch {
    // Invalid JSON from a list endpoint is an operational failure, not proof
    // that the hidden item appeared.
    return false;
  }
}
function searchContainsComment(body: string, type: string, id: number, content: string): boolean {
  try {
    const parsed = JSON.parse(body);
    const results = Array.isArray(parsed) ? parsed : parsed?.results;
    if (!Array.isArray(results)) return false;
    return results.some((result: any) => {
      const resultType = String(result?.contentType ?? result?.content_type ?? result?.type ?? "").replace(/-/g, "_");
      const matchesType = resultType === type || (resultType === "comment" && type.endsWith("_comment"));
      return matchesType && Number(result?.id) === id &&
        (!content || String(result?.content ?? result?.description ?? "").includes(content));
    });
  } catch { return false; }
}
const absolute = (base: string, path: string) => new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
async function bodyText(r: Response): Promise<string> { try { return await r.text(); } catch { return ""; } }

function apiPath(type: string, row: any): string | null {
  if (type === "forum_post") return `/api/forum/posts/${row.id}`;
  if (type === "forum_comment") return row.post_id ? `/api/forum/posts/${row.post_id}/comments` : null;
  if (type === "listing") return `/api/listings/${row.id}`;
  if (type === "event") return `/api/events/${row.id}`;
  if (type === "event_comment") return row.event_id ? `/api/events/${row.event_id}/comments` : null;
  if (type === "page") return row.slug ? `/api/pages/${encodeURIComponent(row.slug)}` : null;
  if (type === "vendor_comment") return row.page_slug ? `/api/vendors/${encodeURIComponent(row.page_slug)}/comments` : null;
  return null;
}

export async function runLeakageCheck({ baseUrl, fetchImpl = fetch }: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<{ checkedItems: number; failures: LeakageFailure[] }> {
  const targets = (await db.execute(sql`
    SELECT t.id target_id,t.dmca_case_id,t.content_type,t.content_id,t.original_url,c.case_number
    FROM dmca_targets t JOIN dmca_cases c ON c.id=t.dmca_case_id
    WHERE t.status='taken_down' AND t.content_id IS NOT NULL`)).rows as any[];
  // Do not rely solely on target state: an orphaned dmca_hidden row must
  // still be checked and surfaced, not silently skipped.
  for (const def of Object.values(CONTENT_TYPES)) {
    if (!def.hasVisibilityColumns) continue;
    const hidden = (await db.execute(sql`
      SELECT item.id, item.dmca_case_id, c.case_number
      FROM ${sql.identifier(def.table)} item JOIN dmca_cases c ON c.id=item.dmca_case_id
      WHERE item.visibility_status='dmca_hidden'`)).rows as any[];
    for (const row of hidden) {
      if (!targets.some(t => t.content_type === def.type && Number(t.content_id) === Number(row.id))) {
        targets.push({
          target_id: null, dmca_case_id: row.dmca_case_id, case_number: row.case_number,
          content_type: def.type, content_id: row.id, original_url: null,
        });
      }
    }
  }
  const quarantined = (await db.execute(sql`
    SELECT q.id,q.dmca_case_id,q.dmca_target_id,q.original_url,c.case_number,t.content_type,t.content_id
    FROM dmca_quarantined_objects q JOIN dmca_cases c ON c.id=q.dmca_case_id
    JOIN dmca_targets t ON t.id=q.dmca_target_id WHERE q.status='quarantined'`)).rows as any[];
  const failures: LeakageFailure[] = [];
  const add = (t: any, check: LeakageFailure["check"], detail: string) =>
    failures.push({ caseNumber: String(t.case_number), contentType: String(t.content_type), contentId: Number(t.content_id), check, detail });

  for (const t of targets) {
    if (!isDmcaContentType(t.content_type) || t.content_type === "avatar") continue;
    const def = getContentTypeDef(t.content_type);
    const row = (await db.execute(sql`SELECT * FROM ${sql.identifier(def.table)} WHERE id=${t.content_id}`)).rows[0] as any;
    if (!row || row.visibility_status !== "dmca_hidden") {
      add(t, "public_api", `Taken-down item is ${row ? `marked ${row.visibility_status}` : "missing"} instead of dmca_hidden`);
      continue;
    }
    const page = def.publicPath?.(row) || t.original_url;
    if (page) {
      const r = await fetchImpl(absolute(baseUrl, page), { headers: {} });
      const text = await bodyText(r);
      // The web app serves its empty React shell with HTTP 200 for every
      // client-side route. That shell contains no item; the API check below
      // verifies that the actual item cannot be loaded.
      if (!removedStatus(r) && !removedBody(text) && !(r.ok && spaShell(text)))
        add(t, "public_page", `${page} returned ${r.status} without a removed response`);
    }
    const api = apiPath(t.content_type, row);
    if (api) {
      const r = await fetchImpl(absolute(baseUrl, api), { headers: {} });
      const text = await bodyText(r);
      const listEndpoint = ["forum_comment", "event_comment", "vendor_comment"].includes(t.content_type);
      if (!removedStatus(r) && !removedBody(text) &&
          (!listEndpoint || listContainsId(text, Number(t.content_id))))
        add(t, "public_api", `${api} returned ${r.status} without a removed response`);
    }
    const title = String(row.title || row.subject || row.name || row.slug || row.content || "").trim().slice(0, 100);
    if (title) {
      const r = await fetchImpl(absolute(baseUrl, `/api/search?q=${encodeURIComponent(title)}`), { headers: {} });
      const searchBody = await bodyText(r);
      // Comments can share their parent URL with a public post. The search
      // result must identify the hidden comment itself, not just its parent.
      const comment = t.content_type.endsWith("_comment");
      if ((comment && (
        (page && searchBody.includes(`#comment-${t.content_id}`)) ||
        searchContainsComment(searchBody, t.content_type, Number(t.content_id), String(row.content || "").trim().slice(0, 50))
      )) ||
          (!comment && (searchBody.includes(title) || (page && searchBody.includes(page.split("#")[0])))))
        add(t, "search", "target appeared in anonymous search");
    }
    const sitemap = await fetchImpl(absolute(baseUrl, "/sitemap.xml"), { headers: {} });
    const sitemapBody = await bodyText(sitemap);
    // Comments have no independent sitemap URL; their public parent can
    // legitimately remain indexed after the comment itself is removed.
    if (page && !t.content_type.endsWith("_comment") && sitemapBody.includes(page.split("#")[0]))
      add(t, "sitemap", "public URL appeared in sitemap");
  }
  for (const q of quarantined) {
    const r = await fetchImpl(absolute(baseUrl, q.original_url), { headers: {} });
    if (!removedStatus(r)) add(q, "file_url", `${q.original_url} returned ${r.status}`);
  }

  const day = new Date().toISOString().slice(0, 10);
  for (const f of failures) {
    const target = targets.find(t => String(t.case_number) === f.caseNumber && Number(t.content_id) === f.contentId);
    const caseId = Number(target?.dmca_case_id || quarantined.find(q => String(q.case_number) === f.caseNumber && Number(q.content_id) === f.contentId)?.dmca_case_id);
    const dedupeKey = `leak:${caseId}:${f.contentType}:${f.contentId}:${f.check}:${day}`;
    const inserted = await raiseDmcaAdminAlert({
      alertType: "content_exposure", severity: "critical", title: "DMCA content exposure",
      body: `${f.caseNumber}: ${f.contentType} #${f.contentId} failed ${f.check}: ${f.detail}`,
      dedupeKey, dmcaCaseId: caseId, emailTo: "all", emailEnabled: isDmcaSchedulerEmailSendingEnabled(),
    });
    if (inserted != null) await writeDmcaAudit({
      event: "dmca_content_exposure", actorType: "system", dmcaCaseId: caseId,
      targetType: f.contentType, targetId: f.contentId, newValue: { check: f.check, detail: f.detail },
    });
  }
  return { checkedItems: targets.length + quarantined.length, failures };
}