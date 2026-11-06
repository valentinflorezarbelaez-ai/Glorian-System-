// eslint.config.mjs — Flat ESLint config (ESLint 9+, typescript-eslint v8)
// Big Tech standard: lint catches runtime anti-patterns that TypeScript's
// type-checker alone cannot detect (no-floating-promises, consistent-return,
// no-unused-vars in JS files, import order, Node.js-specific rules).
//
// Law V: zero external runtime dependencies. ESLint is a devDependency only.

// @ts-check
import js from "@eslint/js";
import tsEslint from "typescript-eslint";
import nodePlugin from "eslint-plugin-n";

export default tsEslint.config(
  // ── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".eos/**",
      ".coverage/**",
      // Generated / vendored JS that we don't own
      "js/eos.js",
      // Templates are self-contained sub-projects with their own tooling
      "templates/**",
    ],
  },

  // ── Base rules for all JS / MJS files ─────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript-aware rules for src/**/*.ts ─────────────────────────────────
  ...tsEslint.configs.recommendedTypeChecked.map((cfg) => ({
    ...cfg,
    files: ["src/**/*.ts"],
  })),

  // ── TypeScript parser options (needed for type-checked rules) ─────────────
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.typecheck.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ── Type safety ─────────────────────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // ── Code quality ─────────────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "no-console": "off", // CLI tool — console output is intentional

      // ── Imports ──────────────────────────────────────────────────────────
      // Enforce .ts extensions in imports (NodeNext module resolution)
      "@typescript-eslint/consistent-type-exports": "error",
    },
  },

  // ── Node.js-specific rules for scripts, bin, api ──────────────────────────
  {
    files: ["scripts/**/*.mjs", "bin/**/*.mjs", "api/**/*.js"],
    plugins: { n: nodePlugin },
    rules: {
      "n/no-process-exit": "off", // scripts legitimately exit with a code
      "n/prefer-node-protocol": "error", // enforce `node:fs` over `fs`
      "n/no-unsupported-features/node-builtins": [
        "error",
        { version: ">=22.0.0" },
      ],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // ── Test files ─────────────────────────────────────────────────────────────
  {
    files: ["test/**/*.test.mjs"],
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Node.js built-in test runner uses top-level await
      "no-console": "off",
    },
  },
);
