import { expect, test, type Page } from "@playwright/test";

async function installMocks(page: Page) {
  let account = "A";
  let status: number | "network" = 200;
  let empty = false;
  let hold: Promise<void> | undefined;
  let release: (() => void) | undefined;
  const requests: number[] = [];
  const profile = (id: number) => ({
    id, name: `Fixture Photographer ${id}`, bio: "Local fixture bio",
    avatarUrl: null, clubs: [], themes: [], createdAt: "2025-01-15T12:00:00.000Z",
  });
  const photos = (id: number) => [1, 2].map(n => ({
    id: id + n, title: `Fixture photo ${id}-${n}`, description: "Local fixture description",
    imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='100'%3E%3Crect width='80' height='100' fill='gray'/%3E%3C/svg%3E",
    photographerId: id, photographerName: profile(id).name, themeId: null,
    likeCount: 3, commentCount: 2, createdAt: profile(id).createdAt,
  }));
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "en"));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", route => route.fulfill({
    contentType: "text/javascript",
    body: `
      import React from "/node_modules/.vite/deps/react.js";
      const { useSyncExternalStore } = React;
      let state = { isLoaded: true, isSignedIn: true, user: { id: "fixture-A", firstName: "Fixture" } };
      const listeners = new Set(), authListeners = new Set();
      const subscribe = cb => { listeners.add(cb); return () => listeners.delete(cb); };
      const addListener = cb => { authListeners.add(cb); cb({user: state.user}); return () => authListeners.delete(cb); };
      window.__switchFixtureAccount = id => {
        state = { ...state, user: { id: "fixture-" + id, firstName: "Fixture" } };
        authListeners.forEach(cb => cb({user: state.user}));
        listeners.forEach(cb => cb());
      };
      export const ClerkProvider = ({children}) => children;
      export const SignIn = () => null, SignUp = () => null, UserButton = () => null;
      export const useUser = () => useSyncExternalStore(subscribe, () => state);
      export const useAuth = () => ({ ...useUser(), userId: state.user.id });
      export const useClerk = () => ({ signOut: async () => {}, addListener });
      export const Show = ({children}) => children;
      export const SignInButton = ({children}) => children;
    `,
  }));
  await page.route("**/node_modules/.vite/deps/@clerk_react_internal.js*", route =>
    route.fulfill({ contentType: "text/javascript", body: `export const publishableKeyFromHost = () => "pk_test_fixture";` }));
  await page.route("**/src/App.tsx*", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      window.__refreshMyPhotos = () => queryClient.invalidateQueries({queryKey: ["/api/photos"]});
    ` });
  });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname === "/api/me") body = profile(account === "A" ? 42 : 84);
    if (url.pathname === "/api/themes") body = [{ id: 7, name: "Fixture theme", description: null }];
    if (url.pathname === "/api/photos") {
      const id = Number(url.searchParams.get("photographerId"));
      requests.push(id);
      const responseStatus = status;
      const responseBody = empty ? [] : photos(id);
      if (hold) await hold;
      if (responseStatus === "network") { await route.abort("failed"); return; }
      await route.fulfill({ status: responseStatus, contentType: "application/json",
        body: JSON.stringify(responseStatus === 200 ? responseBody : { error: "Local mocked failure" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return {
    requests,
    fail: (value: number | "network") => { status = value; },
    recover: (isEmpty = false) => { status = 200; empty = isEmpty; },
    pause: () => { hold = new Promise(resolve => { release = resolve; }); },
    resume: () => { release?.(); hold = undefined; },
    switchAccount: async (id: string) => {
      account = id;
      await page.evaluate(id => (window as any).__switchFixtureAccount(id), id);
    },
  };
}

for (const failure of [503, 401, 403, "network"] as const) {
  test(`initial ${failure} failure is not an empty portfolio and retry recovers`, async ({ page }) => {
    const mock = await installMocks(page);
    mock.fail(failure);
    await page.goto("/my-photos");
    const notice = page.getByTestId("my-photos-load-error");
    await expect(notice).toContainText("Could not load your photographs");
    await expect(page.getByText("No photographs yet", { exact: true })).toHaveCount(0);
    expect(mock.requests).toEqual([42]);
    if (failure === 401 || failure === 403) await expect(notice).toContainText("Your session or access");
    mock.recover();
    await notice.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByAltText("Fixture photo 42-1")).toBeVisible();
    await expect(notice).toHaveCount(0);
    expect(mock.requests).toEqual([42, 42]);
  });
}

test("successful empty portfolio and Dutch failure copy", async ({ page }) => {
  const mock = await installMocks(page);
  mock.recover(true);
  await page.goto("/my-photos");
  await expect(page.getByText("No photographs yet", { exact: true })).toBeVisible();
  await expect(page.getByTestId("my-photos-load-error")).toHaveCount(0);
  await page.getByRole("button", { name: /language/i }).click();
  await page.getByRole("menuitem", { name: "Nederlands" }).click();
  mock.fail(503);
  await page.evaluate(() => (window as any).__refreshMyPhotos());
  await expect(page.getByTestId("my-photos-load-error")).toContainText("Je foto's konden niet worden vernieuwd");
  mock.recover();
  await page.getByTestId("my-photos-load-error").getByRole("button", { name: "Opnieuw proberen", exact: true }).click();
  await expect(page.getByAltText("Fixture photo 42-1")).toBeVisible();
});

test("failed refresh preserves reorder draft and retry stays disabled while fetching", async ({ page }) => {
  const mock = await installMocks(page);
  await page.goto("/my-photos");
  await expect(page.getByAltText("Fixture photo 42-1")).toBeVisible();
  await page.getByRole("button", { name: "Reorder", exact: true }).click();
  const images = page.getByAltText(/Fixture photo 42-/);
  const handles = page.locator('[aria-roledescription="sortable"]');
  await handles.first().scrollIntoViewIfNeeded();
  const from = await handles.first().boundingBox();
  const to = await handles.nth(1).boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x + 14, from!.y + 14);
  await page.mouse.down();
  await page.mouse.move(to!.x + 14, to!.y + 14, { steps: 15 });
  await page.mouse.up();
  await expect.poll(() => images.evaluateAll(nodes => nodes.map(node => node.getAttribute("alt"))))
    .toEqual(["Fixture photo 42-2", "Fixture photo 42-1"]);
  const order = await images.evaluateAll(nodes => nodes.map(node => node.getAttribute("alt")));
  mock.fail(503);
  await page.evaluate(() => (window as any).__refreshMyPhotos());
  const notice = page.getByTestId("my-photos-load-error");
  await expect(notice).toContainText("Could not refresh your photographs");
  await expect(page.getByRole("button", { name: /save order/i })).toBeVisible();
  expect(await images.evaluateAll(nodes => nodes.map(node => node.getAttribute("alt")))).toEqual(order);
  mock.recover();
  mock.pause();
  await notice.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(notice.getByRole("button", { name: "Retrying…" })).toBeDisabled();
  expect(await images.count()).toBe(2);
  mock.resume();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("button", { name: /save order/i })).toBeVisible();
});

test("failed refresh preserves photo edit fields and theme selection", async ({ page }) => {
  const mock = await installMocks(page);
  await page.goto("/my-photos");
  await expect(page.getByAltText("Fixture photo 42-1")).toBeVisible();
  await page.getByRole("button", { name: "Edit photo", exact: true }).first().click({ force: true });
  const dialog = page.getByRole("dialog");
  await dialog.locator("input").fill("Unsaved photo title");
  await dialog.locator("textarea").fill("Unsaved photo description");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Fixture theme", exact: true }).click();
  const theme = await dialog.getByRole("combobox").textContent();
  mock.fail(503);
  await page.evaluate(() => (window as any).__refreshMyPhotos());
  await expect(page.getByTestId("my-photos-load-error")).toContainText("Your unsaved changes are preserved");
  await expect(dialog.locator("input")).toHaveValue("Unsaved photo title");
  await expect(dialog.locator("textarea")).toHaveValue("Unsaved photo description");
  expect(await dialog.getByRole("combobox").textContent()).toBe(theme);
  // Retry through the actual current query while the modal prevents outside clicks.
  mock.recover();
  await page.evaluate(() => (window as any).__refreshMyPhotos());
  await expect(page.getByTestId("my-photos-load-error")).toHaveCount(0);
  await expect(dialog.locator("input")).toHaveValue("Unsaved photo title");
});

test("account switches discard old photos and edits, including returning to A", async ({ page }) => {
  const mock = await installMocks(page);
  await page.goto("/my-photos");
  await expect(page.getByAltText("Fixture photo 42-1")).toBeVisible();
  await page.getByRole("button", { name: "Edit photo", exact: true }).first().click({ force: true });
  await page.getByRole("dialog").locator("input").fill("Old account draft");
  await mock.switchAccount("B");
  await expect(page.getByAltText("Fixture photo 84-1")).toBeVisible();
  await expect(page.getByAltText("Fixture photo 42-1")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  mock.fail(401);
  await mock.switchAccount("A");
  await expect(page.getByTestId("my-photos-load-error")).toBeVisible();
  await expect(page.getByAltText("Fixture photo 84-1")).toHaveCount(0);
  await expect(page.getByAltText("Fixture photo 42-1")).toHaveCount(0);
  mock.recover();
  await page.getByTestId("my-photos-load-error").getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByAltText("Fixture photo 42-1")).toBeVisible();
  expect(mock.requests).toEqual([42, 84, 42, 42]);
});