---
name: PhotoMatrix orange accent
description: Confirmed native primary-color preference and its contrast rationale.
---

Use the warm, high-contrast orange primary accent in the PhotoMatrix native app rather than the former dark red. Keep dark text on filled orange actions; keep destructive and error colors semantically distinct instead of making all red disappear. Do not infer that the separate web products must change color.

**Why:** The user saw the orange native preview and explicitly said it was already satisfactory and more readable. The previous red-on-near-black accent made smaller links and tab labels harder to see. The orange-on-dark and dark-on-orange combinations were checked for strong text contrast.

**How to apply:** Preserve the shared orange accent across native controls and both tab implementations, and verify any later palette change against dark surfaces and filled-button text. Treat the preview preference as confirmed, while still checking native display behavior on real devices before store release.