---
name: Managed Clerk and external Android builds
description: Production Android packaging limitation for Replit-managed Clerk
---

Replit's published Expo bundle can use its automatically provisioned production Clerk configuration, but Replit does not currently export an Android APK/AAB. Its documentation says the managed production Clerk publishable key cannot be accessed or used for an external Expo build. An external Android build service by itself is therefore not a verified production-connected release path for this setup.

**Why:** An externally signed package using development Clerk settings would appear installable while authenticating against the wrong tenant. Production Expo Go testing also cannot verify installed-app deep-link handoff.

**How to apply:** Keep Android installed-build release QA open until a supported production-key/build route is established. Do not scrape a published bundle, substitute development keys, or claim a GitHub/local build is production-connected without validating its auth configuration. Production Expo Go can provide partial server-connected QA after a fresh publish.