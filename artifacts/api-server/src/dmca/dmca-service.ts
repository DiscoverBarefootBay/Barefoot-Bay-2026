/**
 * DMCA core service — the ONLY code that changes case state or DMCA-driven
 * content visibility. Every operation is one database transaction that
 * updates the case, the content, the audit log and the notification outbox
 * together; emails are queued, never sent inline.
 *
 * Legal principles enforced here:
 *   - A takedown is a reversible visibility change (dmca_hidden), never a
 *     delete. Original ids, URLs and storage paths are preserved.
 *   - Software never decides infringement: takedown and restore require a
 *     human actor holding the matching DMCA permission.
 *   - Court action places a legal hold, cancels restoration and keeps the
 *     content hidden.
 *   - Case status only moves along the state machine (state-machine.ts).
 */
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { pgIntArray } from "./legal-hold";
import { db } from "../db";
import { logger } from "../lib/logger";
import { writeDmcaAudit, type DbExecutor } from "./audit";
import { allocateCaseNumber } from "./case-number";
import { assertTransition, DmcaCaseStatus as S, type DmcaCaseStatus } from "./state-machine";
import { collectContentFileUrls, getContentTypeDef, isDmcaContentType, type DmcaContentType } from "./content-registry";
import { getUserDmcaPermissions, DmcaPermission, type DmcaPermission as Perm } from "./permissions";
import { enqueueNotification } from "./outbox";
import {
  moveQuarantinedBack,
  moveRegisteredToQuarantine,
  movesFromOutcomes,
  reverseMoves,
  type MovedFile,
  type MoveOutcome,
  refreshQuarantineRegistry,
  registerQuarantinedUrls,
} from "./quarantine";
import { computeRestorationWindow } from "./business-days";

export interface DmcaActor {
  type: "admin" | "system" | "user" | "public";
  id: number | null;
  ipAddress?: string | null;
}

export class DmcaServiceError extends Error {
  override readonly name = "DmcaServiceError";
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

async function assertActorPermission(actor: DmcaActor, permission: Perm): Promise<void> {
  if (actor.type !== "admin" || actor.id == null) {
    throw new DmcaServiceError(`This action requires a human admin with ${permission}`, 403);
  }
  const perms = await getUserDmcaPermissions({ id: actor.id, role: null });
  if (!perms.has(permission)) throw new DmcaServiceError(`Missing permission: ${permission}`, 403);
}

async function lockCase(tx: DbExecutor, caseId: number): Promise<Record<string, any>> {
  const r = await tx.execute(sql`SELECT * FROM dmca_cases WHERE id = ${caseId} FOR UPDATE`);
  const row = r.rows[0] as Record<string, any> | undefined;
  if (!row) throw new DmcaServiceError(`DMCA case ${caseId} not found`, 404);
  return row;
}

async function setCaseStatus(
  tx: DbExecutor,
  caseRow: Record<string, any>,
  to: DmcaCaseStatus,
  actor: DmcaActor,
  extra: Record<string, unknown> = {},
  notes: string | null = null,
): Promise<void> {
  assertTransition(caseRow.status, to);
  const sets = [sql`status = ${to}`, sql`updated_at = now()`];
  for (const [col, val] of Object.entries(extra)) {
    if (!/^[a-z_]+$/.test(col)) throw new Error(`bad column ${col}`);
    sets.push(sql`${sql.identifier(col)} = ${val as any}`);
  }
  await tx.execute(sql`UPDATE dmca_cases SET ${sql.join(sets, sql`, `)} WHERE id = ${caseRow.id}`);
  await writeDmcaAudit(
    {
      event: "case_status_changed",
      actorType: actor.type,
      actorId: actor.id,
      dmcaCaseId: caseRow.id,
      targetType: "dmca_case",
      targetId: caseRow.id,
      ipAddress: actor.ipAddress ?? null,
      previousValue: { status: caseRow.status },
      newValue: { status: to, ...extra },
      notes,
    },
    tx,
  );
  caseRow.status = to;
}

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "https://barefootbay.com").replace(/\/+$/, "");
}

async function userEmail(tx: DbExecutor, userId: number | null | undefined): Promise<{ email: string | null; name: string | null }> {
  if (userId == null) return { email: null, name: null };
  const r = await tx.execute(sql`SELECT email, username, full_name FROM users WHERE id = ${userId}`);
  const u = r.rows[0] as any;
  return { email: u?.email ?? null, name: u?.full_name || u?.username || null };
}

// ---------------------------------------------------------------------------
// Case creation & submissions
// ---------------------------------------------------------------------------
export type SubmissionType = "notice" | "supplemental_notice" | "counter_notice" | "court_action_notice";

