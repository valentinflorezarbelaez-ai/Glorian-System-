import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export { resolveEvidenceDir, resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

if (!process.env.EOS_EVIDENCE_DIR?.trim()) {
  const ownedDirectory = mkdtempSync(join(tmpdir(), "glorian-test-evidence-"));
  process.env.EOS_EVIDENCE_DIR = ownedDirectory;
  process.once("exit", () => rmSync(ownedDirectory, { recursive: true, force: true }));
}
