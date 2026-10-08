import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { schemaSql, assertCleanSql, schemaFingerprint, environmentInventory, hash } from "./clean-setup-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = "clean-setup";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const read = name => readFileSync(path.join(root, name), "utf8");
const sources = names => names.filter(name => /^(?:artifacts|lib|scripts)\//.test(name) &&
  /\.(?:ts|tsx|js|mjs|sql)$/.test(name) && !/(?:__tests__|\.test\.|\/clean-setup)/.test(name));
function filesAt(ref) {
  const names = git("ls-tree", "-r", "--name-only", ref).trim().split("\n");
  return sources(names).map(name => ({ path: name, text: git("show", `${ref}:${name}`) }));
}
function workingFiles() {
  return sources(git("ls-files").trim().split("\n")).map(name => ({ path: name, text: read(name) }));
}
function verify(load, files) {
  for (const name of ["clean-setup/README.md", "scripts/clean-setup.mjs",
    "scripts/clean-setup-lib.mjs", "scripts/clean-setup-catalog.sql"]) {
    if (!load(name).trim()) throw Error("Clean setup instructions or maintenance scripts are missing");
  }
  const manifest = JSON.parse(load(`${directory}/manifest.json`));
  const sql = load(`${directory}/schema.sql`);
  assertCleanSql(sql);
  if (manifest.format !== 1 || manifest.source !== "development-public-schema" ||
      manifest.includesRecords !== false || manifest.includesCredentials !== false ||
      manifest.schemaSha256 !== hash(sql)) throw Error("Export package is missing or modified; recapture and commit it");
  if (manifest.schemaSourceFingerprint !== schemaFingerprint(files)) {
    throw Error("Database-related code changed: ask Agent to recapture the read-only development catalog and commit the clean package before pushing fresh-main");
  }
  if (JSON.stringify(manifest.environmentKeys) !== JSON.stringify(environmentInventory(files))) {
    throw Error("Service/environment requirements changed: run pnpm export:services and commit clean-setup/manifest.json before pushing fresh-main");
  }
}
function installHook() {
  const hookPath = path.resolve(root, git("rev-parse", "--git-path", "hooks/pre-push").trim());
  const marker = "# managed-clean-setup-check";
  const node = "'" + process.execPath.replaceAll("'", "'\\''") + "'";
  if (existsSync(hookPath) && !readFileSync(hookPath, "utf8").includes(marker)) {
    console.log(`Existing pre-push hook preserved. Add ${node} scripts/clean-setup.mjs --verify-push to it manually.`);
    return;
  }
  mkdirSync(path.dirname(hookPath), { recursive: true });
  // UI-launched Git may not inherit the shell's Node PATH. Hooks are local to
  // each checkout, so use the runtime actually running this installer.
  writeFileSync(hookPath, `#!/bin/sh\n${marker}\n${node} "$(git rev-parse --show-toplevel)/scripts/clean-setup.mjs" --verify-push "$@"\n`);
  chmodSync(hookPath, 0o755);
  console.log("Installed fresh-main clean-setup push check; other branches are unchanged.");
}
try {
  const mode = process.argv[2];
  if (mode === "--capture") {
    if (!process.argv[3]) throw Error("Provide a catalog JSON file from scripts/clean-setup-catalog.sql");
    const catalog = JSON.parse(readFileSync(process.argv[3], "utf8"));
    const sql = schemaSql(catalog);
    const files = workingFiles();
    const manifest = {
      format: 1, source: catalog.source, serverVersion: catalog.serverVersion,
      includesRecords: false, includesCredentials: false,
      schemaSourceFingerprint: schemaFingerprint(files), schemaSha256: hash(sql),
      environmentKeys: environmentInventory(files),
      objects: { tables: catalog.tables.length, functions: catalog.functions.length,
        sequences: catalog.sequences.length, enums: catalog.enums.length, indexes: catalog.indexes.length,
        constraints: catalog.constraints.length, triggers: catalog.triggers.length },
    };
    mkdirSync(path.join(root, directory), { recursive: true });
    // Only audited output is written to tracked paths. Raw catalog remains private.
    writeFileSync(path.join(root, directory, "schema.sql"), sql);
    writeFileSync(path.join(root, directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Captured ${manifest.objects.tables} empty table definitions; no rows or credentials exported.`);
  } else if (mode === "--services") {
    const manifest = JSON.parse(read(`${directory}/manifest.json`));
    manifest.environmentKeys = environmentInventory(workingFiles());
    writeFileSync(path.join(root, directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    console.log("Refreshed service variable names only; database capture fingerprint unchanged.");
  } else if (mode === "--install-hooks") {
    installHook();
  } else if (mode === "--verify-push") {
    // Validate the actual pushed commit, not unrelated/uncommitted working files.
    for (const line of readFileSync(0, "utf8").trim().split("\n")) {
      const [, sha, destination] = line.split(/\s+/);
      if (destination !== "refs/heads/fresh-main" || !sha || /^0+$/.test(sha)) continue;
      if (!/^[a-f0-9]{40,64}$/.test(sha)) throw Error("Invalid pushed revision");
      const load = name => git("show", `${sha}:${name}`);
      verify(load, filesAt(sha));
      console.log("fresh-main: verified content-free setup package in pushed commit.");
    }
  } else if (mode === "--verify") {
    verify(read, workingFiles());
    console.log("Clean setup package verified against current database code and environment key names.");
  } else {
    throw Error("Use --capture <catalog.json>, --services, --verify, --verify-push or --install-hooks");
  }
} catch (error) {
  // Never echo git/SQL stderr, connection strings or captured SQL definitions.
  console.error(error?.stderr ? "Clean setup check failed: required committed files are missing or Git is unavailable." : error.message);
  process.exitCode = 1;
}
