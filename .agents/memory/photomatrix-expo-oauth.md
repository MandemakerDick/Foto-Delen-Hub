---
name: Published Expo Go authentication callbacks
description: Separate published preview callback transport from installed Android scheme evidence
---

Treat a published Expo Go authentication callback as reopening the hosted project, not merely navigating to an app route. Verify the manifest's project address and secure transport as well as the callback route. Keep development Expo Go and installed-app scheme handling separate.

**Why:** A Samsung production Google attempt returned to Expo Go's blue project-error screen while Google worked on the website. The published preview used a project address outside its artifact mount. Expo's linking documentation also warns that generated links for published Expo Go updates are not a stable installed-build contract.

**How to apply:** When production authentication leaves the app for Expo Go, distinguish a failed project reopen from a PhotoMatrix error before changing Clerk settings. Recheck published callback configuration after deployment and require device evidence; a corrected preview callback never clears external custom-scheme handoff or store release.