export interface SubmissionInput {
  submissionType: SubmissionType;
  formPayload: Record<string, unknown>;
  submittedByUserId?: number | null;
  submittedByName?: string | null;
  signatureValue?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  originalDocumentPath?: string | null;
  emailMessageId?: string | null;
}

export interface TargetInput {
  contentType: DmcaContentType | "url";
  contentId: number | null;
  originalUrl?: string | null;
}

export interface CreateCaseInput {
  submission: SubmissionInput;
  claimant: {
    name?: string | null;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    role?: string | null;
    copyrightOwnerName?: string | null;
    workDescription?: string | null;
  };
  targets: TargetInput[];
  submittedVia?: "web_form" | "email" | "mail" | "fax" | "admin_entry";
  actor: DmcaActor;
  /** Runs after all base rows are inserted, inside the case transaction. */
  afterCreate?: (
    tx: DbExecutor,
    created: { id: number; caseNumber: string; statusToken: string; receivedAt: Date },
  ) => Promise<void>;
}

async function insertSubmission(tx: DbExecutor, caseId: number, s: SubmissionInput): Promise<number> {
  const r = await tx.execute(sql`
    INSERT INTO dmca_submissions (dmca_case_id, submission_type, submitted_by_user_id, submitted_by_name, form_payload,
      original_document_path, email_message_id, signature_value, ip_address, user_agent)
    VALUES (${caseId}, ${s.submissionType}, ${s.submittedByUserId ?? null}, ${s.submittedByName ?? null},
      ${JSON.stringify(s.formPayload)}::jsonb, ${s.originalDocumentPath ?? null}, ${s.emailMessageId ?? null},
      ${s.signatureValue ?? null}, ${s.ipAddress ?? null}, ${s.userAgent ?? null})
    RETURNING id`);
  return Number((r.rows[0] as any).id);
}

async function resolveTargetMeta(tx: DbExecutor, t: TargetInput): Promise<{ uploaderUserId: number | null; originalUrl: string | null }> {
  if (t.contentId == null) return { uploaderUserId: null, originalUrl: t.originalUrl ?? null };
  if (t.contentType === "url") return { uploaderUserId: null, originalUrl: t.originalUrl ?? null };
  const def = getContentTypeDef(t.contentType);
  const r = await tx.execute(sql`SELECT * FROM ${sql.identifier(def.table)} WHERE id = ${t.contentId}`);
  const row = r.rows[0] as any;
  if (!row) throw new DmcaServiceError(`${t.contentType} ${t.contentId} does not exist`, 404);
  const owner = row[def.ownerColumn];
  return {
    uploaderUserId: owner == null ? null : Number(owner),
    originalUrl: t.originalUrl ?? (def.publicPath ? def.publicPath(row) : null),
  };
}

export async function createCase(input: CreateCaseInput): Promise<{ id: number; caseNumber: string; statusToken: string }> {
  for (const t of input.targets) {
    if (t.contentType !== "url" && !isDmcaContentType(t.contentType)) throw new DmcaServiceError(`Unknown content type ${t.contentType}`);
  }
  return db.transaction(async (tx) => {
    const caseNumber = await allocateCaseNumber(tx);
    const statusToken = crypto.randomBytes(24).toString("base64url");
    const c = input.claimant;
    const ins = await tx.execute(sql`
      INSERT INTO dmca_cases (case_number, case_type, status, submitted_via, claimant_name, claimant_company, claimant_email,
        claimant_phone, claimant_address, claimant_role, copyright_owner_name, work_description, status_token)
      VALUES (${caseNumber}, 'notice', ${S.RECEIVED}, ${input.submittedVia ?? "web_form"}, ${c.name ?? null}, ${c.company ?? null},
        ${c.email ?? null}, ${c.phone ?? null}, ${c.address ?? null}, ${c.role ?? null}, ${c.copyrightOwnerName ?? null},
        ${c.workDescription ?? null}, ${statusToken})
      RETURNING id, received_at`);
    const caseId = Number((ins.rows[0] as any).id);
    const receivedAt = new Date((ins.rows[0] as any).received_at);
    const submissionId = await insertSubmission(tx, caseId, input.submission);
    for (const t of input.targets) {
      const meta = await resolveTargetMeta(tx, t);
      await tx.execute(sql`
        INSERT INTO dmca_targets (dmca_case_id, content_type, content_id, original_url, uploader_user_id, status)
        VALUES (${caseId}, ${t.contentType}, ${t.contentId}, ${meta.originalUrl}, ${meta.uploaderUserId}, 'pending')`);
    }
    await writeDmcaAudit(
      {
        event: "case_created",
        actorType: input.actor.type,
        actorId: input.actor.id,
        dmcaCaseId: caseId,
        targetType: "dmca_case",
        targetId: caseId,
        ipAddress: input.actor.ipAddress ?? input.submission.ipAddress ?? null,
        newValue: { caseNumber, submissionId, targets: input.targets },
      },
      tx,
    );
    await input.afterCreate?.(tx, { id: caseId, caseNumber, statusToken, receivedAt });
    return { id: caseId, caseNumber, statusToken };
  });
}

