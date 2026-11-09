/**
 * EOS DIFF PATCHER (Layer 0)
 * SPEC-053: Diff-based patch application — 10x more efficient than full file rewrites.
 *
 * Instead of writing complete file content (which wastes tokens and risks
 * overwriting unrelated changes), this module applies unified diffs:
 *
 *   --- a/src/core/eosTurboEngine.ts
 *   +++ b/src/core/eosTurboEngine.ts
 *   @@ -10,7 +10,7 @@
 *    function checkFile() {
 *   -  if (cached) return cached;
 *   +  if (cached && cached.isValid) return cached;
 *      return null;
 *    }
 *
 * Cursor and Devin use this approach — only the changed lines are sent.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ============================================================================
// 1. DATA CONTRACTS
// ============================================================================

export interface DiffHunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly lines: readonly DiffLine[];
}

export interface DiffLine {
  readonly type: "context" | "add" | "remove";
  readonly content: string;
}

export interface ParsedDiff {
  readonly oldPath: string;
  readonly newPath: string;
  readonly hunks: readonly DiffHunk[];
  readonly sha256: string;
}

export interface PatchResult {
  readonly success: boolean;
  readonly targetPath: string;
  readonly linesAdded: number;
  readonly linesRemoved: number;
  readonly linesContext: number;
  readonly durationMs: number;
  readonly error?: string;
  readonly backupPath?: string;
}

// ============================================================================
// 2. DIFF PARSER — Parses unified diff format
// ============================================================================

/**
 * Parses a unified diff string into a structured ParsedDiff.
 */
export function parseDiff(diffText: string): ParsedDiff {
  const lines = diffText.split("\n");
  let oldPath = "";
  let newPath = "";
  const hunks: DiffHunk[] = [];
  let i = 0;

  // Find file headers
  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.startsWith("--- ")) {
      oldPath = line.slice(4).replace(/^a\//, "").trim();
      i++;
      continue;
    }
    if (line.startsWith("+++ ")) {
      newPath = line.slice(4).replace(/^b\//, "").trim();
      i++;
      continue;
    }
    if (line.startsWith("@@ ")) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (!match) {
        i++;
        continue;
      }

      const oldStart = parseInt(match[1] ?? "0", 10);
      const oldCount = match[2] ? parseInt(match[2], 10) : 1;
      const newStart = parseInt(match[3] ?? "0", 10);
      const newCount = match[4] ? parseInt(match[4], 10) : 1;

      i++;
      const hunkLines: DiffLine[] = [];

      // Read hunk body until next @@ or end of diff
      while (
        i < lines.length &&
        !lines[i]?.startsWith("@@ ") &&
        !lines[i]?.startsWith("--- ") &&
        !lines[i]?.startsWith("diff ")
      ) {
        const bodyLine = lines[i] ?? "";
        if (bodyLine.startsWith("+")) {
          hunkLines.push({ type: "add", content: bodyLine.slice(1) });
        } else if (bodyLine.startsWith("-")) {
          hunkLines.push({ type: "remove", content: bodyLine.slice(1) });
        } else if (bodyLine.startsWith(" ") || bodyLine === "") {
          hunkLines.push({ type: "context", content: bodyLine.startsWith(" ") ? bodyLine.slice(1) : bodyLine });
        } else if (bodyLine.startsWith("\\")) {
          // \ No newline at end of file — skip
        }
        i++;
      }

      hunks.push({ oldStart, oldCount, newStart, newCount, lines: Object.freeze(hunkLines) });
      continue;
    }
    i++;
  }

  const sha256 = crypto.createHash("sha256").update(diffText).digest("hex");

  return { oldPath, newPath, hunks: Object.freeze(hunks), sha256 };
}

// ============================================================================
// 3. PATCH APPLIER — Applies a parsed diff to a file on disk
// ============================================================================

/**
 * Applies a unified diff to a file on disk.
 * Creates a backup before applying. On any error, restores the backup.
 * Targets outside projectRoot are rejected before any read, backup, or write.
 *
 * @param diff     The parsed diff to apply
 * @param projectRoot  Root directory for resolving relative paths
 * @returns PatchResult with success/failure info
 */
