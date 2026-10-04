import { expect, test, type Page } from "@playwright/test";

const fixture = {
  id: 42,
  name: "Fixture Photographer",
  bio: "fixture bio",
  avatarUrl: null,
  clubs: [],
  themes: [],
  createdAt: "2025-01-15T12:00:00.000Z",
};

async function installMocks(page: Page) {
  let meStatus = 500;
  let failRefresh = false;

  await page.addInitScript(() => {
    localStorage.setItem("i18nextLng", "en");
    (window as any).__clerkSignOutOptions = null;
  });

  // Replace only the optimized Clerk module: all auth state remains a local fixture.
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", async (route) => {
    await route.fulfill({
      contentType: "text/javascript",
      body: `
        const user = { id: "fixture-A", firstName: "Fixture", lastName: "Photographer",
          fullName: "Fixture Photographer", imageUrl: null, username: "fixture" };
        export const ClerkProvider = ({ children }) => children;
        export const SignIn = () => null;
        export const SignUp = () => null;
        export const useUser = () => ({ isLoaded: true, isSignedIn: true, user });
        export const useAuth = () => ({ isLoaded: true, isSignedIn: true, userId: "fixture-A" });
        export const useClerk = () => ({
          signOut: async (options) => { window.__clerkSignOutOptions = options; },
          addListener: () => () => {}
        });
        export const Show = ({ children }) => children;
        export const SignInButton = ({ children }) => children;
        export const UserButton = () => null;
      `,
    });
  });
  await page.route("**/node_modules/.vite/deps/@clerk_react_internal.js*", async (route) => {
    await route.fulfill({ contentType: "text/javascript", body: `export const publishableKeyFromHost = () => "pk_test_fixture";` });
  });
  // This test-only bridge is appended to Vite's transformed module, preserving
  // access to the actual lexical store without adding an app-source hook.
  await page.route("**/src/hooks/use-my-profile.ts*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({
      response,
      body: `${source}\nwindow.__runProfileRefresh = () => { const s = store.getSnapshot(); return store.refresh(s.userId, s.identityRevision); };\n`,
    });
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/me") {
      const status = failRefresh ? 500 : meStatus;
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(status === 200 ? fixture : { error: "Mocked local response" }),
      });
      return;
    }
    if (url.pathname === "/api/photographers/42") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) });
      return;
    }
    if (url.pathname === "/api/photos/42") {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          id: 42, title: "Fixture public photo", description: "Fixture photo content",
          imageUrl: "/fixture-photo.jpg", photographerId: 42, photographerName: fixture.name,
          likeCount: 0, commentCount: 0, createdAt: fixture.createdAt,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  return {
    setMeStatus: (status: number) => { meStatus = status; failRefresh = false; },
    failBackgroundRefresh: () => { failRefresh = true; },
    recover: () => { failRefresh = false; meStatus = 200; },
  };
}

test("task 181: profile-load states, retained dashboard, public routes and Dutch copy", async ({ page }) => {
  const mock = await installMocks(page);

  await page.goto("/my-photos");
  const notice = page.getByTestId("profile-load-error");
  await expect(notice).toContainText("Photographer profile unavailable");
  await expect(notice.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByText("Link your account to an existing photographer profile", { exact: false })).toHaveCount(0);

  mock.setMeStatus(200);
  await notice.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Fixture Photographer", { exact: true })).toBeVisible();
  await expect(page.getByText("fixture bio", { exact: true })).toBeVisible();

  mock.setMeStatus(404);
  await page.evaluate(() => window.__runProfileRefresh());
  await expect(page.getByText("Link your account to an existing photographer profile", { exact: false })).toBeVisible();
  await expect(page.getByTestId("profile-load-error")).toHaveCount(0);

  mock.setMeStatus(401);
  await page.evaluate(() => window.__runProfileRefresh());
  await expect(page.getByTestId("profile-load-error")).toContainText("Your session could not be verified");
  await expect(page.getByRole("button", { name: "Sign out and sign in again" })).toBeVisible();
  expect(await page.evaluate(() => window.__clerkSignOutOptions)).toBeNull();
  await page.getByRole("button", { name: "Sign out and sign in again" }).click();
  await expect.poll(() => page.evaluate(() => window.__clerkSignOutOptions)).toEqual({ redirectUrl: "/sign-in" });
  await expect(page.getByTestId("profile-load-error")).toBeVisible();

  mock.setMeStatus(200);
  await page.getByTestId("profile-load-error").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Fixture Photographer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  const bio = page.locator("textarea").first();
  await bio.fill("unsaved fixture draft");
  mock.failBackgroundRefresh();
  await page.evaluate(() => window.__runProfileRefresh());
  await expect(page.getByTestId("profile-load-error")).toContainText("Profile refresh failed");
  await expect(bio).toHaveValue("unsaved fixture draft");
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  mock.recover();
  await page.getByTestId("profile-load-error").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("profile-load-error")).toHaveCount(0);
  await expect(bio).toHaveValue("unsaved fixture draft");

  mock.setMeStatus(500);
  await page.goto("/upload");
  await expect(page.getByTestId("profile-load-error")).toBeVisible();
  await expect(page.getByText(/link a photographer profile first/i)).toHaveCount(0);
});

test("public browsing and Dutch profile retry remain available", async ({ page }) => {
  await installMocks(page);
  await page.goto("/photos/42");
  await expect(page.getByTestId("profile-load-error")).toContainText("You can still browse this page");
  await expect(page.getByRole("heading", { name: "Fixture public photo", exact: true })).toBeVisible();
  await page.goto("/photographers/42");
  await expect(page.getByTestId("profile-load-error")).toContainText("You can still browse this page");
  await expect(page.getByRole("heading", { name: "Fixture Photographer", exact: true })).toBeVisible();

  await page.goto("/my-photos");
  await expect(page.getByTestId("profile-load-error")).toBeVisible();
  await page.getByRole("button", { name: /language/i }).click();
  await page.getByRole("menuitem", { name: "Nederlands" }).click();
  await expect(page.getByTestId("profile-load-error")).toContainText("Fotografenprofiel niet beschikbaar");
  await expect(page.getByTestId("profile-load-error").getByRole("button", { name: "Opnieuw proberen" })).toBeVisible();
});