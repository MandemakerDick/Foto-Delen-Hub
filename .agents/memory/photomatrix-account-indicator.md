---
name: PhotoMatrix account indicator
description: Project-specific preference for visible sign-in state in the native app
---

Use a compact top-right Sign out control, optionally showing the first name, to indicate that a member is signed in. Do not add a large “Signed in” card or display the account email as a prominent confirmation.

**Why:** The Android tester found no sign-in confirmation, but said the subsequent email/status card was too much and preferred the existing top-right sign-out location.

**How to apply:** Keep account controls unobtrusive on PhotoMatrix native screens, including before a photographer profile is linked. The sign-out control itself is sufficient confirmation.