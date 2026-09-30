import { createHash, randomUUID } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import type { RequestHandler } from "express";
import { pool, db } from "./db";
import { eq, inArray } from "drizzle-orm";
import { messages, messageRecipients, messageAttachments, users } from "@workspace/db";
import { canReceiveNotificationEmail, sendMessageEmail } from "./sendgrid-service";
import { objectStorageService } from "./object-storage-service";
import { logger } from "./lib/logger";
import { SubmitMessageBody } from "@workspace/api-zod";

// No provider retry: SendGrid has no idempotency guarantee. An interrupted attempt
// becomes "unknown", never "failed" or accepted, and is NEVER automatically resent.
export function selectMailboxes(people: any[]) {
  const addresses = new Set<string>();
  let skipped = 0;
  for (const person of people) {
    const address = (person.email || person.username || "").trim().toLowerCase();
    if (!canReceiveNotificationEmail(person) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || addresses.has(address)) {
      skipped++;
    } else addresses.add(address);
  }
  return { addresses: [...addresses], skipped };
}

export const reserveMessageSend: RequestHandler = async (req, res, next) => {
  const key = req.get("Idempotency-Key");
  if (!key || !/^[a-zA-Z0-9-]{16,100}$/.test(key)) {
    for (const file of (req.files as Express.Multer.File[] || [])) unlinkSync(file.path);
    res.status(400).json({ error: "A valid Idempotency-Key is required. Refresh the messaging page." });
    return;
  }
  const parsed = SubmitMessageBody.safeParse(req.body);
  if (!parsed.success) {
    for (const file of (req.files as Express.Multer.File[] || [])) unlinkSync(file.path);
    res.status(400).json({ error: "Message content and email options are invalid." });
    return;
  }
  const hash = createHash("sha256").update(req.path).update(JSON.stringify(req.body));
  for (const file of (req.files as Express.Multer.File[] || [])) {
    hash.update(file.originalname).update(file.mimetype).update(readFileSync(file.path));
  }
  const fingerprint = hash.digest("hex");
  const id = randomUUID();
  try {
    const result = await pool.query(
      `INSERT INTO message_send_requests (id,sender_id,request_key,fingerprint,email_requested,template_id)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (sender_id,request_key) DO NOTHING RETURNING id`,
      [id, req.user!.id, key, fingerprint, req.body.sendEmail === "true", req.body.templateId || null]);
    if (!result.rowCount) {
      for (const file of (req.files as Express.Multer.File[] || [])) unlinkSync(file.path);
      const { rows: [prior] } = await pool.query(
        "SELECT * FROM message_send_requests WHERE sender_id=$1 AND request_key=$2", [req.user!.id, key]);
      if (prior.fingerprint !== fingerprint) {
        res.status(409).json({ error: "This submission key belongs to different content. The original submission has not been resent." });
      } else if (prior.response) {
        res.status(prior.response_code).json(prior.response);
      } else {
        res.status(409).json({ error: "Submission is still preparing or was interrupted. Check send progress; do not create a duplicate.", requestId: prior.id });
      }
      return;
    }
    res.locals.sendRequest = id;
    // Persist the exact outcome before exposing it to the client, even for
    // validation failures. An uncertain HTTP result can replay without creation.
    const json = res.json.bind(res);
    res.json = ((body: any) => {
      const code = res.statusCode;
      void pool.query(
        `UPDATE message_send_requests SET response=$2,response_code=$3,
         state=CASE WHEN state='preparing' AND message_id IS NOT NULL AND $3>=400 THEN 'email_setup_failed'
           WHEN state='preparing' THEN $4 ELSE state END WHERE id=$1`,
        [id, JSON.stringify(body), code, code >= 400 ? "creation_failed" : "complete"])
        .then(() => json(body))
        .catch(() => { res.statusCode = 503; json({ error: "Submission outcome could not be confirmed. Retry with the same submission key." }); });
      return res;
    }) as typeof res.json;
    next();
  } catch (error) { next(error); }
};

export async function recordCreatedMessage(requestId: string, messageId: number) {
  await pool.query("UPDATE message_send_requests SET message_id=$2 WHERE id=$1", [requestId, messageId]);
}

export async function enqueueMessageEmail(requestId: string, messageId: number, senderId: number, expectedAttachments = 0) {
  // Promote any legacy local-only attachment before accepting a durable job.
  const storedAttachments = await db.select().from(messageAttachments).where(eq(messageAttachments.messageId, messageId));
  if (storedAttachments.length !== expectedAttachments) throw new Error("An attachment could not be saved. Email was not queued.");
  for (const file of storedAttachments) {
    if (!file.storedFilename) throw new Error("Attachment storage reference is missing");
    try {
      await objectStorageService.getFile(`attachments/${file.storedFilename}`, "MESSAGES");
    } catch {
      await objectStorageService.uploadFile(`uploads/attachments/${file.storedFilename}`,
        "attachments", file.storedFilename, "MESSAGES");
    }
  }
  const recipients = await db.select().from(messageRecipients).where(eq(messageRecipients.messageId, messageId));
  const ids = [...new Set([senderId, ...recipients.map(r => r.recipientId)])];
  const people = await db.select().from(users).where(inArray(users.id, ids));
  const { addresses, skipped } = selectMailboxes(people);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const address of addresses) {
      const recipientIds = people.filter(person =>
        (person.email || person.username || "").trim().toLowerCase() === address).map(person => person.id);
      await client.query("INSERT INTO message_email_attempts (id,request_id,address,recipient_ids) VALUES ($1,$2,$3,$4)",
        [randomUUID(), requestId, address, recipientIds]);
    }
    await client.query("UPDATE message_send_requests SET state=$2,skipped=$3 WHERE id=$1",
      [requestId, addresses.length ? "sending" : "complete", skipped]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    await pool.query("UPDATE message_send_requests SET state='email_setup_failed' WHERE id=$1", [requestId]);
    throw error;
  } finally { client.release(); }
}

