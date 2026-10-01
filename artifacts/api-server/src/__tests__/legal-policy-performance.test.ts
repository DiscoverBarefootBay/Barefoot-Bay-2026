import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";

let rows: any[] = [];
let failure: Error | undefined;
let initializationFailure: Error | undefined;
let queries: { sql: string; params: unknown[] }[] = [];
let sanitizations = 0;
const dialect = new PgDialect();
const execute = async (statement: any) => {
  queries.push(dialect.sqlToQuery(statement));
  if (failure) throw failure;
  if (queries.at(-1)!.sql.includes("SELECT v.*")) {
    return { rows: rows.map(row => ({
      policy_key: row.policy_key, id: row.version_id, title: row.policy_key,
      url: `/${row.policy_key}`, published_at: "2026-01-01", content_html: "<p>Policy</p>", change_notes: null,
    })) };
  }
  if (queries.at(-1)!.sql.includes("SELECT version_id FROM")) {
    return { rows: rows.filter(row => row.accepted).map(row => ({ version_id: row.version_id })) };
  }
  return { rows };
};
mock.module("../db", { namedExports: { db: {
  execute,
  transaction: async (work: (tx: any) => Promise<void>) => {
    if (initializationFailure) throw initializationFailure;
    return work({ execute: async () => ({ rows: [] }) });
  },
} } });
mock.module("@workspace/db", { namedExports: { users: {} } });
mock.module("../lib/logger", { namedExports: { logger: { error: () => {} } } });
const sanitizer = Object.assign((html: string) => { sanitizations++; return html; }, { defaults: { allowedTags: [] } });
mock.module("sanitize-html", { defaultExport: sanitizer });
const { initializeLegalDefaults, requiresLegalAcceptance, legalGate } = await import("../legal-policy");
await initializeLegalDefaults();

beforeEach(() => {
  rows = ["terms", "privacy", "dmca"].map((policy_key, i) => ({ policy_key, version_id: i + 1, accepted: true }));
  failure = undefined;
  queries = [];
  sanitizations = 0;
});
async function gate(identity: any, path = "/api/messages", method = "GET") {
  let status = 0; let payload: any; let next = 0; let cache: string | undefined;
  const res: any = {
    set: (_key: string, value: string) => { cache = value; return res; },
    status: (value: number) => { status = value; return res; },
    json: (value: any) => { payload = value; return res; },
  };
  await legalGate({ ...identity, method, path } as any, res, () => { next++; });
  return { status, payload, next, cache };
}
test("accepted Passport and legacy sessions use one fresh indexed metadata read and zero HTML sanitizations", async () => {
  for (const identity of [{ user: { id: 42, role: "super_admin" } }, { session: { user: { id: 42 } } }]) {
    queries = [];
    const result = await gate(identity);
    assert.equal(result.next, 1);
    assert.equal(result.cache, "no-store");
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /EXISTS/);
    assert.ok(queries[0].params.includes(42));
    assert.doesNotMatch(queries[0].sql, /content_html|v\.\*/);
    assert.equal(sanitizations, 0);
  }
});
test("every request rechecks current versions; a new publication requires explicit acceptance even for privileged users", async () => {
  const identity = { user: { id: 42, role: "super_admin" } };
  assert.equal((await gate(identity)).next, 1);
  rows[0] = { policy_key: "terms", version_id: 4, accepted: false };
  const result = await gate(identity);
  assert.equal(result.next, 0);
  assert.equal(result.status, 428);
  assert.equal(result.payload.code, "POLICY_ACCEPTANCE_REQUIRED");
  assert.equal(result.payload.outstanding[0].versionId, 4);
  assert.equal(sanitizations, 3);
  // Restored wording is still a distinct publication/version.
  rows[0].version_id = 5;
  assert.equal((await gate(identity)).payload.outstanding[0].versionId, 5);
});
test("missing, malformed, or unavailable metadata fails closed, never loading old HTML", async () => {
  const valid = rows;
  for (const bad of [[], valid.slice(1), [valid[0], valid[0], valid[2]], valid.map(r => ({ ...r, accepted: "true" })), valid.map(r => ({ ...r, version_id: 0 }))]) {
    rows = bad;
    const result = await gate({ session: { user: { id: 42 } } });
    assert.equal(result.status, 503);
    assert.equal(result.next, 0);
    assert.equal(result.payload.code, "POLICY_STORE_UNAVAILABLE");
    assert.equal(sanitizations, 0);
  }
  failure = Error("store offline");
  await assert.rejects(requiresLegalAcceptance(42), /store offline/);
  assert.equal((await gate({ user: { id: 42 } })).status, 503);
});
test("anonymous and narrow statutory/recovery exceptions perform no policy query", async () => {
  failure = Error("store offline");
  for (const [identity, path, method] of [
    [{}, "/api/messages", "GET"],
    [{ user: { id: 42 } }, "/api/dmca/my-cases", "GET"],
    [{ session: { user: { id: 42 } } }, "/api/dmca/my-cases/CASE/counter-notice", "POST"],
    [{ user: { id: 42 } }, "/api/logout", "POST"],
  ] as const) {
    assert.equal((await gate(identity, path, method)).next, 1);
  }
  assert.equal(queries.length, 0);
  assert.equal((await gate({ user: { id: 42 } }, "/api/admin/dmca/cases")).status, 503);
});
test("failed default publication blocks metadata authorization until initialization recovers", async () => {
  initializationFailure = Error("publication unavailable");
  try {
    await assert.rejects(initializeLegalDefaults(), /publication unavailable/);
    const result = await gate({ user: { id: 42 } });
    assert.equal(result.status, 503);
    assert.equal(result.next, 0);
    assert.equal(queries.length, 0);
  } finally {
    initializationFailure = undefined;
    await initializeLegalDefaults();
  }
  assert.equal((await gate({ user: { id: 42 } })).next, 1);
});