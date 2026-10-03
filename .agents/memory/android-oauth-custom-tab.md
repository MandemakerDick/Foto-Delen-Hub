---
name: Android Google OAuth recovery
description: Native Expo Google sign-in can leave an Android Chrome Custom Tab open after an app reload.
---

On Android, an in-flight Expo browser auth session may be orphaned if the development app reloads while Google sign-in is open. The app cannot reliably close the orphaned Chrome Custom Tab programmatically; the person must close the old Google window before starting another attempt. Distinguish this recovery behavior from a successful sign-in or a normal browser dismissal.

**Why:** A phone tester reported that intermittent Google sign-in interruptions left the browser window open, and the next attempt appeared to do nothing. The installed Expo browser implementation documents that its Android auth-session polyfill cannot dismiss Chrome Custom Tabs.

**How to apply:** For native SSO changes, preserve visible cancellation/interruption feedback and a safe retry path across app reloads; avoid promising automatic tab closure on Android. Retest on a phone, including a development refresh mid-login and a fresh attempt with a different account.