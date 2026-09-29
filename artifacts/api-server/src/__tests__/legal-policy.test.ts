import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db, pool } from "../db";
import {
  acceptanceSchema, currentPolicies, consentStatus, recordAcceptance,
  legalException, legalGate, createAccountWithConsent, registerWithConsent, legalFailure, LegalError, initializeLegalDefaults,
} from "../legal-policy";

const development = !!process.env.DATABASE_URL && process.env.NODE_ENV !== "production" && process.env.REPLIT_DEPLOYMENT !== "true";
const rollback = new Error("intentional test rollback");
async function isolated(work: (tx: any) => Promise<void>) {
  await assert.rejects(db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(736201)`);
    await work(tx);
    throw rollback;
  }), error => error === rollback);
}
after(async () => { await pool.end(); });
before(async () => { if (development) await initializeLegalDefaults(); });

test("requires literal true, valid unique keys, integer exact versions", () => {
  const valid = [{ key: "terms", versionId: 1, accepted: true }];
  assert.equal(acceptanceSchema.safeParse(valid).success, true);
  for (const input of [undefined, [], [...valid, ...valid], [{ ...valid[0], accepted: "true" }], [{ ...valid[0], accepted: false }], [{ ...valid[0], versionId: 1.1 }], [{ ...valid[0], key: "marketing" }]]) {
    assert.equal(acceptanceSchema.safeParse(input).success, false);
  }
});
test("exceptions are method-specific and exclude ordinary uploader/admin features", () => {
  for (const [method, path] of [
    ["GET", "/api/legal/policies"], ["POST", "/api/legal/consent"], ["POST", "/api/logout"],
    ["POST", "/api/password-reset/request"], ["GET", "/api/dmca/status/token"],
    ["GET", "/api/dmca/my-cases/CASE-1"], ["POST", "/api/dmca/my-cases/CASE-1/counter-notice"],
  ]) assert.equal(legalException(method, path), true, path);
  for (const [method, path] of [
    ["DELETE", "/api/legal/policies"], ["GET", "/api/legal/history"],
    ["GET", "/api/dmca/my-activity"], ["GET", "/api/dmca/my-claims"],
    ["PUT", "/api/dmca/settings"], ["GET", "/api/admin/dmca/cases"],
    ["GET", "/api/dmca/status/token/extra"], ["POST", "/api/dmca/my-cases/CASE-1/other"],
  ]) assert.equal(legalException(method, path), false, path);
});
test("database failures never yield empty successful policies", async () => {
  await assert.rejects(currentPolicies({ execute: async () => { throw Error("offline"); } } as any), /offline/);
  await assert.rejects(currentPolicies({ execute: async () => ({ rows: [] }) } as any), /three/);
});
test("unavailable store produces a recoverable 503, never successful consent", () => {
  let status = 0; let payload: any; let cache: string | undefined;
  const res: any = { set: (_k: string, v: string) => { cache = v; return res; }, status: (v: number) => { status = v; return res; }, json: (v: any) => { payload = v; return res; } };
  legalFailure(res, new Error("Synthetic unavailable store"));
  assert.equal(status, 503); assert.equal(payload.code, "POLICY_STORE_UNAVAILABLE"); assert.equal(cache, "no-store");
});
test("current consent, exact-version rejection, changed-only and multiple changes, restoration", { skip: !development }, async () => isolated(async tx => {
  const userId = -736201;
  const initial = await consentStatus(userId, tx);
  assert.equal(initial.outstanding.length, 3);
  const acceptances = initial.policies.map(p => ({ key: p.key, versionId: p.versionId, accepted: true }));
  for (let omitted = 0; omitted < 3; omitted++) {
    await assert.rejects(recordAcceptance(tx, userId, acceptances.filter((_, i) => i !== omitted), "signup"), (e: any) => e.status === 400);
  }
  await recordAcceptance(tx, userId, acceptances, "signup");
  await recordAcceptance(tx, userId, acceptances, "subsequent");
  assert.equal((await consentStatus(userId, tx)).requiresAcceptance, false);
  assert.equal(Number((await tx.execute(sql`SELECT count(*) AS n FROM legal_policy_acceptances WHERE user_id=${userId}`)).rows[0].n), 3);
  const original = (await tx.execute(sql`SELECT content,title FROM page_contents WHERE slug='terms-and-agreements'`)).rows[0];
  await tx.execute(sql`UPDATE page_contents SET updated_at=now() WHERE slug='terms-and-agreements'`);
  assert.deepEqual((await currentPolicies(tx)).map(p => p.versionId), initial.policies.map(p => p.versionId));
  await tx.execute(sql`UPDATE page_contents SET content=content || '<p>Transaction-only legal test</p>' WHERE slug='terms-and-agreements'`);
  assert.deepEqual((await consentStatus(userId, tx)).outstanding.map(p => p.key), ["terms"]);
  await assert.rejects(recordAcceptance(tx, userId, acceptances, "subsequent"), (e: any) => e instanceof LegalError && e.code === "POLICY_VERSION_CHANGED");
  await tx.execute(sql`UPDATE page_contents SET content=content || '<p>Transaction-only privacy test</p>' WHERE slug='privacy-policy'`);
  assert.equal((await consentStatus(userId, tx)).outstanding.length, 2);
  await tx.execute(sql`UPDATE page_contents SET content=${original.content} WHERE slug='terms-and-agreements'`);
  const restored = (await currentPolicies(tx)).find(p => p.key === "terms")!;
  assert.notEqual(restored.versionId, initial.policies[0].versionId);
  assert.equal(restored.contentHtml, initial.policies[0].contentHtml);
  assert.equal((await consentStatus(userId, tx)).requiresAcceptance, true);
}));
test("DMCA settings no-op/unrelated updates do not publish; sections and agent do, escaped", { skip: !development }, async () => isolated(async tx => {
  const before = (await currentPolicies(tx))[2];
  await tx.execute(sql`UPDATE dmca_settings SET updated_at=now(),repeat_infringer_threshold=repeat_infringer_threshold+1 WHERE id=1`);
  assert.equal((await currentPolicies(tx))[2].versionId, before.versionId);
  await tx.execute(sql`UPDATE dmca_settings SET agent_name='<script>alert(1)</script>' WHERE id=1`);
  const changed = (await currentPolicies(tx))[2];
  assert.notEqual(changed.versionId, before.versionId);
  assert.ok(changed.contentHtml.includes("&lt;script&gt;"));
  assert.ok(!changed.contentHtml.includes("<script>"));
  await tx.execute(sql`UPDATE dmca_settings SET policy_sections='[{"key":"policy","title":"Changed title","body":"Changed body"}]'::jsonb WHERE id=1`);
  assert.ok((await currentPolicies(tx))[2].contentHtml.includes("Changed body"));
}));
test("signup account and versioned evidence share a rollback boundary", { skip: !development }, async () => isolated(async tx => {
  const policies = await currentPolicies(tx);
  const account = await createAccountWithConsent(tx, {
    username: "legal-test-transaction-only", email: "legal-test@example.invalid",
    fullName: "Transaction-only test", password: "not-a-login-hash",
  }, policies.map(p => ({ key: p.key, versionId: p.versionId, accepted: true })));
  assert.equal((await consentStatus(account.id, tx)).requiresAcceptance, false);
  const records = (await tx.execute(sql`SELECT source FROM legal_policy_acceptances WHERE user_id=${account.id}`)).rows;
  assert.equal(records.length, 3);
  assert.ok(records.every((r: any) => r.source === "signup"));
}));
test("failed exact-version signup leaves no account behind", { skip: !development }, async () => {
  const policies = await currentPolicies();
  const username = `legal-rejected-${Date.now()}`;
  await assert.rejects(registerWithConsent({
    username, email: `${username}@example.invalid`, fullName: "Rollback test", password: "not-a-login-hash",
  }, policies.map(p => ({ key: p.key, versionId: p.versionId + 1000000, accepted: true }))), (e: any) => e.code === "POLICY_VERSION_CHANGED");
  assert.equal((await db.execute(sql`SELECT id FROM users WHERE username=${username}`)).rows.length, 0);
});
test("hidden legal drafts and unrelated CMS edits do not publish", { skip: !development }, async () => isolated(async tx => {
  const before = await currentPolicies(tx);
  await tx.execute(sql`INSERT INTO page_contents(slug,title,content,is_hidden) VALUES('terms-and-agreements','Draft','Unpublished draft',true)`);
  await tx.execute(sql`UPDATE page_contents SET content='Edited unpublished draft' WHERE slug='terms-and-agreements' AND is_hidden`);
  await tx.execute(sql`DELETE FROM page_contents WHERE slug='terms-and-agreements' AND is_hidden`);
  await tx.execute(sql`INSERT INTO page_contents(slug,title,content,is_hidden) VALUES('legal-test-unrelated','Unrelated','No legal changes',false)`);
  assert.deepEqual((await currentPolicies(tx)).map(p => p.versionId), before.map(p => p.versionId));
}));
test("failed default publication blocks old successful snapshots and retries recovery", { skip: !development }, async () => {
  const transaction = db.transaction;
  let readOldSnapshots = false;
  try {
    (db as any).transaction = async () => { throw new Error("Synthetic default publication failure"); };
    await assert.rejects(initializeLegalDefaults(), /default publication failure/);
    await assert.rejects(currentPolicies({ execute: async () => { readOldSnapshots = true; return { rows: [] }; } } as any), /default publication failure/);
    assert.equal(readOldSnapshots, false);
  } finally {
    db.transaction = transaction;
    await initializeLegalDefaults();
  }
  assert.equal((await currentPolicies()).length, 3);
});
test("append-only records and snapshots reject mutation", { skip: !development }, async () => {
  for (const statement of [
    sql`UPDATE legal_policy_versions SET title=title WHERE false`,
    sql`DELETE FROM legal_policy_versions WHERE false`,
    sql`UPDATE legal_policy_acceptances SET source=source WHERE false`,
    sql`DELETE FROM legal_policy_acceptances WHERE false`,
  ]) await assert.rejects(db.transaction(tx => tx.execute(statement)), (e: any) => /immutable/.test(e.cause?.message || e.message));
});
test("global gate blocks both Passport and legacy-session private requests", { skip: !development }, async () => {
  for (const identity of [{ user: { id: -736201 } }, { session: { user: { id: -736201 } } }]) {
    let status = 0; let payload: any; let next = false;
    const res: any = { set: () => res, status: (v: number) => { status = v; return res; }, json: (v: any) => { payload = v; return res; } };
    await legalGate({ ...identity, method: "GET", path: "/api/messages" } as any, res, () => { next = true; });
    assert.equal(status, 428);
    assert.equal(payload.code, "POLICY_ACCEPTANCE_REQUIRED");
    assert.equal(next, false);
  }
});
test("publication and acceptance use the same serial transaction lock", { skip: !development }, async () => {
  const publisher = await pool.connect(); const accepting = await pool.connect();
  try {
    await publisher.query("BEGIN");
    await publisher.query("UPDATE page_contents SET updated_at=updated_at WHERE slug='privacy-policy'");
    await accepting.query("BEGIN");
    await accepting.query("SET LOCAL lock_timeout='100ms'");
    await assert.rejects(accepting.query("SELECT pg_advisory_xact_lock(736201)"), (e: any) => e.code === "55P03");
  } finally {
    await publisher.query("ROLLBACK"); await accepting.query("ROLLBACK");
    publisher.release(); accepting.release();
  }
});