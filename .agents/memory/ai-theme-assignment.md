---
name: AI theme assignment policy
description: Guardrails for assigning existing themes from AI photo analysis.
---

AI may only select from the existing Theme library. New photos without a manually chosen theme can be auto-assigned when confidence is at least 85%; lower-confidence matches remain pending for an administrator to accept or reject. Existing-photo backfills must remain review-only until suggestion quality has been evaluated. Never overwrite a theme selected by a person.

**Why:** The user wants imports categorized automatically but prefers a controlled rollout that protects curated metadata and makes uncertain matches visible before broader automation.

**How to apply:** Preserve the candidate allowlist, confidence threshold, review state, and conditional unthemed-only update whenever the analysis queue, import flow, or theme-management UI changes.