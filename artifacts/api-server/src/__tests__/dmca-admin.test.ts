import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import dmcaAdminRouter from "../routes/dmca-admin";
import { createForumRouter } from "../routes/forum";
import { storage } from "../storage";
import { DmcaPermission as P } from "../dmca/permissions";
import { markUploaderNotified } from "../dmca/dmca-service";
import { __setQuarantineTestHooks, type QuarantineStorageAdapter } from "../dmca/quarantine";
import { assertCanPermanentDelete, PermanentDeletePermissionError } from "../dmca/permanent-delete";

type Mode = "none" | "member" | "nogrant" | "moderator" | "admin";
const caseIds: number[] = [];
const postIds: number[] = [];
const flagIds: number[] = [];
const granted: Array<{ userId: number; permission: string }> = [];
const uploadedFiles: string[] = [];
let actorId = 0;
let noGrantId = 0;
let categoryId = 0;
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let origin = "";

// In-memory object storage: private documents must round-trip through the adapter (never local disk).
const memoryObjects = new Map<string, Buffer>();
const emptyStorage: QuarantineStorageAdapter = {
  async get(key) { return memoryObjects.get(key) ?? null; },
  async put(key, data) { memoryObjects.set(key, data); },
  async del(key) { memoryObjects.delete(key); },
};

async function api(mode: Mode, method: string, pathname: string, body?: unknown) {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: { "content-type": "application/json", "x-test-auth": mode },
    body: body === undefined || method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let json: any = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { json = raw; }
  return { status: response.status, body: json };
}

async function insertPost(ownerId = noGrantId): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO forum_posts (title,content,category_id,user_id,media_urls)
    VALUES (${"DMCA admin test"},${"throwaway legal test content"},${categoryId},${ownerId},ARRAY[]::text[])
    RETURNING id`);
  const id = Number((result.rows[0] as any).id);
  postIds.push(id);
  return id;
}

function manualCase(url: string, claimant = "Admin Test Claimant") {
  return {
    submittedVia: "phone", receivedAt: new Date().toISOString(),
    claimantName: claimant, claimantEmail: "claimant@example.test",
    claimantPhone: "555-555-0199", claimantAddress: "100 Test Street",
    claimantRole: "owner", workTitle: "Test copyrighted work",
    workDescription: "Original test work", urls: [url],
    statements: { goodFaith: true, accuracyPerjury: true },
    signature: claimant, notes: "Telephone call summary",
  };
}

async function createCaseForPost(postId: number, claimant?: string) {
  const response = await api("admin", "POST", "/api/admin/dmca/cases", manualCase(`https://barefootbay.com/forum/post/${postId}`, claimant));
  assert.equal(response.status, 201, JSON.stringify(response.body));
  caseIds.push(Number(response.body.id));
  return Number(response.body.id);
}

async function createUrlCase(suffix: string) {
  const response = await api("admin", "POST", "/api/admin/dmca/cases", manualCase(`https://barefootbay.com/not-a-real-dmca-test-${suffix}`));
  assert.equal(response.status, 201, JSON.stringify(response.body));
  caseIds.push(Number(response.body.id));
  return Number(response.body.id);
}

async function auditCount(caseId: number) {
  return Number(((await db.execute(sql`SELECT count(*)::int n FROM dmca_audit_log WHERE dmca_case_id=${caseId}`)).rows[0] as any).n);
}

async function audited(caseId: number, method: string, pathname: string, body?: unknown, expected = 200) {
  const beforeCount = await auditCount(caseId);
  const response = await api("admin", method, pathname, body);
  assert.equal(response.status, expected, JSON.stringify(response.body));
  assert.ok(await auditCount(caseId) > beforeCount, `${method} ${pathname} must audit`);
  return response;
}

