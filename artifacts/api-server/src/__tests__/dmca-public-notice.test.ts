import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import router, { DMCA_PUBLIC_STATUS_LABELS, dmcaPublicNoticeSchema, setDmcaRecaptchaVerifierForTests, statusLabels } from "../routes/dmca-public";
import { DmcaCaseStatus } from "../dmca/state-machine";
import { DEFAULT_DMCA_POLICY_SECTIONS } from "../dmca/policy-defaults";
import { redactSensitivePath, redactSensitiveProps } from "../lib/redact-path";

const validNotice = {
  name: "Notice Claimant",
  email: "claimant@example.test",
  phone: "555-555-0199",
  address: "100 Example Street, Example, FL 32976",
  role: "owner" as const,
  workTitle: "Example photograph",
  workDescription: "An original example photograph made by the claimant.",
  infringingUrls: ["https://barefootbay.com/forum/post/999999999"],
  goodFaith: true as const,
  accuracyPerjury: true as const,
  signature: "Notice Claimant",
  recaptchaToken: "test-token",
};

describe("public DMCA notice validation", () => {
  for (const field of ["name", "email", "phone", "address", "role", "workTitle", "workDescription", "infringingUrls", "goodFaith", "accuracyPerjury", "signature", "recaptchaToken"] as const) {
    it(`reports ${field} when it is missing`, () => {
      const body: any = { ...validNotice };
      delete body[field];
      const result = dmcaPublicNoticeSchema.safeParse(body);
      assert.equal(result.success, false);
      if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path[0] === field));
    });
  }

  it("requires the copyright owner name from an agent", () => {
    const result = dmcaPublicNoticeSchema.safeParse({ ...validNotice, role: "agent" });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path[0] === "copyrightOwnerName"));
  });
});

describe("public DMCA status labels", () => {
  it("maps every internal case status to one of the six claimant-safe labels", () => {
    for (const status of Object.values(DmcaCaseStatus)) {
      assert.ok((DMCA_PUBLIC_STATUS_LABELS as readonly string[]).includes(statusLabels[status]), `${status} -> ${statusLabels[status]}`);
    }
  });
});

describe("DMCA status token redaction", () => {
  it("strips the bearer token from paths, URLs and analytics property bags", () => {
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    assert.equal(redactSensitivePath(`/api/dmca/status/${token}`), "/api/dmca/status/[redacted]");
    assert.equal(redactSensitivePath(`https://barefootbay.com/dmca/status/${token}?x=1`), "https://barefootbay.com/dmca/status/[redacted]?x=1");
    assert.equal(redactSensitivePath("/dmca/notice"), "/dmca/notice");
    assert.equal(redactSensitivePath(null), null);
    const props: any = redactSensitiveProps({ url: `/dmca/status/${token}`, referrer: `https://x.test/dmca/status/${token}`, other: 1 });
    assert.ok(!JSON.stringify(props).includes(token));
    assert.equal(props.other, 1);
  });
});

