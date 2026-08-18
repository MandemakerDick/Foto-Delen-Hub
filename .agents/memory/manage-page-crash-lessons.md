---
name: Manage page crash — missing imports & undefined calls
description: What caused the black-screen crash on the Manage page and how it was fixed
---

## The problem
Navigating to `/manage` as a signed-in Clerk admin caused the entire React tree to go black (no error shown because there was no error boundary).

## Root causes found
1. **`AlertDialogTrigger` used but not imported** in `manage.tsx` — the component was `undefined` at runtime; `React.createElement(undefined, ...)` crashes React.
2. **`setImportWarningAcknowledged` called but never defined as state** — a state setter that was never created via `useState`, called inside the Import tab JSX.
3. **Missing `queryKey` in `useListPhotos` call** — the generated hook accepts `{ query: { enabled, queryKey } }` but only `enabled` was passed; added `queryKey: getListPhotosQueryKey()` to match the pattern used by other hooks.

## Secondary issue (also fixed)
The `api-client-react` package `.d.ts` dist files were stale after a schema change (`sessionAdminActive` added to `AdminStatusResponse`). Running `npx tsc -p tsconfig.json` inside `lib/api-client-react` rebuilt the dist and cleared the TypeScript error in `layout.tsx`.

**Why:** Workspace packages with `composite: true` and `emitDeclarationOnly` must be rebuilt whenever their source schema changes; the consuming app uses the compiled `.d.ts`, not the source.

**How to apply:** After any change to `lib/api-client-react/src/generated/`, run `npx tsc -p tsconfig.json` from `lib/api-client-react/` before type-checking the consuming apps.

## Lesson
- Always run `tsc --noEmit` from the consuming app directory after changes to shared packages.
- Any undefined variable/component used in JSX (even inside a lazily-rendered `TabsContent`) can crash the whole React tree if there is no error boundary.
- Add error boundaries early — wrapping route components with `<ErrorBoundary>` surfaces crash messages instead of a black screen.
