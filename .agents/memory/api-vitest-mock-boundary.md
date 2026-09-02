---
name: API Vitest mock boundary
description: How to keep API unit tests from accidentally loading the real database in this workspace.
---

Run tests that import API server modules with the API artifact as Vitest's root. Running the same test from a web artifact can bypass the mocked workspace database package and load the real database.

**Why:** A test initially located under the web artifact mocked the database specifier, but API-side module resolution still loaded the real package. Moving the suite under the API artifact and running Vitest with that artifact as root made the mock deterministic.

**How to apply:** Keep API unit tests in the API artifact, use its test command, and verify a new database mock with a minimal smoke test before writing any case that could mutate data.