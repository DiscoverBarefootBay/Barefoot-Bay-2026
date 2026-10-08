# Clean setup package for a new Replit account

This folder is tracked in Git. Pushing `fresh-main` includes it alongside the
application code. It is **not a content backup or a portable service login**.

## Included and excluded

- `schema.sql`: actual **development** public database structure, including
  legacy tables, defaults, constraints, indexes, sequences, functions and triggers.
  Empty backup/recovery tables are omitted. Sequence counters reset to their
  defined starts; no current IDs are transferred.
- `manifest.json`: structural counts, integrity/freshness fingerprints and
  environment **variable names only**.
- No users, passwords, sessions, posts, pages, events, listings, messages, analytics,
  campaigns, policy publications/acceptances, settings rows, uploaded files,
  provider credentials, bucket IDs, owner grants or database connection values.
- Existing application code/static branding elsewhere in the repository is not
  removed or anonymized by this package.

This is a snapshot of development, **not a claim that production is identical**.
Review known development/production schema differences before recreating a
specific live feature. Do not substitute the Drizzle model: this app's legacy
database contains structures that model does not fully describe.

## Restore on the other account

1. Import **`fresh-main`**, not the older default `main` branch. Install dependencies
   with pnpm. The original app is untouched; use a separate new database.
2. Ask Agent to restore `clean-setup/schema.sql` into the **new, empty development
   database**, with all statements in a transaction and stop-on-error behavior.
   For an authorized connection already configured by the new environment:
   `psql -X --single-transaction --set ON_ERROR_STOP=1 --file clean-setup/schema.sql`.
   The agent must confirm the target; this command must never point at the live site.
   Do not use blind/forced `drizzle-kit push`.
3. Configure the services below. Secret values go through Replit Secrets or
   service authorization—not chat, Git, or this folder. Managed variables such
   as `DATABASE_URL` are supplied by the new platform/database configuration.
4. Initialize fresh app settings, feature permissions/categories as appropriate,
   and a **new owner/admin account** through a reviewed bootstrap process.
   Publish the new site's legal policies through its authorized workflow;
   policy definitions/publication records and old admin grants are not copied.
   An empty database is a foundation, not an already initialized resident site.
5. Start the API and web artifact services, verify login, administration and
   enabled features, then add the new content and upload new media.
6. Do not publish or connect outbound services until tests are complete.

## Services to reconnect

`manifest.json` lists names discovered in the application source. It is an
inventory, not a requirement to fill every name: many are optional feature flags,
development toggles or Replit-managed values.

| Service | Setup on the destination |
|---|---|
| PostgreSQL | Use the destination database, restore empty structure, and keep it separate from the original database. |
| App Storage | Provision/authorize a destination bucket and configure its new search/private paths. No objects or original bucket values are transferred. |
| SendGrid | Reconnect the integration on the new account, configure the sender, and verify sender-domain DNS if using a new sending domain. |
| Google mail/calendar | Authorize the intended account again; configure OAuth credentials, allowed callbacks and email/calendar settings for the new site. |
| Google Maps and reCAPTCHA | Configure destination keys/domain restrictions and the new site's domain. Browser-restricted public keys differ from private server credentials. |
| Gemini/AI | Configure the intended server-side credentials or supported integration. Do not place private AI credentials into `VITE_*` browser variables. |
| Printful/store features | Configure the intended store and credentials explicitly; review legacy fallback IDs in application code rather than relying on them. |
| Rocket launch and uptime services | Configure fresh credentials/settings only if those optional features will be enabled. |
| Session/site identity | Generate a fresh session secret and set destination base URLs; old sessions/accounts are not restored. |

**Email safety:** remain in development and leave
`CALENDAR_SCHEDULER_DEV_SENDING`, `LISTING_SCHEDULER_DEV_SENDING`,
`WEEKLY_LISTINGS_SCHEDULER_DEV_SENDING`, and `DMCA_SCHEDULER_DEV_SENDING`
unset/false. Existing scheduler gates allow sending in production automatically;
do not deploy with working outbound credentials until scheduler settings and
recipients are reviewed. There is no new universal production email-off switch
added by this export.

## Keep the package current before pushing

Run `pnpm export:install-hooks` once in this checkout. On a **standard Git push
to `fresh-main`**, the hook verifies the package in the actual committed revision.
It rejects missing files, altered SQL, database-source changes since capture,
or a changed environment-key inventory. Other destination branches and branch
deletions are unaffected. Existing custom hooks are preserved rather than overwritten.

Hooks are local Git configuration, not transferred by Git; install them on each
new checkout. Tools that bypass native Git hooks cannot be forced to run them.
The tracked package still travels with ordinary commits/pushes.

This check does **not** connect to the database during a push, export content,
stage/commit files, push recursively, or claim to detect out-of-band SQL edits.
A database schema is not automatically dumped by Replit's GitHub push.
After any actual schema change (including SQL-only changes), Agent must recapture:

1. Read `scripts/clean-setup-catalog.sql` and run it with the database skill's
   read-only `executeSql` against **development**. Never query table records.
2. Decode its single CSV cell with `decodeCatalogOutput` from
   `scripts/clean-setup-lib.mjs`; write the JSON to a private temporary/ignored
   file, not a tracked location. No secrets/connection values are selected.
3. Run `pnpm export:clean -- <catalog-json-path>` to regenerate the reviewed
   structure and manifest, then `pnpm export:verify`.
   Stage any **new schema source files** before capture so their fingerprints
   are included; no credentials or raw catalog file should ever be staged.
4. Review the diff and commit `clean-setup/schema.sql` and `manifest.json` with
   the app changes before pushing. Remove the temporary catalog afterward.

The exporter blocks embedded tenant URLs/emails, HTML content, credential-like literals,
and unsupported structures instead of silently dropping or transferring them.
Two generic `object-storage.replit.app` matching patterns are retained as legacy
function implementation code; they do not identify a bucket or uploaded file.
An intentional new object may require extending the exporter and its tests.
Service-only inventory changes can use `pnpm export:services`; that command
cannot mark an old database capture as fresh.
