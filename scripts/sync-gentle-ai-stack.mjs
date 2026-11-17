#!/usr/bin/env node

/**
 * EOS SYSTEM — GENTLEMAN AI STACK HERMETIC SYNC DAEMON & EVIDENCE CUSTODIAN
 *
 * Governed by Law II, Law III, Law V & PELDAÑO 3:
 * Sincronización determinista para:
 * 1. Gentle-AI & Engram DAG (Grafo Epistémico Dirigido Acíclico con compactación por entropía)
 * 2. GGA (Git Governance Agent — hooks pre-commit activos)
 * 3. Espejos SpecBoot (.agents/skills/)
 * 4. Catálogo Canónico MCP (EOS_MCP_TOOL_DEFINITIONS — ~208 tools)
 *
 * Emite recibo sellado SHA-256 en docs/evidence/EVD-GENTLE-STACK-SYNC.json
 * Invariant: Pure Layer-0 Node.js (zero external dependencies).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { sanitizeEvidencePath, TLC_EVIDENCE_MODES } from "./run-tlc.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function redactPathInDetails(text, repoRoot) {
  const raw = String(text ?? "");
  // Replace absolute host / in-repo absolute spans with sanitized tokens.
  return raw
    .replace(/[A-Za-z]:\\(?:[^"'\n]+)/g, (m) => sanitizeEvidencePath(m, repoRoot))
    .replace(/\/(?:Users|home|usr)\/[^\s"']+/g, (m) => sanitizeEvidencePath(m, repoRoot))
    .replace(/\\/g, "/");
}

/**
 * Count MCP tools from the real definitions source of truth
 * (`src/mcp/eosMcpToolDefinitions.ts` + partitioned slices), not from
 * legacy regex scans of eosMcpServer.ts / annotation-only catalog text.
 */
async function resolveMcpToolCounts(root) {
  const definitionsPath = path.join(root, "src", "mcp", "eosMcpToolDefinitions.ts");
  const catalogPath = path.join(root, "src", "mcp", "eosMcpToolCatalog.ts");

  let fullToolCount = 0;
  let coreToolCount = 0;
  let mcpDefinitionsHash = "NOT_FOUND";

  if (!fs.existsSync(definitionsPath)) {
    return { fullToolCount, coreToolCount, mcpDefinitionsHash };
  }

  const hash = crypto.createHash("sha256");
  const entrySrc = fs.readFileSync(definitionsPath);
  hash.update(entrySrc);

  // Include every statically imported partition / phase slice in the seal hash.
  const entryText = entrySrc.toString("utf8");
  for (const m of entryText.matchAll(/from\s+"(\.\/[^"]+\.ts)"/g)) {
    const abs = path.resolve(path.dirname(definitionsPath), m[1]);
    if (fs.existsSync(abs)) {
      hash.update(fs.readFileSync(abs));
    }
  }
  mcpDefinitionsHash = hash.digest("hex");

  try {
    const defMod = await import(pathToFileURL(definitionsPath).href);
    const tools = defMod.EOS_MCP_TOOL_DEFINITIONS;
    if (Array.isArray(tools)) {
      fullToolCount = new Set(tools.map((t) => t && t.name).filter(Boolean)).size;
    }
  } catch {
    // Fail-closed count stays 0 when the definitions module cannot load.
    fullToolCount = 0;
  }

  if (fs.existsSync(catalogPath)) {
    try {
      const catMod = await import(pathToFileURL(catalogPath).href);
      const core = catMod.CORE_TIER0_TOOL_NAMES;
      if (core && typeof core.size === "number") {
        coreToolCount = core.size;
      } else if (Array.isArray(core)) {
        coreToolCount = new Set(core).size;
      }
    } catch {
      coreToolCount = 0;
    }
  }

  return { fullToolCount, coreToolCount, mcpDefinitionsHash };
}

