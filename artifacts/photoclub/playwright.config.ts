import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";

/**
 * Playwright configuration for PhotographersHub Dutch i18n smoke tests.
 *
 * On NixOS (Replit) the Playwright-bundled Chromium can't find system libs.
 * We resolve this by pointing Playwright at the Nix-managed playwright-driver
 * browsers, which are properly wrapped with all library dependencies.
 */
const testPort = process.env.TEST_PORT ?? "5183";

/** Resolve the Nix playwright-driver browsers path at config load time. */
function getNixBrowsersPath(): string {
  try {
    const out = execSync(
      "nix-build --no-out-link '<nixpkgs>' -A playwright-driver.browsers 2>/dev/null",
      { encoding: "utf-8" }
    ).trim();
    return out;
  } catch {
    return "";
  }
}

const nixBrowsersPath = getNixBrowsersPath();

/** Path to the Nix-wrapped chromium headless shell, or undefined (fallback to npm-bundled). */
function nixChromiumExecutable(): string | undefined {
  if (!nixBrowsersPath) return undefined;
  // playwright-driver.browsers ships the headless shell as `headless_shell`
  return `${nixBrowsersPath}/chromium_headless_shell-1169/chrome-linux/headless_shell`;
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${testPort}`,
    screenshot: "only-on-failure",
    headless: true,
  },
  webServer: {
    command: `PORT=${testPort} BASE_PATH=/ pnpm --filter @workspace/photoclub run dev`,
    port: Number(testPort),
    timeout: 60_000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: nixChromiumExecutable(),
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
  ],
});