/** Immutable additional submission (supplemental notice, counter-notice, …). */
export async function addSubmission(caseId: number, submission: SubmissionInput, actor: DmcaActor, executor?: DbExecutor): Promise<number> {
  const run = async (tx: DbExecutor) => {
    await lockCase(tx, caseId);
    const id = await insertSubmission(tx, caseId, submission);
    await writeDmcaAudit(
      {
        event: "submission_received",
        actorType: actor.type,
        actorId: actor.id,
        dmcaCaseId: caseId,
        targetType: "dmca_submission",
        targetId: id,
        ipAddress: actor.ipAddress ?? submission.ipAddress ?? null,
        newValue: { submissionType: submission.submissionType },
      },
      tx,
    );
    return id;
  };
  return executor ? run(executor) : db.transaction(run);
}

/**
 * Generic human-driven status change (review, accept, reject, counter-notice
 * steps, close). Operations with side effects (takedown, restore, court
 * action) have dedicated functions and are refused here.
 */
export async function transitionCase(
  caseId: number,
  to: DmcaCaseStatus,
  actor: DmcaActor,
  opts: { notes?: string | null; closedReason?: string | null } = {},
): Promise<void> {
  if (to === S.CONTENT_REMOVED || to === S.RESTORED || to === S.COURT_ACTION_RECEIVED) {
    throw new DmcaServiceError(`Use the dedicated operation to move a case to ${to}`);
  }
  if (actor.type === "admin") await assertActorPermission(actor, DmcaPermission.REVIEW);
  else if (actor.type !== "system") throw new DmcaServiceError("Not allowed", 403);

  await db.transaction(async (tx) => {
    const c = await lockCase(tx, caseId);
    const extra: Record<string, unknown> = {};
    if (to === S.CLAIMANT_NOTIFIED_OF_COUNTER) extra.claimant_counter_notified_at = new Date();
    if (to === S.COUNTER_NOTICE_ACCEPTED) extra.counter_reviewed_at = new Date();
    if (to === S.COUNTER_NOTICE_RECEIVED && !c.counter_notice_received_at) extra.counter_notice_received_at = new Date();
    if (to === S.UPLOADER_NOTIFIED && !c.uploader_notified_at) extra.uploader_notified_at = new Date();
    if (to === S.WAITING_FOR_RESTORATION_WINDOW) {
      if (!c.counter_notice_received_at) throw new DmcaServiceError("Counter-notice receipt date is missing");
      const w = computeRestorationWindow(new Date(c.counter_notice_received_at));
      extra.restore_eligible_at = w.eligibleAt;
      extra.restore_deadline_at = w.deadlineAt;
    }
    if (to === S.RESTORATION_ELIGIBLE && c.restore_eligible_at && new Date(c.restore_eligible_at) > new Date()) {
      throw new DmcaServiceError("The 10-business-day waiting period has not elapsed yet", 409);
    }
    if (to === S.CLOSED) {
      extra.closed_at = new Date();
      extra.closed_reason = opts.closedReason ?? null;
    }
    await setCaseStatus(tx, c, to, actor, extra, opts.notes ?? null);
  });
}

// ---------------------------------------------------------------------------
// Takedown
// ---------------------------------------------------------------------------
export interface TakedownResult {
  caseNumber: string;
  targetsTakenDown: number;
  filesRegistered: number;
  noticesQueued: number;
}