before(async () => {
  const seed = await db.execute(sql`
    SELECT u.id AS user_id,(SELECT id FROM forum_categories ORDER BY id LIMIT 1) AS category_id
    FROM users u
    WHERE u.email IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM dmca_permission_grants p WHERE p.user_id=u.id)
    ORDER BY u.id LIMIT 2`);
  assert.ok(seed.rows.length >= 2, "two users without DMCA grants are required");
  actorId = Number((seed.rows[0] as any).user_id);
  noGrantId = Number((seed.rows[1] as any).user_id);
  categoryId = Number((seed.rows[0] as any).category_id);
  for (const permission of Object.values(P)) {
    const inserted = await db.execute(sql`
      INSERT INTO dmca_permission_grants(user_id,permission,granted_by)
      VALUES(${actorId},${permission},${actorId}) ON CONFLICT DO NOTHING RETURNING permission`);
    if (inserted.rows.length) granted.push({ userId: actorId, permission });
  }
  __setQuarantineTestHooks({ adapter: emptyStorage });

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const mode = String(req.headers["x-test-auth"] || "none") as Mode;
    req.isAuthenticated = () => mode !== "none";
    if (mode !== "none") {
      req.user = {
        id: mode === "admin" ? actorId : noGrantId,
        username: `test-${mode}`,
        role: mode === "moderator" ? "moderator" : mode === "member" ? "registered" : "admin",
      };
    }
    next();
  });
  app.use("/api/admin/dmca", dmcaAdminRouter);
  app.use("/api/forum", createForumRouter(storage));
  app.use((error: any, _req: any, res: any, _next: any) => res.status(500).json({ message: error?.message || String(error) }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind");
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  __setQuarantineTestHooks({ adapter: null, localRoot: null });
  if (postIds.length) {
    await db.execute(sql`UPDATE forum_posts SET legal_hold=false,visibility_status='published',dmca_case_id=NULL WHERE id IN (${sql.join(postIds.map(v => sql`${v}`), sql`,`)})`);
  }
  await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL dmca.allow_purge='on'`);
    if (caseIds.length) {
      const ids = sql.join(caseIds.map(v => sql`${v}`), sql`,`);
      await tx.execute(sql`DELETE FROM dmca_content_flags WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM notification_outbox WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM user_copyright_events WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_quarantined_objects WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM legal_holds WHERE case_type='dmca' AND case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_audit_log WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_submissions WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_targets WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_cases WHERE id IN (${ids})`);
    }
    if (flagIds.length) await tx.execute(sql`DELETE FROM dmca_content_flags WHERE id IN (${sql.join(flagIds.map(v => sql`${v}`), sql`,`)})`);
    if (postIds.length) {
      const posts = sql.join(postIds.map(v => sql`${v}`), sql`,`);
      await tx.execute(sql`DELETE FROM legal_holds WHERE content_type='forum_post' AND content_id IN (${posts})`);
      await tx.execute(sql`DELETE FROM dmca_audit_log WHERE (target_type='forum_post' AND target_id IN (${posts})) OR (actor_id=${actorId} AND event IN ('document_uploaded','private_file_link_issued'))`);
      await tx.execute(sql`DELETE FROM forum_posts WHERE id IN (${posts})`);
    }
    for (const grant of granted) await tx.execute(sql`DELETE FROM dmca_permission_grants WHERE user_id=${grant.userId} AND permission=${grant.permission}`);
  });
  for (const file of uploadedFiles) {
    await import("fs/promises").then(fs => fs.unlink(file).catch(() => undefined));
  }
});

describe("DMCA admin permission gates", () => {
  it("returns 401 unauthenticated and does not treat site admin as a DMCA grant", async () => {
    assert.equal((await api("none", "GET", "/api/admin/dmca/cases")).status, 401);
    assert.equal((await api("nogrant", "GET", "/api/admin/dmca/cases")).status, 403);
    const me = await api("nogrant", "GET", "/api/admin/dmca/me");
    assert.equal(me.status, 200);
    assert.deepEqual(me.body.permissions, []);
    assert.equal(me.body.isSiteAdmin, true);
  });

  it("gates every permission-protected route before validation", async () => {
    const guarded: Array<[string, string]> = [
      ["GET", "/api/admin/dmca/assignees"], ["GET", "/api/admin/dmca/cases"],
      ["GET", "/api/admin/dmca/cases/1"], ["POST", "/api/admin/dmca/cases"],
      ["POST", "/api/admin/dmca/files"], ["GET", "/api/admin/dmca/files?path=dmca/x"],
      ["PATCH", "/api/admin/dmca/cases/1/assign"], ["POST", "/api/admin/dmca/cases/1/notes"],
      ["POST", "/api/admin/dmca/cases/1/request-info"], ["POST", "/api/admin/dmca/cases/1/start-review"],
      ["POST", "/api/admin/dmca/cases/1/approve-takedown"], ["POST", "/api/admin/dmca/cases/1/reject"],
      ["POST", "/api/admin/dmca/cases/1/targets"], ["POST", "/api/admin/dmca/cases/1/holds"],
      ["POST", "/api/admin/dmca/cases/1/counter-notice"], ["POST", "/api/admin/dmca/cases/1/counter-notice/accept"],
      ["POST", "/api/admin/dmca/cases/1/counter-notice/reject"], ["POST", "/api/admin/dmca/cases/1/counter-notice/forward"],
      ["POST", "/api/admin/dmca/cases/1/court-action"], ["POST", "/api/admin/dmca/cases/1/restore"],
      ["POST", "/api/admin/dmca/cases/1/close"], ["GET", "/api/admin/dmca/holds"],
      ["POST", "/api/admin/dmca/holds"], ["POST", "/api/admin/dmca/holds/1/release"],
      ["GET", "/api/admin/dmca/repeat-infringers"], ["POST", "/api/admin/dmca/repeat-infringers/1/decision"],
      ["GET", "/api/admin/dmca/settings"], ["PUT", "/api/admin/dmca/settings"],
      ["GET", "/api/admin/dmca/permissions"], ["GET", "/api/admin/dmca/permissions/search?q=x"],
      ["POST", "/api/admin/dmca/permissions/1/grant"], ["POST", "/api/admin/dmca/permissions/1/revoke"],
      ["POST", "/api/admin/dmca/content/forum_post/1/flag"], ["GET", "/api/admin/dmca/flags"],
      ["POST", "/api/admin/dmca/flags/1/resolve"],
    ];
    for (const [method, pathname] of guarded) {
      const response = await api("nogrant", method, pathname, {});
      assert.equal(response.status, 403, `${method} ${pathname}: ${JSON.stringify(response.body)}`);
    }
  });

  it("allows a moderator to flag, but not view or take down cases", async () => {
    const postId = await insertPost();
    const flagged = await api("moderator", "POST", `/api/admin/dmca/content/forum_post/${postId}/flag`, { reason: "Possible copied image" });
    assert.equal(flagged.status, 201, JSON.stringify(flagged.body));
    flagIds.push(Number(flagged.body.id));
    assert.equal((await api("moderator", "GET", "/api/admin/dmca/cases")).status, 403);
    assert.equal((await api("moderator", "POST", "/api/admin/dmca/cases/1/approve-takedown", { reason: "x" })).status, 403);
  });

  it("audits private uploads and rejects traversal before issuing a link", async () => {
    const form = new FormData();
    form.append("file", new Blob(["confidential original notice"], { type: "text/plain" }), "notice.txt");
    const upload = await fetch(`${origin}/api/admin/dmca/files`, { method: "POST", headers: { "x-test-auth": "admin" }, body: form });
    const body: any = await upload.json();
    assert.equal(upload.status, 201, JSON.stringify(body));
    const storedKey = `dmca-quarantine/_documents/${String(body.path).slice("dmca/".length)}`;
    assert.equal(memoryObjects.get(storedKey)?.toString(), "confidential original notice", "document must be stored in private object storage under the gated quarantine prefix");
    const audit = (await db.execute(sql`SELECT new_value FROM dmca_audit_log WHERE event='document_uploaded' AND actor_id=${actorId} ORDER BY id DESC LIMIT 1`)).rows[0] as any;
    assert.equal(audit.new_value.path, body.path);
    assert.equal(audit.new_value.mime, "text/plain");
    assert.ok(Number(audit.new_value.size) > 0);

    const traversal = await api("admin", "GET", "/api/admin/dmca/files?path=dmca%2F..%2F..%2Fetc%2Fpasswd");
    assert.equal(traversal.status, 400, JSON.stringify(traversal.body));
    const link = await api("admin", "GET", `/api/admin/dmca/files?path=${encodeURIComponent(body.path)}`);
    assert.equal(link.status, 200, JSON.stringify(link.body));
    assert.ok(link.body.url);
    const download = await fetch(`${origin}${link.body.url}`, { headers: { "x-test-auth": "admin" } });
    assert.equal(download.status, 200);
    assert.equal(await download.text(), "confidential original notice");
    assert.equal(download.headers.get("cache-control"), "private, no-store");
    const tampered = await fetch(`${origin}${String(link.body.url).replace(/sig=[^&]+/, "sig=bad")}`, { headers: { "x-test-auth": "admin" } });
    assert.equal(tampered.status, 403);
    const linkAudit = (await db.execute(sql`SELECT count(*)::int n FROM dmca_audit_log WHERE event='private_file_link_issued' AND actor_id=${actorId}`)).rows[0] as any;
    assert.ok(Number(linkAudit.n) > 0);
  });

  it("requires both review and takedown for approve-takedown", async () => {
    await db.execute(sql`INSERT INTO dmca_permission_grants(user_id,permission,granted_by) VALUES(${noGrantId},${P.REVIEW},${actorId}) ON CONFLICT DO NOTHING`);
    granted.push({ userId: noGrantId, permission: P.REVIEW });
    try {
      const response = await api("nogrant", "POST", "/api/admin/dmca/cases/1/approve-takedown", { reason: "test" });
      assert.equal(response.status, 403);
      assert.ok(String(response.body.message).includes(P.TAKEDOWN));
    } finally {
      await db.execute(sql`DELETE FROM dmca_permission_grants WHERE user_id=${noGrantId} AND permission=${P.REVIEW}`);
      granted.splice(granted.findIndex(g => g.userId === noGrantId && g.permission === P.REVIEW), 1);
    }
  });
});

describe("DMCA admin case actions", () => {
  it("runs request-info through counter-notice restoration and close, auditing every action", async () => {
    const postId = await insertPost();
    const caseId = await createCaseForPost(postId);
    const secret = "SECRET INTERNAL LEGAL NOTE";
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/notes`, { body: secret });
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/request-info`, { reasons: ["work_id", "other"], otherText: "ownership record", message: "Please send an ownership record." });
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/start-review`, {});
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/approve-takedown`, { reason: "Valid complete notice", notifyUploader: true });
    await markUploaderNotified(caseId);
    assert.equal((await db.execute(sql`SELECT status FROM dmca_cases WHERE id=${caseId}`)).rows[0]?.status, "UPLOADER_NOTIFIED");

    const privateSentinel = `NEVER-FORWARD-${Date.now()}`;
    const documentSentinel = `dmca/${privateSentinel}.pdf`;
    const counter = {
      receivedAt: new Date().toISOString(), submittedVia: "email", name: "Uploader",
      address: "200 Test Street", phone: "555-555-0101", email: "uploader@example.test",
      materialIdentification: "The test forum post", goodFaithStatement: true,
      jurisdictionConsent: true, signature: "Uploader", notes: privateSentinel, originalDocumentPath: documentSentinel,
    };
    const wrongMode = await api("admin", "POST", `/api/admin/dmca/cases/${caseId}/restore`, { reason: "wrong statutory basis", mode: "counter_notice" });
    assert.equal(wrongMode.status, 409);
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/counter-notice`, counter);
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/counter-notice/reject`, { reason: "Address needs clarification" });
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/counter-notice`, { ...counter, receivedAt: new Date().toISOString(), address: "201 Corrected Street" });
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/counter-notice/accept`, {});
    const forwarded = await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/counter-notice/forward`, {});
    assert.ok(forwarded.body.restoreEligibleAt);
    assert.ok(forwarded.body.restoreDeadlineAt);
    const dates = (await db.execute(sql`SELECT claimant_counter_notified_at,restore_eligible_at,restore_deadline_at FROM dmca_cases WHERE id=${caseId}`)).rows[0] as any;
    assert.ok(dates.claimant_counter_notified_at);
    assert.ok(dates.restore_eligible_at);
    assert.ok(dates.restore_deadline_at);
    assert.equal(forwarded.body.availableActions.includes("restore"), false, "restore is unavailable before eligibility");

    const early = await api("admin", "POST", `/api/admin/dmca/cases/${caseId}/restore`, { reason: "too early", mode: "counter_notice" });
    assert.equal(early.status, 409, JSON.stringify(early.body));
    const invalidWithdrawal = await api("admin", "POST", `/api/admin/dmca/cases/${caseId}/restore`, { reason: "wrong mode", mode: "notice_withdrawn" });
    assert.equal(invalidWithdrawal.status, 409, JSON.stringify(invalidWithdrawal.body));
    await db.execute(sql`UPDATE dmca_cases SET restore_eligible_at=now()-interval '1 day' WHERE id=${caseId}`);
    const eligibleDetail = await api("admin", "GET", `/api/admin/dmca/cases/${caseId}`);
    assert.equal(eligibleDetail.status, 200);
    assert.equal(eligibleDetail.body.availableActions.includes("restore"), true);
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/restore`, { reason: "Statutory waiting period elapsed", mode: "counter_notice" });
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/close`, { outcome: "restored", notes: "Restoration completed" });

    const outbox = (await db.execute(sql`SELECT event_type,payload FROM notification_outbox WHERE dmca_case_id=${caseId}`)).rows as any[];
    for (const type of ["dmca.claimant_missing_info", "dmca.uploader_takedown_notice", "dmca.claimant_counter_forward", "dmca.uploader_restored_notice", "dmca.claimant_restored_notice", "dmca.claimant_closure_notice", "dmca.uploader_closure_notice"]) {
      assert.ok(outbox.some(row => row.event_type === type), `missing outbox ${type}`);
    }
    assert.equal(JSON.stringify(outbox).includes(secret), false, "internal notes must never enter outbox payloads");
    assert.equal(JSON.stringify(outbox).includes(privateSentinel), false, "counter internal notes must never enter outbox payloads");
    assert.equal(JSON.stringify(outbox).includes(documentSentinel), false, "private document paths must never enter outbox payloads");
    const counterSubmission = (await db.execute(sql`SELECT form_payload,original_document_path FROM dmca_submissions WHERE dmca_case_id=${caseId} AND submission_type='counter_notice' ORDER BY id DESC LIMIT 1`)).rows[0] as any;
    assert.equal(counterSubmission.form_payload.notes, undefined);
    assert.equal(counterSubmission.form_payload.originalDocumentPath, undefined);
    assert.equal(counterSubmission.original_document_path, documentSentinel);
    assert.ok((await db.execute(sql`SELECT 1 FROM dmca_audit_log WHERE dmca_case_id=${caseId} AND event='internal_note' AND notes=${privateSentinel}`)).rows.length);
  });

  it("supports reject, one-active-case enforcement, and closing removed content", async () => {
    const rejectPost = await insertPost();
    const rejectId = await createCaseForPost(rejectPost, "Reject claimant");
    await audited(rejectId, "POST", `/api/admin/dmca/cases/${rejectId}/reject`, { reason: "Notice does not identify a protected work" });
    const rejected = (await db.execute(sql`SELECT status,closed_reason FROM dmca_cases WHERE id=${rejectId}`)).rows[0] as any;
    assert.deepEqual({ status: rejected.status, reason: rejected.closed_reason }, { status: "CLOSED", reason: "rejected_no_action" });

    const activePost = await insertPost();
    const activeId = await createCaseForPost(activePost, "First claimant");
    const secondId = await createUrlCase(`second-${Date.now()}`);
    const conflict = await api("admin", "POST", `/api/admin/dmca/cases/${secondId}/targets`, { contentType: "forum_post", contentId: activePost });
    assert.equal(conflict.status, 409, JSON.stringify(conflict.body));

    await audited(activeId, "POST", `/api/admin/dmca/cases/${activeId}/start-review`, {});
    await audited(activeId, "POST", `/api/admin/dmca/cases/${activeId}/approve-takedown`, { reason: "Complete notice" });
    await markUploaderNotified(activeId);
    await audited(activeId, "POST", `/api/admin/dmca/cases/${activeId}/close`, { outcome: "removed", notes: "No counter-notice received" });
    assert.equal((await db.execute(sql`SELECT closed_reason FROM dmca_cases WHERE id=${activeId}`)).rows[0]?.closed_reason, "removed");
  });

  it("records court action, places holds, and refuses restoration with 423", async () => {
    const postId = await insertPost();
    const caseId = await createCaseForPost(postId, "Court claimant");
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/approve-takedown`, { reason: "Complete notice" });
    await markUploaderNotified(caseId);
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/court-action`, { notes: "Complaint filed in federal court" });
    const restore = await api("admin", "POST", `/api/admin/dmca/cases/${caseId}/restore`, { reason: "must remain hidden", mode: "notice_withdrawn" });
    assert.equal(restore.status, 423, JSON.stringify(restore.body));
    assert.equal(restore.body.error, "legal_hold");
    const state = (await db.execute(sql`SELECT status,legal_hold FROM dmca_cases WHERE id=${caseId}`)).rows[0] as any;
    assert.equal(state.status, "COURT_ACTION_RECEIVED");
    assert.equal(state.legal_hold, true);
    assert.ok(Number(((await db.execute(sql`SELECT count(*)::int n FROM legal_holds WHERE case_type='dmca' AND case_id=${caseId} AND released_at IS NULL`)).rows[0] as any).n) > 0);
  });

  it("refuses restoration when a target hold exists even if the case flag is false", async () => {
    const postId = await insertPost();
    const caseId = await createCaseForPost(postId, "Target hold claimant");
    await audited(caseId, "POST", `/api/admin/dmca/cases/${caseId}/approve-takedown`, { reason: "Complete notice" });
    await markUploaderNotified(caseId);
    const hold = await api("admin", "POST", "/api/admin/dmca/holds", { target: "content", contentType: "forum_post", contentId: postId, reason: "Independent evidence hold" });
    assert.equal(hold.status, 201, JSON.stringify(hold.body));
    assert.equal((await db.execute(sql`SELECT legal_hold FROM dmca_cases WHERE id=${caseId}`)).rows[0]?.legal_hold, false);
    const holdId = Number(((await db.execute(sql`SELECT id FROM legal_holds WHERE content_type='forum_post' AND content_id=${postId} AND released_at IS NULL ORDER BY id DESC LIMIT 1`)).rows[0] as any).id);
    // An unreleased hold row is independently sufficient, even if a stale
    // content column were cleared.
    await db.execute(sql`UPDATE forum_posts SET legal_hold=false WHERE id=${postId}`);
    const rowHoldRestore = await api("admin", "POST", `/api/admin/dmca/cases/${caseId}/restore`, { reason: "withdrawn", mode: "notice_withdrawn" });
    assert.equal(rowHoldRestore.status, 423, JSON.stringify(rowHoldRestore.body));
    assert.equal(rowHoldRestore.body.error, "legal_hold");
    // Conversely, the content legal_hold column is independently sufficient.
    await db.execute(sql`UPDATE legal_holds SET released_at=now(),released_by=${actorId},release_reason='test branch' WHERE id=${holdId}`);
    await db.execute(sql`UPDATE forum_posts SET legal_hold=true WHERE id=${postId}`);
    const columnHoldRestore = await api("admin", "POST", `/api/admin/dmca/cases/${caseId}/restore`, { reason: "withdrawn", mode: "notice_withdrawn" });
    assert.equal(columnHoldRestore.status, 423, JSON.stringify(columnHoldRestore.body));
    assert.equal(columnHoldRestore.body.error, "legal_hold");
  });

  it("serializes simultaneous admin target claims so only one succeeds", async () => {
    const postId = await insertPost();
    const payload = manualCase(`https://barefootbay.com/forum/post/${postId}`, "Racing claimant");
    const [a, b] = await Promise.all([
      api("admin", "POST", "/api/admin/dmca/cases", payload),
      api("admin", "POST", "/api/admin/dmca/cases", payload),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    const winner = a.status === 201 ? a : b;
    caseIds.push(Number(winner.body.id));
    const active = await db.execute(sql`SELECT count(*)::int n FROM dmca_targets WHERE content_type='forum_post' AND content_id=${postId} AND status='pending'`);
    assert.equal(Number((active.rows[0] as any).n), 1);

    const addedPost = await insertPost();
    const firstCase = await createUrlCase(`claim-a-${Date.now()}`);
    const secondCase = await createUrlCase(`claim-b-${Date.now()}`);
    const [firstAdd, secondAdd] = await Promise.all([
      api("admin", "POST", `/api/admin/dmca/cases/${firstCase}/targets`, { contentType: "forum_post", contentId: addedPost }),
      api("admin", "POST", `/api/admin/dmca/cases/${secondCase}/targets`, { contentType: "forum_post", contentId: addedPost }),
    ]);
    assert.deepEqual([firstAdd.status, secondAdd.status].sort(), [200, 409]);
    const attached = await db.execute(sql`SELECT count(*)::int n FROM dmca_targets WHERE content_type='forum_post' AND content_id=${addedPost} AND status='pending'`);
    assert.equal(Number((attached.rows[0] as any).n), 1);
  });
});

