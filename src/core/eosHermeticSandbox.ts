/**
 * EOS SYSTEM — HERMETIC COPY-ON-WRITE SANDBOX (Layer 0)
 * Governed by ADR-037, SPEC-030, FR-085, BDD-073
 *
 * Provides isolated virtual filesystem overlays for prospective AST mutations:
 * - 100% in-memory Copy-on-Write (CoW) overlay prevents premature physical disk writes
 * - Double-blind syntax verification via Node.js built-in vm.Script compilation
 * - Secret leak and prohibited pattern scanning before commit
 * - Optional transactional WAL logging integration upon commit
 * - Zero external npm dependencies (Layer-0 purity)
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import type { EosDurableWal } from "./eosDurableWal.ts";

export interface StagedEntry {
  relPath: string;
  content: string | null; // null represents staged deletion
  isDeletion: boolean;
  stagedAtNs: bigint;
}

export interface ValidationError {
  file: string;
  message: string;
  line?: number;
  column?: number;
}

export interface HermeticValidationReport {
  status: "SANDBOX_PASSED" | "SANDBOX_REJECTED";
  passed: boolean;
  checkedFiles: number;
  errors: ValidationError[];
  timestamp: string;
}

export interface HermeticCommitReport {
  status: "COMMITTED" | "ABORTED_ON_VALIDATION_FAILURE" | "NO_OP";
  filesWritten: string[];
  filesDeleted: string[];
  walTxId?: bigint;
  commitTimestamp: string;
}

export class EosHermeticSandbox {
  public readonly projectRoot: string;
  private readonly overlay: Map<string, StagedEntry> = new Map();
  private readonly prohibitedPatterns: RegExp[] = [
    /(?:api[_-]?key|secret|password|private[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/i,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    /sk-[a-zA-Z0-9]{20,}/,
    /ghp_[a-zA-Z0-9]{20,}/,
  ];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Normalizes a relative path within projectRoot.
   * SECURITY: rejects any path that attempts to escape via ../ sequences.
   */
  private normalizeRel(relPath: string): string {
    const clean = path.normalize(relPath).replace(/^[\\/]+/, "");
    // CRITICAL: block path traversal — any ../ after normalization is an escape attempt
    if (clean.startsWith("..") || clean.includes("/../") || clean.includes("\\..\\")) {
      throw new Error(
        `Security violation: path traversal attempt detected in staged path "${relPath}" → "${clean}". ` +
          `Staged paths must remain within projectRoot.`,
      );
    }
    return clean.replace(/\\/g, "/");
  }

  /**
   * Validates that a full absolute path stays within projectRoot.
   * Throws if the path would escape.
   */
  private _assertContained(fullPath: string, relPath: string): void {
    const normalizedRoot = this.projectRoot.replace(/\\/g, "/");
    const normalizedFull = fullPath.replace(/\\/g, "/");
    if (!normalizedFull.startsWith(normalizedRoot + "/") && normalizedFull !== normalizedRoot) {
      throw new Error(
        `Security violation: resolved path "${fullPath}" escapes projectRoot "${this.projectRoot}". ` +
          `Origin relPath: "${relPath}"`,
      );
    }
  }

  /**
   * Stages a file modification or creation into in-memory overlay.
   */
  public stageFile(relPath: string, content: string): void {
    const key = this.normalizeRel(relPath);
    this.overlay.set(key, {
      relPath: key,
      content,
      isDeletion: false,
      stagedAtNs: process.hrtime.bigint(),
    });
  }

  /**
   * Stages a file deletion into in-memory overlay.
   */
  public stageDelete(relPath: string): void {
    const key = this.normalizeRel(relPath);
    this.overlay.set(key, {
      relPath: key,
      content: null,
      isDeletion: true,
      stagedAtNs: process.hrtime.bigint(),
    });
  }

  /**
   * Discards all staged changes from the overlay.
   */
  public discard(): void {
    this.overlay.clear();
  }

  /**
   * Returns list of currently staged relative file paths.
   */
  public getStagedFiles(): string[] {
    return Array.from(this.overlay.keys());
  }

  /**
   * Retrieves file content: from overlay if staged, otherwise from disk if it exists.
   */
  public readFile(relPath: string): string | null {
    const key = this.normalizeRel(relPath);
    if (this.overlay.has(key)) {
      const entry = this.overlay.get(key)!;
      return entry.isDeletion ? null : entry.content;
    }
    const fullPath = path.join(this.projectRoot, key);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, "utf-8");
    }
    return null;
  }

  /**
   * Validates all staged files for syntax correctness, JSON validity,
   * bracket balance, and secret leakage.
   */
  public validateOverlay(options?: {
    allowSecrets?: boolean;
    customRules?: Array<(file: string, content: string) => string | null>;
  }): HermeticValidationReport {
    const errors: ValidationError[] = [];
    const entries = Array.from(this.overlay.values());

    for (const entry of entries) {
      if (entry.isDeletion || entry.content === null) {
        continue;
      }

      const file = entry.relPath;
      const content = entry.content;

      // 1. Prohibited pattern scanning (Secrets / Tokens)
      if (!options?.allowSecrets) {
        for (const pattern of this.prohibitedPatterns) {
          if (pattern.test(content)) {
            errors.push({
              file,
              message: `Security invariant violation: Detected forbidden sensitive token or secret matching ${pattern.source}`,
            });
          }
        }
      }

      // 2. Syntax validation by file extension
      const ext = path.extname(file).toLowerCase();
      if (ext === ".json") {
        try {
          JSON.parse(content);
        } catch (e: any) {
          errors.push({
            file,
            message: `JSON syntax error: ${e.message}`,
          });
        }
      } else if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
        try {
          // Double-blind compilation check without executing code
          new vm.Script(content, { filename: file });
        } catch (e: any) {
          errors.push({
            file,
            message: `JavaScript syntax error: ${e.message}`,
            line: e.lineNumber,
            column: e.column,
          });
        }
      } else if (ext === ".ts" || ext === ".mts" || ext === ".cts") {
        // TypeScript syntax sanity check: verify balanced delimiters and no broken tokens
        const balanceErr = this.checkBalancedDelimiters(content);
        if (balanceErr) {
          errors.push({
            file,
            message: `TypeScript structure error: ${balanceErr}`,
          });
        }
      }

      // 3. Custom rules
      if (options?.customRules) {
        for (const rule of options.customRules) {
          const ruleErr = rule(file, content);
          if (ruleErr) {
            errors.push({ file, message: ruleErr });
          }
        }
      }
    }

    const passed = errors.length === 0;
    return {
      status: passed ? "SANDBOX_PASSED" : "SANDBOX_REJECTED",
      passed,
      checkedFiles: entries.length,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Helper to verify balanced braces, brackets, and parentheses in TypeScript/code.
   */
  private checkBalancedDelimiters(code: string): string | null {
    const stack: { char: string; line: number }[] = [];
    let line = 1;
    let inString: string | null = null;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < code.length; i++) {
      const c = code[i];
      const next = code[i + 1];

      if (c === "\n") {
        line++;
        inLineComment = false;
        continue;
      }

      if (inLineComment) continue;

      if (inBlockComment) {
        if (c === "*" && next === "/") {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      if (inString) {
        if (c === "\\") {
          i++; // skip escaped char
        } else if (c === inString) {
          inString = null;
        }
        continue;
      }

      // Check comments
      if (c === "/" && next === "/") {
        inLineComment = true;
        i++;
        continue;
      }
      if (c === "/" && next === "*") {
        inBlockComment = true;
        i++;
        continue;
      }

      // Check strings / template literals
      if (c === "'" || c === '"' || c === "`") {
        inString = c;
        continue;
      }

      // Delimiters
      if (c === "{" || c === "(" || c === "[") {
        stack.push({ char: c, line });
      } else if (c === "}" || c === ")" || c === "]") {
        if (stack.length === 0) {
          return `Unmatched closing delimiter '${c}' at line ${line}`;
        }
        const top = stack.pop()!;
        if ((c === "}" && top.char !== "{") || (c === ")" && top.char !== "(") || (c === "]" && top.char !== "[")) {
          return `Mismatched delimiter: expected closing for '${top.char}' (from line ${top.line}), found '${c}' at line ${line}`;
        }
      }
    }

    if (stack.length > 0) {
      const unclosed = stack.pop()!;
      return `Unclosed delimiter '${unclosed.char}' opened at line ${unclosed.line}`;
    }

    return null;
  }

  /**
   * Commits staged modifications to physical disk only if validation passes.
   * If WAL is provided, writes an atomic transaction before physical disk mutation.
   */
  public commitToDisk(wal?: EosDurableWal): HermeticCommitReport {
    if (this.overlay.size === 0) {
      return {
        status: "NO_OP",
        filesWritten: [],
        filesDeleted: [],
        commitTimestamp: new Date().toISOString(),
      };
    }

    const validation = this.validateOverlay();
    if (!validation.passed) {
      return {
        status: "ABORTED_ON_VALIDATION_FAILURE",
        filesWritten: [],
        filesDeleted: [],
        commitTimestamp: new Date().toISOString(),
      };
    }

    const filesWritten: string[] = [];
    const filesDeleted: string[] = [];
    const entries = Array.from(this.overlay.values());

    let walTxId: bigint | undefined;

    // Optional physical WAL commit
    if (wal) {
      const walPayload = {
        type: "HERMETIC_SANDBOX_COMMIT",
        changes: entries.map((e) => ({
          relPath: e.relPath,
          isDeletion: e.isDeletion,
          byteLength: e.content ? Buffer.byteLength(e.content, "utf-8") : 0,
        })),
        timestamp: Date.now(),
      };
      walTxId = wal.append(walPayload).txId;
    }

    // Physical disk write
    for (const entry of entries) {
      const fullPath = path.join(this.projectRoot, entry.relPath);
      // CRITICAL: containment check — ensure we never write outside projectRoot
      this._assertContained(fullPath, entry.relPath);
      if (entry.isDeletion) {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          filesDeleted.push(entry.relPath);
        }
      } else if (entry.content !== null) {
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(fullPath, entry.content, "utf-8");
        filesWritten.push(entry.relPath);
      }
    }

    // Clear overlay after successful physical commit
    this.discard();

    return {
      status: "COMMITTED",
      filesWritten,
      filesDeleted,
      walTxId,
      commitTimestamp: new Date().toISOString(),
    };
  }
}
