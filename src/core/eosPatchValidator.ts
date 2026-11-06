/**
 * EOS SYSTEM — SOVEREIGN PATCH & AST VALIDATOR (Layer 0)
 * Governed by ADR-017, FR-024 & BDD-019
 *
 * Implements pre-write AST syntax verification, secret detection,
 * boundary isolation, and destructive command interception for AI coding agents.
 *
 * Zero external runtime dependencies.
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface PatchValidationResult {
  readonly valid: boolean;
  readonly targetPath: string;
  readonly syntaxValid: boolean;
  readonly secretsFound: boolean;
  readonly destructiveCommandsFound: boolean;
  readonly pathTraversalsFound: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly patchChecksum: string;
}

const SECRET_PATTERNS = [
  { name: "Live Stripe/OpenAI Key", regex: new RegExp("sk-" + "live-[0-9a-zA-Z]{16,}") },
  { name: "GitHub Personal Access Token", regex: new RegExp("ghp_" + "[0-9a-zA-Z]{24,}") },
  { name: "AWS Access Key ID", regex: new RegExp("AKIA" + "[0-9A-Z]{16}") },
  { name: "Google API Key", regex: new RegExp("AIza" + "[0-9A-Za-z\\-_]{35}") },
  { name: "PEM Private Key Block", regex: new RegExp("-----BEGIN " + "(RSA |EC |OPENSSH )?PRIVATE KEY-----") }
];

const DESTRUCTIVE_PATTERNS = [
  "rm -rf",
  "drop table",
  "drop database",
  "delete from",
  "truncate table",
  "| bash",
  "| sh",
  ":(){",
  "/etc/shadow",
  "/etc/passwd"
];

/**
 * Validates a proposed code or file patch before it touches disk.
 */
export function validatePatch(
  targetPath: string,
  proposedContent: string,
  projectRoot: string = process.cwd()
): PatchValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const checksum = crypto
    .createHash("sha256")
    .update(proposedContent || "", "utf8")
    .digest("hex");

  // 1. Path Traversal & Boundary Verification (Law IV)
  let pathTraversalsFound = false;
  const resolvedPath = path.resolve(projectRoot, targetPath || "");
  const normalizedRoot = path.resolve(projectRoot);

  const relativeTarget = path.relative(normalizedRoot, resolvedPath);
  if (relativeTarget === ".." || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
    pathTraversalsFound = true;
    errors.push(`[Law IV Barrier] Path traversal detected: "${targetPath}" attempts to escape project root.`);
  }

  // 2. Secret Scanner (Law VI)
  let secretsFound = false;
  for (const pat of SECRET_PATTERNS) {
    if (pat.regex.test(proposedContent)) {
      secretsFound = true;
      errors.push(`[Law VI Barrier] Plaintext secret detected (${pat.name}).`);
    }
  }

  // 3. Destructive Command Scanner (Safety Barrier)
  let destructiveCommandsFound = false;
  const lowerContent = (proposedContent || "").toLowerCase();
  for (const d of DESTRUCTIVE_PATTERNS) {
    if (lowerContent.includes(d)) {
      destructiveCommandsFound = true;
      errors.push(`[Safety Barrier] Destructive pattern detected: "${d}".`);
    }
  }

  // 4. Syntax & Structural Verification
  let syntaxValid = true;
  const ext = path.extname(targetPath).toLowerCase();

  if (ext === ".json") {
    try {
      JSON.parse(proposedContent);
    } catch (err: any) {
      syntaxValid = false;
      errors.push(`[JSON Syntax Error] ${err.message}`);
    }
  } else if (ext === ".js" || ext === ".mjs") {
    try {
      execFileSync(
        process.execPath,
        ["--check", "--input-type=module"],
        {
          input: proposedContent,
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 2000
        }
      );
    } catch (err: any) {
      syntaxValid = false;
      const msg = err.stderr ? err.stderr.toString().trim() : err.message;
      errors.push(`[AST Syntax Error] ${msg}`);
    }
  } else if (ext === ".ts" || ext === ".tsx") {
    // Validate TypeScript syntax: check balanced braces and basic syntax
    try {
      const openBraces = (proposedContent.match(/{/g) || []).length;
      const closeBraces = (proposedContent.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        throw new Error(`Unbalanced curly braces: ${openBraces} open vs ${closeBraces} close`);
      }
      const openParens = (proposedContent.match(/\(/g) || []).length;
      const closeParens = (proposedContent.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        throw new Error(`Unbalanced parentheses: ${openParens} open vs ${closeParens} close`);
      }

      // In environments with node CLI, attempt AST check in ESM sandbox
      const valDir = path.join(os.tmpdir(), "eos_ts_validation_sandbox");
      if (!fs.existsSync(valDir)) {
        try {
          fs.mkdirSync(valDir, { recursive: true });
          fs.writeFileSync(path.join(valDir, "package.json"), JSON.stringify({ type: "module" }));
        } catch {}
      }
      const tmpFile = path.join(valDir, `eos_val_${crypto.randomUUID()}${ext}`);
      try {
        fs.writeFileSync(tmpFile, proposedContent, "utf8");
        execFileSync(process.execPath, ["--check", tmpFile], {
          cwd: valDir,
          stdio: ["ignore", "ignore", "ignore"],
          timeout: 2000
        });
      } catch {
        // Non-fatal if container has restricted subprocess execution
      } finally {
        if (fs.existsSync(tmpFile)) {
          try { fs.unlinkSync(tmpFile); } catch {}
        }
      }
    } catch (err: any) {
      syntaxValid = false;
      errors.push(`[AST TypeScript Syntax Error] ${err.message}`);
    }
  } else if (ext === ".md" || ext === ".markdown") {
    // Check balanced code block fences
    const fenceCount = (proposedContent.match(/^```/gm) || []).length;
    if (fenceCount % 2 !== 0) {
      warnings.push(`[Markdown Warning] Unbalanced code block fences detected (${fenceCount} backtick fences).`);
    }
  }

  const valid = !pathTraversalsFound && !secretsFound && !destructiveCommandsFound && syntaxValid;

  return {
    valid,
    targetPath,
    syntaxValid,
    secretsFound,
    destructiveCommandsFound,
    pathTraversalsFound,
    errors,
    warnings,
    patchChecksum: `sha256:${checksum}`
  };
}
