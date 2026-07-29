import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // Notifications must have exactly one state owner. Only the provider
      // (and tests) may touch the low-level hook directly; every component
      // reads through useNotificationsContext().
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/hooks/useNotifications",
                "**/hooks/useNotifications",
              ],
              message:
                "Import useNotificationsContext from '@/contexts/NotificationsContext' instead. useNotifications() may only be called by NotificationsProvider.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/contexts/NotificationsContext.tsx",
      "**/*.test.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  }
);
