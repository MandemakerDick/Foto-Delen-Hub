---
name: PhotoMatrix theme cardinality
description: The distinction between Photo's single theme and Photographer's multiple themes.
---

A Photo has one Theme. A Photographer may have several preferred Themes. Do not apply photographer theme multiplicity to photos.

**Why:** After briefly considering Photo multi-theme support, the user explicitly corrected that Photos only have one Theme. The similarity of the two profile types made it easy to conflate their cardinality.

**How to apply:** Use one-theme selection and display for photo upload, detail, editing, filtering and AI categorization. Keep the existing multiple-theme preferences for photographer profiles.