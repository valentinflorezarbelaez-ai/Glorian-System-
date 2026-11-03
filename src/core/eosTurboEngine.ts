/**
 * EOS SYSTEM — LOCAL REPOSITORY CHECKS (Layer 0)
 * Governed by ADR-020, FR-028, FR-029 & BDD-022, BDD-023
 *
 * Implements selected credential-pattern scanning, architecture checks, dependency
 * inventory, and critical-file presence checks. Durations are local process timings.
 *
 * These checks do not certify production readiness, SAST coverage, an SBOM, or SLSA.
 *
 * Zero external runtime dependencies.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { clearArchitectureCache, scanArchitecture } from "./eosArchitectureGuard.ts";

export interface CacheEntry {
  readonly sha256: string;
  readonly mtimeNs?: bigint;
  readonly size?: number;
  readonly isClean: boolean;
  readonly findings: readonly string[];
}

interface InventoryHashCacheEntry {
  readonly mtimeNs: bigint;
  readonly size: number;
  readonly sha256: string;
}

export interface StageTelemetry {
  readonly stageId: string;
  readonly name: string;
  readonly durationUs: number;
  readonly durationMs: number;
  readonly status: "PASS" | "FAIL";
  readonly details: string;
}

export interface TurboPipelineResult {
  readonly success: boolean;
  readonly totalDurationUs: number;
  readonly totalDurationMs: number;
  readonly totalFilesChecked: number;
  readonly cacheHits: number;
  readonly freshScans: number;
  readonly stages: readonly StageTelemetry[];
  readonly violations: readonly string[];
  readonly epistemicState: "LOCAL_CHECKS_PASSED" | "FINDINGS_IDENTIFIED";
  readonly sourceInventoryDigest: string;
}

// In-memory cache keyed by path and validated against nanosecond stat + content hash.
const VERIFICATION_CACHE = new Map<string, CacheEntry>();
const INVENTORY_HASH_CACHE = new Map<string, InventoryHashCacheEntry>();

const SECRET_PATTERNS = [
  { name: "Live Stripe/OpenAI Key", regex: new RegExp("sk-" + "live-[0-9a-zA-Z]{16,}") },
  { name: "GitHub Personal Access Token", regex: new RegExp("ghp_" + "[0-9a-zA-Z]{24,}") },
  { name: "AWS Access Key ID", regex: new RegExp("AKIA" + "[0-9A-Z]{16}") },
  { name: "Google API Key", regex: new RegExp("AIza" + "[0-9A-Za-z\\-_]{35}") },
  { name: "PEM Private Key Block", regex: new RegExp("-----BEGIN " + "(RSA |EC |OPENSSH )?PRIVATE KEY-----") }
];

/**
 * Scans a single file for plaintext secrets using the content cache.
 */
export function checkFileSecretsCached(filePath: string): { isClean: boolean; findings: string[]; fromCache: boolean } {
  try {
    const stat = fs.statSync(filePath, { bigint: true });
    const cached = VERIFICATION_CACHE.get(filePath);
    if (cached && cached.mtimeNs === stat.mtimeNs && cached.size === Number(stat.size)) {
      return { isClean: cached.isClean, findings: [...cached.findings], fromCache: true };
    }

    const content = fs.readFileSync(filePath, "utf8");
    const sha256 = crypto.createHash("sha256").update(content, "utf8").digest("hex");

    if (cached && cached.sha256 === sha256) {
      VERIFICATION_CACHE.set(filePath, {
        ...cached,
        mtimeNs: stat.mtimeNs,
        size: Number(stat.size)
      });
      return { isClean: cached.isClean, findings: [...cached.findings], fromCache: true };
    }

    const findings: string[] = [];
    for (const pat of SECRET_PATTERNS) {
      if (pat.regex.test(content)) {
        findings.push(`Configured credential pattern detected in ${path.basename(filePath)} (${pat.name})`);
      }
    }

    const isClean = findings.length === 0;
    VERIFICATION_CACHE.set(filePath, {
      sha256,
      mtimeNs: stat.mtimeNs,
      size: Number(stat.size),
      isClean,
      findings
    });

    return { isClean, findings, fromCache: false };
  } catch {
    return { isClean: false, findings: [`Could not read ${path.basename(filePath)} for the configured pattern scan`], fromCache: false };
  }
}

