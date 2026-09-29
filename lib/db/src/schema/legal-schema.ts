import { pgTable, serial, bigserial, integer, text, timestamp, unique, foreignKey, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const legalPolicyVersions = pgTable("legal_policy_versions", {
  id: serial("id").primaryKey(),
  policyKey: text("policy_key").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  contentHtml: text("content_html").notNull(),
  contentHash: text("content_hash").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  changeNotes: text("change_notes"),
}, t => [unique().on(t.id, t.policyKey)]);
export const legalPolicyCurrent = pgTable("legal_policy_current", {
  policyKey: text("policy_key").primaryKey(),
  versionId: integer("version_id").notNull(),
}, t => [foreignKey({ columns: [t.versionId, t.policyKey], foreignColumns: [legalPolicyVersions.id, legalPolicyVersions.policyKey] })]);
export const legalPolicyAcceptances = pgTable("legal_policy_acceptances", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: integer("user_id").notNull(),
  policyKey: text("policy_key").notNull(),
  versionId: integer("version_id").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  source: text("source").notNull(),
}, t => [
  unique().on(t.userId, t.versionId),
  foreignKey({ columns: [t.versionId, t.policyKey], foreignColumns: [legalPolicyVersions.id, legalPolicyVersions.policyKey] }),
]);
export const legalPolicyDefaults = pgTable("legal_policy_defaults", {
  id: integer("id").primaryKey(), sections: jsonb("sections").notNull(),
});
export type LegalPolicyVersion = typeof legalPolicyVersions.$inferSelect;
export type LegalPolicyAcceptance = typeof legalPolicyAcceptances.$inferSelect;