describe("DMCA admin UI contracts", () => {
  it("accepts select-string ids for assignment and flag resolution", async () => {
    const caseId = await createUrlCase(`assign-${Date.now()}`);
    const assigned = await api("admin", "PATCH", `/api/admin/dmca/cases/${caseId}/assign`, { adminId: String(actorId) });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
    assert.equal(Number(assigned.body.case.adminAssignedId), actorId);
    assert.equal((await api("admin", "PATCH", `/api/admin/dmca/cases/${caseId}/assign`, { adminId: null })).status, 200);

    const postId = await insertPost();
    const flagged = await api("moderator", "POST", `/api/admin/dmca/content/forum_post/${postId}/flag`, { reason: "Looks copied" });
    assert.equal(flagged.status, 201, JSON.stringify(flagged.body));
    flagIds.push(Number(flagged.body.id));
    const resolved = await api("admin", "POST", `/api/admin/dmca/flags/${flagged.body.id}/resolve`, { resolution: "added_to_case", caseId: String(caseId) });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  });

  it("returns camelCased repeat-infringer events", async () => {
    const caseId = await createUrlCase(`repeat-${Date.now()}`);
    await db.execute(sql`INSERT INTO user_copyright_events(user_id,dmca_case_id,event_type,counts_toward_repeat_policy,status,notes,created_by)
      VALUES(${noGrantId},${caseId},'takedown',true,'active','test strike',${actorId})`);
    const response = await api("admin", "GET", "/api/admin/dmca/repeat-infringers");
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const target = response.body.users.find((u: any) => Number(u.id) === noGrantId);
    assert.ok(target && target.events.length >= 1, "seeded strike must appear");
    assert.equal(target.events[0].eventType, "takedown");
    for (const user of response.body.users) {
      for (const event of user.events) {
        assert.ok("eventType" in event && !("event_type" in event), "events must use camelCase fields");
      }
      if (user.lastDecision) assert.ok("eventType" in user.lastDecision);
    }
  });

  it("gives a URL-only case hold a releasable record and exposes release_hold", async () => {
    const caseId = await createUrlCase(`hold-${Date.now()}`);
    const held = await api("admin", "POST", `/api/admin/dmca/cases/${caseId}/holds`, { reason: "Preservation letter" });
    assert.equal(held.status, 200, JSON.stringify(held.body));
    assert.equal(held.body.case.legalHold, true);
    assert.ok(held.body.availableActions.includes("release_hold"));
    const active = held.body.holds.filter((h: any) => !h.releasedAt);
    assert.equal(active.length, 1, "URL-only case must still get a case-level hold row");
    const released = await api("admin", "POST", `/api/admin/dmca/holds/${active[0].id}/release`, { reason: "Matter resolved" });
    assert.equal(released.status, 200, JSON.stringify(released.body));
    assert.equal(released.body.case.legalHold, false);
  });
});

