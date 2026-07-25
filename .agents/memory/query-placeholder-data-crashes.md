---
name: Global placeholderData crashes
description: The web app's global react-query placeholderData fallback injects wrong-shaped data ([]/null) and crashes pages via the error boundary
---

The web app's query client sets a global `placeholderData` function that returns `[]` or `null` for query keys it doesn't recognize. It was written for react-query v4's `(previousData, context)` signature; in v5 the second arg is the previous *query* (often undefined), so it logs "PlaceholderData called with undefined context" and returns `[]`.

**Why:** Any component that treats a truthy `data` as its expected object shape (e.g. `data.listings.length`) throws mid-fetch on `[]`, tripping the app-wide "Something went wrong" error boundary. This crashed the weekly digest email preview.

**How to apply:** When adding a `useQuery` in `artifacts/discover-barefoot-bay`, either override `placeholderData: undefined` on the query or guard renders with shape checks (`Array.isArray`, optional chaining) before reading nested fields. A full-page "Something went wrong" that appears only while data is loading is a strong signal of this fallback.
