---
name: PhotoMatrix upload confirmation
description: Photo selection and upload consent across native and web
---

Selecting a camera or library photo in PhotoMatrix or PhotographersHub should only stage and preview it. Require a separate Upload photo action before transferring or creating a photo, and keep Cancel available to discard the draft.

**Why:** A tester found that the Cancel button was ineffective for review when library selection immediately started the upload. Choosing an image is not an explicit instruction to publish it.

**How to apply:** Preserve review and cancellation steps if changing either product's photographer photo selection, preview, or upload flows. Browser camera/file inputs do not share native permission APIs, but the choice must never start a network transfer on its own. Administrator uploads may still have their own account/club assignment choices.

The tester confirmed on Android that a prolonged offline request fails with the draft still selected, retry after reconnection succeeds once and renders the image, and Cancel works before upload and during transfer. A short interruption may legitimately recover before the deadline.

The user also confirmed the signed-in PhotographersHub browser upload and camera check worked after web photo selection was changed to a draft-first flow. That confirmation does not establish every failure/cancellation branch or production-connected native behavior.