import { createHash } from "node:crypto";

export const hash = value => createHash("sha256").update(value).digest("hex");
const identifier = value => `"${String(value).replaceAll('"', '""')}"`;
const relation = value => `public.${identifier(value)}`;
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const number = value => {
  if (!/^-?\d+$/.test(String(value))) throw Error("Invalid sequence definition");
  return String(value);
};
const terminated = value => value.trimEnd().replace(/;$/, "") + ";\n";

/** Metadata only. Fail closed rather than silently omit unsupported objects. */
export function schemaSql(catalog) {
  if (catalog.format !== 1 || catalog.source !== "development-public-schema") throw Error("Unexpected schema catalog");
  for (const [kind, count] of Object.entries(catalog.unsupported ?? {})) {
    if (Number(count)) throw Error(`Export requires explicit support for ${kind}`);
  }
  if (catalog.views?.length) throw Error("Views require dependency-order support before export");
  if (catalog.policies?.length) throw Error("RLS policies require a portable role mapping before export");
  const output = [
    "-- Content-free development schema. No records, sequence counters, owners or grants.\n",
    "-- Restore only into a NEW, EMPTY database; do not run against the live site.\n",
    "CREATE SCHEMA IF NOT EXISTS public;\nSET search_path = public, pg_catalog;\nSET check_function_bodies = false;\n",
  ];
  for (const extension of catalog.extensions) {
    output.push(`CREATE EXTENSION IF NOT EXISTS ${identifier(extension.name)} WITH SCHEMA ${identifier(extension.schema)};\n`);
  }
  for (const type of catalog.enums) {
    output.push(`CREATE TYPE ${relation(type.name)} AS ENUM (${type.labels.map(literal).join(", ")});\n`);
  }
  for (const sequence of catalog.sequences) {
    if (sequence.identity) throw Error("Identity sequences require explicit export support");
    if (sequence.ownerSchema && sequence.ownerSchema !== "public") throw Error("Cross-schema sequence ownership");
    output.push(`CREATE SEQUENCE ${relation(sequence.name)} AS ${sequence.type} START WITH ${number(sequence.start)} INCREMENT BY ${number(sequence.increment)} MINVALUE ${number(sequence.min)} MAXVALUE ${number(sequence.max)} CACHE ${number(sequence.cache)} ${sequence.cycle ? "CYCLE" : "NO CYCLE"};\n`);
  }
  for (const table of catalog.tables) {
    const columns = table.columns.map(column => {
      if (column.identity) throw Error("Identity columns require explicit export support");
      if (column.generated && column.generated !== "s") throw Error("Unsupported generated column");
      if (/(?:password|token|secret|api_?key|credential|bucket_?id|client_?id|store_?id)/i.test(column.name) &&
          /'(?:[^']|''){1,}'/.test(column.default ?? "")) throw Error("Review a sensitive column's literal default before export");
      return `  ${identifier(column.name)} ${column.type}` +
        (column.collation ? ` COLLATE ${column.collation}` : "") +
        (column.generated ? ` GENERATED ALWAYS AS (${column.default}) STORED` :
          column.default !== null ? ` DEFAULT ${column.default}` : "") +
        (column.notNull ? " NOT NULL" : "");
    });
    output.push(`CREATE ${table.unlogged ? "UNLOGGED " : ""}TABLE ${relation(table.name)} (\n${columns.join(",\n")}\n);\n`);
  }
  // Functions are source code, not table records. Their definitions are scanned
  // below for embedded account-specific content before anything is written.
  for (const fn of catalog.functions) output.push(terminated(fn.ddl));
  for (const sequence of catalog.sequences) {
    if (sequence.ownerTable) output.push(`ALTER SEQUENCE ${relation(sequence.name)} OWNED BY ${relation(sequence.ownerTable)}.${identifier(sequence.ownerColumn)};\n`);
  }
  const constraint = c => `ALTER TABLE ${relation(c.table)} ADD CONSTRAINT ${identifier(c.name)} ${c.ddl};\n`;
  for (const c of catalog.constraints.filter(c => c.type !== "f")) output.push(constraint(c));
  for (const index of catalog.indexes) output.push(terminated(index));
  for (const c of catalog.constraints.filter(c => c.type === "f")) output.push(constraint(c));
  for (const trigger of catalog.triggers) {
    output.push(terminated(trigger.ddl));
    const states = { O: "ENABLE", D: "DISABLE", R: "ENABLE REPLICA", A: "ENABLE ALWAYS" };
    if (!(trigger.enabled in states)) throw Error("Unknown trigger state");
    output.push(`ALTER TABLE ${relation(trigger.table)} ${states[trigger.enabled]} TRIGGER ${identifier(trigger.name)};\n`);
  }
  for (const table of catalog.tables) {
    if (table.rls) output.push(`ALTER TABLE ${relation(table.name)} ENABLE ROW LEVEL SECURITY;\n`);
    if (table.forceRls) output.push(`ALTER TABLE ${relation(table.name)} FORCE ROW LEVEL SECURITY;\n`);
  }
  const sql = output.join("\n");
  assertCleanSql(sql);
  return sql;
}

