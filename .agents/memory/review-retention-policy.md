---
name: Review retention policy
description: Why file reclamation refuses deletion of review-linked items rather than silently cascading review history.
---

Keep review history protected when reclaiming unused images. Refuse deletion
of photos, profiles, or individual submissions that still have dependent review
references; do not introduce automatic destruction of review history as a
side effect of storage cleanup.

**Why:** Review screens use live photo/profile records, not durable URL
snapshots. Retaining only file bytes after removing those records still breaks
the review. Refusing removal was chosen over a new soft-deletion model to avoid
changing Gallery visibility and every client contract within file reclamation.
Deleting an entire review session is an existing explicit administrator action
and retains its intentional cascade.

**How to apply:** Maintain this safety boundary when extending removal paths.
Any move to archival snapshots or soft deletion needs an explicit product
decision and coordinated client/schema changes, not an incidental cleanup fix.