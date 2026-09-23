---
name: Expo React version alignment
description: Root pnpm override behavior when Expo requires a newer React patch version.
---

An explicit Expo artifact React pin may still install the root override version. The root pnpm overrides and catalog need alignment with the Expo SDK's expected React version; splitting React versions can leave shared React Query peers duplicated and fail Expo Doctor.

**Why:** A per-artifact pin and scoped override both appeared valid in package manifests but installed an older React through root overrides. Removing global overrides produced a duplicate React peer instance. Aligning the workspace on the Expo-required version passed all Doctor checks.

**How to apply:** When upgrading Expo or React, inspect the installed package version and run `expo-doctor` from the artifact; do not trust manifest values alone.