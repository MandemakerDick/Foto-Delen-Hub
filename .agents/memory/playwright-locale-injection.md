---
name: Playwright locale injection for i18n tests
description: How to reliably set i18next language in Playwright e2e tests for photoclub and review-club.
---

## Rule
Use `context.addInitScript` + `page.evaluate` + `page.reload()` to set the i18n locale in Playwright tests. Never use `storageState.origins` with `"http://localhost"` — it must match the exact host:port the dev server runs on.

## Why
`storageState.origins` requires the origin to exactly match `http://localhost:5183` (photoclub) or `http://localhost:5184` (review-club). Using `"http://localhost"` without the port silently fails — the localStorage key is never set and i18next loads with the default language.

`addInitScript` fires before ANY page script, so i18next sees the locale in localStorage on first initialization. However, if the test navigates to the page before calling evaluate, add a reinforce + reload step.

## How to apply
```js
// Fresh context
const context = await browser.newContext({ ... });
await context.addInitScript(() => localStorage.setItem("photoclub.lang", "nl"));
const page = await context.newPage();
// ... setup stubs ...
await page.goto(url, { waitUntil: "domcontentloaded" });
// Reinforce — belt-and-suspenders:
await page.evaluate(() => localStorage.setItem("photoclub.lang", "nl"));
await page.reload({ waitUntil: "networkidle" });
```

Storage keys:
- photoclub: `"photoclub.lang"`
- review-club: `"reviewclub.lang"`
