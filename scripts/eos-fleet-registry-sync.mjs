#!/usr/bin/env node
/**
 * SPEC-124: EOS Autonomous Dynamic Fleet Registry & Law IV Multi-Tenant Sentinel
 *
 * Auto-discovers local Git checkouts across the developer workspace, extracts
 * Git porcelain and deployment endpoints, verifies secret hygiene, and safely
 * synchronizes docs/projects/registry.json without violating Law IV write barriers.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const DEFAULT_WORKSPACE_ROOT = process.env.EOS_WORKSPACE_ROOT || "c:\\Users\\valen";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".gemini",
  ".cache",
  ".vscode",
  ".cursor",
  "AppData",
  "Desktop",
  "Downloads",
  "Documents",
  "Music",
  "Pictures",
  "Videos",
  "Saved Games",
  "Favorites",
  "Links",
  "Searches",
  "Contacts",
  "OneDrive",
]);

/**
 * Local clones that must never inflate the fleet registry as LEVEL_1 ghosts.
 * Control-plane SSOT remains `Eos-System` in docs/projects/registry.json;
 * `Glorian-System-` / `Glorian-System--1` are workspace aliases of the same remote.
 */
export function isExcludedFleetClone(dirName) {
  if (typeof dirName !== "string" || dirName.length === 0) return true;
  if (/^Eos-System-\d+$/i.test(dirName)) return true;
  if (/^Glorian-System-/i.test(dirName)) return true;
  if (/^Kegel/i.test(dirName)) return true;
  return false;
}

export function discoverGitRepositories(workspaceRoot = DEFAULT_WORKSPACE_ROOT) {
  if (!fs.existsSync(workspaceRoot)) return [];

  const discovered = [];
  const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".")) continue;
    if (isExcludedFleetClone(entry.name)) continue;

    const fullPath = path.join(workspaceRoot, entry.name);
    const gitDir = path.join(fullPath, ".git");

    if (fs.existsSync(gitDir)) {
      discovered.push({
        name: entry.name,
        fullPath,
      });
    }
  }

  return discovered;
}

export function extractGitMetadata(repoPath) {
  try {
    const remoteUrl = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    const currentBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    const headCommitSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    return { remoteUrl, currentBranch, headCommitSha };
  } catch {
    return { remoteUrl: "", currentBranch: "main", headCommitSha: "" };
  }
}

const CANONICAL_FLEET_PROFILES = [
  {
    match: (lower) => lower.includes("abopack") || lower.includes("avopak"),
    id: "control-de-asistencia-abopack",
    name: "Avo Pack S.A.S. — Central de Asistencia y Liquidación Laboral",
    productionUrl: "https://avo-pack.vercel.app",
    type: "industrial-operations-suite",
    cicdGateScript: "npm test",
  },
  {
    match: (lower) => lower.includes("atp-strength"),
    id: "atp-strength",
    name: "ATP Strength & Hypertrophy Platform",
    productionUrl: "https://atp-strength.vercel.app",
    type: "athletic-performance-monolith",
    cicdGateScript: "npm test",
  },
  {
    match: (lower) => lower.includes("aberamentho"),
    id: "aberamentho",
    name: "Aberamentho Pleroma Music",
    productionUrl: "https://aberamentosprelomamusic.vercel.app",
    type: "sacred-acoustic-app",
    cicdGateScript: "scripts/verify-landing.mjs",
  },
  {
    match: (lower) => lower.includes("portafolio"),
    id: "portafolio",
    name: "Portafolio Oficial — Valentín Flórez",
    productionUrl: "https://portafolio-valentin.vercel.app",
    type: "executive-showcase",
    cicdGateScript: "scripts/verify-landing.mjs",
  },
  {
    match: (lower) => lower.includes("crud-slack"),
    id: "crud-slack",
    name: "TaskFlow AI — Omnichannel Request-to-Task CRUD & Triage",
    productionUrl: "https://crud-slack.vercel.app",
    type: "ai-productivity-workspace",
    cicdGateScript: "scripts/verify-strict.mjs",
  },
  {
    match: (lower) => lower.includes("performance-talent"),
    id: "performance-talent-group",
    name: "PTG — Performance Talent Group",
    productionUrl: "https://ptg-performance-talent-group.vercel.app",
    type: "enterprise-operations",
    cicdGateScript: "scripts/smoke-test.ps1",
  },
  {
    match: (lower) => lower === "eos-system" || lower.startsWith("glorian-system"),
    id: "eos-system",
    name: "EOS System (Control Plane Core)",
    productionUrl: "https://eos-system-ten.vercel.app",
    type: "control-plane-monolith",
    cicdGateScript: "scripts/verify-cicd-pipeline.mjs",
  },
  {
    match: (lower) => lower.includes("biblioteca-gnostica"),
    id: "biblioteca-gnostica-1",
    name: "Biblioteca Gnóstica — Preservación Digital de Textos Sagrados",
    productionUrl: "https://biblioteca-gnostica.vercel.app",
    type: "cultural-archive-platform",
    cicdGateScript: "npm test",
  },
  {
    match: (lower) => lower.includes("donaciones"),
    id: "donaciones",
    name: "Portal de Donaciones — Sede AGEAC & Tercer Factor",
    productionUrl: "https://donaciones-drab.vercel.app",
    type: "philanthropic-portal",
    cicdGateScript: "npm test",
  },
];

