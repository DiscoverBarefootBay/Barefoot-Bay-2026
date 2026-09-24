import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { runDmcaSchedulerTick } from "../dmca/dmca-scheduler";
import { runLeakageCheck } from "../dmca/leakage-checker";
import { addBusinessDays } from "../dmca/business-days";

const caseIds: number[] = [];
const postIds: number[] = [];
let userId = 0;
let categoryId = 0;
let savedSettings: any;

async function addCase(status: string, fields: Record<string, unknown> = {}) {
  const suffix = `${Date.now()}-${caseIds.length}`;
  const row = await db.execute(sql`
    INSERT INTO dmca_cases
      (case_number,status,status_token,received_at,claimant_counter_notified_at,
       restore_eligible_at,restore_deadline_at,legal_hold,court_action_received_at)
    VALUES
      (${`BB-DMCA-SCHED-${suffix}`},${status},${`sched-${suffix}`},
       ${fields.receivedAt ?? new Date()},${fields.counterAt ?? null},
       ${fields.eligibleAt ?? null},${fields.deadlineAt ?? null},
       ${fields.legalHold ?? false},${fields.courtAt ?? null})
    RETURNING id,case_number`);
  const result = row.rows[0] as any;
  caseIds.push(Number(result.id));
  return result;
}

async function alertTypes(caseId: number) {
  const rows = await db.execute(sql`
    SELECT alert_type,severity FROM dmca_admin_alerts
    WHERE dmca_case_id=${caseId} ORDER BY id`);
  return (rows.rows as any[]).map(row => `${row.alert_type}:${row.severity}`);
}

before(async () => {
  const seed = await db.execute(sql`
    SELECT u.id user_id,c.id category_id FROM users u CROSS JOIN forum_categories c LIMIT 1`);
  assert.ok(seed.rows.length);
  userId = Number((seed.rows[0] as any).user_id);
  categoryId = Number((seed.rows[0] as any).category_id);
  savedSettings = (await db.execute(sql`
    SELECT reminder_offsets,registration_expires_at FROM dmca_settings WHERE id=1`)).rows[0];
});

