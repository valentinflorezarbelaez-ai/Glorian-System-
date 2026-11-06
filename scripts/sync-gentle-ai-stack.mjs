#!/usr/bin/env node

/**
 * EOS SYSTEM — GENTLEMAN AI STACK HERMETIC SYNC DAEMON & EVIDENCE CUSTODIAN
 *
 * Governed by Law II, Law III, Law V & PELDAÑO 3:
 * Sincronización determinista para:
 * 1. Gentle-AI & Engram DAG (Grafo Epistémico Dirigido Acíclico con compactación por entropía)
 * 2. GGA (Git Governance Agent — hooks pre-commit activos)
 * 3. Espejos SpecBoot (.agents/skills/)
 * 4. Catálogo Canónico de 80 Herramientas MCP
 *
 * Emite recibo sellado SHA-256 en docs/evidence/EVD-GENTLE-STACK-SYNC.json
 * Invariant: Pure Layer-0 Node.js (zero external dependencies).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export function syncGentleAiStack(options = {}) {
  const root = path.resolve(options.projectRoot || projectRoot);
  const components = [];

  // 1. Engram DAG & Binary Verification
  const engramPath = process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local", "engram", "bin", "engram.exe")
    : "/usr/local/bin/engram";

  const engramExists = fs.existsSync(engramPath);
  const engramHash = engramExists
    ? crypto.createHash("sha256").update(fs.readFileSync(engramPath)).digest("hex")
    : "NOT_FOUND";

  components.push({
    name: "Engram Epistemic DAG Engine",
    category: "ENGRAM_DAG",
    verified: engramExists,
    sha256: engramHash,
    details: engramExists
      ? `Canonical binary found at ${engramPath} (${(fs.statSync(engramPath).size / 1024 / 1024).toFixed(1)} MB)`
      : `Engram binary not found at ${engramPath}`
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
  const hookHash = hookExists
    ? crypto.createHash("sha256").update(fs.readFileSync(hookPath)).digest("hex")
    : "NO_HOOK";

  components.push({
    name: "GGA Git Governance Agent Hook",
    category: "GGA_HOOKS",
    verified: hookExists,
    sha256: hookHash,
    details: hookExists
      ? `Active pre-commit verification gate present in ${path.relative(root, hookPath)}`
      : `Pre-commit hook missing in .githooks/ and .git/hooks/`
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
    details: `${skillCount} sovereign SDD and fleet operational skills active in .agents/skills/`
  });

  // 4. Canonical MCP Tools Catalog Verification
  let coreToolCount = 0;
  let fullToolCount = 0;
  let mcpCatalogHash = "UNAVAILABLE";

  const catalogPath = path.join(root, "src", "mcp", "eosMcpToolCatalog.ts");
  if (fs.existsSync(catalogPath)) {
    const catalogSource = fs.readFileSync(catalogPath, "utf8");
    mcpCatalogHash = crypto.createHash("sha256").update(catalogSource).digest("hex");

    const coreMatches = catalogSource.match(/"eos_[a-z0-9_]+"/g) || [];
    coreToolCount = new Set(coreMatches).size;
  }

  const serverPath = path.join(root, "src", "mcp", "eosMcpServer.ts");
  if (fs.existsSync(serverPath)) {
    const serverSource = fs.readFileSync(serverPath, "utf8");
    const allMatches = serverSource.match(/name:\s*"eos_[a-z0-9_]+"/g) || [];
    fullToolCount = new Set(allMatches).size;
  }

  components.push({
    name: "Canonical MCP Sovereign Tool Catalog",
    category: "MCP_CATALOG",
    verified: fullToolCount >= 70,
    sha256: mcpCatalogHash,
    details: `Registered ${fullToolCount} tools in full profile and ${coreToolCount} tools in curated Tier-0 core profile.`
  });

  const total = components.length;
  const synchronized = components.filter(c => c.verified).length;
  const status = synchronized === total ? "SYNCHRONIZED_HERMETIC" : "DEGRADED";
  const timestamp = new Date().toISOString();

  const sealInput = `${status}:${timestamp}:${synchronized}/${total}:${components.map(c => c.sha256).join(":")}`;
  const sha256EvidenceSeal = crypto.createHash("sha256").update(sealInput).digest("hex");

  const receipt = {
    status,
    timestamp,
    projectRoot: root,
    totalComponents: total,
    synchronizedComponents: synchronized,
    components,
    mcpToolCount: {
      coreProfile: coreToolCount,
      fullProfile: fullToolCount
    },
    sha256EvidenceSeal
  };

  // Write sealed evidence receipt to docs/evidence/EVD-GENTLE-STACK-SYNC.json
  const evidenceDir = path.join(root, "docs", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "EVD-GENTLE-STACK-SYNC.json"),
    JSON.stringify(receipt, null, 2),
    "utf8"
  );

  return receipt;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("sync-gentle-ai-stack.mjs")) {
  console.log("======================================================================");
  console.log(" EOS SYSTEM — GENTLEMAN AI STACK HERMETIC SYNC DAEMON                 ");
  console.log("======================================================================\n");

  const receipt = syncGentleAiStack();
  console.log(`Estado Global  : ${receipt.status}`);
  console.log(`Componentes    : ${receipt.synchronizedComponents}/${receipt.totalComponents} sincronizados`);
  console.log(`Catálogo MCP   : ${receipt.mcpToolCount.fullProfile} herramientas (Full) / ${receipt.mcpToolCount.coreProfile} (Core)`);
  console.log(`Sello EVD      : sha256:${receipt.sha256EvidenceSeal}\n`);

  for (const c of receipt.components) {
    console.log(`  • [${c.verified ? "PASS" : "WARN"}] ${c.name}`);
    console.log(`    ↳ SHA-256: ${c.sha256.slice(0, 16)}...`);
    console.log(`    ↳ Detalle: ${c.details}`);
  }

  console.log(`\n✔ Recibo sellado guardado en docs/evidence/EVD-GENTLE-STACK-SYNC.json\n`);
}
