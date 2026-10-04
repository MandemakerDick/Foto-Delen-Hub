# Gallery reliability and larger-library audit

## Scope

PhotographersHub Gallery and its photo-detail browsing path, preserving the
existing design and public Gallery API. No production data was changed. The
browser checks used anonymous authentication stubs and synthetic API responses;
no real accounts, uploads, likes, comments or deletions were used.

## Reproduced problems and repairs

- An initial Gallery 503 was presented as “No photographs match these filters.”
  Initial, background-refresh, and next-page failures now have separate recovery
  messages. Retrying a next page does not discard the already loaded pages.
- Search-only views offered no Clear filters action. Reset now restores search,
  club/theme/photographer/date filters, grouping and sorting to their defaults.
- Fox 10 in an oldest-first `search=Fox` selection linked forward to Photo 11
  from the legacy unfiltered list instead of Fox 20. Gallery links now carry
  the return view and use the captured selection order. The next-page boundary
  uses the same filtered Gallery cursor and offers retry on failure.
- Failed photo requests were called missing photographs. Transient failures
  now have retry; actual 404s retain the correct Gallery return path.
- Failed filter lookups appeared as empty option lists. Recovery now preserves
  the active filters and photograph grid. Existing photo metadata or explicit
  ID labels keep selected filters identifiable while names cannot be loaded.
- Overlapping page IDs are deduplicated without reordering the loaded
  selection. Canceled requests cannot overwrite a newer filter selection.
- Gallery controls now respond to same-page history navigation. URL dates and
  filter IDs are validated; reversed date ranges show an explanation without
  sending an invalid request. Existing single-filter links are accepted.
- Populated filter badges wrap rather than widening phone layouts.

## Repeatable larger-library observations

Fixture: 1,200 synthetic photographs with five photographers, three clubs,
four themes, varied engagement counts, and deterministic creation dates.
Measurements are UTF-8 response JSON sizes, **not compressed transfer sizes,
real-image costs, production database timings or real network latency**.

| Check | Before | After |
| --- | --- | --- |
| Open a photograph from the filtered Gallery | Additional legacy full-list response: 536,927 bytes | No legacy full-list request; existing selected IDs are reused |
| Filtered first page | 24 photographs / 10,716 bytes | Same 24-item API contract |
| Load 240 photographs, oldest first | Increasing animation delay with card index | 10 paginated requests; initial page 10,688 bytes; no full-list request |
| Last card after appending the 240th photograph | Still opacity 0 after 800 ms; index 239 imposed an 11.95-second delay | Opacity 1 verified within two seconds; reveal delay capped at 250 ms |

Photo cards are memoized and images remain lazy-loaded with asynchronous
decoding. These changes avoid repeatedly rebuilding unchanged cards; no
unmeasured CPU or production-latency improvement is claimed.

## Verification

- PhotographersHub TypeScript and lint: passed, without lint warnings.
- PhotographersHub unit tests: 1,517 passed, including URL normalization,
  cursor parameters, return-path safety, ordered deduplication and snapshot
  isolation/expiry.
- Existing API cursor/filter helper tests: 3 passed. API implementation and
  generated clients were not changed.
- 22 distinct focused Gallery browser checks passed across the main pass and
  targeted follow-up checks. Coverage includes initial/refresh/next-page and
  filter-option recovery, rapid search changes, empty results/reset, seeded
  combined views, pagination, detail navigation/reload/return, same-page
  history, English/Dutch labels, and populated 360/768/1280px layouts.
- Existing narrow-screen tests now stub the actual Gallery endpoint and
  measure the text search input rather than mistakenly measuring a date input.

Repeat the focused browser suite:

```sh
cd artifacts/photoclub
pnpm exec playwright test --config playwright.config.ts \
  e2e/gallery-reliability.test.ts \
  e2e/gallery-shareable-view.test.ts \
  e2e/gallery-filter-overflow.test.ts
```

## Boundaries

Selection snapshots are public photo IDs/cursors, bounded to five views and
30 minutes in the browser tab; they do not store private profile data or
photograph bodies. Reloading a detail page retains its captured selection.
When a copied detail link has no snapshot, its filtered Gallery return URL
still works and the page explains that selection navigation is unavailable
instead of silently navigating the unfiltered library. Other detail contexts
retain their existing legacy contract.

The server still uses fingerprinted offset cursors over a live dataset.
Client deduplication handles overlap, but cannot guarantee complete snapshot
pagination when removals or engagement changes move rows across a page
boundary. SQL query plans and database latency at larger volumes were not
benchmarked; the observations above intentionally measure client/request
behavior with a controlled fixture, not production capacity.