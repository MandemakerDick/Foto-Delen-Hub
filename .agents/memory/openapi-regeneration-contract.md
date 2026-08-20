---
name: OpenAPI regeneration contract
description: The generated API clients are replaced wholesale, so the specification must include all active route fields and request contracts.
---

Treat the OpenAPI document as the complete API contract before running code generation; generated client and Zod outputs are cleaned and recreated rather than incrementally patched.

**Why:** An incomplete contract can silently remove type exports or response fields that existing app code relies on, turning a routine regeneration into cross-app build failures.

**How to apply:** When changing the spec, compare server route inputs/outputs with the schemas, include adjacent active endpoints affected by the same models, regenerate, and typecheck every API consumer immediately.