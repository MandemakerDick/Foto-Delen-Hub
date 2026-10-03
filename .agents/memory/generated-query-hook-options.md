---
name: Generated query hook options
description: Type-checking gotcha when customizing generated React Query hooks
---

When customizing options on a generated API query hook, inspect its positional signature first. Parameterized hooks may expect endpoint parameters before the options object, and the generated TypeScript types may require an explicit query key inside those options.

**Why:** Two plausible calls for an otherwise ordinary query failed TypeScript checks: passing options as the first argument and then omitting the query key from the second argument.

**How to apply:** Before adding `enabled`, retry, or other options to a generated hook, check its generated signature and query-key helper rather than assuming every hook accepts the same shape.