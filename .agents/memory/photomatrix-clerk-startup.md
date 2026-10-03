---
name: PhotoMatrix Clerk startup
description: Why public native navigation should remain visible while Clerk initializes.
---

Keep public PhotoMatrix navigation and its Sign in entry available while Clerk is still loading; gate only private actions and tabs on confirmed authentication. The sign-in screen should state when auth is loading and offer a retry, rather than showing a form that cannot submit. Unauthenticated API requests should not wait for a bearer token before Clerk is ready.

**Why:** The native splash hides after font loading. Gating all navigation on Clerk readiness can leave a plain blank screen if session restoration or network initialization takes too long. Gating both Home account actions also left only Feedback visible under Member access, with no sign-in path or explanation.

**How to apply:** When changing the auth provider or root layout, preserve public browsing during auth initialization and check both startup and private-route behavior on a physical device before declaring the release path clear. A working web preview did not predict native readiness on a Samsung: after a prolonged unexplained stall, the tester later completed Expo Go sign-in. Do not assign causality to a package patch or restart without evidence.