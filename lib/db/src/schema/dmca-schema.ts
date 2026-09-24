import { pgTable, text, serial, integer, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

/**
 * DMCA / copyright-case management, legal holds, repeat-infringer records,
 * DMCA permissions, settings, quarantined-object registry and the
 * notification outbox.
 *
 * The live DB is built from the idempotent SQL in
 * lib/db/sql/2026-09-24-dmca-foundation.sql (never drizzle-kit push). This
 * file is the code-facing type model and must stay in sync with that SQL.
 *
 * dmca_submissions and dmca_audit_log are append-only: DB triggers reject
 * UPDATE/DELETE unless the session sets dmca.allow_purge = 'on'.
 */

export const dmcaCaseCounters = pgTable("dmca_case_counters", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

export const dmcaCases = pgTable("dmca_cases", {
  id: serial("id").primaryKey(),
  caseNumber: text("case_number").notNull().unique(),
  caseType: text("case_type").notNull().default("notice"),
  status: text("status").notNull().default("RECEIVED"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  submittedVia: text("submitted_via").notNull().default("web_form"),
  claimantName: text("claimant_name"),
  claimantCompany: text("claimant_company"),
  claimantEmail: text("claimant_email"),
  claimantPhone: text("claimant_phone"),
  claimantAddress: text("claimant_address"),
  claimantRole: text("claimant_role"),
  copyrightOwnerName: text("copyright_owner_name"),
  workDescription: text("work_description"),
  adminAssignedId: integer("admin_assigned_id"),
  validityStatus: text("validity_status").notNull().default("unchecked"),
  completeness: jsonb("completeness"),
  statusToken: text("status_token").unique(),
  legalHold: boolean("legal_hold").notNull().default(false),
  takedownAt: timestamp("takedown_at"),
  uploaderNotifiedAt: timestamp("uploader_notified_at"),
  counterNoticeReceivedAt: timestamp("counter_notice_received_at"),
  counterReviewedAt: timestamp("counter_reviewed_at"),
  claimantCounterNotifiedAt: timestamp("claimant_counter_notified_at"),
  restoreEligibleAt: timestamp("restore_eligible_at"),
  restoreDeadlineAt: timestamp("restore_deadline_at"),
  restoredAt: timestamp("restored_at"),
  courtActionReceivedAt: timestamp("court_action_received_at"),
  closedAt: timestamp("closed_at"),
  closedReason: text("closed_reason"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type DmcaCase = typeof dmcaCases.$inferSelect;

export const dmcaTargets = pgTable("dmca_targets", {
  id: serial("id").primaryKey(),
  dmcaCaseId: integer("dmca_case_id").notNull().references(() => dmcaCases.id),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id"),
  originalUrl: text("original_url"),
  uploaderUserId: integer("uploader_user_id"),
  // pending | taken_down | restored | removed
  status: text("status").notNull().default("pending"),
  originalState: jsonb("original_state"),
  storageObjects: jsonb("storage_objects"),
  takenDownAt: timestamp("taken_down_at"),
  restoredAt: timestamp("restored_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type DmcaTarget = typeof dmcaTargets.$inferSelect;

export const dmcaSubmissions = pgTable("dmca_submissions", {
  id: serial("id").primaryKey(),
  dmcaCaseId: integer("dmca_case_id").notNull().references(() => dmcaCases.id),
  // notice | supplemental_notice | counter_notice | court_action_notice
  submissionType: text("submission_type").notNull(),
  submittedByUserId: integer("submitted_by_user_id"),
  submittedByName: text("submitted_by_name"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  formPayload: jsonb("form_payload").notNull(),
  originalDocumentPath: text("original_document_path"),
  emailMessageId: text("email_message_id"),
  signatureValue: text("signature_value"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type DmcaSubmission = typeof dmcaSubmissions.$inferSelect;

export const dmcaAuditLog = pgTable("dmca_audit_log", {
  id: serial("id").primaryKey(),
  dmcaCaseId: integer("dmca_case_id"),
  event: text("event").notNull(),
  // admin | user | system | public
  actorType: text("actor_type").notNull(),
  actorId: integer("actor_id"),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  ipAddress: text("ip_address"),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type DmcaAuditEntry = typeof dmcaAuditLog.$inferSelect;

export const legalHolds = pgTable("legal_holds", {
  id: serial("id").primaryKey(),
  caseType: text("case_type"),
  caseId: integer("case_id"),
  contentType: text("content_type"),
  contentId: integer("content_id"),
  userId: integer("user_id"),
  reason: text("reason").notNull(),
  placedBy: integer("placed_by"),
  placedAt: timestamp("placed_at").notNull().defaultNow(),
  releasedBy: integer("released_by"),
  releasedAt: timestamp("released_at"),
  releaseReason: text("release_reason"),
});
export type LegalHold = typeof legalHolds.$inferSelect;

export const userCopyrightEvents = pgTable("user_copyright_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  dmcaCaseId: integer("dmca_case_id"),
  dmcaTargetId: integer("dmca_target_id"),
  eventType: text("event_type").notNull(),
  eventDate: timestamp("event_date").notNull().defaultNow(),
  countsTowardRepeatPolicy: boolean("counts_toward_repeat_policy").notNull().default(false),
  // active | reversed (e.g. content later restored after counter-notice)
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type UserCopyrightEvent = typeof userCopyrightEvents.$inferSelect;

export const dmcaPermissionGrants = pgTable("dmca_permission_grants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  permission: text("permission").notNull(),
  grantedBy: integer("granted_by"),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
}, (t) => [unique("dmca_permission_grants_user_permission_unique").on(t.userId, t.permission)]);
export type DmcaPermissionGrant = typeof dmcaPermissionGrants.$inferSelect;

export const dmcaSettings = pgTable("dmca_settings", {
  id: integer("id").primaryKey().default(1),
  agentName: text("agent_name"),
  agentOrganization: text("agent_organization"),
  agentAddress: text("agent_address"),
  agentPhone: text("agent_phone"),
  agentEmail: text("agent_email"),
  registrationNumber: text("registration_number"),
  registrationExpiresAt: timestamp("registration_expires_at"),
  repeatInfringerThreshold: integer("repeat_infringer_threshold").notNull().default(3),
  repeatInfringerWindowMonths: integer("repeat_infringer_window_months").notNull().default(36),
  reminderOffsets: jsonb("reminder_offsets").notNull(),
  policySections: jsonb("policy_sections"),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type DmcaSettings = typeof dmcaSettings.$inferSelect;

export const dmcaQuarantinedObjects = pgTable("dmca_quarantined_objects", {
  id: serial("id").primaryKey(),
  dmcaCaseId: integer("dmca_case_id").notNull(),
  dmcaTargetId: integer("dmca_target_id").notNull(),
  originalUrl: text("original_url").notNull(),
  fileBasename: text("file_basename").notNull(),
  // object_storage | local_fs | none (file not found; URL still blocked)
  storageLocation: text("storage_location").notNull().default("none"),
  originalKey: text("original_key"),
  quarantineKey: text("quarantine_key"),
  // quarantined | restored
  status: text("status").notNull().default("quarantined"),
  quarantinedAt: timestamp("quarantined_at").notNull().defaultNow(),
  restoredAt: timestamp("restored_at"),
});
export type DmcaQuarantinedObject = typeof dmcaQuarantinedObjects.$inferSelect;

export const notificationOutbox = pgTable("notification_outbox", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  dmcaCaseId: integer("dmca_case_id"),
  dedupeKey: text("dedupe_key").unique(),
  // pending | processing | sent | failed | dead | cancelled
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(8),
  nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
});
export type NotificationOutboxRow = typeof notificationOutbox.$inferSelect;
