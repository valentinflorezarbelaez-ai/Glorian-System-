#!/usr/bin/env node
/**
 * EOS SYSTEM — ENTERPRISE PACKAGING & OCI DISTROLESS AUDITOR
 * Governed by SPEC-085, CHANGE-063, ADR-087, FR-302..FR-305 (v71.0.0)
 *
 * Verifies:
 * 1. Root entry point src/index.ts exists and exports core systems.
 * 2. Zero runtime npm dependencies (dependencies: {}).
 * 3. package.json exports, types, and version 71.0.0.
 * 4. Dockerfile Google Distroless multi-stage non-root compliance.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("==================================================================");
console.log("  EOS SYSTEM — PACKAGING & OCI DISTROLESS AUDIT (SPEC-085)");
console.log("==================================================================");

let violations = 0;

function reportCheck(name, passed, detail) {
  if (passed) {
    console.log(`[PASS] ${name}: ${detail}`);
  } else {
    console.error(`[FAIL] ${name}: ${detail}`);
    violations++;
  }
}

// 1. Audit src/index.ts
const indexPath = path.join(projectRoot, "src", "index.ts");
const indexExists = fs.existsSync(indexPath);
if (indexExists) {
  const content = fs.readFileSync(indexPath, "utf8");
  const exportsCore = content.includes('export * from "./core/index.ts"');
  const exportsMcp = content.includes("EosMcpServer");
  reportCheck(
    "Unified Root Entry Point",
    exportsCore && exportsMcp,
    "src/index.ts exists and re-exports core engines & MCP server"
  );
} else {
  reportCheck("Unified Root Entry Point", false, "src/index.ts not found");
}

// 2. Audit package.json manifest
const pkgPath = path.join(projectRoot, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

reportCheck(
  "Package Version",
  pkg.version === "75.0.0",
  `Expected v75.0.0, found v${pkg.version}`
);

reportCheck(
  "ESM Module Format",
  pkg.type === "module",
  `Expected type: "module", found ${pkg.type}`
);

reportCheck(
  "Main & Types Entry Points",
  pkg.main === "./src/index.ts" && pkg.types === "./src/index.ts",
  `main: ${pkg.main}, types: ${pkg.types}`
);

const depsCount = Object.keys(pkg.dependencies || {}).length;
reportCheck(
  "Layer-0 Zero Runtime Dependencies",
  depsCount === 0,
  `Expected 0 external runtime dependencies, found ${depsCount}`
);

reportCheck(
  "Open Source License",
  pkg.license === "MIT",
  `License: ${pkg.license}`
);

// 3. Audit Dockerfile OCI Distroless
const dockerfilePath = path.join(projectRoot, "Dockerfile");
if (fs.existsSync(dockerfilePath)) {
  const dockerfile = fs.readFileSync(dockerfilePath, "utf8");
  const hasDistrolessStatic = dockerfile.includes("gcr.io/distroless/static-debian12:nonroot");
  const hasDistrolessNode = dockerfile.includes("gcr.io/distroless/nodejs24-debian12:nonroot");
  const hasNonRootUser = dockerfile.includes("USER nonroot:nonroot");

  reportCheck(
    "Distroless OCI Compliance",
    hasDistrolessStatic && hasDistrolessNode && hasNonRootUser,
    "Multi-stage build targets distroless static & nodejs24 under nonroot user"
  );
} else {
  reportCheck("Distroless OCI Compliance", false, "Dockerfile not found");
}

console.log("------------------------------------------------------------------");
if (violations === 0) {
  console.log("PACKAGING & OCI AUDIT RESULT: 100% CONFORMANT (0 violations)");
  process.exit(0);
} else {
  console.error(`PACKAGING & OCI AUDIT RESULT: FAILED (${violations} violations)`);
  process.exit(1);
}
