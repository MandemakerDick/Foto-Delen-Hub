---
name: PhotoMatrix reorder layout
description: Keep native photo reordering visually aligned with the web reorder screen.
---

Entering native photo reordering should show a two-column photo grid with card handles and Cancel / Save order controls, matching the web layout. Keep a Move entry between Edit and Delete on each normal My photos row. On a phone, a tap-to-select then tap-to-place action provides an accessible way to change the draft order before saving.

**Why:** The user explicitly asked for the native reorder UI to use the same layout as the existing web app, rather than an inline Up/Down panel. Sending each adjacent move immediately also differed from the web's review-then-save flow. They later confirmed on a development Android phone that Save persisted the order and Cancel discarded an unsaved change.

**How to apply:** When changing either reorder experience, preserve the grid and explicit Save/Cancel model across both products. Do not silently persist a change before Save; keep the draft available after a failed save.