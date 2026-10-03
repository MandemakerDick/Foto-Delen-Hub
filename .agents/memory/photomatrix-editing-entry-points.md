---
name: PhotoMatrix editing entry points
description: Native photo editing should use one owner-only full-size editor across entry points.
---

Keep photo editing in the full-size photo detail view, including when an owner starts from My photos. Keep theme and club choices collapsed until requested rather than displaying all choices inline; use the compact boxed picker treatment for upload choices too.

**Why:** A device tester found the small inline editor in My photos cramped and the full theme list distracting; they preferred the existing full-size editor reached from Gallery or photographer pages. After trying the updated upload choices on a Samsung, the user explicitly liked the UI changes and the light boxes.

**How to apply:** Route an owner’s Edit action into the shared photo detail editor and preserve a back path to the originating tab. Avoid introducing a second edit form with different controls or save behavior. Prefer compact bordered selection controls over a wall of chips for upload club and theme choices.

The tester confirmed the recent full-size edit flow, including choosing or clearing a theme, saving, and returning to My photos, works on their Android phone.