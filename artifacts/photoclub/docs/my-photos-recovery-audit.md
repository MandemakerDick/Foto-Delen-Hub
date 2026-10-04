# My Photos loading recovery

## Scope and behavior

- Private My Photos only. Public Gallery, API contracts, native apps and
  production records were not changed.
- Failed initial requests show a retry notice, not an empty portfolio or
  misleading zero totals. A successfully loaded empty list retains the
  normal first-upload prompt.
- Failed background refreshes retain cached photographs and keep the
  dashboard mounted, including changed reorder drafts and photo-edit fields
  and theme selection. Retry does not reset those drafts.
- HTTP 401/403 explain the session/access problem without automatically
  signing out. The existing Sign out control remains available.
- Private list keys distinguish account identity epochs while preserving
  generated list-key prefixes used by edit/delete/reorder invalidation.
  Retries and responses check their captured identity; obsolete requests
  cannot populate a later account/session.
- Initial and background errors, authentication guidance and retry progress
  have English and Dutch copy. Retry is disabled while fetching.

## Verification

- PhotographersHub TypeScript, lint and whitespace checks passed.
- Full web unit suite: 1,541 passed. The new query/notice suites contain
  14 focused checks covering network/server/auth recovery, retained data,
  stale retries/responses, identity-separated keys, mutation invalidation
  compatibility and English/Dutch error presentation.
- Eight distinct focused browser scenarios passed across the main and
  targeted correction runs. Coverage includes 503/401/403/network initial
  failure and retry, successful empty lists, Dutch refresh recovery,
  a genuinely changed drag-reorder draft, pending retry, unsaved title/
  description/theme selection, and A → B → A account switching.
- Browser checks use local Clerk fixtures and fully mocked API responses;
  no real accounts, uploads, saves, deletions or production writes occur.
- The managed web workflow was restarted and came up cleanly. A 390px
  preview screenshot confirmed the unchanged signed-out My Photos page;
  authenticated error/draft behavior was checked with the browser fixtures,
  not inferred from that signed-out screenshot.

Repeat focused checks:

```sh
pnpm --filter @workspace/photoclub exec vitest run \
  src/lib/my-photos-query.test.ts \
  src/components/my-photos-load-notice.test.ts
cd artifacts/photoclub
pnpm exec playwright test --config playwright.config.ts \
  e2e/my-photos-recovery.test.ts --workers=1
```

## Separate performance finding

The private normal photo grid still uses an uncapped index-based reveal
delay. This task does not change animation or large-portfolio performance.
The public Gallery's bounded delay does not apply to My Photos.