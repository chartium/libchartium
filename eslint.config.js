import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import compat from "eslint-plugin-compat";
import eslintPluginSvelte from "eslint-plugin-svelte";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginSvelte.configs["flat/recommended"],
  compat.configs["flat/recommended"],
  {
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn", // or "error"
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "svelte/no-at-html-tags": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["src/**/*.svelte"],
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  {
    ignores: ["dist/*", ".svelte-kit/*"],
  },
);
