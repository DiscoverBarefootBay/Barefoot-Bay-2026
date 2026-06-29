---
name: Enhanced Analytics Dashboard response contracts
description: Why the /api/analytics/* enhanced endpoints return different shapes and must stay that way
---

The admin Enhanced Analytics Dashboard (route `/analytics-dashboard` →
`EnhancedAnalyticsDashboard`) is fed by several `/api/analytics/*` endpoints whose
JSON response shapes are deliberately inconsistent, because each frontend tab consumes
a different shape:

- `/data` → FLAT object (page does `setAnalyticsData(data)` directly, no `.data`/`.success`).
- `/user-journey` and `/user-segments` → object WITH `success: true`.
- `/geo-location` and `/country-visitors` → RAW arrays (no wrapper).
- `/click-data` → `{ clicks: [...] }`.

**Why:** the original (deleted) dashboard's components were restored as-is, each with its
own fetch-parsing assumption. A well-meaning refactor to make all endpoints return a
uniform `{success, data}` envelope will blank the mismatched tabs with NO error.

**How to apply:** if you touch these routes or add a tab, match the exact shape the
consuming component expects rather than standardizing. Click heatmap also needs the
client to send `positionData {x,y,elementType,elementId}` on click events (in
`discover-barefoot-bay/src/lib/analytics.tsx`) or the heatmap stays empty even though
the endpoint works.
