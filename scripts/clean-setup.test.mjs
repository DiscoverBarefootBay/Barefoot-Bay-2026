import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, cpSync, writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { schemaSql, assertCleanSql, schemaFingerprint, environmentInventory, decodeCatalogOutput, sqlStatements } from "./clean-setup-lib.mjs";

const fixture = () => ({
  format: 1, source: "development-public-schema", serverVersion: "16",
  unsupported: {}, extensions: [], enums: [], sequences: [], tables: [{
    name: "users", unlogged: false, rls: false, forceRls: false,
    columns: [{ name: "id", type: "integer", default: null, notNull: true, identity: "", generated: "" }],
  }], functions: [], constraints: [], indexes: [], views: [], triggers: [], policies: [],
});
test("exports empty structures and no table records, owners or sequence counters", () => {
  const sql = schemaSql(fixture());
  assert.match(sql, /CREATE TABLE public\."users"/);
  assert.doesNotMatch(sql, /INSERT INTO|COPY |OWNER TO|setval/);
});
test("retains trigger-function implementation DML without executing or exporting rows", () => {
  const c = fixture();
  c.functions.push({ name: "maintain", ddl: "CREATE FUNCTION public.maintain() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\nINSERT INTO audit VALUES (NEW.id);\nRETURN NEW;\nEND;\n$$;" });
  assert.match(schemaSql(c), /INSERT INTO audit/);
  assert.equal(sqlStatements(schemaSql(c)).filter(s => s.startsWith("CREATE FUNCTION")).length, 1);
});
test("rejects top-level records, ownership, pg commands and credentials", () => {
  for (const sql of ["INSERT INTO users VALUES(1);", " COPY users FROM STDIN;", "SELECT setval('id',42);",
    "GRANT ALL ON users TO old_owner;", "ALTER TABLE users OWNER TO old_owner;",
    "\\connect old_database", "CREATE TABLE x(a text DEFAULT 'https://old.example/a');",
    "CREATE TABLE x(a text DEFAULT 'owner@example.test');", "CREATE TABLE x(a text DEFAULT 'postgresql://name:password@host/db');"]) {
    assert.throws(() => assertCleanSql(sql));
  }
});
test("generic legacy storage-host patterns are allowed, tenant URLs remain blocked", () => {
  assert.doesNotThrow(() => assertCleanSql("CREATE FUNCTION public.media() RETURNS text LANGUAGE sql AS $$ SELECT 'https://object-storage.replit.app/%', 'https://object-storage\\.replit\\.app(/[^?#]*)' $$;"));
  assert.throws(() => assertCleanSql("CREATE FUNCTION public.media() RETURNS text LANGUAGE sql AS $$ SELECT 'https://object-storage.replit.app/private-bucket/photo.jpg' $$;"));
});
test("unknown schema types and sensitive defaults fail closed", () => {
  for (const c of [
    { ...fixture(), unsupported: { partitions: 1 } },
    { ...fixture(), views: [{ name: "unknown" }] },
    { ...fixture(), policies: [{ name: "old_role" }] },
    { ...fixture(), sequences: [{ identity: true }] },
  ]) assert.throws(() => schemaSql(c));
  const c = fixture(); c.tables[0].columns[0] = { ...c.tables[0].columns[0], name: "api_key", default: "'private-value'::text" };
  assert.throws(() => schemaSql(c));
});
test("preserves explicitly disabled/replica/always trigger states", () => {
  for (const [enabled, expected] of [["D", "DISABLE"], ["R", "ENABLE REPLICA"], ["A", "ENABLE ALWAYS"]]) {
    const c = fixture();
    c.triggers = [{ table: "users", name: "notify", enabled, ddl: "CREATE TRIGGER notify BEFORE INSERT ON users EXECUTE FUNCTION notify()" }];
    assert.match(schemaSql(c), new RegExp(`${expected} TRIGGER "notify"`));
  }
});
test("decodes catalog CSV with quoted multiline SQL, never queries table records", () => {
  const c = fixture(); c.functions.push({ ddl: "line\n'quote' \"identifier\"" });
  const text = JSON.stringify(c);
  assert.deepEqual(decodeCatalogOutput(`catalog\n"${text.replaceAll('"', '""')}"\n`), c);
});
test("schema fingerprints ignore ordinary UI changes but detect SQL/schema edits", () => {
  const base = [{ path: "lib/db/src/schema.ts", text: "schema" }, { path: "artifacts/web/src/page.tsx", text: "hello" }];
  assert.equal(schemaFingerprint(base), schemaFingerprint([{ ...base[1], text: "new title" }, base[0]]));
  assert.notEqual(schemaFingerprint(base), schemaFingerprint([{ ...base[0], text: "new schema" }]));
});
test("environment inventory contains key names only and updates for browser/server/bracket forms", () => {
  assert.deepEqual(environmentInventory([{ text: `process.env.SESSION_SECRET; process.env["GOOGLE_CLIENT_ID"]; import.meta.env.VITE_GOOGLE_MAPS_API_KEY; env["NODE_ENV"];` }]),
    ["GOOGLE_CLIENT_ID", "NODE_ENV", "SESSION_SECRET", "VITE_GOOGLE_MAPS_API_KEY"]);
});
test("SQL scanner respects comments, dollar bodies, quoted identifiers and semicolons in literals", () => {
  assert.equal(sqlStatements(`-- ';'\nCREATE TABLE "a;b"(x text DEFAULT 'a;''b'); /* outer /* inner */ end */ CREATE FUNCTION x() RETURNS text AS $f$ SELECT ';'; $f$ LANGUAGE sql;`).length, 2);
  assert.throws(() => sqlStatements("CREATE FUNCTION f() AS $$ unclosed"));
});
test("fresh-main checks the committed package, detects stale/missing snapshots, and ignores other branches/deletions", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "clean-setup-git-"));
  const run = (command, args, options = {}) => execFileSync(command, args, { cwd: dir, encoding: "utf8", stdio: "pipe", ...options });
  const cli = (...args) => run("node", ["scripts/clean-setup.mjs", ...args]);
  const push = sha => spawnSync("node", ["scripts/clean-setup.mjs", "--verify-push"], {
    cwd: dir, encoding: "utf8", input: `refs/heads/local ${sha} refs/heads/fresh-main ${"0".repeat(40)}\n`,
  });
  try {
    run("git", ["init", "-q"]); run("git", ["config", "user.email", "test@example.test"]); run("git", ["config", "user.name", "Test"]);
    mkdirSync(path.join(dir, "scripts"));
    cpSync(new URL("./clean-setup.mjs", import.meta.url), path.join(dir, "scripts/clean-setup.mjs"));
    cpSync(new URL("./clean-setup-lib.mjs", import.meta.url), path.join(dir, "scripts/clean-setup-lib.mjs"));
    cpSync(new URL("./clean-setup-catalog.sql", import.meta.url), path.join(dir, "scripts/clean-setup-catalog.sql"));
    mkdirSync(path.join(dir, "lib/db"), { recursive: true });
    writeFileSync(path.join(dir, "lib/db/schema.ts"), "schema");
    writeFileSync(path.join(dir, "catalog.json"), JSON.stringify(fixture()));
    run("git", ["add", "scripts", "lib"]);
    cli("--capture", "catalog.json");
    cpSync(new URL("../clean-setup/README.md", import.meta.url), path.join(dir, "clean-setup/README.md"));
    cli("--verify");
    run("git", ["add", "clean-setup"]); run("git", ["commit", "-qm", "clean"]);
    const sha = run("git", ["rev-parse", "HEAD"]).trim();
    assert.equal(push(sha).status, 0);
    writeFileSync(path.join(dir, "lib/db/schema.ts"), "changed");
    assert.equal(push(sha).status, 0, "uncommitted state must not alter verification of pushed tree");
    run("git", ["add", "lib"]); run("git", ["commit", "-qm", "schema changed"]);
    assert.notEqual(push(run("git", ["rev-parse", "HEAD"]).trim()).status, 0);
    const other = spawnSync("node", ["scripts/clean-setup.mjs", "--verify-push"], { cwd: dir, encoding: "utf8", input: "ref nonexistent refs/heads/other old\n" });
    assert.equal(other.status, 0);
    assert.equal(push("0".repeat(40)).status, 0);
    cli("--install-hooks");
    const hook = path.join(dir, ".git/hooks/pre-push");
    assert.match(readFileSync(hook, "utf8"), /managed-clean-setup-check/);
    run("git", ["init", "--bare", "-q", path.join(dir, "remote.git")]);
    run("git", ["remote", "add", "local", path.join(dir, "remote.git")]);
    run("git", ["push", "local", `${sha}:refs/heads/fresh-main`]);
    const refused = spawnSync("git", ["push", "local", "HEAD:refs/heads/fresh-main"], { cwd: dir, encoding: "utf8" });
    assert.notEqual(refused.status, 0, "real native Git push must block a stale package");
    assert.equal(run("git", ["--git-dir", path.join(dir, "remote.git"), "rev-parse", "refs/heads/fresh-main"]).trim(), sha);
    writeFileSync(hook, "#!/bin/sh\n# existing custom hook\n");
    cli("--install-hooks"); assert.match(readFileSync(hook, "utf8"), /existing custom hook/);
    run("git", ["rm", "-q", "clean-setup/schema.sql"]); run("git", ["commit", "-qm", "missing"]);
    assert.notEqual(push(run("git", ["rev-parse", "HEAD"]).trim()).status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