function inferManifestDefaults(repoPath, dirName) {
  let name = dirName;
  let productionUrl = "";
  let cicdGateScript = "npm test";

  const pkgPath = path.join(repoPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.name) name = pkg.description ? `${pkg.name} — ${pkg.description}` : pkg.name;
      if (pkg.scripts?.["verify:strict"]) cicdGateScript = "scripts/verify-strict.mjs";
    } catch {
      // Ignore malformed package.json
    }
  }

  const vercelPath = path.join(repoPath, "vercel.json");
  if (fs.existsSync(vercelPath)) {
    try {
      const v = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
      if (v.alias) productionUrl = `https://${Array.isArray(v.alias) ? v.alias[0] : v.alias}`;
    } catch {
      // Ignore malformed vercel.json
    }
  }

  const indexPath = path.join(repoPath, "index.html");
  if (fs.existsSync(indexPath)) {
    try {
      const html = fs.readFileSync(indexPath, "utf8");
      const m = html.match(/https:\/\/([a-zA-Z0-9-]+\.vercel\.app)/);
      if (m && !productionUrl) productionUrl = `https://${m[1]}`;
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch?.[1]) name = titleMatch[1].trim();
    } catch {
      // Ignore unreadable index.html
    }
  }

  return { name, productionUrl, type: "general-application", cicdGateScript };
}

export function inferProjectMetadata(repoPath) {
  const dirName = path.basename(repoPath);
  const defaults = inferManifestDefaults(repoPath, dirName);
  const lower = dirName.toLowerCase();
  const profile = CANONICAL_FLEET_PROFILES.find((p) => p.match(lower));
  if (!profile) return defaults;
  return {
    name: profile.name,
    productionUrl: profile.productionUrl,
    type: profile.type,
    cicdGateScript: profile.cicdGateScript,
  };
}

export function computeRegistrySignature(registry) {
  function sortObj(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sortObj);
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      if (key !== "registrySha256" && key !== "updatedAt") {
        sorted[key] = sortObj(obj[key]);
      }
    }
    return sorted;
  }
  const normalized = JSON.stringify(sortObj(registry));
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function resolveCanonicalProjectId(disc) {
  if (disc.id) return disc.id;
  const dirLower = String(disc.dirName || "").toLowerCase();
  const profile = CANONICAL_FLEET_PROFILES.find((p) => p.match(dirLower));
  return profile ? profile.id : dirLower;
}

function defaultGovernancePosture(id) {
  const isAbopack = id === "control-de-asistencia-abopack";
  return {
    intake: isAbopack ? "INTAKE_COMPLETE" : "PENDING_INTAKE",
    specification: isAbopack ? "SPECIFICATION_APPROVED" : "PENDING_SPECIFICATION",
    audit: isAbopack ? "AUDIT_COMPLETE" : "PENDING_AUDIT",
    authorization: isAbopack ? "LEVEL_3_PRODUCTION_AUTHORIZED" : "LEVEL_1_READ_ONLY",
    ownerApproval: isAbopack ? "OWNER_APPROVAL" : undefined,
  };
}

function definedFields(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") result[k] = v;
  }
  return result;
}

function mergeDiscoveredProject(id, disc, prev = {}) {
  const defaults = defaultGovernancePosture(id);
  const envKey = `EOS_FLEET_${id.toUpperCase().replace(/-/g, "_")}_PATH`;
  const base = {
    id,
    name: disc.name,
    resolvedLocalDir: disc.dirName,
    localPathEnv: envKey,
    remoteUrl: "",
    productionUrl: disc.productionUrl || "",
    type: disc.type || "application",
    status: "REGISTERED",
    intake: defaults.intake,
    specification: defaults.specification,
    audit: defaults.audit,
    authorization: defaults.authorization,
    ...(defaults.ownerApproval ? { ownerApproval: defaults.ownerApproval } : {}),
    cicdGateScript: disc.cicdGateScript || "npm test",
    autoShipScript: "git push origin main",
  };
  return {
    ...base,
    ...definedFields(prev),
    id,
    resolvedLocalDir: disc.dirName,
    remoteUrl: disc.remoteUrl || prev.remoteUrl || "",
    currentBranch: disc.currentBranch || "main",
    headCommitSha: disc.headCommitSha || "",
  };
}

