# Versioned legal policy rollout

This is a technical acceptance control, not legal advice. Counsel must approve the actual wording and designated-agent details. The development DMCA settings currently have no section overrides; the existing server defaults explicitly identify pending-counsel-review placeholders. This feature faithfully snapshots those defaults; it does not replace or approve them.

## Production sequence (owner approval required)

1. Back up the database and inspect published `page_contents` rows for slugs `terms-and-agreements` and `privacy-policy`. Each must have one non-hidden current row. Verify the `dmca_settings` singleton (`id=1`) and its designated-agent details. Resolve duplicate published legal slugs before rollout.
2. Apply **only** `lib/db/sql/2026-10-01-versioned-legal.sql` with an owner-approved production SQL connection. It is additive/idempotent and acquires transaction advisory lock 736201. Never use Drizzle schema push/force against this legacy schema.
3. Deploy the API and frontend together. Before installing authentication routes the API synchronizes the server-owned DMCA default section manifest and publishes the effective DMCA snapshot in a locked transaction. New default wording creates a version only when it changes the current effective text; identical deployments do not. Missing migration/default initialization fails closed with 503 rather than granting consent, even when old accepted snapshots remain. Readiness is established only after publication commits; requests retry a failed initialization before reading snapshots or the legacy DMCA policy response.
4. Check anonymously that `GET /api/legal/policies` returns exactly three nonempty policies, valid publication timestamps, correct links (`/terms`, `/privacy`, `/dmca`) and the complete designated-agent section. Review every effective DMCA section against the approved source.
5. Verify existing users, including administrators, receive 428 for private APIs until explicitly accepting outstanding exact versions. No legacy boolean, form submission, role or provisioning path is backfilled as consent. Admin/service-created test accounts intentionally start with no consent and cannot use ordinary private features until accepting.
6. Verify login/session-status, policy reads, logout, password recovery, public notice/status, uploader case read and counter-notice submission remain available. Underlying uploader ownership and legal permission checks remain unchanged.
7. Sign in as authorized staff and verify `/api/legal/history?page=1&pageSize=50`, then a policy filter. Monitor 503 responses and publication failures. Do not disable the gate as a recovery shortcut; restore the legal store/migration instead.

No production database access, production migration, or user notifications were performed during implementation. Development migration and rollback-only tests are separate from the above owner-run sequence.

## Publication, immutability, and locking

Database source triggers publish CMS legal-page create/update/restore and both DMCA settings APIs atomically, including direct SQL source updates. Statement-level advisory locking happens before source row locking. Acceptance and signup take the same advisory lock before reading exact versions and committing evidence, preventing publication-during-acceptance races. The statement touching the source either publishes its snapshot or rolls back.

Identical current title/URL/content hashes do not publish. Restoring different older wording always inserts a **new** version; hashes are compared only with the current snapshot, never used as a global unique key. Unrelated CMS edits, legal hidden-draft row saves, revision-only edits and DMCA non-public settings do not publish. A published legal page cannot be hidden, renamed or deleted; use a separate hidden draft and explicitly publish its wording to the existing source. Snapshot and acceptance UPDATE/DELETE/TRUNCATE are rejected by database triggers, including account cleanup attempts. Evidence `user_id` deliberately has no cascading user foreign key. Database superusers still have infrastructure-level powers; use ordinary least-privilege application credentials.

DMCA defaults are deployment-owned in `policy-defaults.ts`; override merging follows their canonical order. Public HTML is sanitized with a restrictive allowlist; DMCA text and designated-agent fields are escaped before snapshotting. Publishing records optional `changeNotes` as null until a dedicated reviewed publication-note input exists. Client editors display the reacceptance warning.

## API contract

- `GET /api/legal/policies`: `{policies:[{key,versionId,title,url,publishedAt,contentHtml,changeNotes}]}`.
- `GET /api/legal/consent`: authenticated `{policies,outstanding,requiresAcceptance}`.
- `POST /api/legal/consent`: `{acceptances:[{key,versionId,accepted:true}]}`; returns the same status. Allows accepting only outstanding policies, and idempotent retransmission of current accepted versions.
- `POST /api/register`: requires `legalAcceptances` containing each of terms/privacy/dmca exactly once with literal `true` and current integer IDs. Account insertion and all three evidence records share one transaction. Existing CAPTCHA, account validation and post-registration behavior remain.
- `GET /api/legal/history`: admin-only, read-only. `page` defaults to 1 (maximum 1000), `pageSize` defaults to 50 (maximum 100), optional `policyKey` is terms/privacy/dmca. Returns `{versions,acceptances,page,pageSize,total,versionTotal,acceptanceTotal}`. `total` is the larger collection count so one pager covers both independently paginated collections. Versions use the public policy shape; acceptance rows are `{userId,policyKey,versionId,acceptedAt,source}`. No email, IP, credential or session evidence is stored.
- Errors: 400 malformed/nonexplicit/incomplete signup acceptance, 409 `POLICY_VERSION_CHANGED`, 428 `POLICY_ACCEPTANCE_REQUIRED`, 503 `POLICY_STORE_UNAVAILABLE`. Legal reads, writes and authenticated gating use `Cache-Control: no-store`; no successful-consent cache exists.

## Boundary audit

`app.ts` installs the session first. Idempotent `setupAuth` installs Passport initialization/session, then the global legal gate and legal routes **before any auth or private route handlers**, including DMCA private evidence/admin routes and main routes. `main-routes.ts` no longer installs authentication a second time. The only earlier API router is health; quarantine protection remains earlier too. Legacy `session.user` identities are checked at the same global gate before legacy message middleware adopts them.

Exact method/path exceptions are maintained in `legalException`; they do not include general DMCA activity/claims/admin features or private evidence. Case list/detail endpoints support statutory counter-notices and retain ownership checks. Password-reset exception paths are `/api/password-reset/request`, `/validate`, and `/reset` (POST only).

The old unsigned `authToken` query-token authentication branch is disabled. The legacy unauthenticated WebSocket broadcaster now refuses every upgrade; the other websocket implementation was already commented out. Re-enabling sockets requires verified session authentication plus current consent on connection and every action/delivery, not Express middleware alone. The arbitrary private-key presigning route now requires an administrator (and the global current-consent gate). Public asset proxies remain public; their existing quarantine and visibility protections are unchanged.

## Checks

Run `pnpm run typecheck:libs`, then `pnpm --filter @workspace/api-server exec node --import tsx --test src/__tests__/legal-policy.test.ts`. Database tests refuse production environments and roll back publication/consent/account test transactions. No email modules or notification senders are invoked. Full server typecheck has substantial pre-existing legacy errors; inspect diagnostics for the new legal-policy module separately.