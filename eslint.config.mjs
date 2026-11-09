// eslint.config.mjs — Flat ESLint config (ESLint 9+)
// Big Tech standard: lint catches runtime anti-patterns that TypeScript's
// type-checker alone cannot detect (unused vars, no-constant-condition,
// no-async-promise-executor, import patterns, Node.js-specific rules).
//
// TypeScript safety is handled by `tsc --project tsconfig.typecheck.json`
// (strict mode, noEmit). ESLint focuses on code patterns and JS/MJS files
// that the TS compiler doesn't lint (scripts/, bin/, api/, test/) — the
// `src/**/*.ts` tree is deliberately NOT parsed here (espree cannot parse TS).
//
// Law V: zero external runtime dependencies. ESLint is a devDependency only,
// and the Node globals below are declared inline to avoid pulling `globals`.

// @ts-check
import js from "@eslint/js";
import nodePlugin from "eslint-plugin-n";

// Node.js runtime + Web platform globals exposed by Node 22+.
const nodeGlobals = {
  // Core runtime
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  global: "readonly",
  globalThis: "readonly",
  // Timers & scheduling
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  setImmediate: "readonly",
  clearImmediate: "readonly",
  queueMicrotask: "readonly",
  structuredClone: "readonly",
  // Web platform APIs available in Node 22+
  fetch: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  performance: "readonly",
  crypto: "readonly",
  WebAssembly: "readonly",
};

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
      "js/wasm_exec.js", // Vendored Go wasm runtime shim
      // Templates are self-contained sub-projects with their own tooling
      "templates/**",
    ],
  },

  // ── Base rules for every linted JS / MJS file ───────────────────────────────
  js.configs.recommended,

  // ── Node.js globals for CLI, scripts, api and test suites ──────────────────
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: nodeGlobals,
    },
  },

  // ── Service Worker (browser) context — its own global surface ──────────────
  {
    files: ["sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        clients: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
        console: "readonly",
      },
    },
  },

  // ── Node.js-specific rules for scripts, bin, api ──────────────────────────
  {
    files: ["scripts/**/*.mjs", "bin/**/*.mjs", "api/**/*.js"],
    plugins: { n: nodePlugin },
    rules: {
      "n/no-process-exit": "off", // scripts legitimately exit with a code
      "n/prefer-node-protocol": "error", // enforce `node:fs` over `fs`
      "n/no-unsupported-features/node-builtins": ["error", { version: ">=22.0.0", allowExperimental: true }],
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
