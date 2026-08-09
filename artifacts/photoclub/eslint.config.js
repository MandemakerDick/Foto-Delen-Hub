import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import requireTestIdOnTabsTrigger from "./eslint-rules/require-testid-on-tabs-trigger.js";


export default [
  {
    ignores: ["dist/**", "build/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // Catch unused variables AND unused destructured props in component signatures
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          // Underscore-prefixed names are intentionally unused
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Disable the base rule — the TS-aware version above replaces it
      "no-unused-vars": "off",
      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // ── Manage-page tab guard ─────────────────────────────────────────────────
  // Every <TabsTrigger> in manage.tsx must carry a data-testid prop so the
  // manage-i18n smoke test can count tabs without fragile positional queries.
  {
    files: ["src/pages/manage.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      local: { rules: { "require-testid-on-tabs-trigger": requireTestIdOnTabsTrigger } },
    },
    rules: {
      "local/require-testid-on-tabs-trigger": "error",
    },
  },
];