export async function syncGentleAiStack(options = {}) {
  const root = path.resolve(options.projectRoot || projectRoot);
  const components = [];

  // 1. Engram DAG & Binary Verification
  const engramPath =
    process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Local", "engram", "bin", "engram.exe")
      : "/usr/local/bin/engram";

  const engramExists = fs.existsSync(engramPath);
  const engramHash = engramExists
    ? crypto.createHash("sha256").update(fs.readFileSync(engramPath)).digest("hex")
    : "NOT_FOUND";
  const engramLabel = sanitizeEvidencePath(engramPath, root);

  components.push({
    name: "Engram Epistemic DAG Engine",
    category: "ENGRAM_DAG",
    verified: engramExists,
    sha256: engramHash,
    details: engramExists
      ? `Canonical binary found at ${engramLabel} (${(fs.statSync(engramPath).size / 1024 / 1024).toFixed(1)} MB)`
      : `Engram binary not found at ${engramLabel}`,
  });

  // 2. GGA Pre-commit Hooks Verification (.githooks or .git/hooks)
  const githooksPreCommit = path.join(root, ".githooks", "pre-commit");
  const gitHooksPreCommit = path.join(root, ".git", "hooks", "pre-commit");
  const hookPath = fs.existsSync(githooksPreCommit)
    ? githooksPreCommit
    : fs.existsSync(gitHooksPreCommit)
      ? gitHooksPreCommit
      : null;

  const hookExists = Boolean(hookPath && fs.existsSync(hookPath));
  const hookHash = hookExists ? crypto.createHash("sha256").update(fs.readFileSync(hookPath)).digest("hex") : "NO_HOOK";

  components.push({
    name: "GGA Git Governance Agent Hook",
    category: "GGA_HOOKS",
    verified: hookExists,
    sha256: hookHash,
    details: hookExists
      ? `Active pre-commit verification gate present in ${path.relative(root, hookPath)}`
      : `Pre-commit hook missing in .githooks/ and .git/hooks/`,
  });

  // 3. SpecBoot Skills Verification
  const skillsDir = path.join(root, ".agents", "skills");
  const skillsExists = fs.existsSync(skillsDir);
  let skillCount = 0;
  let skillsCombinedHash = crypto.createHash("sha256");

  if (skillsExists) {
    const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const ent of skillEntries) {
      if (ent.isDirectory()) {
        skillCount++;
        skillsCombinedHash.update(ent.name);
      }
    }
  }

  components.push({
    name: "SpecBoot Mirrored SDD Skills",
    category: "SPECBOOT_SKILLS",
    verified: skillsExists && skillCount >= 10,
    sha256: skillsExists ? skillsCombinedHash.digest("hex") : "NOT_FOUND",
    details: `${skillCount} sovereign SDD and fleet operational skills active in .agents/skills/`,
  });

  // 4. Canonical MCP Tools Catalog Verification (definitions source of truth)
  const { fullToolCount, coreToolCount, mcpDefinitionsHash } = await resolveMcpToolCounts(root);

  components.push({
    name: "Canonical MCP Sovereign Tool Catalog",
    category: "MCP_CATALOG",
    verified: fullToolCount >= 70,
    sha256: mcpDefinitionsHash,
    details: `Registered ${fullToolCount} tools in full profile (eosMcpToolDefinitions) and ${coreToolCount} tools in curated Tier-0 core profile.`,
  });

  const total = components.length;
  const synchronized = components.filter((c) => c.verified).length;
  const status = synchronized === total ? "SYNCHRONIZED_HERMETIC" : "DEGRADED";
  const timestamp = new Date().toISOString();

  const sealInput = `${status}:${timestamp}:${synchronized}/${total}:${components.map((c) => c.sha256).join(":")}`;
  const sha256EvidenceSeal = crypto.createHash("sha256").update(sealInput).digest("hex");

  // Sanitize component details so versioned evidence never embeds host plumbing.
  for (const c of components) {
    c.details = redactPathInDetails(c.details, root);
  }

  const receipt = {
    status,
    timestamp,
    projectRoot: sanitizeEvidencePath(root, root),
    totalComponents: total,
    synchronizedComponents: synchronized,
    components,
    mcpToolCount: {
      coreProfile: coreToolCount,
      fullProfile: fullToolCount,
    },
    sha256EvidenceSeal,
    // Local stack probe is not merge-gate certified (Law III / FR-009 hygiene).
    epistemicState: TLC_EVIDENCE_MODES.LOCAL_SIMULATION,
    executionMode: TLC_EVIDENCE_MODES.LOCAL_SIMULATION,
    reproducibleByMergeGate: false,
    note: "Gentle-AI stack sync receipt with host paths sanitized; not merge-gate certified.",
  };

  // Write sealed evidence receipt to docs/evidence/EVD-GENTLE-STACK-SYNC.json
  const evidenceDir = path.join(root, "docs", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "EVD-GENTLE-STACK-SYNC.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );

  return receipt;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("sync-gentle-ai-stack.mjs")) {
  console.log("======================================================================");
  console.log(" EOS SYSTEM — GENTLEMAN AI STACK HERMETIC SYNC DAEMON                 ");
  console.log("======================================================================\n");

  const receipt = await syncGentleAiStack();
  console.log(`Estado Global  : ${receipt.status}`);
  console.log(`Componentes    : ${receipt.synchronizedComponents}/${receipt.totalComponents} sincronizados`);
  console.log(
    `Catálogo MCP   : ${receipt.mcpToolCount.fullProfile} herramientas (Full) / ${receipt.mcpToolCount.coreProfile} (Core)`,
  );
  console.log(`Sello EVD      : sha256:${receipt.sha256EvidenceSeal}\n`);

  for (const c of receipt.components) {
    console.log(`  • [${c.verified ? "PASS" : "WARN"}] ${c.name}`);
    console.log(`    ↳ SHA-256: ${c.sha256.slice(0, 16)}...`);
    console.log(`    ↳ Detalle: ${c.details}`);
  }

  console.log(`\n✔ Recibo sellado guardado en docs/evidence/EVD-GENTLE-STACK-SYNC.json\n`);
}