export async function executeTakedown(opts: {
  caseId: number;
  actor: DmcaActor;
  reason?: string;
  notifyUploader?: boolean;
}): Promise<TakedownResult> {
  await assertActorPermission(opts.actor, DmcaPermission.TAKEDOWN);
  const reason = opts.reason ?? "Removed in response to a DMCA copyright notice";
  const notify = opts.notifyUploader ?? true;
  const actor = opts.actor;

  // Physical moves done inside the transaction; undone if it does not commit.
  let takedownMoves: MovedFile[] = [];
  let outcomes: MoveOutcome[] = [];
  const txResult = await db.transaction(async (tx) => {
    const c = await lockCase(tx, opts.caseId);
    assertTransition(c.status, S.CONTENT_REMOVED);
    const targets = (await tx.execute(sql`SELECT * FROM dmca_targets WHERE dmca_case_id = ${c.id} AND status = 'pending' ORDER BY id FOR UPDATE`)).rows as any[];
    if (targets.length === 0) throw new DmcaServiceError("This case has no pending targets to take down", 409);

    const registryIds: number[] = [];
    const uploaders = new Map<number, string[]>();
    let taken = 0;
    for (const t of targets) {
      if (t.content_id == null || !isDmcaContentType(t.content_type)) {
        // URL-only target (not mapped to a row): nothing to hide in the DB,
        // but any stored file URL is still quarantined/blocked.
        if (t.original_url) registryIds.push(...(await registerQuarantinedUrls([{ dmcaCaseId: c.id, dmcaTargetId: t.id, originalUrl: t.original_url }], tx)));
        await tx.execute(sql`UPDATE dmca_targets SET status = 'taken_down', taken_down_at = now() WHERE id = ${t.id}`);
        taken++;
        continue;
      }
      const def = getContentTypeDef(t.content_type);
      const row = (await tx.execute(sql`SELECT * FROM ${sql.identifier(def.table)} WHERE id = ${t.content_id} FOR UPDATE`)).rows[0] as any;
      if (!row) throw new DmcaServiceError(`${t.content_type} ${t.content_id} no longer exists`, 409);
      // One active takedown per item: a second case must not overwrite the
      // first case's linkage, otherwise restoring either case could republish
      // content the other case still requires hidden.
      if (def.hasVisibilityColumns && row.visibility_status === "dmca_hidden" && row.dmca_case_id != null && Number(row.dmca_case_id) !== c.id) {
        throw new DmcaServiceError(`${t.content_type} ${t.content_id} is already taken down under another active DMCA case (id ${row.dmca_case_id})`, 409);
      }
      const fileUrls = collectContentFileUrls(def, row);
      const originalState: Record<string, unknown> = {
        visibility_status: def.hasVisibilityColumns ? row.visibility_status : null,
        hidden_at: row.hidden_at ?? null,
        hidden_reason: row.hidden_reason ?? null,
        dmca_case_id: row.dmca_case_id ?? null,
        file_urls: fileUrls,
      };
      if (def.type === "avatar") originalState.avatar_url = row.avatar_url ?? null;

      if (def.hasVisibilityColumns) {
        await tx.execute(sql`
          UPDATE ${sql.identifier(def.table)}
          SET visibility_status = 'dmca_hidden', hidden_at = now(), hidden_by_admin_id = ${actor.id},
              hidden_reason = ${reason}, dmca_case_id = ${c.id}
          WHERE id = ${t.content_id}`);
      } else if (def.type === "avatar") {
        await tx.execute(sql`UPDATE users SET avatar_url = NULL WHERE id = ${t.content_id}`);
      }
      const regIds = await registerQuarantinedUrls(
        fileUrls.map((u) => ({ dmcaCaseId: c.id, dmcaTargetId: t.id, originalUrl: u })),
        tx,
      );
      registryIds.push(...regIds);
      await tx.execute(sql`
        UPDATE dmca_targets SET status = 'taken_down', taken_down_at = now(), original_state = ${JSON.stringify(originalState)}::jsonb,
          storage_objects = ${JSON.stringify({ registryIds: regIds, urls: fileUrls })}::jsonb
        WHERE id = ${t.id}`);

      const uploader = t.uploader_user_id ?? (row[def.ownerColumn] != null ? Number(row[def.ownerColumn]) : null);
      if (uploader != null) {
        await tx.execute(sql`
          INSERT INTO user_copyright_events (user_id, dmca_case_id, dmca_target_id, event_type, counts_toward_repeat_policy, status, created_by, notes)
          VALUES (${uploader}, ${c.id}, ${t.id}, 'content_taken_down', true, 'active', ${actor.id}, ${reason})`);
        const list = uploaders.get(uploader) ?? [];
        list.push(t.original_url || `${t.content_type} #${t.content_id}`);
        uploaders.set(uploader, list);
      }
      await writeDmcaAudit(
        {
          event: "content_taken_down",
          actorType: actor.type,
          actorId: actor.id,
          dmcaCaseId: c.id,
          targetType: t.content_type,
          targetId: t.content_id,
          ipAddress: actor.ipAddress ?? null,
          previousValue: originalState,
          newValue: { visibility_status: def.hasVisibilityColumns ? "dmca_hidden" : null, avatar_url: def.type === "avatar" ? null : undefined, quarantinedFiles: fileUrls.length },
          notes: reason,
        },
        tx,
      );
      taken++;
    }

    let noticesQueued = 0;
    if (notify) {
      for (const [uid, items] of uploaders) {
        const u = await userEmail(tx, uid);
        if (!u.email) {
          await writeDmcaAudit({ event: "uploader_notice_skipped_no_email", actorType: "system", dmcaCaseId: c.id, targetType: "user", targetId: uid }, tx);
          continue;
        }
        const id = await enqueueNotification(
          {
            eventType: "dmca.uploader_takedown_notice",
            dmcaCaseId: c.id,
            dedupeKey: `dmca:${c.id}:takedown_notice:${uid}`,
            data: { caseId: c.id, userId: uid, onSent: "mark_uploader_notified" },
            email: {
              to: u.email,
              subject: `Content removed after a copyright notice (case ${c.case_number})`,
              text: [
                `Hello${u.name ? ` ${u.name}` : ""},`,
                ``,
                `We received a copyright notice under the Digital Millennium Copyright Act (DMCA) and have disabled access to the following content you posted on Barefoot Bay:`,
                ...items.map((i) => `  - ${i}`),
                ``,
                `Case number: ${c.case_number}`,
                ``,
                `The content has not been deleted. If you believe it was removed by mistake or misidentification, you may submit a counter-notice. See ${appBaseUrl()}/dmca for our copyright policy and instructions, and quote your case number.`,
                ``,
                `Barefoot Bay Community`,
              ].join("\n"),
            },
          },
          tx,
        );
        if (id != null) noticesQueued++;
      }
    }

    // Verified physical quarantine is REQUIRED before the takedown commits:
    // every stored file is moved off its public key (so even direct
    // object-storage URLs stop working). If any move fails, the moves already
    // made are reversed and the whole takedown is rolled back.
    outcomes = await moveRegisteredToQuarantine(String(c.case_number), registryIds, tx);
    takedownMoves = movesFromOutcomes(outcomes);
    const failed = outcomes.filter((o) => o.location === "move_failed");
    if (failed.length) {
      throw new DmcaServiceError(
        `Takedown aborted: ${failed.length} file(s) could not be moved into quarantine (${failed.map((f) => f.error).join("; ")}). Nothing was changed; retry.`,
        502,
      );
    }
    await writeDmcaAudit(
      { event: "files_quarantined", actorType: "system", dmcaCaseId: c.id, newValue: { outcomes } },
      tx,
    );

    await setCaseStatus(tx, c, S.CONTENT_REMOVED, actor, { takedown_at: new Date() }, reason);
    return { caseNumber: String(c.case_number), taken, registryIds, noticesQueued };
  }).catch(async (err) => {
    if (takedownMoves.length) {
      await reverseMoves(takedownMoves).catch((cErr) => {
        logger.error({ cErr, caseId: opts.caseId }, "[DMCA] takedown rolled back but file compensation failed");
      });
    }
    throw err;
  });

  // Post-commit: gate now blocks every registered URL (belt and braces).
  await refreshQuarantineRegistry().catch((err) => logger.error({ err }, "[DMCA] registry refresh after takedown failed"));
  await invalidateSitemap();
  return { caseNumber: txResult.caseNumber, targetsTakenDown: txResult.taken, filesRegistered: txResult.registryIds.length, noticesQueued: txResult.noticesQueued };
}