export function reconcileFleetRegistry(existingRegistry, discoveredList, options = {}) {
  const allowNewProjects = options.allowNewProjects === true;
  const existingProjects = new Map();
  for (const p of existingRegistry.projects || []) {
    if (!isExcludedFleetClone(p.resolvedLocalDir || p.id || "")) {
      existingProjects.set(p.id, p);
    }
  }

  const updatedProjects = [];
  for (const disc of discoveredList) {
    if (isExcludedFleetClone(disc.dirName || "")) continue;
    const id = resolveCanonicalProjectId(disc);
    const prev = existingProjects.get(id);
    if (!prev && !allowNewProjects) continue;
    if (prev?.resolvedLocalDir && disc.dirName !== prev.resolvedLocalDir) continue;

    updatedProjects.push(mergeDiscoveredProject(id, disc, prev));
    existingProjects.delete(id);
  }

  for (const [, remaining] of existingProjects) {
    updatedProjects.push(remaining);
  }

  updatedProjects.sort((a, b) => a.id.localeCompare(b.id));

  const newRegistry = {
    version: "11.0.0-autonomous-fleet-registry",
    updatedAt: new Date().toISOString(),
    masterOrchestrator: "EOS System control plane (SPEC-124)",
    complianceStandard: "EOS_CONSTITUTION_LAW_IV_EXTERNAL_WRITE_BARRIER",
    totalFleetProjects: updatedProjects.length,
    projects: updatedProjects,
  };

  newRegistry.registrySha256 = computeRegistrySignature(newRegistry);
  return newRegistry;
}

export async function runFleetRegistrySync(options = {}) {
  const workspaceRoot = options.workspaceRoot || DEFAULT_WORKSPACE_ROOT;
  const registryPath = path.resolve(options.registryPath || "docs/projects/registry.json");

  let existingRegistry = { version: "1.0.0", projects: [] };
  if (fs.existsSync(registryPath)) {
    try {
      existingRegistry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    } catch {
      // Malformed
    }
  }

  const rawRepos = discoverGitRepositories(workspaceRoot);
  const discovered = [];

  for (const r of rawRepos) {
    if (isExcludedFleetClone(r.name)) continue;

    const gitMeta = extractGitMetadata(r.fullPath);
    const projMeta = inferProjectMetadata(r.fullPath);

    discovered.push({
      dirName: r.name,
      fullPath: r.fullPath,
      ...gitMeta,
      ...projMeta,
    });
  }

  const reconciled = reconcileFleetRegistry(existingRegistry, discovered, {
    allowNewProjects: options.allowNewProjects === true,
  });

  // Optional Secret Audit
  const auditResults = [];
  if (options.audit) {
    const { scanDirectory } = await import("./eos-secret-scan.mjs");
    for (const proj of reconciled.projects) {
      const projPath = path.join(workspaceRoot, proj.resolvedLocalDir || proj.id);
      if (fs.existsSync(projPath)) {
        const scan = await scanDirectory(projPath);
        auditResults.push({
          id: proj.id,
          exitCode: scan.exitCode,
          findingsCount: scan.findingsCount || 0,
        });
      }
    }
  }

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify(reconciled, null, 2) + "\n", "utf8");
  }

  return {
    dryRun: Boolean(options.dryRun),
    registryPath,
    totalDiscovered: discovered.length,
    totalRegistered: reconciled.projects.length,
    registrySha256: reconciled.registrySha256,
    projects: reconciled.projects,
    auditResults,
  };
}

// CLI Runner
if (process.argv[1] && process.argv[1].endsWith("eos-fleet-registry-sync.mjs")) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const audit = args.includes("--audit");
  const isJson = args.includes("--json");

  runFleetRegistrySync({ dryRun, audit })
    .then((result) => {
      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("======================================================================");
        console.log(" 🌐 EOS SYSTEM — AUTONOMOUS FLEET REGISTRY SYNC (SPEC-124)            ");
        console.log("======================================================================");
        console.log(` Registry: ${result.registryPath} (${result.dryRun ? "DRY-RUN" : "SAVED"})`);
        console.log(` Total Projects: ${result.totalRegistered} | Seal: ${result.registrySha256.slice(0, 16)}...`);
        console.log("----------------------------------------------------------------------");
        for (const p of result.projects) {
          console.log(` - [${p.status}] ${p.id.padEnd(30)} -> ${p.resolvedLocalDir} (${p.authorization})`);
          if (p.productionUrl) console.log(`   ↳ URL: ${p.productionUrl}`);
        }
        if (result.auditResults && result.auditResults.length > 0) {
          console.log("----------------------------------------------------------------------");
          console.log(" SECRET HYGIENE AUDIT RESULTS:");
          for (const a of result.auditResults) {
            console.log(` - [${a.exitCode === 0 ? "PASS" : "FAIL"}] ${a.id.padEnd(30)}: ${a.findingsCount} findings`);
          }
        }
        console.log("======================================================================");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Sync failed:", err);
      process.exit(1);
    });
}
