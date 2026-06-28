import { defineConfig } from "drizzle-kit";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import path from "path";
import * as schema from "./src/schema/index";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Scope drizzle-kit to ONLY the tables this Drizzle schema owns.
//
// The dev/prod database contains many tables that are NOT modeled here:
//   - legacy/app-managed tables (sessions, sponsorships, media_files, ...)
//   - one-time *_backup_* / *_recovery_backup snapshots
//
// Without this filter, `drizzle-kit push` tries to make the DB match the
// schema *exactly* — it wants to DROP every unmodeled table and CREATE the
// schema-only ones, then pairs those drops/creates as ambiguous "renames"
// and drops into an interactive prompt where a wrong answer destroys data.
//
// Deriving the allowlist from the schema (rather than hardcoding) keeps it in
// sync automatically: any table added to the schema is managed, and any table
// the schema does not define is left untouched by push.
const managedTables = Object.values(schema)
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableName(table));

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  tablesFilter: managedTables,
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
