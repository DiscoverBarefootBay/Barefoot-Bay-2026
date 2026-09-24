import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  acceptCounter, approveTakedown, closeCase, createCase, forwardCounterNotice,
  markUploaderNotified, recordCourtAction, rejectCase, requestMissingInfo, restoreCase,
} from "../dmca/dmca-service";
import { runDmcaSchedulerTick } from "../dmca/dmca-scheduler";
import { runLeakageCheck } from "../dmca/leakage-checker";
import { __setQuarantineTestHooks, candidateObjectKeys } from "../dmca/quarantine";
import { DmcaPermission } from "../dmca/permissions";
import dmcaUploaderRouter from "../routes/dmca-uploader";
import { createForumRouter } from "../routes/forum";
import { storage } from "../storage";

const cases: number[] = [], posts: number[] = [], messages: number[] = [];
const caseNumbers: string[] = [];
const grants: string[] = [];
const objects = new Map<string, Buffer>();
let adminId = 0, uploaderId = 0, categoryId = 0;
let server: ReturnType<ReturnType<typeof express>["listen"]>, origin = "";
const actor = () => ({ type: "admin" as const, id: adminId });
const counter = {
  materialIdentification: "Test forum post and image", formerLocation: "https://barefootbay.com/forum/test",
  perjuryStatement: true, name: "Test Uploader", address: "1 Test Street",
  phone: "555-0101", email: "uploader@example.test", jurisdictionConsent: true,
  serviceOfProcessConsent: true, signature: "Test Uploader",
};

async function postFixture(withFile = false) {
  const fileUrl = withFile ? `/api/storage-proxy/direct-forum/e2e-${Date.now()}-${posts.length}.jpg` : null;
  if (fileUrl) objects.set(candidateObjectKeys(fileUrl)[0], Buffer.from("e2e evidence"));
  const row = await db.execute(sql`
    INSERT INTO forum_posts(title,content,category_id,user_id,media_urls)
    VALUES(${`DMCA e2e ${Date.now()}`},'throwaway',${categoryId},${uploaderId},
      ARRAY[${fileUrl}]::text[]) RETURNING id`);
  const id = Number((row.rows[0] as any).id); posts.push(id);
  return { id, fileUrl };
}

async function notice(postId: number) {
  const c = await createCase({
    actor: actor(), claimant: { name: "E2E Claimant", email: "claimant@example.test", workDescription: "Original photograph" },
    submission: { submissionType: "notice", formPayload: { complete: true } },
    targets: [{ contentType: "forum_post", contentId: postId, originalUrl: `/forum/post/${postId}` }],
    submittedVia: "admin_entry",
  });
  cases.push(c.id); caseNumbers.push(c.caseNumber); return c;
}