describe("public DMCA endpoints", () => {
  let server: ReturnType<ReturnType<typeof express>["listen"]>;
  let origin = "";
  const caseIds: number[] = [];

  before(async () => {
    process.env.APP_BASE_URL = "https://barefootbay.com";
    setDmcaRecaptchaVerifierForTests(async () => true);
    const app = express();
    app.set("trust proxy", 1); // mirror app.ts so req.ip semantics match production
    app.use(express.json());
    app.use((req: any, _res, next) => {
      const testId = req.headers["x-test-user"];
      req.isAuthenticated = () => !!testId;
      if (testId) req.user = { id: Number(testId), role: "user" };
      next();
    });
    app.use("/api/dmca", router);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server failed to bind");
    origin = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    setDmcaRecaptchaVerifierForTests(null);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (caseIds.length) {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL dmca.allow_purge = 'on'`);
        const ids = sql`ARRAY[${sql.join(caseIds.map((id) => sql`${id}`), sql`, `)}]::int[]`;
        await tx.execute(sql`DELETE FROM notification_outbox WHERE dmca_case_id = ANY(${ids})`);
        await tx.execute(sql`DELETE FROM dmca_targets WHERE dmca_case_id = ANY(${ids})`);
        await tx.execute(sql`DELETE FROM dmca_submissions WHERE dmca_case_id = ANY(${ids})`);
        await tx.execute(sql`DELETE FROM dmca_audit_log WHERE dmca_case_id = ANY(${ids})`);
        await tx.execute(sql`DELETE FROM dmca_cases WHERE id = ANY(${ids})`);
      });
    }
  });

  it("returns the seven pending-counsel defaults and protects settings", async () => {
    const policy = await fetch(`${origin}/api/dmca/policy`);
    assert.equal(policy.status, 200);
    const body: any = await policy.json();
    assert.deepEqual(body.sections.map((section: any) => section.key), DEFAULT_DMCA_POLICY_SECTIONS.map((section) => section.key));
    assert.ok(body.sections.every((section: any) => section.pendingCounselReview === true || !section.body.includes("PENDING COUNSEL REVIEW")));
    assert.equal(body.canEdit, false);

    const update = await fetch(`${origin}/api/dmca/settings`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    });
    assert.equal(update.status, 401);
  });

  it("creates an immutable received case without taking content down and exposes only safe status fields", async () => {
    const selected = await db.execute(sql`SELECT id, visibility_status FROM forum_posts WHERE visibility_status='published' ORDER BY id LIMIT 1`);
    const post = selected.rows[0] as any;
    const urls = [
      post ? `https://barefootbay.com/forum/post/${post.id}` : "https://barefootbay.com/forum/post/999999998",
      "https://barefootbay.com/community/not-a-real-category/not-a-real-page",
    ];
    const response = await fetch(`${origin}/api/dmca/notices`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "dmca-test-agent", "x-forwarded-for": "192.0.2.25" },
      body: JSON.stringify({ ...validNotice, infringingUrls: urls }),
    });
    const responseText = await response.text();
    assert.equal(response.status, 201, responseText);
    const created: any = JSON.parse(responseText);
    assert.match(created.caseNumber, /^BB-DMCA-\d{4}-\d{6}$/);
    assert.match(created.statusUrl, /^\/dmca\/status\/[A-Za-z0-9_-]{32}$/);

    const rows = await db.execute(sql`SELECT * FROM dmca_cases WHERE case_number=${created.caseNumber}`);
    const dmcaCase = rows.rows[0] as any;
    assert.ok(dmcaCase);
    caseIds.push(Number(dmcaCase.id));
    assert.equal(dmcaCase.status, "RECEIVED");
    assert.equal(dmcaCase.validity_status, "unchecked");
    assert.equal(dmcaCase.completeness.note, "automated presence check only; not a legal determination");
    assert.equal(dmcaCase.completeness.unmatchedCount >= 1, true);

    const submissions = await db.execute(sql`SELECT * FROM dmca_submissions WHERE dmca_case_id=${dmcaCase.id}`);
    assert.equal(submissions.rows.length, 1);
    assert.equal((submissions.rows[0] as any).user_agent, "dmca-test-agent");
    assert.equal((submissions.rows[0] as any).ip_address, "192.0.2.25");
    assert.equal((submissions.rows[0] as any).signature_value, "Notice Claimant");
    assert.equal((submissions.rows[0] as any).submission_type, "notice");
    assert.equal((submissions.rows[0] as any).submitted_by_user_id, null);
    // Immutable: the append-only trigger rejects edits.
    await assert.rejects(db.execute(sql`UPDATE dmca_submissions SET signature_value='tampered' WHERE id=${(submissions.rows[0] as any).id}`));
    assert.equal((submissions.rows[0] as any).form_payload.recaptchaToken, undefined);
    const targets = await db.execute(sql`SELECT * FROM dmca_targets WHERE dmca_case_id=${dmcaCase.id} ORDER BY id`);
    assert.equal(targets.rows.length, 2);
    assert.ok((targets.rows as any[]).some((target) => target.content_id == null && target.content_type === "url"));
    if (post) assert.ok((targets.rows as any[]).some((target) => target.content_type === "forum_post" && Number(target.content_id) === Number(post.id)));
    assert.ok((targets.rows as any[]).every((target) => target.status === "pending"));
    const audits = await db.execute(sql`SELECT event FROM dmca_audit_log WHERE dmca_case_id=${dmcaCase.id}`);
    assert.ok((audits.rows as any[]).some((row) => row.event === "notice_received"));
    const outbox = await db.execute(sql`SELECT event_type, payload FROM notification_outbox WHERE dmca_case_id=${dmcaCase.id}`);
    const claimantMail = (outbox.rows as any[]).find((row) => row.event_type === "dmca_notice_claimant_confirmation");
    assert.ok(claimantMail);
    assert.equal(claimantMail.payload.email.to, "claimant@example.test");
    assert.ok(claimantMail.payload.email.text.includes(created.caseNumber));
    assert.ok(claimantMail.payload.email.text.includes("Designated Agent"));
    assert.ok(claimantMail.payload.email.text.includes(created.statusUrl));
    if (post) {
      const current = await db.execute(sql`SELECT visibility_status FROM forum_posts WHERE id=${post.id}`);
      assert.equal((current.rows[0] as any).visibility_status, "published");
    }

    const status = await fetch(`${origin}/api/dmca${created.statusUrl.replace(/^\/dmca/, "")}`);
    assert.equal(status.status, 200);
    const publicStatus: any = await status.json();
    assert.deepEqual(Object.keys(publicStatus).sort(), ["caseNumber", "receivedAt", "status", "updatedAt"]);
    assert.equal(publicStatus.status, "Received");
    assert.equal(JSON.stringify(publicStatus).includes("claimant@example.test"), false);

    // Internal notes / uploader identity never leak, even after a takedown.
    await db.execute(sql`UPDATE dmca_cases SET status='CONTENT_REMOVED', internal_notes='SECRET-INTERNAL-NOTE' WHERE id=${dmcaCase.id}`);
    const later: any = await (await fetch(`${origin}/api/dmca${created.statusUrl.replace(/^\/dmca/, "")}`)).json();
    assert.equal(later.status, "Content disabled");
    assert.deepEqual(Object.keys(later).sort(), ["caseNumber", "receivedAt", "status", "updatedAt"]);
    assert.equal(JSON.stringify(later).includes("SECRET-INTERNAL-NOTE"), false);

    const missing = await fetch(`${origin}/api/dmca/status/${"x".repeat(32)}`);
    assert.equal(missing.status, 404);
  });

  it("links a signed-in claimant to their own case, not to a supplied identity", async () => {
    const ownerId = Number((await db.execute(sql`SELECT id FROM users ORDER BY id LIMIT 1`)).rows[0]?.id);
    assert.ok(ownerId);
    const response = await fetch(`${origin}/api/dmca/notices`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": String(ownerId), "x-forwarded-for": "192.0.2.73" },
      body: JSON.stringify({ ...validNotice, infringingUrls: ["https://barefootbay.com/forum/post/999999997"] }),
    });
    const created: any = await response.json();
    assert.equal(response.status, 201, JSON.stringify(created));
    const row = (await db.execute(sql`
      SELECT c.id,s.submitted_by_user_id FROM dmca_cases c
      JOIN dmca_submissions s ON s.dmca_case_id=c.id
      WHERE c.case_number=${created.caseNumber}`)).rows[0] as any;
    caseIds.push(Number(row.id));
    assert.equal(Number(row.submitted_by_user_id), ownerId);
    const forged = await fetch(`${origin}/api/dmca/notices`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": String(ownerId), "x-forwarded-for": "192.0.2.74" },
      body: JSON.stringify({ ...validNotice, submittedByUserId: ownerId + 1 }),
    });
    assert.equal(forged.status, 400);
  });

  it("rejects a failed CAPTCHA without creating a case", async () => {
    const before = await db.execute(sql`SELECT count(*)::int AS n FROM dmca_cases`);
    setDmcaRecaptchaVerifierForTests(async () => false);
    try {
      const response = await fetch(`${origin}/api/dmca/notices`, {
        method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.26" },
        body: JSON.stringify(validNotice),
      });
      assert.equal(response.status, 403);
    } finally {
      setDmcaRecaptchaVerifierForTests(async () => true);
    }
    const afterCount = await db.execute(sql`SELECT count(*)::int AS n FROM dmca_cases`);
    assert.equal((afterCount.rows[0] as any).n, (before.rows[0] as any).n);
  });

  it("rejects URLs that are not on the Barefoot Bay site", async () => {
    const response = await fetch(`${origin}/api/dmca/notices`, {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.27" },
      body: JSON.stringify({ ...validNotice, infringingUrls: ["https://evil.example.com/x"] }),
    });
    assert.equal(response.status, 400);
    const body: any = await response.json();
    assert.ok(body.errors["infringingUrls.0"]);
  });

  it("records the proxy-derived IP, not a client-forged X-Forwarded-For entry", async () => {
    const response = await fetch(`${origin}/api/dmca/notices`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.99, 192.0.2.31" },
      body: JSON.stringify(validNotice),
    });
    const created: any = await response.json();
    assert.equal(response.status, 201, JSON.stringify(created));
    const rows = await db.execute(sql`SELECT c.id, s.ip_address FROM dmca_cases c JOIN dmca_submissions s ON s.dmca_case_id=c.id WHERE c.case_number=${created.caseNumber}`);
    const row = rows.rows[0] as any;
    caseIds.push(Number(row.id));
    assert.equal(row.ip_address, "192.0.2.31");
  });

  it("dedupes URL aliases to one target and never matches a comment under the wrong post", async () => {
    const listing = (await db.execute(sql`SELECT id FROM real_estate_listings ORDER BY id LIMIT 1`)).rows[0] as any;
    const comment = (await db.execute(sql`SELECT id, post_id FROM forum_comments WHERE post_id IS NOT NULL ORDER BY id LIMIT 1`)).rows[0] as any;
    const otherPost = comment
      ? (await db.execute(sql`SELECT id FROM forum_posts WHERE id <> ${comment.post_id} ORDER BY id LIMIT 1`)).rows[0] as any
      : null;
    const urls: string[] = [];
    if (listing) urls.push(`https://barefootbay.com/for-sale/${listing.id}`, `https://barefootbay.com/real-estate/${listing.id}`);
    if (comment && otherPost) urls.push(`https://barefootbay.com/forum/post/${otherPost.id}#comment-${comment.id}`);
    if (!urls.length) return; // no fixture data in this database
    const response = await fetch(`${origin}/api/dmca/notices`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.32" },
      body: JSON.stringify({ ...validNotice, infringingUrls: urls }),
    });
    const created: any = await response.json();
    assert.equal(response.status, 201, JSON.stringify(created));
    const dmcaCase = (await db.execute(sql`SELECT id, completeness FROM dmca_cases WHERE case_number=${created.caseNumber}`)).rows[0] as any;
    caseIds.push(Number(dmcaCase.id));
    const targets = (await db.execute(sql`SELECT content_type, content_id FROM dmca_targets WHERE dmca_case_id=${dmcaCase.id}`)).rows as any[];
    if (listing) assert.equal(targets.filter((t) => t.content_type === "listing" && Number(t.content_id) === Number(listing.id)).length, 1);
    if (comment && otherPost) assert.equal(targets.some((t) => t.content_type === "forum_comment"), false);
    const submission = (await db.execute(sql`SELECT form_payload FROM dmca_submissions WHERE dmca_case_id=${dmcaCase.id}`)).rows[0] as any;
    assert.equal(submission.form_payload.infringingUrls.length, urls.length, "every submitted URL is preserved as evidence");
  });
});