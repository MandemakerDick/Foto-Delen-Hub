---
name: AI theme assignment policy
description: Guardrails for assigning existing themes from AI photo analysis.
---

AI may only select from the existing Theme library. New photos without a manually chosen theme can be auto-assigned when confidence is at least 85%; lower-confidence matches remain pending for an administrator to accept or reject. Existing-photo backfills must remain review-only until suggestion quality has been evaluated. Never overwrite a theme selected by a person.

Keep assignment status separate from evaluation outcome. Accepting a pending suggestion records it as correct, rejecting records it as incorrect, and every auto-applied suggestion must remain visible in review history until an administrator marks it correct or incorrect.

**Why:** The user wants imports categorized automatically but prefers a controlled rollout that protects curated metadata, makes uncertain matches visible, and clearly explains when automatic results are already public. This review-first visibility has been confirmed as working.

**How to apply:** Preserve the candidate allowlist, confidence threshold, review state, outcome history, and conditional unthemed-only update whenever the analysis queue, import flow, or theme-management UI changes.