async function uploaderApi(method: string, path: string, body?: unknown) {
  const response = await fetch(`${origin}${path}`, {
    method, headers: { "content-type": "application/json", "x-e2e-user": String(uploaderId) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.text() };
}

before(async () => {
  const seed = await db.execute(sql`
    SELECT u.id,(SELECT id FROM forum_categories ORDER BY id LIMIT 1) category_id
    FROM users u WHERE u.email IS NOT NULL ORDER BY u.id LIMIT 2`);
  assert.equal(seed.rows.length, 2);
  adminId = Number((seed.rows[0] as any).id); uploaderId = Number((seed.rows[1] as any).id);
  categoryId = Number((seed.rows[0] as any).category_id);
  for (const permission of Object.values(DmcaPermission)) {
    const r = await db.execute(sql`
      INSERT INTO dmca_permission_grants(user_id,permission,granted_by)
      VALUES(${adminId},${permission},${adminId}) ON CONFLICT DO NOTHING RETURNING permission`);
    if (r.rows.length) grants.push(permission);
  }
  __setQuarantineTestHooks({ adapter: {
    async get(key) { return objects.get(key) ?? null; },
    async put(key, data) { objects.set(key, Buffer.from(data)); },
    async del(key) { objects.delete(key); },
  } });
  const app = express(); app.set("trust proxy", 1); app.use(express.json());
  app.use((req: any, _res, next) => {
    req.isAuthenticated = () => !!req.headers["x-e2e-user"];
    if (req.isAuthenticated()) req.user = { id: uploaderId, role: "user", username: "e2e-uploader" };
    next();
  });
  app.use("/api/dmca", dmcaUploaderRouter);
  app.use("/api/forum", createForumRouter(storage));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const addr = server.address(); if (!addr || typeof addr === "string") throw new Error("bind failed");
  origin = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  __setQuarantineTestHooks({ adapter: null, localRoot: null });
  if (posts.length) await db.execute(sql`
    UPDATE forum_posts SET visibility_status='published',legal_hold=false,dmca_case_id=NULL
    WHERE id IN (${sql.join(posts.map(id => sql`${id}`), sql`,`)})`);
  await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL dmca.allow_purge='on'`);
    if (cases.length) {
      const ids = sql.join(cases.map(id => sql`${id}`), sql`,`);
      for (const caseNumber of caseNumbers) {
        const ms = await tx.execute(sql`
          SELECT DISTINCT m.id FROM messages m JOIN message_recipients r ON r.message_id=m.id
          WHERE r.recipient_id=${uploaderId} AND m.message_type='system'
            AND m.content LIKE ${`%${caseNumber}%`}`);
        messages.push(...ms.rows.map((r: any) => Number(r.id)));
      }
      if (messages.length) {
        const mids = sql.join([...new Set(messages)].map(id => sql`${id}`), sql`,`);
        await tx.execute(sql`DELETE FROM message_recipients WHERE message_id IN (${mids})`);
        await tx.execute(sql`DELETE FROM messages WHERE id IN (${mids})`);
      }
      await tx.execute(sql`DELETE FROM notification_outbox WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_admin_alerts WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM user_copyright_events WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_quarantined_objects WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM legal_holds WHERE case_type='dmca' AND case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_audit_log WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_submissions WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_targets WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_cases WHERE id IN (${ids})`);
    }
    if (posts.length) await tx.execute(sql`DELETE FROM forum_posts WHERE id IN (${sql.join(posts.map(id => sql`${id}`), sql`,`)})`);
    for (const p of grants) await tx.execute(sql`DELETE FROM dmca_permission_grants WHERE user_id=${adminId} AND permission=${p}`);
  });
});

describe("DMCA flowchart end-to-end", () => {
  it("closes an incomplete notice after review without action", async () => {
    const p = await postFixture(), c = await notice(p.id);
    await requestMissingInfo(c.id, { reasons: ["ownership"], message: "Please provide ownership evidence" }, actor());
    await rejectCase(c.id, "Required information was not supplied", actor());
    const row = (await db.execute(sql`SELECT status,closed_reason FROM dmca_cases WHERE id=${c.id}`)).rows[0] as any;
    assert.deepEqual({ status: row.status, reason: row.closed_reason }, { status: "CLOSED", reason: "rejected_no_action" });
    assert.equal((await db.execute(sql`SELECT visibility_status FROM forum_posts WHERE id=${p.id}`)).rows[0]?.visibility_status, "published");
  });

  it("takes down and quarantines, returns public 404, notifies, and closes while removed", async () => {
    const p = await postFixture(true), c = await notice(p.id);
    await approveTakedown(c.id, actor(), "Valid notice", true);
    assert.equal((await fetch(`${origin}/api/forum/posts/${p.id}`)).status, 404);
    assert.equal(objects.has(candidateObjectKeys(p.fileUrl!)[0]), false);
    await markUploaderNotified(c.id);
    await closeCase(c.id, "removed", "No counter-notice received", actor());
    assert.equal((await db.execute(sql`SELECT visibility_status FROM forum_posts WHERE id=${p.id}`)).rows[0]?.visibility_status, "dmca_hidden");
    const effects = await db.execute(sql`
      SELECT
       (SELECT count(*) FROM notification_outbox WHERE dmca_case_id=${c.id})::int outbox,
       (SELECT count(*) FROM messages m JOIN message_recipients r ON r.message_id=m.id
        WHERE r.recipient_id=${uploaderId} AND m.content LIKE ${`%${c.caseNumber}%`})::int inbox`);
    assert.ok(Number((effects.rows[0] as any).outbox) >= 2);
    assert.ok(Number((effects.rows[0] as any).inbox) >= 2);
  });

  it("accepts and forwards an uploader counter-notice, reaches eligibility, restores, notifies, and closes", async () => {
    const p = await postFixture(), c = await notice(p.id);
    await approveTakedown(c.id, actor(), "Valid notice", true);
    assert.equal((await uploaderApi("POST", `/api/dmca/my-cases/${c.caseNumber}/counter-notice`, counter)).status, 201);
    await acceptCounter(c.id, actor());
    const window = await forwardCounterNotice(c.id, actor());
    const forwarded = (await db.execute(sql`
      SELECT payload FROM notification_outbox
      WHERE dmca_case_id=${c.id} AND event_type='dmca.claimant_counter_forward'`)).rows[0] as any;
    assert.equal(forwarded.payload.data.counterNotice.formerLocation, counter.formerLocation);
    assert.match(forwarded.payload.data.counterNotice.perjuryStatement, /under penalty of perjury/);
    assert.match(forwarded.payload.data.counterNotice.jurisdictionConsent, /Federal District Court/);
    assert.match(forwarded.payload.data.counterNotice.serviceOfProcessConsent, /accept service of process/);
    await runDmcaSchedulerTick({ now: window.restoreDeadlineAt, emailEnabled: false });
    assert.equal((await db.execute(sql`SELECT status FROM dmca_cases WHERE id=${c.id}`)).rows[0]?.status, "RESTORATION_ELIGIBLE");
    await restoreCase({ caseId: c.id, actor: actor(), reason: "Statutory waiting period elapsed", notify: true, mode: "counter_notice" });
    await closeCase(c.id, "restored", "Restored", actor());
    assert.equal((await fetch(`${origin}/api/forum/posts/${p.id}`)).status, 200);
    const types = (await db.execute(sql`SELECT event_type FROM notification_outbox WHERE dmca_case_id=${c.id}`)).rows.map((r: any) => r.event_type);
    for (const type of ["dmca.uploader_restored_notice", "dmca.claimant_restored_notice", "dmca.claimant_closure_notice", "dmca.uploader_closure_notice"])
      assert.ok(types.includes(type), type);
  });

  it("court action places a hold, blocks restore, suppresses reminders, and leaves content removed", async () => {
    const p = await postFixture(), c = await notice(p.id);
    await approveTakedown(c.id, actor(), "Valid notice", false);
    assert.equal((await uploaderApi("POST", `/api/dmca/my-cases/${c.caseNumber}/counter-notice`, counter)).status, 201);
    await acceptCounter(c.id, actor()); const window = await forwardCounterNotice(c.id, actor());
    await recordCourtAction({ caseId: c.id, actor: actor(), submission: { formPayload: { filed: true } }, reason: "Complaint filed" });
    await assert.rejects(
      () => restoreCase({ caseId: c.id, actor: actor(), reason: "must remain held", notify: false }),
      (e: any) => e.statusCode === 423,
    );
    await runDmcaSchedulerTick({ now: window.restoreDeadlineAt, emailEnabled: false });
    const reminders = await db.execute(sql`
      SELECT 1 FROM dmca_admin_alerts WHERE dmca_case_id=${c.id}
      AND alert_type LIKE 'restoration_%'`);
    assert.equal(reminders.rows.length, 0);
    assert.equal((await db.execute(sql`SELECT visibility_status FROM forum_posts WHERE id=${p.id}`)).rows[0]?.visibility_status, "dmca_hidden");
  });

  it("refuses a mixed-uploader takedown rather than letting one uploader control another's content", async () => {
    const p = await postFixture(), c = await notice(p.id);
    const second = (await db.execute(sql`SELECT id FROM users WHERE id NOT IN (${adminId},${uploaderId}) LIMIT 1`)).rows[0] as any;
    assert.ok(second, "test needs a second uploader");
    const extra = await db.execute(sql`
      INSERT INTO forum_posts(title,content,category_id,user_id)
      VALUES('Other uploader DMCA fixture','content',${categoryId},${Number(second.id)}) RETURNING id`);
    const extraId = Number((extra.rows[0] as any).id); posts.push(extraId);
    await db.execute(sql`
      INSERT INTO dmca_targets(dmca_case_id,content_type,content_id,original_url,uploader_user_id,status)
      VALUES(${c.id},'forum_post',${extraId},${`/forum/post/${extraId}`},${Number(second.id)},'pending')`);
    await assert.rejects(() => approveTakedown(c.id, actor(), "Claim accepted"),
      (e: any) => e.statusCode === 409 && /different or unattributed uploaders/.test(e.message));
    assert.equal((await db.execute(sql`SELECT visibility_status FROM forum_posts WHERE id=${p.id}`)).rows[0]?.visibility_status, "published");
  });

  it("does not let a named uploader control an unattributed URL-only target", async () => {
    const p = await postFixture(), c = await notice(p.id);
    await db.execute(sql`
      INSERT INTO dmca_targets(dmca_case_id,content_type,content_id,original_url,uploader_user_id,status)
      VALUES(${c.id},'url',NULL,'https://barefootbay.com/unknown',NULL,'pending')`);
    await assert.rejects(() => approveTakedown(c.id, actor(), "Claim accepted"),
      (e: any) => e.statusCode === 409 && /unattributed/.test(e.message));
  });

  it("finds no real hidden-item leak, then alerts on a simulated public regression", async () => {
    const p = await postFixture(), c = await notice(p.id);
    await approveTakedown(c.id, actor(), "Valid notice", false);
    const real = await runLeakageCheck({ baseUrl: origin });
    assert.equal(real.failures.filter(f => f.caseNumber === c.caseNumber).length, 0);
    const simulated = await runLeakageCheck({
      baseUrl: origin,
      fetchImpl: (async (input: string | URL | Request) =>
        String(input).includes(`/forum/post/${p.id}`)
          ? new Response(`<article>${p.id}</article>`, { status: 200 })
          : new Response("Not found", { status: 404 })) as typeof fetch,
    });
    assert.ok(simulated.failures.some(f => f.caseNumber === c.caseNumber && f.check === "public_page"));
    assert.ok((await db.execute(sql`
      SELECT 1 FROM dmca_admin_alerts WHERE dmca_case_id=${c.id}
      AND alert_type='content_exposure'`)).rows.length);
  });
});