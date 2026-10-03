---
name: Separate admin and photographer identities
description: Operational identity policy when the same person manages the site and contributes photos
---

One person who acts as both administrator and photographer should use two distinct sign-in accounts: the admin identity for management and the photographer identity for uploading and editing their own photos.

**Why:** Keeping duties separate avoids working on personal photos while signed in as the administrative identity and makes invitation and ownership checks clearer.

**How to apply:** In release QA, have the admin sign in on the production web site to create an invite, then sign in with a different photographer account in native to redeem it and manage photos. This is an intended policy, not proof that the current API enforces role exclusivity; ask before adding an enforced prohibition or changing existing account links.