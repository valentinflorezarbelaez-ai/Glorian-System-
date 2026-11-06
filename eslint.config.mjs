// eslint.config.mjs — Flat ESLint config (ESLint 9+)
// Big Tech standard: lint catches runtime anti-patterns that TypeScript's
// type-checker alone cannot detect (unused vars, no-constant-condition,
// no-async-promise-executor, import patterns, Node.js-specific rules).
//
// TypeScript safety is handled by `tsc --project tsconfig.typecheck.json`
// (strict mode, noEmit). ESLint focuses on code patterns and JS/MJS files
// that the TS compiler doesn't lint (scripts/, bin/, api/, test/).
//
// Law V: zero external runtime dependencies. ESLint is a devDependency only.

// @ts-check
import js from "@eslint/js";
import nodePlugin from "eslint-plugin-n";

export default [
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

  // ── Base rules for all JS / MJS / TS files ─────────────────────────────────
  js.configs.recommended,

  // ── TypeScript files: apply JS rules + custom overrides ─────────────────────
  {
    files: ["src/**/*.ts"],
    rules: {
      // TS compiler handles type safety; ESLint handles code patterns
      "no-undef": "off", // TS types are not global vars
      "no-unused-vars": "off", // TS compiler catches this with noUnusedLocals
      "no-console": "off", // CLI tool — console output is intentional
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-async-promise-executor": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],
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
      // Node.js built-in test runner uses top-level await and console
      "no-console": "off",
    },
  },
];
