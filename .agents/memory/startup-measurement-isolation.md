---
name: Startup measurement isolation
description: Avoid misleading homepage/calendar timings from shared workspace CPU contention.
---

Measure browser startup sequentially, without frontend tests, production builds or screenshot capture running alongside the probe.

**Why:** In this workspace, a browser probe overlapping verification reported a roughly nine-second cold homepage despite a sub-200 ms day response. The same completed implementation loaded in roughly 1.7 seconds with the workspace idle. Shared CPU contention inflated module startup and rendering, not event-server latency.

**How to apply:** Separate correctness verification from timing comparisons. Keep contended samples labelled rather than silently discarding them, and use an idle before/after comparison on the same preview/database. Preview timings and published-site timings are not interchangeable.

Cold browser and cold development compiler are different baselines. After shared
library generation or source changes, retain the first probe separately and inspect
when the user request actually begins. Also compare user-response-to-first-content
time, not only navigation-to-content time.

**Why:** Even without concurrent tests, the first preview sample after regeneration
spent much longer before auth requests began than subsequent fresh-browser samples.
Treating this as directory/network latency would misidentify the bottleneck.