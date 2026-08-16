---
name: Review-club base path routing in tests
description: How to navigate correctly in review-club Playwright tests where the app is mounted at /review/.
---

## Rule
Always use relative paths (without leading `/`) in `page.goto()` calls for review-club Playwright tests. The base URL is `http://localhost:5184/review/`.

## Why
- Absolute paths (starting with `/`) replace the path after the origin: `page.goto("/archive")` → `http://localhost:5184/archive` (wrong — bypasses /review/)
- Relative paths are resolved against the baseURL: `page.goto("archive")` → `http://localhost:5184/review/archive` ✓

**Exception**: `page.goto("/")` is treated as the root URL by Playwright and effectively lands on `http://localhost:5184/` which happens to serve the same Vite HTML — so it works for the sessions home page but is technically wrong.

## How to apply
```js
// Wrong:
await page.goto("/archive", ...);  // lands on http://localhost:5184/archive

// Right:
await page.goto("archive", ...);   // lands on http://localhost:5184/review/archive
await page.goto("/", ...);         // acceptable for home page only (lucky case)
```

## API endpoint note
`useListReviewSessions` calls `/api/review-sessions` (NOT `/api/sessions`). Stub pattern: `/\/api\/review-sessions(\?|$)/`.
