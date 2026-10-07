---
name: Forum unread compatibility
description: Why badge and story-card unread logic must not be unified during a performance-only change.
---

Preserve the distinct historical unread definitions in performance-only changes: badges use comment-ID markers, while story cards use comment timestamps.

**Why:** A timestamp-only read record with no comment marker still counts as unread for a badge when comments exist. Story cards may consider the same old comments read. Reusing one predicate for both would change residents' visible behavior, despite looking like harmless query consolidation.

**How to apply:** Optimize each read path independently. Test missing/zero/equal/newer comment markers and timestamp-only records. Unifying the behavior is a product decision, not an implicit part of speeding up queries.

For incremental feeds ordered by mutable edits/comments/pinning, restarting after a detected ordering change is intentional; do not remove that check while replacing the pagination implementation.

**Why:** A unique ID tie-breaker fixes ties but cannot prevent offset skips when an existing post moves between requests. Restarting gives a consistent fresh feed without storing a new server-side snapshot or changing the database.

**How to apply:** Any cursor or revision optimization must retain a defined policy for concurrent insertions, removals and reordering. Do not claim a fixed page size plus deduplication alone prevents skipped stories.
