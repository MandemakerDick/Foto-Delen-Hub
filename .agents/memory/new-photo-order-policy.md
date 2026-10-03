---
name: New photo placement
description: Required position of new uploads within a photographer's existing photo order
---

Newly uploaded photographs must become the first item in the photographer's list, including when the existing photographs have a manually saved order. Existing photographs move down while preserving their relative order.

**Why:** The user explicitly corrected the previous append-at-bottom behavior after a Samsung test: "uploaded photo should become the first one, existing ones all move down in list." A valid upload at the bottom had appeared missing. They subsequently confirmed the new-first behavior with preserved existing order in both My photos and View profile on Samsung.

**How to apply:** Apply the policy to native and web uploads and other paths that create photographs for a photographer. Preserve manual reordering as a separate explicit action. A failed upload must not rearrange existing photographs, and concurrent uploads or reorder saves must not produce duplicate positions or lose the new first item.