export function applyDiff(diff: ParsedDiff, projectRoot: string): PatchResult {
  const t0 = Date.now();
  const targetPath = path.resolve(projectRoot, diff.newPath || diff.oldPath);

  const relTarget = path.relative(path.resolve(projectRoot), targetPath);
  if (relTarget === "" || relTarget === ".." || relTarget.startsWith(".." + path.sep) || path.isAbsolute(relTarget)) {
    return {
      success: false,
      targetPath: diff.newPath || diff.oldPath,
      linesAdded: 0,
      linesRemoved: 0,
      linesContext: 0,
      durationMs: Date.now() - t0,
      error: `Patch target escapes project root: ${diff.newPath || diff.oldPath}`,
    };
  }

  if (!fs.existsSync(targetPath)) {
    return {
      success: false,
      targetPath: diff.newPath || diff.oldPath,
      linesAdded: 0,
      linesRemoved: 0,
      linesContext: 0,
      durationMs: Date.now() - t0,
      error: `Target file does not exist: ${diff.newPath || diff.oldPath}`,
    };
  }

  // Read original content
  const original = fs.readFileSync(targetPath, "utf8");
  const originalLines = original.split("\n");

  // Create backup
  const backupPath = `${targetPath}.eos-backup-${Date.now()}`;
  fs.writeFileSync(backupPath, original, "utf8");

  let linesAdded = 0;
  let linesRemoved = 0;
  let linesContext = 0;

  try {
    // Apply each hunk — process from bottom to top to not shift line numbers
    const sortedHunks = [...diff.hunks].sort((a, b) => b.oldStart - a.oldStart);
    const resultLines = [...originalLines];

    for (const hunk of sortedHunks) {
      let lineIdx = hunk.oldStart - 1; // 0-indexed

      for (const dl of hunk.lines) {
        if (dl.type === "context") {
          linesContext++;
          lineIdx++;
        } else if (dl.type === "add") {
          linesAdded++;
          resultLines.splice(lineIdx, 0, dl.content);
          lineIdx++;
        } else if (dl.type === "remove") {
          linesRemoved++;
          // Verify the line we're removing matches; a stale or malformed patch must not apply
          const actual = resultLines[lineIdx];
          if (actual === undefined || actual.trim() !== dl.content.trim()) {
            throw new Error(`Patch mismatch at line ${lineIdx + 1}: removal line does not match target file`);
          }
          resultLines.splice(lineIdx, 1);
        }
      }
    }

    // Write the patched content
    fs.writeFileSync(targetPath, resultLines.join("\n"), "utf8");

    // Clean up backup on success
    fs.unlinkSync(backupPath);

    return {
      success: true,
      targetPath: diff.newPath || diff.oldPath,
      linesAdded,
      linesRemoved,
      linesContext,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    // Restore from backup on failure
    if (fs.existsSync(backupPath)) {
      fs.writeFileSync(targetPath, fs.readFileSync(backupPath, "utf8"), "utf8");
      fs.unlinkSync(backupPath);
    }

    return {
      success: false,
      targetPath: diff.newPath || diff.oldPath,
      linesAdded,
      linesRemoved,
      linesContext,
      durationMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// 4. DIFF GENERATOR — Creates a diff from old and new content
// ============================================================================

/**
 * Generates a simple unified diff between two strings.
 * Uses a line-by-line comparison (not a full LCS algorithm — keeps it simple and zero-dep).
 */
export function generateDiff(oldContent: string, newContent: string, filePath: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const lines: string[] = [];
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  // Find the first differing line
  let startLine = 0;
  for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
    if (oldLines[i] !== newLines[i]) {
      startLine = i;
      break;
    }
    startLine = i;
  }

  // Find the last differing line
  let endOld = oldLines.length - 1;
  let endNew = newLines.length - 1;
  while (endOld > startLine && endNew > startLine && oldLines[endOld] === newLines[endNew]) {
    endOld--;
    endNew--;
  }

  const hasLeadingContext = startLine > 0;
  const hasTrailingContext = endOld + 1 < oldLines.length;

  const headerOldStart = hasLeadingContext ? startLine : startLine + 1;
  const headerNewStart = hasLeadingContext ? startLine : startLine + 1;
  const oldCount = endOld - startLine + 1 + (hasLeadingContext ? 1 : 0) + (hasTrailingContext ? 1 : 0);
  const newCount = endNew - startLine + 1 + (hasLeadingContext ? 1 : 0) + (hasTrailingContext ? 1 : 0);

  lines.push(`@@ -${headerOldStart},${oldCount} +${headerNewStart},${newCount} @@`);

  // Add context line before changes (if exists)
  if (startLine > 0) {
    lines.push(` ${oldLines[startLine - 1]}`);
  }

  // Add removed lines
  for (let i = startLine; i <= endOld; i++) {
    lines.push(`-${oldLines[i] ?? ""}`);
  }

  // Add added lines
  for (let i = startLine; i <= endNew; i++) {
    lines.push(`+${newLines[i] ?? ""}`);
  }

  // Add context line after changes (if exists)
  if (endOld + 1 < oldLines.length) {
    lines.push(` ${oldLines[endOld + 1]}`);
  }

  return lines.join("\n");
}
