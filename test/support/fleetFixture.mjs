import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FLEET_IDS = [
  "aberamentho",
  "atp-strength",
  "biblioteca-gnostica-1",
  "control-de-asistencia-abopack",
  "crud-slack",
  "donaciones",
  "kegel-ham-sah",
  "performance-talent-group",
  "portafolio",
  "eos-system"
];

/**
 * Builds a throwaway control plane whose registry points at repositories that
 * exist on disk, so fleet suites do not depend on the developer workstation.
 */
export function createFleetFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-fixture-"));
  const projects = [];

  for (const id of FLEET_IDS) {
    const localPath = id === "eos-system" ? undefined : path.join(root, "repos", id);
    if (localPath) {
      fs.mkdirSync(path.join(localPath, ".cursor"), { recursive: true });
      fs.mkdirSync(path.join(localPath, "openspec"), { recursive: true });
      fs.writeFileSync(path.join(localPath, ".cursor", "mcp.json"), "{}\n");
    }
    projects.push({
      id,
      name: id,
      localPath,
      productionUrl: `https://${id}.vercel.app`,
      status: "REGISTERED",
      intake: "INTAKE_COMPLETE",
      specification: "SPECIFICATION_APPROVED",
      audit: "AUDIT_COMPLETE",
      ownerApproval: "OWNER_APPROVAL",
      authorization: "LEVEL_3_PRODUCTION_AUTHORIZED"
    });
  }

  fs.mkdirSync(path.join(root, "docs", "projects"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs", "projects", "registry.json"),
    `${JSON.stringify({ projects }, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "eos-fleet-fixture", version: "0.0.0", private: true }, null, 2)}\n`
  );

  return {
    root,
    cleanup() {
      // SQLite handles can hold the fixture directory open on Windows; leaking a temp dir is harmless.
      try {
        fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch {
        // Best-effort cleanup only.
      }
    }
  };
}
