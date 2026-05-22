# PhotoClub

A photo sharing platform where photographers share their work within tight-knit clubs, organized by themes and searchable by club, photographer name, and theme.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/photoclub run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4, wouter routing, Framer Motion, TanStack Query
- API: Express 5, contract-first OpenAPI → Orval codegen
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — DB schema (clubs.ts, themes.ts, photographers.ts, photos.ts)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/photoclub/src/` — React frontend
- `lib/api-client-react/src/generated/` — Generated React Query hooks
- `lib/api-zod/src/generated/` — Generated Zod schemas (used by server)

## Architecture decisions

- Contract-first: OpenAPI spec gates all type generation; never hand-write types that Orval can generate.
- Server uses Zod schemas from `@workspace/api-zod` for request validation; client uses hooks from `@workspace/api-client-react`.
- Photo likes are a simple counter increment (no per-user tracking) for simplicity.
- Search is server-side via `ilike` for clubs/themes/photographers; photo gallery filtering uses query params.
- Stats endpoint aggregates counts from all four tables on demand.

## Product

- Browse photos across clubs and themes in a curated gallery
- Search photos by title; filter by club, theme, or photographer
- View club pages, theme collections, and photographer portfolios
- Upload photos with club and theme tagging
- Like photos; manage clubs, themes, and photographer profiles

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always re-run codegen before touching backend or frontend code.
- `pnpm --filter @workspace/db run push` must be run after schema changes in `lib/db/src/schema/`.
- Never import from relative paths in the frontend — use `@workspace/api-client-react`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
