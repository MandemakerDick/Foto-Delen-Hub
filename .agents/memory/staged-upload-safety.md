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

Apply the same decoded object identity to reference checks and attachment
locking, including mixed literal and percent-encoded UUID characters.

**Why:** A served storage URL can encode UUID characters. Literal UUID matching
alone misses a surviving photo/avatar/logo reference and can delete its file.
Canonicalizing only new writes does not protect older noncanonical references.

**How to apply:** Preserve conservative alias matching for existing references
when changing path normalization or adding an image consumer.

Server-side buffer imports must reserve durably before writing storage bytes,
and exclude expiry cleanup for the duration of the write. A failed or ambiguous
write must leave its reservation eligible for later cleanup, not delete eagerly.

**Why:** Reserving after upload leaves an orphan on a process crash. Reserving
before upload without excluding cleanup allows a sufficiently delayed write to
recreate an object after its deletion tombstone. A reported failure can also
follow a successful photo commit, so immediate deletion is unsafe.

**How to apply:** Reuse the staging ledger for newly created import objects,
keep attachment transactional, and never backfill old import objects merely
because they share the same storage prefix.

Authorize writes that can trigger retirement on the server, not just through
management-page link visibility. Club creation and updates require a verified
administrator; public club reads remain public.

**Why:** Club edits were previously callable without an admin check. Adding
physical cleanup would otherwise let an unauthorized logo replacement schedule
another club's file for deletion.

**How to apply:** Keep the verified Clerk/password-session admin boundary when
extending club image mutations or adding another retirement-triggering route.