after(async () => {
  if (postIds.length) await db.execute(sql`
    UPDATE forum_posts SET visibility_status='published',legal_hold=false,dmca_case_id=NULL
    WHERE id IN (${sql.join(postIds.map(id => sql`${id}`), sql`,`)})`);
  await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL dmca.allow_purge='on'`);
    if (caseIds.length) {
      const ids = sql.join(caseIds.map(id => sql`${id}`), sql`,`);
      await tx.execute(sql`DELETE FROM notification_outbox WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_admin_alerts WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_quarantined_objects WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_audit_log WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_targets WHERE dmca_case_id IN (${ids})`);
      await tx.execute(sql`DELETE FROM dmca_cases WHERE id IN (${ids})`);
    }
    await tx.execute(sql`DELETE FROM dmca_admin_alerts WHERE dedupe_key LIKE 'sched:agent:%:2026-10-01'`);
    if (postIds.length) await tx.execute(sql`
      DELETE FROM forum_posts WHERE id IN (${sql.join(postIds.map(id => sql`${id}`), sql`,`)})`);
  });
  await db.execute(sql`
    UPDATE dmca_settings SET reminder_offsets=${JSON.stringify(savedSettings.reminder_offsets)}::jsonb,
      registration_expires_at=${savedSettings.registration_expires_at} WHERE id=1`);
});

describe("DMCA scheduler", () => {
  it("waits until the exact day-10 deadline without stopping other cases", async () => {
    const start = new Date("2026-09-01T18:00:00.000Z");
    const eligibleAt = addBusinessDays(start, 10);
    const c = await addCase("WAITING_FOR_RESTORATION_WINDOW", {
      counterAt: start, eligibleAt, deadlineAt: addBusinessDays(start, 14),
    });
    const other = await addCase("RECEIVED", { receivedAt: start });
    await runDmcaSchedulerTick({ now: new Date(eligibleAt.getTime() - 60_000), emailEnabled: false });
    assert.equal((await db.execute(sql`SELECT status FROM dmca_cases WHERE id=${c.id}`)).rows[0]?.status, "WAITING_FOR_RESTORATION_WINDOW");
    assert.ok((await alertTypes(other.id)).includes("untouched_notice:warning"));
    await runDmcaSchedulerTick({ now: eligibleAt, emailEnabled: false });
    assert.equal((await db.execute(sql`SELECT status FROM dmca_cases WHERE id=${c.id}`)).rows[0]?.status, "RESTORATION_ELIGIBLE");
  });
  it("raises each restoration-window alert, advances status but never restores, and is idempotent", async () => {
    const start = new Date("2026-09-01T12:00:00.000Z");
    const c = await addCase("CLAIMANT_NOTIFIED_OF_COUNTER", {
      counterAt: start,
      eligibleAt: new Date("2026-09-15T12:00:00.000Z"),
      deadlineAt: new Date("2026-09-21T12:00:00.000Z"),
    });
    await db.execute(sql`
      INSERT INTO dmca_targets(dmca_case_id,content_type,content_id,uploader_user_id,status)
      VALUES(${c.id},'forum_post',NULL,${userId},'taken_down')`);

    await runDmcaSchedulerTick({ now: addBusinessDays(start, 8), emailEnabled: false });
    assert.ok((await alertTypes(c.id)).includes("restoration_day8:info"));
    await runDmcaSchedulerTick({ now: addBusinessDays(start, 10), emailEnabled: false });
    assert.equal((await db.execute(sql`SELECT status FROM dmca_cases WHERE id=${c.id}`)).rows[0]?.status, "RESTORATION_ELIGIBLE");
    assert.ok((await alertTypes(c.id)).includes("restoration_eligible:warning"));
    assert.equal((await db.execute(sql`SELECT status FROM dmca_targets WHERE dmca_case_id=${c.id}`)).rows[0]?.status, "taken_down");
    await runDmcaSchedulerTick({ now: addBusinessDays(start, 12), emailEnabled: false });
    assert.ok((await alertTypes(c.id)).includes("restoration_day12:warning"));
    await runDmcaSchedulerTick({ now: addBusinessDays(start, 13), emailEnabled: false });
    assert.ok((await alertTypes(c.id)).includes("restoration_deadline:critical"));
    const count = (await alertTypes(c.id)).length;
    await runDmcaSchedulerTick({ now: addBusinessDays(start, 13), emailEnabled: false });
    assert.equal((await alertTypes(c.id)).length, count);
  });

  it("skips held court cases, escalates untouched notices, and reminds before agent expiry", async () => {
    const held = await addCase("COURT_ACTION_RECEIVED", {
      counterAt: new Date("2026-09-01T12:00:00Z"), legalHold: true,
      courtAt: new Date("2026-09-02T12:00:00Z"),
    });
    const untouched = await addCase("RECEIVED", { receivedAt: new Date("2026-09-01T12:00:00Z") });
    await db.execute(sql`
      UPDATE dmca_settings SET registration_expires_at='2026-10-01',
      reminder_offsets=coalesce(reminder_offsets,'{}'::jsonb) ||
        '{"agentRenewalReminderDays":[90,30,7]}'::jsonb WHERE id=1`);
    await runDmcaSchedulerTick({ now: new Date("2026-09-24T12:00:00Z"), emailEnabled: false });
    assert.deepEqual(await alertTypes(held.id), []);
    assert.ok((await alertTypes(untouched.id)).includes("untouched_notice:warning"));
    const renewal = await db.execute(sql`
      SELECT alert_type,severity FROM dmca_admin_alerts
      WHERE alert_type='agent_registration_expiry' AND created_at > now()-interval '5 minutes'`);
    assert.ok(renewal.rows.some((row: any) => row.severity === "critical"));
  });
});

describe("DMCA leakage checker", () => {
  it("detects a hidden item even when its takedown target record is missing", async () => {
    const c = await addCase("CONTENT_REMOVED");
    const post = await db.execute(sql`
      INSERT INTO forum_posts(title,content,category_id,user_id,visibility_status,dmca_case_id)
      VALUES('Orphaned hidden DMCA item','hidden',${categoryId},${userId},'dmca_hidden',${c.id})
      RETURNING id`);
    const postId = Number((post.rows[0] as any).id);
    postIds.push(postId);
    const fetched = await runLeakageCheck({
      baseUrl: "http://example.test",
      fetchImpl: (async (input: string | URL | Request) => String(input).includes(`/api/forum/posts/${postId}`)
        ? new Response(JSON.stringify({ id: postId, title: "Orphaned hidden DMCA item" }))
        : new Response("Not found", { status: 404 })) as typeof fetch,
    });
    assert.ok(fetched.failures.some(f => f.caseNumber === c.case_number && f.check === "public_api"));
  });
  it("alerts and audits page, API, file, search, and sitemap exposure; clean responses do not alert", async () => {
    const post = await db.execute(sql`
      INSERT INTO forum_posts(title,content,category_id,user_id,visibility_status)
      VALUES(${"Unique leakage title"},${"hidden"},${categoryId},${userId},'published') RETURNING id`);
    const postId = Number((post.rows[0] as any).id);
    postIds.push(postId);
    const c = await addCase("CONTENT_REMOVED");
    const target = await db.execute(sql`
      INSERT INTO dmca_targets(dmca_case_id,content_type,content_id,original_url,uploader_user_id,status)
      VALUES(${c.id},'forum_post',${postId},${`/forum/post/${postId}`},${userId},'taken_down') RETURNING id`);
    await db.execute(sql`UPDATE forum_posts SET visibility_status='dmca_hidden',dmca_case_id=${c.id} WHERE id=${postId}`);
    await db.execute(sql`
      INSERT INTO dmca_quarantined_objects
        (dmca_case_id,dmca_target_id,original_url,file_basename,storage_location,status)
      VALUES(${c.id},${Number((target.rows[0] as any).id)},${`/files/leak-${postId}.jpg`},
        ${`leak-${postId}.jpg`},'object_storage','quarantined')`);

    const removed = () => new Response("Not found", { status: 404 });
    for (const check of ["public_page", "public_api", "file_url", "search", "sitemap"] as const) {
      const fetchImpl = async (input: string | URL | Request) => {
        const url = String(input);
        if (check === "public_page" && url.includes(`/forum/post/${postId}`)) return new Response("visible page");
        if (check === "public_api" && url.includes(`/api/forum/posts/${postId}`)) return new Response(JSON.stringify({ id: postId }));
        if (check === "file_url" && url.includes(`/files/leak-${postId}.jpg`)) return new Response("bytes");
        if (check === "search" && url.includes("/api/search?")) return new Response(JSON.stringify({ id: postId, title: "Unique leakage title" }));
        if (check === "sitemap" && url.endsWith("/sitemap.xml")) return new Response(`<loc>/forum/post/${postId}</loc>`);
        return removed();
      };
      const result = await runLeakageCheck({ baseUrl: "http://example.test", fetchImpl: fetchImpl as typeof fetch });
      assert.ok(result.failures.some(f => f.caseNumber === c.case_number && f.check === check), check);
    }
    const alerts = await db.execute(sql`
      SELECT alert_type,severity FROM dmca_admin_alerts WHERE dmca_case_id=${c.id}`);
    assert.equal(alerts.rows.filter((row: any) => row.alert_type === "content_exposure" && row.severity === "critical").length, 5);
    const audits = await db.execute(sql`
      SELECT count(*)::int n FROM dmca_audit_log
      WHERE dmca_case_id=${c.id} AND event='dmca_content_exposure'`);
    assert.equal(Number((audits.rows[0] as any).n), 5);
    const before = alerts.rows.length;
    await runLeakageCheck({ baseUrl: "http://example.test", fetchImpl: (async () => removed()) as typeof fetch });
    assert.equal((await alertTypes(c.id)).length, before);
  });
});