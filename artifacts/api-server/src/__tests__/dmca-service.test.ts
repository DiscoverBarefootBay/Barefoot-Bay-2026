import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  applyLegalHold,
  createCase,
  DmcaServiceError,
  executeTakedown,
  recordCourtAction,
  releaseLegalHold,
  restoreCase,
  transitionCase,
} from "../dmca/dmca-service";
import { DmcaCaseStatus, InvalidDmcaTransitionError } from "../dmca/state-machine";
import {
  __setQuarantineTestHooks,
  candidateObjectKeys,
  quarantineGateMiddleware,
  quarantineKeyFor,
  type QuarantineStorageAdapter,
} from "../dmca/quarantine";
import { DmcaPermission } from "../dmca/permissions";

afterEach(() => __setQuarantineTestHooks({ adapter: null, localRoot: null }));

function gateResponse() {
  const state: any = { statusCode: 200, body: null };
  return {
    state,
    response: {
      status(code: number) { state.statusCode = code; return this; },
      send(body: unknown) { state.body = body; return this; },
      setHeader() {},
    } as any,
  };
}

describe("DMCA service lifecycle", () => {
  it("takes down, physically quarantines, restores, and applies court/legal holds", async (t) => {
    const caseIds: number[] = [];
    const holdIds: number[] = [];
    let postId: number | null = null;
    let commentId: number | null = null;
    let actorId: number | null = null;
    const insertedPermissions: string[] = [];
    const fileUrl = `/api/storage-proxy/direct-forum/dmca-test-${Date.now()}.jpg`;
    const originalKey = candidateObjectKeys(fileUrl)[0];
    const bytes = Buffer.from("authentic dmca test evidence");
    const objects = new Map<string, Buffer>([[originalKey, bytes]]);
    let failPutContaining: string | null = null;
    const adapter: QuarantineStorageAdapter = {
      async get(key) { return objects.get(key) ?? null; },
      async put(key, data) {
        if (failPutContaining && key.includes(failPutContaining)) throw new Error("injected second-file put failure");
        objects.set(key, Buffer.from(data));
      },
      async del(key) { objects.delete(key); },
    };
    __setQuarantineTestHooks({ adapter });

    try {
      const seed = await db.execute(sql`
        SELECT u.id AS user_id, c.id AS category_id
        FROM users u CROSS JOIN forum_categories c
        WHERE u.email IS NOT NULL AND u.email <> '' LIMIT 1`);
      if (!seed.rows.length) {
        t.skip("dev database has no emailable user/category seed for FK-safe lifecycle rows");
        return;
      }
      actorId = Number((seed.rows[0] as any).user_id);
      const categoryId = Number((seed.rows[0] as any).category_id);
      const permissions = [
        DmcaPermission.REVIEW,
        DmcaPermission.TAKEDOWN,
        DmcaPermission.RESTORE,
        DmcaPermission.MANAGE_HOLDS,
      ];
      for (const permission of permissions) {
        const grant = await db.execute(sql`
          INSERT INTO dmca_permission_grants (user_id, permission, granted_by)
          VALUES (${actorId}, ${permission}, ${actorId}) ON CONFLICT DO NOTHING
          RETURNING permission`);
        if (grant.rows.length) insertedPermissions.push(permission);
      }
      const post = await db.execute(sql`
        INSERT INTO forum_posts (title, content, category_id, user_id, media_urls)
        VALUES (${"DMCA lifecycle throwaway"}, ${"throwaway"}, ${categoryId}, ${actorId}, ARRAY[${fileUrl}]::text[])
        RETURNING id`);
      postId = Number((post.rows[0] as any).id);
      const comment = await db.execute(sql`
        INSERT INTO forum_comments (content, post_id, author_id)
        VALUES (${"DMCA lifecycle child"}, ${postId}, ${actorId}) RETURNING id`);
      commentId = Number((comment.rows[0] as any).id);
      const actor = { type: "admin" as const, id: actorId };

      const created = await createCase({
        actor,
        claimant: { name: "Test claimant", email: "claimant@example.test" },
        submission: { submissionType: "notice", formPayload: { test: true }, submittedByName: "Test claimant" },
        targets: [{ contentType: "forum_post", contentId: postId }],
        submittedVia: "admin_entry",
      });
      caseIds.push(created.id);
      await transitionCase(created.id, DmcaCaseStatus.UNDER_REVIEW, actor);
      await transitionCase(created.id, DmcaCaseStatus.ACCEPTED, actor);
      await assert.rejects(
        () => transitionCase(created.id, DmcaCaseStatus.RECEIVED, actor),
        InvalidDmcaTransitionError,
      );

      const taken = await executeTakedown({ caseId: created.id, actor });
      assert.equal(taken.targetsTakenDown, 1);
      assert.equal(taken.filesRegistered, 1);
      assert.equal(taken.noticesQueued, 1);
      const quarantineKey = quarantineKeyFor(created.caseNumber, originalKey);
      assert.equal(objects.has(originalKey), false);
      assert.deepEqual(objects.get(quarantineKey), bytes);

      const hidden = await db.execute(sql`
        SELECT visibility_status, dmca_case_id FROM forum_posts WHERE id = ${postId}`);
      assert.equal((hidden.rows[0] as any).visibility_status, "dmca_hidden");
      assert.equal(Number((hidden.rows[0] as any).dmca_case_id), created.id);
      const effects = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM dmca_audit_log WHERE dmca_case_id = ${created.id})::int AS audits,
          (SELECT count(*) FROM user_copyright_events WHERE dmca_case_id = ${created.id})::int AS copyright_events,
          (SELECT count(*) FROM user_copyright_events
           WHERE dmca_case_id = ${created.id} AND counts_toward_repeat_policy = true)::int AS counting_copyright_events,
          (SELECT count(*) FROM notification_outbox WHERE dmca_case_id = ${created.id})::int AS notices,
          (SELECT status FROM dmca_cases WHERE id = ${created.id}) AS case_status,
          (SELECT status FROM dmca_quarantined_objects WHERE dmca_case_id = ${created.id} LIMIT 1) AS registry_status`);
      const effect = effects.rows[0] as any;
      assert.ok(Number(effect.audits) >= 4);
      assert.equal(Number(effect.copyright_events), 2);
      assert.equal(Number(effect.counting_copyright_events), 1);
      assert.equal(Number(effect.notices), 1);
      assert.equal(effect.case_status, DmcaCaseStatus.CONTENT_REMOVED);
      assert.equal(effect.registry_status, "quarantined");

      // A different accepted case cannot steal an item already linked to the
      // first active takedown.
      const conflicting = await createCase({
        actor,
        claimant: { name: "Conflicting claimant" },
        submission: { submissionType: "notice", formPayload: { conflicting: true } },
        targets: [{ contentType: "forum_post", contentId: postId }],
        submittedVia: "admin_entry",
      });
      caseIds.push(conflicting.id);
      await transitionCase(conflicting.id, DmcaCaseStatus.UNDER_REVIEW, actor);
      await transitionCase(conflicting.id, DmcaCaseStatus.ACCEPTED, actor);
      await assert.rejects(
        () => executeTakedown({ caseId: conflicting.id, actor, notifyUploader: false }),
        (error: unknown) => error instanceof DmcaServiceError && error.statusCode === 409,
      );
      const stillFirstCase = await db.execute(sql`SELECT dmca_case_id FROM forum_posts WHERE id = ${postId}`);
      assert.equal(Number((stillFirstCase.rows[0] as any).dmca_case_id), created.id);

      const gated = gateResponse();
      let nextCalled = false;
      await quarantineGateMiddleware()(
        { method: "GET", path: fileUrl } as any,
        gated.response,
        () => { nextCalled = true; },
      );
      assert.equal(nextCalled, false);
      assert.equal(gated.state.statusCode, 404);

      await restoreCase({ caseId: created.id, actor, reason: "lifecycle test restoration", notify: false });
      assert.deepEqual(objects.get(originalKey), bytes);
      assert.equal(objects.has(quarantineKey), false);
      const restored = await db.execute(sql`
        SELECT p.visibility_status, p.hidden_at, p.hidden_reason, p.dmca_case_id,
          (SELECT status FROM dmca_quarantined_objects WHERE dmca_case_id = ${created.id} LIMIT 1) AS registry_status
        FROM forum_posts p WHERE p.id = ${postId}`);
      assert.equal((restored.rows[0] as any).visibility_status, "published");
      assert.equal((restored.rows[0] as any).hidden_at, null);
      assert.equal((restored.rows[0] as any).hidden_reason, null);
      assert.equal((restored.rows[0] as any).dmca_case_id, null);
      assert.equal((restored.rows[0] as any).registry_status, "restored");
      const open = gateResponse();
      nextCalled = false;
      await quarantineGateMiddleware()(
        { method: "GET", path: fileUrl } as any,
        open.response,
        () => { nextCalled = true; },
      );
      assert.equal(nextCalled, true);

      // A failure on the second physical move aborts the transaction and
      // compensates the first move back to its exact public key.
      const secondUrl = `/api/storage-proxy/direct-forum/dmca-test-second-${Date.now()}.jpg`;
      const secondKey = candidateObjectKeys(secondUrl)[0];
      objects.set(secondKey, Buffer.from("second evidence"));
      await db.execute(sql`
        UPDATE forum_posts SET media_urls = ARRAY[${fileUrl}, ${secondUrl}]::text[] WHERE id = ${postId}`);
      const failedMove = await createCase({
        actor,
        claimant: { name: "Move failure claimant" },
        submission: { submissionType: "notice", formPayload: { moveFailure: true } },
        targets: [{ contentType: "forum_post", contentId: postId }],
        submittedVia: "admin_entry",
      });
      caseIds.push(failedMove.id);
      await transitionCase(failedMove.id, DmcaCaseStatus.UNDER_REVIEW, actor);
      await transitionCase(failedMove.id, DmcaCaseStatus.ACCEPTED, actor);
      failPutContaining = secondKey.split("/").pop()!;
      await assert.rejects(
        () => executeTakedown({ caseId: failedMove.id, actor, notifyUploader: false }),
        (error: unknown) => error instanceof DmcaServiceError && error.statusCode === 502,
      );
      failPutContaining = null;
      assert.deepEqual(objects.get(originalKey), bytes);
      assert.equal(objects.get(secondKey)?.toString(), "second evidence");
      const rolledBack = await db.execute(sql`
        SELECT
          (SELECT visibility_status FROM forum_posts WHERE id = ${postId}) AS visibility,
          (SELECT status FROM dmca_cases WHERE id = ${failedMove.id}) AS case_status,
          (SELECT count(*)::int FROM dmca_quarantined_objects WHERE dmca_case_id = ${failedMove.id}) AS registry_count`);
      assert.equal((rolledBack.rows[0] as any).visibility, "published");
      assert.equal((rolledBack.rows[0] as any).case_status, DmcaCaseStatus.ACCEPTED);
      assert.equal(Number((rolledBack.rows[0] as any).registry_count), 0);
      await db.execute(sql`
        UPDATE forum_posts SET media_urls = ARRAY[${fileUrl}]::text[] WHERE id = ${postId}`);
      objects.delete(secondKey);

      // A second accepted case is taken down, then court action places a hold
      // and leaves the material disabled.
      objects.set(originalKey, bytes);
      objects.set(secondKey, Buffer.from("second evidence"));
      await db.execute(sql`
        UPDATE forum_posts SET media_urls = ARRAY[${fileUrl}, ${secondUrl}]::text[] WHERE id = ${postId}`);
      const court = await createCase({
        actor,
        claimant: { name: "Court test", email: "court@example.test" },
        submission: { submissionType: "notice", formPayload: { court: true } },
        targets: [{ contentType: "forum_post", contentId: postId }],
        submittedVia: "admin_entry",
      });
      caseIds.push(court.id);
      await transitionCase(court.id, DmcaCaseStatus.UNDER_REVIEW, actor);
      await transitionCase(court.id, DmcaCaseStatus.ACCEPTED, actor);
      await executeTakedown({ caseId: court.id, actor, notifyUploader: false });
      const courtQuarantineKey = quarantineKeyFor(court.caseNumber, originalKey);
      const courtSecondQuarantineKey = quarantineKeyFor(court.caseNumber, secondKey);
      failPutContaining = secondKey.split("/").pop()!;
      await assert.rejects(
        () => restoreCase({ caseId: court.id, actor, reason: "injected partial restore failure", notify: false }),
        /injected second-file put failure/,
      );
      failPutContaining = null;
      assert.equal(objects.has(originalKey), false);
      assert.equal(objects.has(secondKey), false);
      assert.deepEqual(objects.get(courtQuarantineKey), bytes);
      assert.equal(objects.get(courtSecondQuarantineKey)?.toString(), "second evidence");
      const failedRestoreState = await db.execute(sql`
        SELECT p.visibility_status, t.status AS target_status, q.n AS registry_count
        FROM forum_posts p
        CROSS JOIN LATERAL (
          SELECT status FROM dmca_targets WHERE dmca_case_id = ${court.id} LIMIT 1
        ) t
        CROSS JOIN LATERAL (
          SELECT count(*)::int AS n FROM dmca_quarantined_objects
          WHERE dmca_case_id = ${court.id} AND status = 'quarantined'
        ) q
        WHERE p.id = ${postId}`);
      assert.equal((failedRestoreState.rows[0] as any).visibility_status, "dmca_hidden");
      assert.equal((failedRestoreState.rows[0] as any).target_status, "taken_down");
      assert.equal(Number((failedRestoreState.rows[0] as any).registry_count), 2);
      await db.execute(sql`
        UPDATE forum_posts SET visibility_status = 'moderation_hidden' WHERE id = ${postId}`);
      await assert.rejects(
        () => restoreCase({ caseId: court.id, actor, reason: "must abort", notify: false }),
        (error: unknown) => error instanceof DmcaServiceError && error.statusCode === 409,
      );
      const aborted = await db.execute(sql`
        SELECT
          (SELECT status FROM dmca_targets WHERE dmca_case_id = ${court.id} LIMIT 1) AS target_status,
          (SELECT status FROM dmca_quarantined_objects WHERE dmca_case_id = ${court.id} LIMIT 1) AS registry_status`);
      assert.equal((aborted.rows[0] as any).target_status, "taken_down");
      assert.equal((aborted.rows[0] as any).registry_status, "quarantined");
      assert.equal(objects.has(originalKey), false);
      assert.deepEqual(objects.get(courtQuarantineKey), bytes);
      await db.execute(sql`
        UPDATE forum_posts SET visibility_status = 'dmca_hidden' WHERE id = ${postId}`);
      await recordCourtAction({
        caseId: court.id,
        actor,
        submission: { formPayload: { docket: "test" }, submittedByName: "Test counsel" },
      });
      const courtState = await db.execute(sql`
        SELECT c.status, c.legal_hold AS case_hold, p.visibility_status, p.legal_hold AS content_hold
        FROM dmca_cases c CROSS JOIN forum_posts p
        WHERE c.id = ${court.id} AND p.id = ${postId}`);
      assert.deepEqual(
        {
          status: (courtState.rows[0] as any).status,
          caseHold: (courtState.rows[0] as any).case_hold,
          visibility: (courtState.rows[0] as any).visibility_status,
          contentHold: (courtState.rows[0] as any).content_hold,
        },
        {
          status: DmcaCaseStatus.COURT_ACTION_RECEIVED,
          caseHold: true,
          visibility: "dmca_hidden",
          contentHold: true,
        },
      );

      const standaloneHold = await applyLegalHold({
        contentType: "forum_comment",
        contentId: commentId,
        reason: "standalone lifecycle hold",
        actor,
      });
      holdIds.push(standaloneHold);
      await releaseLegalHold({ holdId: standaloneHold, actor, reason: "standalone lifecycle release" });
      const holdAudit = await db.execute(sql`
        SELECT count(*)::int AS n FROM dmca_audit_log
        WHERE target_type = 'forum_comment' AND target_id = ${commentId}
          AND event IN ('legal_hold_placed', 'legal_hold_released')`);
      assert.equal(Number((holdAudit.rows[0] as any).n), 2);
    } finally {
      if (commentId != null) await db.execute(sql`UPDATE forum_comments SET legal_hold = false WHERE id = ${commentId}`);
      if (postId != null) await db.execute(sql`UPDATE forum_posts SET legal_hold = false, visibility_status = 'published' WHERE id = ${postId}`);
      if (caseIds.length || postId != null || commentId != null) {
        await db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL dmca.allow_purge = 'on'`);
          if (caseIds.length) {
            const ids = sql.join(caseIds.map((id) => sql`${id}`), sql`, `);
            await tx.execute(sql`DELETE FROM notification_outbox WHERE dmca_case_id IN (${ids})`);
            await tx.execute(sql`DELETE FROM user_copyright_events WHERE dmca_case_id IN (${ids})`);
            await tx.execute(sql`DELETE FROM dmca_quarantined_objects WHERE dmca_case_id IN (${ids})`);
            await tx.execute(sql`DELETE FROM legal_holds WHERE case_type = 'dmca' AND case_id IN (${ids})`);
            await tx.execute(sql`DELETE FROM dmca_audit_log WHERE dmca_case_id IN (${ids}) OR (target_type = 'forum_comment' AND target_id = ${commentId})`);
            await tx.execute(sql`DELETE FROM dmca_submissions WHERE dmca_case_id IN (${ids})`);
            await tx.execute(sql`DELETE FROM dmca_targets WHERE dmca_case_id IN (${ids})`);
            await tx.execute(sql`DELETE FROM dmca_cases WHERE id IN (${ids})`);
          }
          if (holdIds.length) await tx.execute(sql`DELETE FROM legal_holds WHERE id IN (${sql.join(holdIds.map((id) => sql`${id}`), sql`, `)})`);
          if (commentId != null) await tx.execute(sql`DELETE FROM forum_comments WHERE id = ${commentId}`);
          if (postId != null) await tx.execute(sql`DELETE FROM forum_posts WHERE id = ${postId}`);
          if (actorId != null && insertedPermissions.length) {
            await tx.execute(sql`
              DELETE FROM dmca_permission_grants
              WHERE user_id = ${actorId} AND permission IN (${sql.join(insertedPermissions.map((p) => sql`${p}`), sql`, `)})`);
          }
        });
      }
    }
  });
});