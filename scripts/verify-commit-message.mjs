#!/usr/bin/env node
/**
 * Local Conventional Commits policy (commitlint-equivalent, zero dependencies).
 * Wired through .githooks/commit-msg so history stays machine-readable for
 * release notes, changelogs and provenance without a paid service.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COMMIT_TYPES = Object.freeze([
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert"
]);

const HEADER_PATTERN = /^([a-z]+)(?:\(([a-z0-9][a-z0-9-]*)\))?(!)?: (\S.*)$/;
const MAX_HEADER_LENGTH = 100;

// Git-generated headers that are not authored messages.
const EXEMPT_PATTERNS = [
  /^Merge (branch|remote-tracking|pull request)\b/,
  /^Revert "/,
  /^(fixup|squash|amend)! /
];

export function validateCommitMessage(rawMessage) {
  const lines = String(rawMessage ?? "")
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("#"));
  const header = lines.find((line) => line.trim().length > 0)?.trimEnd();

  if (!header) {
    return { ok: false, errors: ["commit message is empty"] };
  }
  if (EXEMPT_PATTERNS.some((pattern) => pattern.test(header))) {
    return { ok: true, errors: [] };
  }

  const errors = [];
  if (header.length > MAX_HEADER_LENGTH) {
    errors.push(`header is ${header.length} characters; limit is ${MAX_HEADER_LENGTH}`);
  }

  const match = HEADER_PATTERN.exec(header);
  if (!match) {
    errors.push(
      `header must follow "<type>(<scope>)!: <subject>" with a lowercase type; got ${JSON.stringify(header)}`
    );
    return { ok: false, errors };
  }

  const [, type, , , subject] = match;
  if (!COMMIT_TYPES.includes(type)) {
    errors.push(`unsupported type "${type}"; allowed: ${COMMIT_TYPES.join(", ")}`);
  }
  if (subject.trim().length === 0) {
    errors.push("subject must not be empty");
  }
  if (subject.endsWith(".")) {
    errors.push("subject must not end with a period");
  }

  return { ok: errors.length === 0, errors };
}

const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const [firstArg, secondArg] = process.argv.slice(2);

  if (!firstArg) {
    console.error("usage: verify-commit-message.mjs <commit-msg-file> | --message \"<message>\"");
    process.exit(2);
  }

  let rawMessage;
  try {
    rawMessage = firstArg === "--message" ? secondArg ?? "" : fs.readFileSync(firstArg, "utf8");
  } catch (error) {
    console.error(`[FAIL] Cannot read commit message: ${error.message}`);
    process.exit(2);
  }

  const result = validateCommitMessage(rawMessage);
  if (!result.ok) {
    console.error("[FAIL] Commit message does not follow Conventional Commits:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("[PASS] Commit message follows Conventional Commits.");
}
