/**
 * EOS Centralized Evidence Directory Resolver
 *
 * SPEC-342 (Verification Honesty & Evidence Hermeticity):
 * Resolves the evidence output directory honoring EOS_EVIDENCE_DIR.
 * Under test suites, setting EOS_EVIDENCE_DIR to a temporary directory
 * guarantees hermetic test execution without mutating tracked files under docs/evidence/.
 *
 * Pure Layer-0 TypeScript (Law V: zero npm runtime dependencies).
 */

import * as path from "node:path";
import * as fs from "node:fs";

export function resolveEvidenceDir(rootDir: string = process.cwd()): string {
  const custom = process.env.EOS_EVIDENCE_DIR;
  if (custom && custom.trim().length > 0) {
    const resolved = path.resolve(custom.trim());
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    return resolved;
  }
  return path.join(rootDir, "docs", "evidence");
}

export function resolveEvidencePath(fileName: string, rootDir: string = process.cwd()): string {
  const dir = resolveEvidenceDir(rootDir);
  return path.join(dir, fileName);
}
