---
name: Startup measurement isolation
description: Avoid misleading homepage/calendar timings from shared workspace CPU contention.
---

Measure browser startup sequentially, without frontend tests, production builds or screenshot capture running alongside the probe.

**Why:** In this workspace, a browser probe overlapping verification reported a roughly nine-second cold homepage despite a sub-200 ms day response. The same completed implementation loaded in roughly 1.7 seconds with the workspace idle. Shared CPU contention inflated module startup and rendering, not event-server latency.

**How to apply:** Separate correctness verification from timing comparisons. Keep contended samples labelled rather than silently discarding them, and use an idle before/after comparison on the same preview/database. Preview timings and published-site timings are not interchangeable.