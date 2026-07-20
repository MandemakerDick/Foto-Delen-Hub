---
name: Drizzle-kit push in non-TTY environments
description: drizzle-kit push fails non-interactively; use raw SQL via executeSql instead
---

## Rule
Never run `pnpm --filter @workspace/db run push` from bash in CI or agent shells — it requires an interactive TTY and will throw `Interactive prompts require a TTY terminal`.

**Why:** drizzle-kit prompts the user to confirm table renames/drops, which fails when stdin/stdout are not a TTY.

**How to apply:** Use the `executeSql` code_execution callback to run the raw `CREATE TABLE IF NOT EXISTS ...` DDL directly. Match the Drizzle schema exactly (column names, types, constraints, defaults).
