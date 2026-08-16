---
name: Playwright strict mode and getByText
description: How to avoid strict mode violations when asserting translated text in dialogs.
---

## Rule
Never use `page.getByText("Theme")` or `dialog.getByText("Theme")` when "Theme" could appear in multiple elements (e.g., a Label AND a "Suggest a new theme" button). Playwright strict mode throws an error when a locator resolves to more than one element.

## Why
`getByText("Theme")` finds ANY element whose text contains "Theme" — including buttons, links, and labels. In the photo edit dialog, both the `<label>Theme</label>` and `<button>+ Suggest a new theme</button>` match.

## How to apply
Target the specific element type:
```js
// Wrong — strict mode violation if multiple elements match:
await dialog.getByText("Theme").toBeVisible();

// Right — targets only <label> elements:
await dialog.locator("label").filter({ hasText: "Theme" }).first().toBeVisible();

// Also right — use exact text:
await page.getByText("Theme", { exact: true }).toBeVisible(); // still may match 2
```

The `locator("label").filter({ hasText: "..." })` approach is the most reliable for asserting translated label text in forms.
