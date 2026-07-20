---
name: Dark-theme dialog visibility
description: In the darkroom near-black theme, dialog bg-background is indistinguishable from the overlay; use hardcoded arbitrary values.
---

The app's CSS theme uses `--background: 240 5% 4%` (near-black). The default shadcn `DialogContent` uses `bg-background`, and the overlay is `bg-black/70`. Both resolve to near-identical near-black, making the dialog invisible.

**Why:** CSS custom property token resolution via `@theme inline` works in principle but is fragile in edge cases. Hardcoded Tailwind arbitrary values are reliable.

**How to apply:** In `dialog.tsx` and `alert-dialog.tsx`, use:
- `bg-[hsl(240_5%_13%)]` for the dialog surface (dark charcoal, clearly distinct from overlay)
- `border-[hsl(240_5%_22%)]` for the border
- `text-[hsl(0_0%_90%)]` for foreground text
- Overlay: `bg-black/70` (slightly reduced from default 80%)
