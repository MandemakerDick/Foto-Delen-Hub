---
name: Radix Select empty-value crash
description: Using value="" on SelectItem crashes the component tree at runtime; use "none" instead.
---

Radix UI Select requires all SelectItem values to be non-empty strings. Using `value=""` is unsupported and throws at runtime, crashing the nearest React subtree with no visible error boundary — just a blank/black page.

**Why:** Radix UI internally uses empty string to represent "no selection" (uncontrolled state). A SelectItem with the same value collides with that sentinel, causing an invariant violation.

**How to apply:** Any time a Select needs a "none/unset" option, use `value="none"` (or any non-empty sentinel). Update state initialisation and save logic accordingly:
- Init: `useState("none")` / `photo?.clubId?.toString() ?? "none"`
- Save: `value !== "none" ? Number(value) : null`