export function assertCleanSql(sql) {
  // Top-level DML/privileges are never generated. DML inside function bodies is
  // legitimate implementation code; schemaSql only accepts catalog metadata.
  // These two generic storage-host patterns are implementation code in the
  // legacy media normalizers, not a tenant URL, bucket ID or uploaded object.
  const inspected = sql
    .replaceAll("'https://object-storage.replit.app/%'", "'[generic-storage-pattern]'")
    .replaceAll(String.raw`'https://object-storage\.replit\.app(/[^?#]*)'`, "'[generic-storage-pattern]'");
  const forbidden = [
    [/https?:\/\/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, "embedded URL/email"],
    [/\b(?:postgres(?:ql)?:\/\/|sk-[A-Za-z0-9]{12}|SG\.[A-Za-z0-9_-]+\.|AIza[A-Za-z0-9_-]{20}|-----BEGIN .*PRIVATE KEY)/, "credential-like literal"],
    [/<(?:html|body|p|style|script)\b/i, "embedded page content"],
    [/^\\(?:connect|copy|!|include|i|o|gexec)\b/m, "psql command"],
  ];
  for (const [pattern, reason] of forbidden) {
    if (pattern.test(inspected)) throw Error(`Clean export blocked: ${reason}; review the definition privately`);
  }
  for (const statement of sqlStatements(sql)) {
    if (!/^(?:CREATE\s+(?:(?:OR\s+REPLACE\s+)?FUNCTION|SCHEMA|EXTENSION|TYPE|SEQUENCE|(?:UNLOGGED\s+)?TABLE|(?:UNIQUE\s+)?INDEX|TRIGGER)|ALTER\s+(?:TABLE|SEQUENCE)|SET\s+(?:search_path|check_function_bodies))\b/i.test(statement)) {
      throw Error("Clean export blocked: unexpected top-level SQL statement");
    }
    if (/^ALTER\b[\s\S]*\bOWNER TO\b/i.test(statement)) throw Error("Clean export blocked: ownership statement");
  }
}

// Split only outside PostgreSQL literals/comments/function bodies. A function's
// INSERT/UPDATE implementation is not exported table data or executed on restore.
export function sqlStatements(sql) {
  const statements = [];
  let current = "";
  for (let i = 0; i < sql.length;) {
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i + 2);
      i = end < 0 ? sql.length : end + 1; current += "\n"; continue;
    }
    if (sql.startsWith("/*", i)) {
      let depth = 1; i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) { depth++; i += 2; }
        else if (sql.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw Error("Unclosed SQL comment");
      current += " "; continue;
    }
    const dollar = sql[i] === "$" && sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length);
      if (end < 0) throw Error("Unclosed SQL function body");
      current += sql.slice(i, end + dollar.length); i = end + dollar.length; continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i]; const start = i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { i += 2; continue; }
          i++; closed = true; break;
        }
        i++;
      }
      if (!closed) throw Error("Unclosed SQL literal");
      current += sql.slice(start, i); continue;
    }
    if (sql[i] === ";") {
      if (current.trim()) statements.push(current.trim());
      current = ""; i++; continue;
    }
    current += sql[i++];
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function schemaInput(path, text) {
  return /^lib\/db\/.*\.(ts|sql)$/.test(path) || /^scripts\/.*\.sql$/.test(path) ||
    (/^artifacts\/api-server\/src\/.*\.ts$/.test(path) &&
      /\b(?:CREATE|ALTER|DROP)\s+(?:OR\s+REPLACE\s+)?(?:TABLE|TYPE|SEQUENCE|FUNCTION|TRIGGER|POLICY|INDEX|VIEW)\b/i.test(text));
}

export function schemaFingerprint(files) {
  return hash(files.filter(({ path, text }) => schemaInput(path, text))
    .sort((a, b) => a.path.localeCompare(b.path, "en"))
    .map(({ path, text }) => `${path}\0${hash(text)}\n`).join(""));
}

export function environmentInventory(files) {
  const keys = new Set();
  const patterns = [
    /(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]+)/g,
    /(?:process\.env|import\.meta\.env|env)\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,
    /(?:CALENDAR|LISTING|WEEKLY_LISTINGS|DMCA)_SCHEDULER_DEV_SENDING/g,
  ];
  for (const { text } of files) {
    for (const pattern of patterns) for (const match of text.matchAll(pattern)) keys.add(match[1] ?? match[0]);
  }
  return [...keys].sort();
}

export function decodeCatalogOutput(output) {
  const cell = output.slice(output.indexOf("\n") + 1).trim();
  return JSON.parse(cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell);
}
