import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  checkRepeatInfringerThreshold, createCase, DmcaValidationError, executeTakedown,
  recordRepeatInfringerDecision, restoreCase, submitCounterNoticeByUploader,
  transitionCase, UPLOADER_COUNTER_FIELDS,
} from "../dmca/dmca-service";
import {
  UPLOADER_DMCA_TEMPLATE_STATUS, uploaderClosureEmail, uploaderRestorationEmail,
  uploaderTakedownEmail,
} from "../dmca/email-templates";
import dmcaUploaderRouter from "../routes/dmca-uploader";
import { DmcaCaseStatus as S } from "../dmca/state-machine";
import { DmcaPermission } from "../dmca/permissions";
import { __setQuarantineTestHooks } from "../dmca/quarantine";

const validCounterNotice: Record<string, unknown> = {
  materialIdentification: "Forum post and attached photograph",
  formerLocation: "https://barefootbay.com/forum/post/123",
  perjuryStatement: true,
  name: "Uploader Person",
  address: "123 Main Street, Barefoot Bay, FL 32976",
  phone: "555-0100",
  email: "uploader@example.com",
  jurisdictionConsent: true,
  serviceOfProcessConsent: true,
  signature: "Uploader Person",
};

describe("DMCA uploader counter-notice validation", () => {
  for (const field of UPLOADER_COUNTER_FIELDS) {
    it(`rejects a missing ${field} before persistence`, async () => {
      const payload = { ...validCounterNotice };
      delete payload[field];
      await assert.rejects(
        submitCounterNoticeByUploader(1, 1, payload, { ipAddress: "127.0.0.1", userAgent: "test" }),
        (error: unknown) => error instanceof DmcaValidationError && !!error.fieldErrors[field],
      );
    });
  }

  it("rejects an invalid email before persistence", async () => {
    await assert.rejects(
      submitCounterNoticeByUploader(1, 1, { ...validCounterNotice, email: "not-an-email" }, { ipAddress: null, userAgent: null }),
      (error: unknown) => error instanceof DmcaValidationError && !!error.fieldErrors.email,
    );
  });
});