/**
 * Collects all project source files recursively, ignoring node_modules, .git, .eos, and transient build dirs.
 */
export function collectSourceFiles(dir: string, projectRoot: string = dir): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const ignoredDirs = new Set(["node_modules", ".git", ".eos", ".worktrees", "dist", ".next", "_sandbox", ".turbo", "target"]);
  const binaryExtensions = new Set([
    ".exe",
    ".bin",
    ".dll",
    ".so",
    ".dylib",
    ".wasm",
    ".png",
    ".jpg",
    ".jpeg",
    ".ico",
    ".webp",
    ".pdf",
    ".sqlite",
    ".sqlite-wal",
    ".sqlite-shm"
  ]);

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        results.push(...collectSourceFiles(full, projectRoot));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!binaryExtensions.has(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * Runs four bounded local repository checks. Durations are observations from
 * this process and do not represent complete security or release verification.
 */
export function runTurboPipeline(projectRoot: string = process.cwd()): TurboPipelineResult {
  const startGlobal = process.hrtime.bigint();
  const stages: StageTelemetry[] = [];
  const allViolations: string[] = [];

  const files = collectSourceFiles(projectRoot, projectRoot);
  const textFiles = files.filter((f) => /\.(ts|tsx|js|mjs|json|html|css|md)$/.test(f));

  // --- Task A: Configured credential-pattern scan with content cache ---
  const startStage1 = process.hrtime.bigint();
  let cacheHits = 0;
  let freshScans = 0;
  const stage1Violations: string[] = [];

  for (const f of textFiles) {
    const rel = path.relative(projectRoot, f);
    // Skip test files containing synthetic mock keys
    if (rel.includes("test") || rel.includes("node_modules")) continue;

    const res = checkFileSecretsCached(f);
    if (res.fromCache) cacheHits++;
    else freshScans++;

    if (!res.isClean) {
      stage1Violations.push(...res.findings);
    }
  }

  const endStage1 = process.hrtime.bigint();
  const durStage1Us = Number((endStage1 - startStage1) / 1000n);
  stages.push({
    stageId: "STAGE_1_CREDENTIAL_PATTERNS",
    name: "Configured credential-pattern scan (content-hash cache)",
    durationUs: durStage1Us,
    durationMs: Number((durStage1Us / 1000).toFixed(3)),
    status: stage1Violations.length === 0 ? "PASS" : "FAIL",
    details: `${cacheHits + freshScans} files scanned (${cacheHits} content-hash cache hits, ${freshScans} pattern scans). Configured patterns only.`
  });
  allViolations.push(...stage1Violations);

  // --- Task B: Static architecture and cycle scan ---
  const startStage2 = process.hrtime.bigint();
  const archReport = scanArchitecture(path.join(projectRoot, "src"), projectRoot);
  const endStage2 = process.hrtime.bigint();
  const durStage2Us = Number((endStage2 - startStage2) / 1000n);

  stages.push({
    stageId: "STAGE_2_ARCH",
    name: "Static architecture and circular-import scan",
    durationUs: durStage2Us,
    durationMs: Number((durStage2Us / 1000).toFixed(3)),
    status: archReport.isClean ? "PASS" : "FAIL",
    details: `Scanned ${archReport.scannedFilesCount} files. Architecture score: ${archReport.architecturePurityScore}%. Cycles found: ${archReport.circularDependencies.length}. Static source analysis only.`
  });
  if (!archReport.isClean) {
    archReport.violations.forEach((v) => allViolations.push(`[${v.rule}] ${v.file}: ${v.details}`));
  }

  // --- Task C: runtime dependency check and source-file inventory digest ---
  const startStage3 = process.hrtime.bigint();
  let pkgClean = true;
  const pkgPath = path.join(projectRoot, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const runtimeDeps = Object.keys(pkg.dependencies || {});
    if (runtimeDeps.length > 0) {
      pkgClean = false;
      allViolations.push(`External runtime dependencies detected: ${runtimeDeps.join(", ")}`);
    }
  }

  // Hash sorted file paths, sizes, and content hashes. This is not a Merkle tree.
  const inventoryHasher = crypto.createHash("sha256");
  for (const f of files.sort()) {
    const rel = path.relative(projectRoot, f).replace(/\\/g, "/");
    if (rel.includes("node_modules") || rel.includes(".git") || rel.startsWith(".eos/")) continue;
    const stat = fs.statSync(f, { bigint: true });
    const size = Number(stat.size);
    const cachedInv = INVENTORY_HASH_CACHE.get(f);
    const cachedVer = VERIFICATION_CACHE.get(f);
    let fileSha256: string;
    if (cachedInv && cachedInv.mtimeNs === stat.mtimeNs && cachedInv.size === size) {
      fileSha256 = cachedInv.sha256;
    } else if (cachedVer && cachedVer.mtimeNs === stat.mtimeNs && cachedVer.size === size) {
      fileSha256 = cachedVer.sha256;
      INVENTORY_HASH_CACHE.set(f, { mtimeNs: stat.mtimeNs, size, sha256: fileSha256 });
    } else {
      const bytes = fs.readFileSync(f);
      fileSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      INVENTORY_HASH_CACHE.set(f, { mtimeNs: stat.mtimeNs, size: bytes.length, sha256: fileSha256 });
    }
    inventoryHasher.update(`${rel}:${size}:${fileSha256}\n`);
  }
  const sourceInventoryDigest = `sha256:${inventoryHasher.digest("hex")}`;
  const endStage3 = process.hrtime.bigint();
  const durStage3Us = Number((endStage3 - startStage3) / 1000n);

  stages.push({
    stageId: "STAGE_3_INVENTORY",
    name: "Runtime dependency check & source-file inventory digest",
    durationUs: durStage3Us,
    durationMs: Number((durStage3Us / 1000).toFixed(3)),
    status: pkgClean ? "PASS" : "FAIL",
    details: `Declared runtime dependencies checked. Digest: ${sourceInventoryDigest.slice(0, 24)}... (not an SBOM or Merkle root).`
  });

  // --- Task D: Critical Assets & Semantic Structure ---
  const startStage4 = process.hrtime.bigint();
  const criticalFiles = [
    "index.html",
    "css/eos.css",
    "js/eos.js",
    "sw.js",
    "manifest.webmanifest",
    "bin/eos.mjs",
    "src/mcp/eosMcpServer.ts"
  ];
  let assetsClean = true;
  for (const rel of criticalFiles) {
    if (!fs.existsSync(path.join(projectRoot, rel))) {
      assetsClean = false;
      allViolations.push(`Required repository file is missing: ${rel}`);
    }
  }
  const endStage4 = process.hrtime.bigint();
  const durStage4Us = Number((endStage4 - startStage4) / 1000n);

  stages.push({
    stageId: "STAGE_4_ASSETS",
    name: "Required file presence checks",
    durationUs: durStage4Us,
    durationMs: Number((durStage4Us / 1000).toFixed(3)),
    status: assetsClean ? "PASS" : "FAIL",
    details: `${criticalFiles.filter((rel) => fs.existsSync(path.join(projectRoot, rel))).length}/${criticalFiles.length} required paths exist; file contents and runtime behavior were not verified.`
  });

  const endGlobal = process.hrtime.bigint();
  const totalDurationUs = Number((endGlobal - startGlobal) / 1000n);
  const totalDurationMs = Number((totalDurationUs / 1000).toFixed(3));
  const success = allViolations.length === 0;

  return {
    success,
    totalDurationUs,
    totalDurationMs,
    totalFilesChecked: textFiles.length,
    cacheHits,
    freshScans,
    stages,
    violations: allViolations,
    epistemicState: success ? "LOCAL_CHECKS_PASSED" : "FINDINGS_IDENTIFIED",
    sourceInventoryDigest
  };
}

/**
 * Resets the in-memory verification cache.
 */
export function clearVerificationCache(): void {
  VERIFICATION_CACHE.clear();
  INVENTORY_HASH_CACHE.clear();
  clearArchitectureCache();
}
