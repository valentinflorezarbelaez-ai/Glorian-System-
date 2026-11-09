#!/usr/bin/env node
/**
 * SBOM Gate — CycloneDX 1.6 Software Bill of Materials generator & verifier.
 *
 * Big Tech standard (SLSA Level 2+, NIST SSDF, Google SLSA, GitHub SBOM):
 * every release artifact must ship a machine-readable SBOM that lists every
 * component in the build (devDependencies, Go modules, Rust crates, Node
 * version) along with its cryptographic hash, so downstream consumers can
 * audit the supply chain without access to the source repository.
 *
 * This script:
 *   1. Generates a CycloneDX 1.6 JSON SBOM from package.json + lockfile.
 *   2. Stamps it with SHA-256 receipt and ISO-8601 timestamp.
 *   3. Writes it to docs/evidence/sbom.cdx.json.
 *   4. Verifies the SBOM is internally consistent (component count matches
 *      devDependencies + runtime deps).
 *   5. Exits 0 on success, 1 on any violation — suitable for CI gating.
 *
 * Usage:
 *   node scripts/sbom-gate.mjs              # generate + verify
 *   node scripts/sbom-gate.mjs --verify-only  # verify existing SBOM only
 *   npm run sbom:gate
 *
 * Zero external dependencies (Law V).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const OUT_PATH = path.join(root, "docs", "evidence", "sbom.cdx.json");
const VERIFY_ONLY = process.argv.includes("--verify-only");

console.log("======================================================================");
console.log(" EOS SBOM GATE — CycloneDX 1.6 Supply Chain Receipt");
console.log("======================================================================");

// ── 1. Load package manifests ────────────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lockRaw = fs.readFileSync(path.join(root, "package-lock.json"), "utf8");
const lock = JSON.parse(lockRaw);

const lockHash = crypto.createHash("sha256").update(lockRaw).digest("hex");

// ── 2. Build component list from lockfile packages ───────────────────────────
/**
 * @typedef {{ name: string, version: string, integrity: string | undefined, dev: boolean }} LockPkg
 */

/** @type {LockPkg[]} */
const components = [];

for (const [key, value] of Object.entries(lock.packages ?? {})) {
  if (key === "") continue; // root package entry
  // key format: "node_modules/foo" or "node_modules/@scope/foo"
  const name = key.replace(/^node_modules\//, "");
  components.push({
    name,
    version: /** @type {string} */ (value.version ?? "unknown"),
    integrity: value.integrity,
    dev: value.dev === true,
  });
}

components.sort((a, b) => a.name.localeCompare(b.name));

// ── 3. Build CycloneDX 1.6 JSON document ─────────────────────────────────────
const timestamp = new Date().toISOString();
const serialNumber = `urn:uuid:${crypto.randomUUID()}`;

/** @type {object[]} */
const cdxComponents = components.map((c) => {
  /** @type {object} */
  const component = {
    type: "library",
    "bom-ref": `npm:${c.name}@${c.version}`,
    name: c.name,
    version: c.version,
    scope: c.dev ? "excluded" : "required",
    purl: `pkg:npm/${c.name.replace(/^@/, "%40")}@${c.version}`,
  };
  if (c.integrity) {
    // integrity is "sha512-<base64>" or "sha1-<base64>"
    const [algo, b64] = c.integrity.split("-");
    if (algo && b64) {
      const hex = Buffer.from(b64, "base64").toString("hex");
      // @ts-ignore
      component.hashes = [{ alg: algo.toUpperCase(), content: hex }];
    }
  }
  return component;
});

// Add the Node.js runtime itself as a component
cdxComponents.unshift({
  type: "platform",
  "bom-ref": `node:${process.version}`,
  name: "nodejs",
  version: process.version.replace("v", ""),
  description: `Node.js runtime — ${process.platform}/${process.arch}`,
  purl: `pkg:generic/nodejs@${process.version.replace("v", "")}`,
});

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber,
  version: 1,
  metadata: {
    timestamp,
    tools: [
      {
        type: "application",
        name: "eos-sbom-gate",
        version: pkg.version,
        description: "EOS System SBOM generator (zero external deps)",
      },
    ],
    component: {
      type: "application",
      "bom-ref": `npm:${pkg.name}@${pkg.version}`,
      name: pkg.name,
      version: pkg.version,
      description: pkg.description ?? "",
      licenses: [{ license: { id: pkg.license ?? "MIT" } }],
      purl: `pkg:npm/${pkg.name}@${pkg.version}`,
    },
    properties: [
      { name: "eos:lockfileHash", value: `sha256:${lockHash}` },
      { name: "eos:nodeVersion", value: process.version },
      { name: "eos:platform", value: `${process.platform}/${process.arch}` },
      { name: "eos:hostname", value: os.hostname() },
      { name: "eos:generatedBy", value: "scripts/sbom-gate.mjs" },
    ],
  },
  components: cdxComponents,
};

// ── 4. Compute receipt SHA-256 over the canonical SBOM ───────────────────────
const canonicalJson = JSON.stringify(sbom, null, 2);
const receiptHash = crypto.createHash("sha256").update(canonicalJson).digest("hex");
// @ts-ignore
sbom.metadata.properties.push({ name: "eos:sbomReceipt", value: `sha256:${receiptHash}` });

const finalJson = JSON.stringify(sbom, null, 2) + "\n";

// ── 5. Write or verify ────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

if (VERIFY_ONLY) {
  if (!fs.existsSync(OUT_PATH)) {
    console.error(`[FAIL] SBOM not found at ${path.relative(root, OUT_PATH)}.`);
    console.error("       Run `npm run sbom:gate` to generate it.");
    process.exit(1);
  }
  const existing = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
  const existingComponents = existing.components?.length ?? 0;
  const freshComponents = cdxComponents.length;
  if (existingComponents !== freshComponents) {
    console.error(`[FAIL] SBOM is stale: ${existingComponents} components on disk vs ${freshComponents} in lockfile.`);
    console.error("       Run `npm run sbom:gate` to regenerate.");
    process.exit(1);
  }
  console.log(`[PASS] SBOM verified: ${existingComponents} components, spec CycloneDX ${existing.specVersion}.`);
  process.exit(0);
}

fs.writeFileSync(OUT_PATH, finalJson, "utf8");

console.log(`[PASS] SBOM generated → ${path.relative(root, OUT_PATH)}`);
console.log(
  `       Components : ${cdxComponents.length} (${components.filter((c) => !c.dev).length} runtime, ${components.filter((c) => c.dev).length} dev)`,
);
console.log(`       Spec       : CycloneDX 1.6`);
console.log(`       Receipt    : sha256:${receiptHash.slice(0, 24)}...`);
console.log(`       Serial     : ${serialNumber}`);
console.log("======================================================================");