describe("DMCA uploader notice templates", () => {
  it("contains every required takedown field without unrelated internal notes", () => {
    const message = uploaderTakedownEmail({
      caseNumber: "DMCA-2026-000001",
      name: "Uploader",
      items: ["forum post #123 — Original URL: https://barefootbay.com/forum/post/123"],
      disabledAt: new Date("2026-09-26T12:00:00.000Z"),
      claimantName: "Claimant Company",
      workDescription: "A described photograph",
      counterNoticeUrl: "https://barefootbay.com/copyright-notices/DMCA-2026-000001/counter-notice",
    });
    for (const expected of [
      "DMCA-2026-000001", "forum post #123", "https://barefootbay.com/forum/post/123",
      "2026-09-26T12:00:00.000Z", "Claimant Company", "A described photograph",
      "/counter-notice", `Template status: ${UPLOADER_DMCA_TEMPLATE_STATUS}`,
    ]) assert.match(message.text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(message.text, /internal note/i);
  });

  it("marks restoration and closure templates pending counsel review", () => {
    const restored = uploaderRestorationEmail({ caseNumber: "DMCA-1", caseUrl: "/copyright-notices/DMCA-1" });
    const closed = uploaderClosureEmail("DMCA-1", "restored", "/copyright-notices/DMCA-1");
    assert.match(restored.text, /Template status: pending counsel review/);
    assert.match(closed.text, /Template status: pending counsel review/);
  });
});

describe("DMCA uploader routes and persistence", () => {
  const caseIds: number[] = [];
  const caseNumbers: string[] = [];
  const postIds: number[] = [];
  const messageIds: number[] = [];
  let actorId = 0;
  let uploaderId = 0;
  let otherId = 0;
  let categoryId = 0;
  let oldThreshold = 0;
  const granted: string[] = [];
  let server: ReturnType<ReturnType<typeof express>["listen"]>;
  let origin = "";

  async function api(as: "uploader" | "other" | "none", method: string, path: string, body?: unknown) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-test-user": as },
      body: body == null || method === "GET" ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  before(async () => {
    const seed = await db.execute(sql`
      SELECT u.id,(SELECT id FROM forum_categories ORDER BY id LIMIT 1) category_id
      FROM users u WHERE u.email IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM user_copyright_events e WHERE e.user_id=u.id)
        AND NOT EXISTS (SELECT 1 FROM dmca_repeat_infringer_reviews r WHERE r.user_id=u.id)
        AND NOT EXISTS (SELECT 1 FROM dmca_submissions s WHERE s.submitted_by_user_id=u.id AND s.submission_type='notice')
        AND NOT EXISTS (SELECT 1 FROM dmca_targets t JOIN dmca_cases c ON c.id=t.dmca_case_id
          WHERE t.uploader_user_id=u.id AND c.takedown_at IS NOT NULL)
      ORDER BY u.id LIMIT 3`);
    assert.equal(seed.rows.length, 3, "three users with email are required");
    [actorId, uploaderId, otherId] = seed.rows.map((r: any) => Number(r.id));
    categoryId = Number((seed.rows[0] as any).category_id);
    for (const permission of [DmcaPermission.REVIEW, DmcaPermission.TAKEDOWN, DmcaPermission.RESTORE, DmcaPermission.MANAGE_REPEAT_INFRINGER]) {
      const inserted = await db.execute(sql`
        INSERT INTO dmca_permission_grants(user_id,permission,granted_by)
        VALUES(${actorId},${permission},${actorId}) ON CONFLICT DO NOTHING RETURNING permission`);
      if (inserted.rows.length) granted.push(permission);
    }
    oldThreshold = Number((await db.execute(sql`
      SELECT repeat_infringer_threshold FROM dmca_settings WHERE id=1`)).rows[0]?.repeat_infringer_threshold);
    await db.execute(sql`UPDATE dmca_settings SET repeat_infringer_threshold=1 WHERE id=1`);
    __setQuarantineTestHooks({
      adapter: { async get() { return null; }, async put() {}, async del() {} },
    });
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.use((req: any, _res, next) => {
      const id = req.headers["x-test-user"] === "other" ? otherId : uploaderId;
      req.isAuthenticated = () => req.headers["x-test-user"] !== "none";
      if (req.isAuthenticated()) req.user = { id, username: `uploader-${id}`, role: "user" };
      next();
    });
    app.use("/api/dmca", dmcaUploaderRouter);
    app.use((error: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ message: error?.message || String(error) }));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    origin = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    __setQuarantineTestHooks({ adapter: null, localRoot: null });
    await db.execute(sql`UPDATE dmca_settings SET repeat_infringer_threshold=${oldThreshold} WHERE id=1`);
    if (postIds.length) await db.execute(sql`
      UPDATE forum_posts SET visibility_status='published',legal_hold=false,dmca_case_id=NULL
      WHERE id IN (${sql.join(postIds.map(id => sql`${id}`), sql`,`)})`);
    await db.transaction(async tx => {
      await tx.execute(sql`SET LOCAL dmca.allow_purge='on'`);
      if (caseIds.length) {
        const ids = sql.join(caseIds.map(id => sql`${id}`), sql`,`);
        for (const caseNumber of caseNumbers) {
          const messages = await tx.execute(sql`
            SELECT DISTINCT m.id FROM messages m JOIN message_recipients r ON r.message_id=m.id
            WHERE r.recipient_id=${uploaderId} AND m.message_type='system'
              AND m.content LIKE ${`%${caseNumber}%`}`);
          messageIds.push(...messages.rows.map((r: any) => Number(r.id)));
        }
        if (messageIds.length) {
          const mids = sql.join([...new Set(messageIds)].map(id => sql`${id}`), sql`,`);
          await tx.execute(sql`DELETE FROM message_recipients WHERE message_id IN (${mids})`);
          await tx.execute(sql`DELETE FROM messages WHERE id IN (${mids})`);
        }
        await tx.execute(sql`DELETE FROM notification_outbox WHERE dmca_case_id IN (${ids})`);
        await tx.execute(sql`DELETE FROM dmca_admin_alerts WHERE dmca_case_id IN (${ids}) OR user_id=${uploaderId}`);
        await tx.execute(sql`DELETE FROM dmca_repeat_infringer_reviews WHERE user_id=${uploaderId}`);
        await tx.execute(sql`DELETE FROM user_copyright_events WHERE dmca_case_id IN (${ids})`);
        await tx.execute(sql`DELETE FROM dmca_quarantined_objects WHERE dmca_case_id IN (${ids})`);
        await tx.execute(sql`DELETE FROM dmca_audit_log WHERE dmca_case_id IN (${ids})`);
        await tx.execute(sql`DELETE FROM dmca_submissions WHERE dmca_case_id IN (${ids})`);
        await tx.execute(sql`DELETE FROM dmca_targets WHERE dmca_case_id IN (${ids})`);
        await tx.execute(sql`DELETE FROM dmca_cases WHERE id IN (${ids})`);
      }
      if (postIds.length) await tx.execute(sql`
        DELETE FROM forum_posts WHERE id IN (${sql.join(postIds.map(id => sql`${id}`), sql`,`)})`);
      for (const permission of granted)
        await tx.execute(sql`DELETE FROM dmca_permission_grants WHERE user_id=${actorId} AND permission=${permission}`);
    });
  });

  it("shows only account-linked claims, including closed ones, without exposing status tokens", async () => {
    assert.equal((await api("none", "GET", "/api/dmca/my-activity")).status, 401);
    assert.equal((await api("none", "GET", "/api/dmca/my-claims")).status, 401);
    assert.equal((await api("uploader", "GET", "/api/dmca/my-activity")).body.hasActivity, false);
    const before = await api("uploader", "GET", "/api/dmca/my-claims");
    const created = await createCase({
      actor: { type: "public", id: null },
      claimant: { name: "Claim owner" },
      submission: { submissionType: "notice", submittedByUserId: uploaderId, formPayload: {} },
      targets: [{ contentType: "url", contentId: null, originalUrl: "https://barefootbay.com/not-found" }],
      submittedVia: "web_form",
    });
    caseIds.push(created.id);
    caseNumbers.push(created.caseNumber);
    const owned = await api("uploader", "GET", "/api/dmca/my-claims");
    assert.equal(owned.body.claims.length, before.body.claims.length + 1);
    assert.ok(owned.body.claims.some((claim: any) => claim.caseNumber === created.caseNumber && claim.status === "Received"));
    assert.equal((await api("uploader", "GET", "/api/dmca/my-activity")).body.hasActivity, true);
    assert.equal((await api("other", "GET", "/api/dmca/my-claims")).body.claims.some((claim: any) => claim.caseNumber === created.caseNumber), false);
    assert.equal((await api("other", "GET", "/api/dmca/my-activity")).body.hasActivity, false);
    assert.equal(JSON.stringify(owned.body).includes(created.statusToken), false);
    await db.execute(sql`UPDATE dmca_cases SET status='CLOSED' WHERE id=${created.id}`);
    assert.equal((await api("uploader", "GET", "/api/dmca/my-activity")).body.hasActivity, true);
    assert.ok((await api("uploader", "GET", "/api/dmca/my-claims")).body.claims.some((claim: any) =>
      claim.caseNumber === created.caseNumber && claim.status === "Closed"));
  });

  it("notifies the uploader, exposes only safe owner data, and accepts one immutable counter-notice", async () => {
    const post = await db.execute(sql`
      INSERT INTO forum_posts(title,content,category_id,user_id,media_urls)
      VALUES(${"Uploader DMCA integration"},${"throwaway"},${categoryId},${uploaderId},ARRAY[]::text[])
      RETURNING id`);
    const postId = Number((post.rows[0] as any).id);
    postIds.push(postId);
    const originalUrl = `/forum/post/${postId}`;
    const secret = `INTERNAL-COUNSEL-${Date.now()}`;
    const created = await createCase({
      actor: { type: "admin", id: actorId },
      claimant: {
        name: "Safe Claimant", company: "Claim Company", email: "private-claimant@example.test",
        phone: "555-0199", workDescription: "Claimed original photograph",
      },
      submission: { submissionType: "notice", formPayload: { internalNotes: secret } },
      targets: [{ contentType: "forum_post", contentId: postId, originalUrl }],
      submittedVia: "admin_entry",
    });
    caseIds.push(created.id);
    caseNumbers.push(created.caseNumber);
    await db.execute(sql`UPDATE dmca_cases SET internal_notes=${secret} WHERE id=${created.id}`);
    const actor = { type: "admin" as const, id: actorId };
    await transitionCase(created.id, S.UNDER_REVIEW, actor);
    await transitionCase(created.id, S.ACCEPTED, actor);
    await executeTakedown({ caseId: created.id, actor, notifyUploader: true });

    const inbox = await db.execute(sql`
      SELECT m.id,m.subject,m.content,m.message_type FROM messages m
      JOIN message_recipients r ON r.message_id=m.id
      WHERE r.recipient_id=${uploaderId} AND m.message_type='system'
        AND m.content LIKE ${`%${created.caseNumber}%`}
      ORDER BY m.id DESC LIMIT 1`);
    assert.equal(inbox.rows.length, 1);
    const message = inbox.rows[0] as any;
    messageIds.push(Number(message.id));
    for (const expected of [
      created.caseNumber, originalUrl, "Claim Company", "Claimed original photograph",
      "counter-notice", "pending counsel review",
    ]) assert.match(message.content, new RegExp(expected, "i"));
    assert.match(message.content, /\d{4}-\d{2}-\d{2}T/);
    assert.doesNotMatch(message.content, new RegExp(secret));

    const listed = await api("uploader", "GET", "/api/dmca/my-cases");
    assert.equal(listed.status, 200);
    const item = listed.body.cases.find((c: any) => c.caseNumber === created.caseNumber);
    assert.equal(item.status, "content_disabled");
    assert.equal(item.canSubmitCounterNotice, true);
    assert.equal((await api("uploader", "GET", "/api/dmca/my-activity")).body.hasActivity, true);
    const detail = await api("uploader", "GET", `/api/dmca/my-cases/${created.caseNumber}`);
    assert.equal(detail.status, 200);
    const serialized = JSON.stringify(detail.body);
    assert.doesNotMatch(serialized, /private-claimant@example\.test|555-0199|INTERNAL-COUNSEL/);
    assert.equal((await api("other", "GET", `/api/dmca/my-cases/${created.caseNumber}`)).status, 404);
    assert.equal((await api("other", "POST", `/api/dmca/my-cases/${created.caseNumber}/counter-notice`, validCounterNotice)).status, 404);

    const incomplete = await api("uploader", "POST", `/api/dmca/my-cases/${created.caseNumber}/counter-notice`, {
      ...validCounterNotice, signature: "",
    });
    assert.equal(incomplete.status, 400);
    const submitted = await api("uploader", "POST", `/api/dmca/my-cases/${created.caseNumber}/counter-notice`, validCounterNotice);
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    assert.equal((await db.execute(sql`SELECT status FROM dmca_cases WHERE id=${created.id}`)).rows[0]?.status, S.COUNTER_NOTICE_RECEIVED);
    const counter = (await db.execute(sql`
      SELECT id FROM dmca_submissions WHERE dmca_case_id=${created.id}
      AND submission_type='counter_notice'`)).rows[0] as any;
    await assert.rejects(
      () => db.execute(sql`UPDATE dmca_submissions SET submitted_by_name='tampered' WHERE id=${counter.id}`),
    );
    assert.ok((await db.execute(sql`
      SELECT 1 FROM dmca_audit_log WHERE dmca_case_id=${created.id}
      AND event='submission_received' AND target_type='dmca_submission'
      AND target_id=${counter.id}`)).rows.length);
    assert.ok((await db.execute(sql`
      SELECT 1 FROM dmca_admin_alerts WHERE dmca_case_id=${created.id}
      AND alert_type='counter_notice_received'`)).rows.length);
    assert.equal((await api("uploader", "POST", `/api/dmca/my-cases/${created.caseNumber}/counter-notice`, validCounterNotice)).status, 409);

    const reviews = await db.execute(sql`
      SELECT count(*)::int n FROM dmca_repeat_infringer_reviews
      WHERE user_id=${uploaderId} AND status='open'`);
    assert.equal(Number((reviews.rows[0] as any).n), 1);
    assert.ok((await db.execute(sql`
      SELECT 1 FROM dmca_admin_alerts WHERE user_id=${uploaderId}
      AND alert_type='repeat_infringer_threshold'`)).rows.length);
    assert.equal((await db.execute(sql`SELECT is_blocked FROM users WHERE id=${uploaderId}`)).rows[0]?.is_blocked, false);
    await recordRepeatInfringerDecision(uploaderId, "dismiss", "Reviewed by a human", { type: "admin", id: actorId });
    assert.equal(await checkRepeatInfringerThreshold(uploaderId), null);
    assert.equal((await db.execute(sql`
      SELECT count(*)::int n FROM dmca_repeat_infringer_reviews WHERE user_id=${uploaderId}
        AND status='open'`)).rows[0]?.n, 0);
  });

  it("removes a restored takedown from the active repeat-infringer count", async () => {
    const post = await db.execute(sql`
      INSERT INTO forum_posts(title,content,category_id,user_id,media_urls)
      VALUES(${"Restored strike integration"},${"throwaway"},${categoryId},${uploaderId},ARRAY[]::text[])
      RETURNING id`);
    const postId = Number((post.rows[0] as any).id);
    postIds.push(postId);
    const actor = { type: "admin" as const, id: actorId };
    const created = await createCase({
      actor,
      claimant: { name: "Withdrawal claimant" },
      submission: { submissionType: "notice", formPayload: { test: true } },
      targets: [{ contentType: "forum_post", contentId: postId }],
      submittedVia: "admin_entry",
    });
    caseIds.push(created.id);
    caseNumbers.push(created.caseNumber);
    await transitionCase(created.id, S.UNDER_REVIEW, actor);
    await transitionCase(created.id, S.ACCEPTED, actor);
    await executeTakedown({ caseId: created.id, actor, notifyUploader: false });
    await restoreCase({
      caseId: created.id, actor, reason: "Claimant withdrew the notice",
      notify: false, mode: "notice_withdrawn",
    });
    assert.equal((await api("uploader", "GET", "/api/dmca/my-activity")).body.hasActivity, true);
    const events = await db.execute(sql`
      SELECT event_type,status,counts_toward_repeat_policy
      FROM user_copyright_events WHERE dmca_case_id=${created.id}`);
    const takedown = (events.rows as any[]).find(row => row.event_type === "content_taken_down");
    assert.equal(takedown.status, "reversed");
    assert.equal(takedown.counts_toward_repeat_policy, false);
    assert.equal((events.rows as any[]).filter(row =>
      row.status === "active" && row.counts_toward_repeat_policy === true).length, 0);
  });
});