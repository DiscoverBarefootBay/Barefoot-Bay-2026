---
name: Legal policy rollout gap
description: Production publication-function gap and safe recovery boundary for legal acknowledgement.
---
The live policy API may return 503 even though the legal-policy tables exist, because database publication functions and triggers are absent. An already-signed-in user must remain gated; logging out or drawing a client-only acceptance button cannot record a valid exact-version acknowledgement.

**Why:** Read-only production inspection found policy tables but no DMCA publication function after the versioned feature was published. The server intentionally fails closed when initialization cannot publish the current policy snapshot.

**How to apply:** Check the public policy endpoint and production logs before changing UI. Restore the approved complete migration through the owner-authorized rollout process, then verify three current policies and existing-session acknowledgement. Do not use a frontend fallback or assume table synchronization installed SQL functions/triggers.