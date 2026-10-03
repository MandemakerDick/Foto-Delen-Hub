---
name: PhotoMatrix shared selection links
description: Distinguish native custom-scheme sharing from web links and Expo Go limitations.
---

Gallery selection sharing uses a native custom-scheme URL, not a browser URL. Provide an in-app paste path while testing with Expo Go; do not claim direct OS handoff works until an installed Android build is tested.

**Why:** A device tester could copy the selection URL but had no way to use it in the preview. Expo Go does not register PhotoMatrix's custom scheme, even though the app declares one for its own builds.

The tester subsequently confirmed that pasting the copied link restored the selection on their Android phone **without signing in**, kept seeded Shuffle order, and allowed a fresh Reshuffle; they also confirmed the shared-link form's Close and Cancel actions. Keep this public Gallery path available to signed-out visitors. These confirmations are for in-app paste, not direct custom-scheme handoff.

**How to apply:** Keep parsing selection filters and random seed consistent between pasted links and external routes. Test paste in development and test direct opening from another app only with an installed build. Keep the share-link action next to Reset in Gallery rather than hidden under expanded filters; the user requested this for discoverability. Its “Save and share” wording refers to saving or sending the link with the system share sheet, not to an account-saved selection.