export async function listSendProgress(senderId: number) {
  const { rows } = await pool.query(
    `SELECT r.id, r.message_id AS "messageId", r.created_at AS "createdAt", r.email_requested AS "emailRequested",
      CASE WHEN r.state='preparing' AND r.created_at < now()-interval '10 minutes'
        THEN 'interrupted' ELSE r.state END AS state,
      (r.skipped + count(a.id) FILTER (WHERE a.state='skipped'))::int AS skipped,
      count(a.id)::int AS total,
      count(a.id) FILTER (WHERE a.state='queued')::int AS queued,
      count(a.id) FILTER (WHERE a.state IN ('sending','accepted','failed','unknown'))::int AS attempted,
      count(a.id) FILTER (WHERE a.state='accepted')::int AS accepted,
      count(a.id) FILTER (WHERE a.state='failed')::int AS failed,
      count(a.id) FILTER (WHERE a.state='unknown')::int AS unknown
     FROM message_send_requests r LEFT JOIN message_email_attempts a ON a.request_id=r.id
     WHERE r.sender_id=$1 AND r.dismissed_at IS NULL AND r.created_at > now()-interval '24 hours'
     GROUP BY r.id
     ORDER BY (r.state IN ('preparing','sending')) DESC, r.created_at DESC LIMIT 20`, [senderId]);
  return rows;
}

export async function dismissSendProgress(senderId: number, requestId: string): Promise<boolean> {
  // Display-only tombstone: keep the request, attempts, and underlying message
  // intact so worker state and duplicate-submission protection are unchanged.
  const { rowCount } = await pool.query(
    `UPDATE message_send_requests SET dismissed_at=COALESCE(dismissed_at, now())
     WHERE id=$1 AND sender_id=$2 AND dismissed_at IS NULL
       AND created_at > now()-interval '24 hours'`,
    [requestId, senderId]);
  return (rowCount ?? 0) > 0;
}

let busy = false;
async function withDeadline<T>(promise: Promise<T>, milliseconds = 60_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Email operation timed out")), milliseconds);
      timer.unref();
    })]);
  } finally { clearTimeout(timer!); }
}

export async function processMessageEmailQueue() {
  if (busy) return;
  busy = true;
  try {
    await pool.query(`UPDATE message_email_attempts SET state='unknown'
      WHERE state='sending' AND started_at < now()-interval '10 minutes'`);
    // A single atomic claim works across multiple server instances.
    const { rows: [attempt] } = await pool.query(
      `UPDATE message_email_attempts SET state='sending',started_at=now() WHERE id=(
        SELECT id FROM message_email_attempts WHERE state='queued' ORDER BY id
        FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
    if (attempt) {
      let outcome = "failed";
      try {
        const { rows: [request] } = await pool.query("SELECT * FROM message_send_requests WHERE id=$1", [attempt.request_id]);
        const [message] = await db.select().from(messages).where(eq(messages.id, request.message_id));
        const [sender] = await db.select().from(users).where(eq(users.id, request.sender_id));
        if (!message || !sender) throw new Error("Message or sender unavailable");
        // Recheck opt-outs at execution time, including shared mailboxes.
        const { rows: mailboxUsers } = await pool.query(
          `SELECT email_notifications_enabled AS "emailNotificationsEnabled"
           FROM users WHERE lower(trim(COALESCE(NULLIF(email,''),username)))=$1
           AND id = ANY($2::integer[])`, [attempt.address, attempt.recipient_ids]);
        if (!mailboxUsers.some(p => canReceiveNotificationEmail(p))) {
          outcome = "skipped";
        } else {
          const stored = await db.select().from(messageAttachments).where(eq(messageAttachments.messageId, message.id));
          const attachments = [];
          for (const file of stored) {
            // Never silently omit an attachment and never persist file bytes in SQL.
            const bytes = await withDeadline(objectStorageService.getFile(`attachments/${file.storedFilename}`, "MESSAGES"));
            attachments.push({ content: bytes.toString("base64"), filename: file.filename, type: file.contentType || "application/octet-stream" });
          }
          outcome = "unknown";
          const content = request.template_id && request.template_id !== "custom"
            ? message.content.replace(/\{\{firstName\}\}/g, "Member").replace(/\{\{expirationDate\}\}/g, "[Date]")
            : message.content;
          outcome = await withDeadline(sendMessageEmail(attempt.address, message.subject, content,
            sender.fullName || sender.username, sender.email || "noreply@barefootbay.com",
            attachments.length ? attachments : undefined, undefined, Boolean(message.inReplyTo),
            undefined, { throwOnUncertain: true })) ? "accepted" : "failed";
        }
      } catch {
        // Exceptions can occur after provider acceptance; do not claim failure.
        logger.warn({ attemptId: attempt.id, outcome }, "Email attempt could not finish; not retrying");
      }
      await pool.query("UPDATE message_email_attempts SET state=$2 WHERE id=$1 AND state='sending'", [attempt.id, outcome]);
    }
    await pool.query(`UPDATE message_send_requests r SET state='complete' WHERE state='sending'
      AND NOT EXISTS (SELECT 1 FROM message_email_attempts a WHERE a.request_id=r.id AND a.state IN ('queued','sending'))`);
  } finally { busy = false; }
}

// Durable queued rows are resumed on startup without requiring a browser visit.
if (process.env.NODE_ENV !== "test") {
  const timer = setInterval(() => {
    void processMessageEmailQueue().catch(() => logger.error("Message email queue unavailable"));
  }, 1000);
  timer.unref();
}