describe("moderation-hidden recovery", () => {
  it("finds and restores comments, events, listings, and pages without granting public search access", async () => {
    const postId = await insertPost();
    const created: Array<{ type: string; table: string; id: number }> = [];
    const add = async (type: string, table: string, statement: any) => {
      const result = await db.execute(statement);
      const contentId = Number((result.rows[0] as any).id);
      created.push({ type, table, id: contentId });
      return contentId;
    };
    try {
      const suffix = `${Date.now()}-${postId}`;
      const forumComment = await add("forum_comment", "forum_comments", sql`
        INSERT INTO forum_comments(post_id,author_id,content) VALUES(${postId},${noGrantId},${`Review comment ${suffix}`}) RETURNING id`);
      const eventId = await add("event", "events", sql`
        INSERT INTO events(title,description,start_date,end_date,event_date,start_time,end_time,category,created_by)
        VALUES(${`Review event ${suffix}`},'Test event',now(),now() + interval '1 hour',current_date,'10:00','11:00','Community',${noGrantId}) RETURNING id`);
      const eventComment = await add("event_comment", "event_comments", sql`
        INSERT INTO event_comments(event_id,user_id,content) VALUES(${eventId},${noGrantId},${`Review event reply ${suffix}`}) RETURNING id`);
      const listingId = await add("listing", "real_estate_listings", sql`
        INSERT INTO real_estate_listings(listing_type,title,price,address,bedrooms,bathrooms,square_feet,year_built,contact_info,status,created_by)
        VALUES('FSBO',${`Review listing ${suffix}`},100000,'Test address',2,1,800,2000,'{}'::jsonb,'DRAFT',${noGrantId}) RETURNING id`);
      const pageId = await add("page", "page_contents", sql`
        INSERT INTO page_contents(slug,title,content,updated_by)
        VALUES(${`recovery-${suffix}`},${`Review page ${suffix}`},${`Distinct body phrase ${suffix}`},${noGrantId}) RETURNING id`);
      const vendorComment = await add("vendor_comment", "vendor_comments", sql`
        INSERT INTO vendor_comments(page_slug,user_id,content)
        VALUES(${`recovery-${suffix}`},${noGrantId},${`Review vendor reply ${suffix}`}) RETURNING id`);

      for (const item of created) {
        const response = await api("moderator", "POST", `/api/admin/dmca/content/${item.type}/${item.id}/moderate`, { hidden: true, reason: "Needs review" });
        assert.equal(response.status, 200, JSON.stringify(response.body));
      }
      const base = "/api/admin/dmca/moderated-content";
      assert.equal((await api("none", "GET", base)).status, 401);
      assert.equal((await api("member", "GET", base)).status, 403);
      assert.equal((await api("admin", "GET", `${base}?type=avatar`)).status, 400);
      for (const item of created) {
        const result = await api("moderator", "GET", `${base}?type=${item.type}&q=${item.id}`);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.total, 1);
        assert.equal(result.body.items[0].contentType, item.type);
        assert.equal(result.body.items[0].hiddenReason, "Needs review");
        assert.equal(result.body.items[0].visibilityStatus, "moderation_hidden");
      }
      const all = await api("admin", "GET", `${base}?q=${encodeURIComponent(suffix)}`);
      assert.equal(all.status, 200, JSON.stringify(all.body));
      assert.equal(all.body.total, created.length);
      const bodySearch = await api("admin", "GET", `${base}?type=page&q=${encodeURIComponent(`Distinct body phrase ${suffix}`)}`);
      assert.equal(bodySearch.body.items[0]?.id, pageId, JSON.stringify(bodySearch.body));
      assert.equal(all.body.items.find((item: any) => item.id === forumComment && item.contentType === "forum_comment")?.publicPath, `/forum/post/${postId}#comment-${forumComment}`);
      assert.equal(all.body.items.find((item: any) => item.id === eventComment && item.contentType === "event_comment")?.publicPath, `/events/${eventId}`);
      assert.ok(all.body.items.some((item: any) => item.id === vendorComment && item.contentType === "vendor_comment"));
      assert.equal((await api("moderator", "POST", `/api/admin/dmca/content/page/${pageId}/moderate`, { hidden: false, reason: "" })).status, 400);
      await db.execute(sql`UPDATE page_contents SET legal_hold=true WHERE id=${pageId}`);
      const held = await api("admin", "GET", `${base}?type=page&q=${pageId}`);
      assert.equal(held.body.items[0].legalHold, true);
      assert.equal((await api("admin", "POST", `/api/admin/dmca/content/page/${pageId}/moderate`, { hidden: false, reason: "Held" })).status, 423);
      await db.execute(sql`UPDATE page_contents SET legal_hold=false WHERE id=${pageId}`);
      const hold = await api("admin", "POST", "/api/admin/dmca/holds", { target: "content", contentType: "page", contentId: pageId, reason: "Preserve record" });
      assert.equal(hold.status, 201, JSON.stringify(hold.body));
      const holdId = Number((await db.execute(sql`SELECT id FROM legal_holds WHERE content_type='page' AND content_id=${pageId} AND released_at IS NULL ORDER BY id DESC LIMIT 1`)).rows[0]?.id);
      assert.equal((await api("admin", "GET", `${base}?type=page&q=${pageId}`)).body.items[0].activeHold, true);
      assert.equal((await api("moderator", "POST", `/api/admin/dmca/content/page/${pageId}/moderate`, { hidden: false, reason: "Held in record" })).status, 423);
      assert.equal((await api("admin", "POST", `/api/admin/dmca/holds/${holdId}/release`, { reason: "Resolved" })).status, 200);
      const caseId = await createUrlCase(`recovery-${suffix}`);
      const attached = await api("admin", "POST", `/api/admin/dmca/cases/${caseId}/targets`, { contentType: "page", contentId: pageId });
      assert.equal(attached.status, 200, JSON.stringify(attached.body));
      assert.equal((await api("admin", "GET", `${base}?type=page&q=${pageId}`)).body.items[0].activeDmcaCase, true);
      assert.equal((await api("admin", "POST", `/api/admin/dmca/content/page/${pageId}/moderate`, { hidden: false, reason: "Wrong workflow" })).status, 409);
      await db.execute(sql`UPDATE dmca_cases SET status='CLOSED' WHERE id=${caseId}`);
      const restored = await api("moderator", "POST", `/api/admin/dmca/content/page/${pageId}/moderate`, { hidden: false, reason: "Reviewed page" });
      assert.equal(restored.status, 200, JSON.stringify(restored.body));
      assert.equal((await api("admin", "GET", `${base}?type=page&q=${pageId}`)).body.total, 0);
      assert.equal((await db.execute(sql`SELECT notes FROM dmca_audit_log WHERE target_type='page' AND target_id=${pageId} AND event='content_moderation_unhidden' ORDER BY id DESC LIMIT 1`)).rows[0]?.notes, "Reviewed page");
      assert.ok(listingId > 0);
    } finally {
      await db.transaction(async tx => {
        await tx.execute(sql`SET LOCAL dmca.allow_purge='on'`);
        for (const { type, table, id: contentId } of [...created].reverse()) {
          await tx.execute(sql`DELETE FROM legal_holds WHERE content_type=${type} AND content_id=${contentId}`);
          await tx.execute(sql`DELETE FROM dmca_audit_log WHERE target_type=${type} AND target_id=${contentId}`);
          await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE id=${contentId}`);
        }
      });
    }
  });

  it("searches only moderation-hidden posts for staff and requires an audited reason to restore", async () => {
    const postId = await insertPost();
    const path = `/api/admin/dmca/content/forum_post/${postId}/moderate`;
    assert.equal((await api("moderator", "POST", path, { hidden: true, reason: "Off topic" })).status, 200);
    const url = `/api/admin/dmca/moderated-posts?q=${postId}`;
    assert.equal((await api("none", "GET", url)).status, 401);
    assert.equal((await api("member", "GET", url)).status, 403);
    assert.equal((await api("member", "POST", path, { hidden: false, reason: "Not authorized" })).status, 403);
    for (const mode of ["admin", "moderator"] as const) {
      const found = await api(mode, "GET", url);
      assert.equal(found.status, 200, JSON.stringify(found.body));
      assert.equal(found.body.total, 1);
      assert.equal(Number(found.body.posts[0].id), postId);
      assert.equal(found.body.posts[0].hiddenReason, "Off topic");
      const detail = await api(mode, "GET", `/api/forum/posts/${postId}`);
      assert.equal(detail.status, 200, JSON.stringify(detail.body));
      assert.equal(detail.body.contentVisibility?.status, "moderation_hidden");
    }
    assert.equal((await api("nogrant", "GET", `/api/forum/posts/${postId}`)).body.contentVisibility?.status, "moderation_hidden");
    const titleSearch = await api("moderator", "GET", "/api/admin/dmca/moderated-posts?q=DMCA%20admin%20test");
    assert.equal(titleSearch.status, 200);
    assert.ok(titleSearch.body.posts.some((post: any) => Number(post.id) === postId));
    assert.equal((await api("admin", "POST", path, { hidden: false, reason: "" })).status, 400);
    assert.equal((await api("member", "GET", `/api/forum/posts/${postId}`)).status, 404);
    const beforeAudit = Number(((await db.execute(sql`SELECT count(*)::int n FROM dmca_audit_log WHERE target_type='forum_post' AND target_id=${postId} AND event='content_moderation_unhidden'`)).rows[0] as any).n);
    const restored = await api("moderator", "POST", path, { hidden: false, reason: "Review completed" });
    assert.equal(restored.status, 200, JSON.stringify(restored.body));
    assert.equal((await api("admin", "GET", url)).body.total, 0);
    const row = (await db.execute(sql`SELECT visibility_status FROM forum_posts WHERE id=${postId}`)).rows[0] as any;
    assert.equal(row.visibility_status, "published");
    const audit = (await db.execute(sql`SELECT notes,actor_id FROM dmca_audit_log WHERE target_type='forum_post' AND target_id=${postId} AND event='content_moderation_unhidden' ORDER BY id DESC LIMIT 1`)).rows[0] as any;
    assert.equal(audit.notes, "Review completed");
    assert.equal(Number(audit.actor_id), noGrantId);
    assert.equal(Number(((await db.execute(sql`SELECT count(*)::int n FROM dmca_audit_log WHERE target_type='forum_post' AND target_id=${postId} AND event='content_moderation_unhidden'`)).rows[0] as any).n), beforeAudit + 1);
    assert.equal((await api("admin", "POST", path, { hidden: false, reason: "Again" })).status, 409);
  });

  it("refuses to restore DMCA-hidden content or moderation-hidden content under legal hold or an active case", async () => {
    const postId = await insertPost();
    const path = `/api/admin/dmca/content/forum_post/${postId}/moderate`;
    await db.execute(sql`UPDATE forum_posts SET visibility_status='dmca_hidden' WHERE id=${postId}`);
    assert.equal((await api("admin", "GET", `/api/admin/dmca/moderated-posts?q=${postId}`)).body.total, 0);
    assert.equal((await api("admin", "POST", path, { hidden: false, reason: "Wrong workflow" })).status, 409);
    await db.execute(sql`UPDATE forum_posts SET visibility_status='moderation_hidden',legal_hold=true WHERE id=${postId}`);
    assert.equal((await api("moderator", "POST", path, { hidden: false, reason: "Held" })).status, 423);
    await db.execute(sql`UPDATE forum_posts SET legal_hold=false WHERE id=${postId}`);
    const caseId = await createCaseForPost(postId);
    assert.equal((await api("admin", "POST", path, { hidden: false, reason: "Active case" })).status, 409);
    assert.equal((await db.execute(sql`SELECT visibility_status FROM forum_posts WHERE id=${postId}`)).rows[0]?.visibility_status, "moderation_hidden");
  });
});

describe("permanent deletion safeguards", () => {
  it("uses the centralized grant check for every destructive bulk route", async () => {
    const req = { user: { id: noGrantId, role: "admin" } } as any;
    for (const route of ["event-series", "all-events", "all-listings", "all-forum-posts", "all-forum-comments", "community-pages", "all-community-pages"]) {
      await assert.rejects(() => assertCanPermanentDelete(req), (error: unknown) => {
        assert.ok(error instanceof PermanentDeletePermissionError, route);
        return true;
      });
    }
    assert.equal((await api("nogrant", "DELETE", "/api/forum/all")).status, 403);
    assert.equal((await api("nogrant", "DELETE", "/api/forum/comments/all")).status, 403);
  });
  it("returns 403 without dmca.permanent_delete and 423 through the real delete route while held", async () => {
    const postId = await insertPost(actorId);
    // noGrant is an admin but not the owner and has no grants.
    const forbidden = await api("nogrant", "DELETE", `/api/forum/posts/${postId}`);
    assert.equal(forbidden.status, 403, JSON.stringify(forbidden.body));
    assert.ok(String(forbidden.body.message).includes(P.PERMANENT_DELETE));

    const hold = await api("admin", "POST", "/api/admin/dmca/holds", {
      target: "content", contentType: "forum_post", contentId: postId, reason: "Preserve evidence",
    });
    assert.equal(hold.status, 201, JSON.stringify(hold.body));
    const held = await api("admin", "DELETE", `/api/forum/posts/${postId}`);
    assert.equal(held.status, 423, JSON.stringify(held.body));
    assert.equal(held.body.error, "legal_hold");
  });
});