async function invalidateSitemap(): Promise<void> {
  try {
    const mod = await import("../routes/sitemap");
    (mod as any).invalidateAllSitemapSections?.();
  } catch (err) {
    logger.warn({ err }, "[DMCA] could not invalidate sitemap cache");
  }
}

/** Called by the outbox dispatcher once an uploader takedown notice is actually delivered. */
export async function markUploaderNotified(caseId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const c = await lockCase(tx, caseId);
    if (c.status !== S.CONTENT_REMOVED) {
      if (!c.uploader_notified_at) await tx.execute(sql`UPDATE dmca_cases SET uploader_notified_at = now() WHERE id = ${caseId}`);
      return;
    }
    await setCaseStatus(tx, c, S.UPLOADER_NOTIFIED, { type: "system", id: null }, { uploader_notified_at: new Date() }, "Takedown notice delivered to uploader");
  });
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------
export async function restoreCase(opts: { caseId: number; actor: DmcaActor; reason: string; notify?: boolean }): Promise<{ targetsRestored: number }> {
  await assertActorPermission(opts.actor, DmcaPermission.RESTORE);
  if (!opts.reason?.trim()) throw new DmcaServiceError("A restoration reason is required");
  const actor = opts.actor;
  const notify = opts.notify ?? true;

  // Files moved back inside the transaction; re-quarantined if it does not commit.
  let restoreMoves: MovedFile[] = [];
  const result = await db.transaction(async (tx) => {
    const c = await lockCase(tx, opts.caseId);
    if (c.legal_hold) throw new DmcaServiceError("This case is under legal hold; content cannot be restored", 423);
    assertTransition(c.status, S.RESTORED);
    const targets = (await tx.execute(sql`SELECT * FROM dmca_targets WHERE dmca_case_id = ${c.id} AND status = 'taken_down' ORDER BY id FOR UPDATE`)).rows as any[];
    const reg = (await tx.execute(sql`SELECT id FROM dmca_quarantined_objects WHERE dmca_case_id = ${c.id} AND status = 'quarantined'`)).rows as any[];
    const registryIds = reg.map((r) => Number(r.id));

    // Verify every row is still hidden under THIS case before touching files,
    // so we never mark a target restored without actually restoring it.
    for (const t of targets) {
      if (t.content_id == null || !isDmcaContentType(t.content_type)) continue;
      const def = getContentTypeDef(t.content_type);
      if (!def.hasVisibilityColumns) continue;
      const cur = (await tx.execute(sql`SELECT visibility_status, dmca_case_id FROM ${sql.identifier(def.table)} WHERE id = ${t.content_id} FOR UPDATE`)).rows[0] as any;
      if (!cur || cur.visibility_status !== "dmca_hidden" || Number(cur.dmca_case_id) !== c.id) {
        throw new DmcaServiceError(`${t.content_type} ${t.content_id} is no longer hidden under this case; restore aborted`, 409);
      }
    }

    // Move bytes back first; any failure aborts the whole restore (content
    // stays hidden, URLs stay blocked by the registry).
    restoreMoves = await moveQuarantinedBack(registryIds, tx);

    const uploaders = new Set<number>();
    for (const t of targets) {
      if (t.content_id != null && isDmcaContentType(t.content_type)) {
        const def = getContentTypeDef(t.content_type);
        const original = (t.original_state ?? {}) as Record<string, any>;
        if (def.hasVisibilityColumns) {
          const restoreTo = original.visibility_status && original.visibility_status !== "dmca_hidden" ? original.visibility_status : "published";
          // Restore the full pre-takedown snapshot (status + hidden metadata + prior case link).
          const upd = await tx.execute(sql`
            UPDATE ${sql.identifier(def.table)}
            SET visibility_status = ${restoreTo}, restored_at = now(), restored_by_admin_id = ${actor.id},
                hidden_at = ${original.hidden_at ?? null}, hidden_reason = ${original.hidden_reason ?? null},
                hidden_by_admin_id = NULL, dmca_case_id = ${original.dmca_case_id ?? null}
            WHERE id = ${t.content_id} AND visibility_status = 'dmca_hidden' AND dmca_case_id = ${c.id}`);
          if (!upd.rowCount) throw new DmcaServiceError(`${t.content_type} ${t.content_id} could not be restored`, 409);
        } else if (def.type === "avatar" && original.avatar_url) {
          await tx.execute(sql`UPDATE users SET avatar_url = ${original.avatar_url} WHERE id = ${t.content_id} AND avatar_url IS NULL`);
        }
        await writeDmcaAudit(
          {
            event: "content_restored",
            actorType: actor.type,
            actorId: actor.id,
            dmcaCaseId: c.id,
            targetType: t.content_type,
            targetId: t.content_id,
            ipAddress: actor.ipAddress ?? null,
            previousValue: { visibility_status: "dmca_hidden" },
            newValue: original,
            notes: opts.reason,
          },
          tx,
        );
      }
      await tx.execute(sql`UPDATE dmca_targets SET status = 'restored', restored_at = now() WHERE id = ${t.id}`);
      if (t.uploader_user_id != null) uploaders.add(Number(t.uploader_user_id));
    }
    if (registryIds.length) {
      await tx.execute(sql`UPDATE dmca_quarantined_objects SET status = 'restored', restored_at = now() WHERE id = ANY(${pgIntArray(registryIds.map(Number))})`);
    }
    await tx.execute(sql`
      UPDATE user_copyright_events SET status = 'reversed', counts_toward_repeat_policy = false,
        notes = COALESCE(notes, '') || ${`\n[restored ${new Date().toISOString()}] ${opts.reason}`}
      WHERE dmca_case_id = ${c.id} AND status = 'active'`);
    await tx.execute(sql`
      UPDATE notification_outbox SET status = 'cancelled', last_error = 'case restored'
      WHERE dmca_case_id = ${c.id} AND status IN ('pending', 'failed') AND event_type LIKE 'dmca.restoration_%'`);

    if (notify) {
      for (const uid of uploaders) {
        const u = await userEmail(tx, uid);
        if (!u.email) continue;
        await enqueueNotification(
          {
            eventType: "dmca.uploader_restored_notice",
            dmcaCaseId: c.id,
            dedupeKey: `dmca:${c.id}:restored_notice:${uid}`,
            data: { caseId: c.id, userId: uid },
            email: {
              to: u.email,
              subject: `Your content has been restored (case ${c.case_number})`,
              text: `Hello${u.name ? ` ${u.name}` : ""},\n\nThe content that was disabled under DMCA case ${c.case_number} has been restored at its original location.\n\nBarefoot Bay Community`,
            },
          },
          tx,
        );
      }
      if (c.claimant_email) {
        await enqueueNotification(
          {
            eventType: "dmca.claimant_restored_notice",
            dmcaCaseId: c.id,
            dedupeKey: `dmca:${c.id}:claimant_restored_notice`,
            data: { caseId: c.id },
            email: {
              to: c.claimant_email,
              subject: `Content restored (case ${c.case_number})`,
              text: `Hello${c.claimant_name ? ` ${c.claimant_name}` : ""},\n\nThe material identified in DMCA case ${c.case_number} has been restored.\n\nBarefoot Bay Community`,
            },
          },
          tx,
        );
      }
    }
    await setCaseStatus(tx, c, S.RESTORED, actor, { restored_at: new Date() }, opts.reason);
    return { targetsRestored: targets.length };
  }).catch(async (err) => {
    if (restoreMoves.length) {
      // The DB still says "hidden": put the bytes back into quarantine.
      await reverseMoves(restoreMoves).catch((cErr) => {
        logger.error({ cErr, caseId: opts.caseId }, "[DMCA] restore rolled back but re-quarantine of files failed");
      });
    }
    throw err;
  });

  await refreshQuarantineRegistry().catch((err) => logger.error({ err }, "[DMCA] registry refresh after restore failed"));
  await invalidateSitemap();
  return result;
}

