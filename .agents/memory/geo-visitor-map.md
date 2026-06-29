---
name: Visitor geolocation map (admin analytics)
description: Why the admin Geolocation map was empty + heatmap crashed, and the correct @react-google-maps/api loader pattern.
---

# Admin Visitor Geolocation map

The admin Analytics → Geolocation map (`artifacts/discover-barefoot-bay/src/components/admin/geo-location-map.tsx`).

## Root causes (the "empty map + heatmap crash")
- **Heatmap crash**: `<HeatmapLayer>` needs `google.maps.visualization`. The loader never requested the `visualization` library, so the layer threw and tripped the analytics error boundary.
- **Empty / fragile pin map was NOT a data problem.** The geoip pipeline works: production `analytics_sessions` had coords on ~4343/4441 of the last-30-day rows, and freshly-recorded sessions store lat/long. `getClientIp` → `geoip.lookup` resolves fine (US IPs with no precise city still get the US-centroid 37.751/-97.822). So do not chase backend IP resolution for an empty map — verify prod data first.
- The component used **two separate `<LoadScript>`** tags (one per tab) that remount on tab switch — fragile, and once libraries differ between them you get "Loader must not be called again with different options".

## Correct pattern
- One `useJsApiLoader` with a **module-scope stable** `libraries: ['visualization']` array (not inline — inline array rerenders trigger reload warnings).
- Gate rendering on `isLoaded`; recompute heatmap points on `isLoaded` (google is undefined before load).
- Resolve the Maps key from `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`, falling back to the server endpoint `GET /api/google/mapkey` (it carries a configured key) — covers production bundles built without the VITE var.

**Why:** an empty production map here is almost always the Maps script failing to load (missing/empty key at build, or LoadScript remount churn), not missing coordinates.

## Note
`artifacts/discover-barefoot-bay/src/pages/direct-analytics.tsx` imports `{ GeoLocationMap }` (named) and passes `locations`/`isLoading` props, but the module only has a `default` export taking no props — that page's map is separately broken (pre-existing, out of scope of the admin-dashboard fix).
