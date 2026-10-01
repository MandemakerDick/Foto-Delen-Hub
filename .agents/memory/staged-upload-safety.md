---
name: Staged upload safety
description: Why upload cleanup must cover avatars, ambiguous saves, and compatible API writers.
---

Treat the shared signed-upload endpoint as an image uploader, not only a photo
uploader. Every persisted use of its files must participate in the same
transactional attachment protocol as cleanup. Preserve deletion tombstones;
checking references immediately before deletion alone is not sufficient.

**Why:** The native photo-upload cleanup design initially overlooked the web
avatar uploader sharing that endpoint. Expiring all unlinked reservations would
have removed successfully saved avatars. Also, a client can receive an error
after a successful commit, so client failure must never trigger unconditional
file deletion.

**How to apply:** When introducing another image consumer or write path, include
its attachment transaction and fallback reference check. Do not enable cleanup
alongside older writers that bypass the protocol; disable/drain cleanup workers
before a mixed-version rollout or legacy rollback. Never extend cleanup to
untracked legacy files merely by scanning storage.