// ---------------------------------------------------------------------------
// Court action
// ---------------------------------------------------------------------------
export async function recordCourtAction(opts: { caseId: number; actor: DmcaActor; submission: Omit<SubmissionInput, "submissionType">; reason?: string }): Promise<void> {
  await assertActorPermission(opts.actor, DmcaPermission.MANAGE_HOLDS);
  const actor = opts.actor;
  const reason = opts.reason ?? "Court action filed; content must remain disabled";
  await db.transaction(async (tx) => {
    const c = await lockCase(tx, opts.caseId);
    assertTransition(c.status, S.COURT_ACTION_RECEIVED);
    await addSubmission(c.id, { ...opts.submission, submissionType: "court_action_notice" }, actor, tx);
    const targets = (await tx.execute(sql`SELECT * FROM dmca_targets WHERE dmca_case_id = ${c.id}`)).rows as any[];
    for (const t of targets) {
      if (t.content_id == null || !isDmcaContentType(t.content_type)) continue;
      await placeHoldTx(tx, { caseType: "dmca", caseId: c.id, contentType: t.content_type, contentId: Number(t.content_id), userId: null, reason, actor });
    }
    await tx.execute(sql`
      UPDATE notification_outbox SET status = 'cancelled', last_error = 'court action received'
      WHERE dmca_case_id = ${c.id} AND status IN ('pending', 'failed') AND event_type LIKE 'dmca.restoration_%'`);
    await setCaseStatus(
      tx,
      c,
      S.COURT_ACTION_RECEIVED,
      actor,
      { court_action_received_at: new Date(), legal_hold: true, restore_eligible_at: null, restore_deadline_at: null },
      reason,
    );
  });
}

