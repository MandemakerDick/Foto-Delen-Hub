---
name: Workspace dependency pruning
description: Keep dependency removals scoped to the intended artifact in the pnpm monorepo.
---

When pruning dependencies from one artifact, confirm the artifact's own manifest and the workspace lockfile changed; a general package-removal operation can target the monorepo root without altering the artifact.

**Why:** A reported successful removal did not change the PhotoMatrix workspace manifest, leaving the direct dependencies declared.

**How to apply:** After any scoped dependency cleanup, check the target package manifest for the removed declarations, synchronize the lockfile, and run the artifact's build and tests.