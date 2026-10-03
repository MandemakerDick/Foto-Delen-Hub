---
name: Clerk Expo Core 3 results
description: Sign-in error-handling caveat in the native Clerk SDK's newer resource API.
---

When building custom email sign-in and verification with the native Clerk hooks, do not assume a rejected Promise or a completed session follows every request. Check the returned error object and the resource's resulting status; show a visible message for any incomplete state.

Do not mix examples from Clerk's legacy sign-in resource into a Core 3 future-resource flow. The future-resource MFA interface has different methods; consult its installed types before implementing second-factor handling.

**Why:** A real Android tester saw sign-in do nothing because a failed or incomplete attempt produced no visible error. The SDK's newer resource methods can resolve with an error result rather than throwing. A later second-factor flow exposed an API mismatch between legacy and future resources.

**How to apply:** Whenever changing native Clerk custom flows, consult the installed SDK types for the result shape and supported verification methods, handle returned errors as well as exceptions, and verify completion before activating or navigating. Never bypass a required factor to make sign-in appear successful.