// ---------------------------------------------------------------------------
// Legal holds
// ---------------------------------------------------------------------------
export interface HoldInput {
  caseType?: string | null;
  caseId?: number | null;
  contentType?: DmcaContentType | null;
  contentId?: number | null;
  userId?: number | null;
  /** Private messages are not DMCA-targetable content but can be preserved under hold. */
  messageId?: number | null;
  reason: string;
  actor: DmcaActor;
}

async function placeHoldTx(tx: DbExecutor, h: HoldInput): Promise<number> {
  if (!h.reason?.trim()) throw new DmcaServiceError("A legal-hold reason is required");
  if (!(h.contentType && h.contentId != null) && h.userId == null && h.messageId == null) {
    throw new DmcaServiceError("A hold must target content, a message or a user");
  }
  if (h.messageId != null) {
    const m = await tx.execute(sql`UPDATE messages SET legal_hold = true WHERE id = ${h.messageId} RETURNING id`);
    if (!m.rows.length) throw new DmcaServiceError(`message ${h.messageId} does not exist`, 404);
  }
  if (h.contentType) {
    const def = getContentTypeDef(h.contentType);
    const exists = await tx.execute(sql`SELECT id FROM ${sql.identifier(def.table)} WHERE id = ${h.contentId}`);
    if (!exists.rows.length) throw new DmcaServiceError(`${h.contentType} ${h.contentId} does not exist`, 404);
    if (def.hasVisibilityColumns) {
      await tx.execute(sql`UPDATE ${sql.identifier(def.table)} SET legal_hold = true WHERE id = ${h.contentId}`);
    }
  }
  if (h.userId != null) await tx.execute(sql`UPDATE users SET legal_hold = true WHERE id = ${h.userId}`);
  const r = await tx.execute(sql`
    INSERT INTO legal_holds (case_type, case_id, content_type, content_id, user_id, reason, placed_by)
    VALUES (${h.caseType ?? null}, ${h.caseId ?? null}, ${h.messageId != null ? "message" : h.contentType ?? null},
      ${h.messageId ?? h.contentId ?? null}, ${h.userId ?? null}, ${h.reason}, ${h.actor.id})
    RETURNING id`);
  const holdId = Number((r.rows[0] as any).id);
  await writeDmcaAudit(
    {
      event: "legal_hold_placed",
      actorType: h.actor.type,
      actorId: h.actor.id,
      dmcaCaseId: h.caseType === "dmca" ? h.caseId ?? null : null,
      targetType: h.messageId != null ? "message" : h.contentType ?? "user",
      targetId: h.messageId ?? h.contentId ?? h.userId ?? null,
      ipAddress: h.actor.ipAddress ?? null,
      newValue: { holdId, caseType: h.caseType ?? null, caseId: h.caseId ?? null },
      notes: h.reason,
    },
    tx,
  );
  return holdId;
}

export async function applyLegalHold(h: HoldInput): Promise<number> {
  await assertActorPermission(h.actor, DmcaPermission.MANAGE_HOLDS);
  return db.transaction(async (tx) => {
    const id = await placeHoldTx(tx, h);
    if (h.caseType === "dmca" && h.caseId != null) {
      await tx.execute(sql`UPDATE dmca_cases SET legal_hold = true, updated_at = now() WHERE id = ${h.caseId}`);
    }
    return id;
  });
}

export async function releaseLegalHold(opts: { holdId: number; actor: DmcaActor; reason: string }): Promise<void> {
  await assertActorPermission(opts.actor, DmcaPermission.MANAGE_HOLDS);
  if (!opts.reason?.trim()) throw new DmcaServiceError("A release reason is required");
  await db.transaction(async (tx) => {
    const r = await tx.execute(sql`SELECT * FROM legal_holds WHERE id = ${opts.holdId} FOR UPDATE`);
    const hold = r.rows[0] as any;
    if (!hold) throw new DmcaServiceError("Legal hold not found", 404);
    if (hold.released_at) throw new DmcaServiceError("Legal hold already released", 409);
    await tx.execute(sql`UPDATE legal_holds SET released_at = now(), released_by = ${opts.actor.id}, release_reason = ${opts.reason} WHERE id = ${opts.holdId}`);

    if (hold.content_type && hold.content_id != null && isDmcaContentType(hold.content_type)) {
      const def = getContentTypeDef(hold.content_type);
      const others = await tx.execute(sql`
        SELECT 1 FROM legal_holds WHERE released_at IS NULL AND content_type = ${hold.content_type} AND content_id = ${hold.content_id} LIMIT 1`);
      if (!others.rows.length && def.hasVisibilityColumns) {
        await tx.execute(sql`UPDATE ${sql.identifier(def.table)} SET legal_hold = false WHERE id = ${hold.content_id}`);
      }
    }
    if (hold.content_type === "message" && hold.content_id != null) {
      const others = await tx.execute(sql`
        SELECT 1 FROM legal_holds WHERE released_at IS NULL AND content_type = 'message' AND content_id = ${hold.content_id} LIMIT 1`);
      if (!others.rows.length) await tx.execute(sql`UPDATE messages SET legal_hold = false WHERE id = ${hold.content_id}`);
    }
    if (hold.user_id != null) {
      const others = await tx.execute(sql`SELECT 1 FROM legal_holds WHERE released_at IS NULL AND user_id = ${hold.user_id} LIMIT 1`);
      if (!others.rows.length) await tx.execute(sql`UPDATE users SET legal_hold = false WHERE id = ${hold.user_id}`);
    }
    if (hold.case_type === "dmca" && hold.case_id != null) {
      const others = await tx.execute(sql`
        SELECT 1 FROM legal_holds WHERE released_at IS NULL AND case_type = 'dmca' AND case_id = ${hold.case_id} LIMIT 1`);
      if (!others.rows.length) await tx.execute(sql`UPDATE dmca_cases SET legal_hold = false, updated_at = now() WHERE id = ${hold.case_id}`);
    }
    await writeDmcaAudit(
      {
        event: "legal_hold_released",
        actorType: opts.actor.type,
        actorId: opts.actor.id,
        dmcaCaseId: hold.case_type === "dmca" ? hold.case_id : null,
        targetType: hold.content_type ?? "user",
        targetId: hold.content_id ?? hold.user_id ?? null,
        ipAddress: opts.actor.ipAddress ?? null,
        previousValue: { holdId: hold.id, reason: hold.reason },
        notes: opts.reason,
      },
      tx,
    );
  });
}
