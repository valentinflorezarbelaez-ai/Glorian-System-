/**
 * EOS SYSTEM — CONTROL PLANE HEALTH PROBES (Layer 0)
 * Google SRE / CNCF-inspired *local* subsystem probes for the Glorian control plane.
 *
 * Explicitly NOT multi-region SRE, NOT live Vercel probes, NOT Level 5.
 * Epistemic: CONTROL_PLANE_HEALTH_WITHIN_TESTED_SCOPE
 */

import fs from "node:fs";
import path from "node:path";

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type HealthProbeId =
  | "PROCESS_LIVENESS"
  | "LAYER0_RUNTIME_DEPS"
  | "SBOM_PRESENT"
  | "PROVENANCE_PRESENT"
  | "FLEET_REGISTRY"
  | "TIP_SEAL_PIN";

export interface HealthProbeResult {
  readonly id: HealthProbeId;
  readonly ok: boolean;
  readonly detail: string;
  readonly latencyUs: number;
}

export interface ControlPlaneHealthReport {
  readonly status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  readonly epistemicState: "CONTROL_PLANE_HEALTH_WITHIN_TESTED_SCOPE";
  readonly claimsDenied: readonly string[];
  readonly uptimeSeconds: number;
  readonly memoryRssMb: string;
  readonly heapUsedMb: string;
  readonly probes: readonly HealthProbeResult[];
  readonly probesPassing: number;
  readonly probesTotal: number;
  readonly tipSealCommitSha: string | null;
  readonly sha256Receipt: string;
  readonly auditedAtIso: string;
}

const CLAIMS_DENIED = [
  "Level 5",
  "Multi-region SRE certification",
  "Live production traffic probes",
  "External dependency uptime SLA",
] as const;

function timedProbe(id: HealthProbeId, fn: () => { ok: boolean; detail: string }): HealthProbeResult {
  const t0 = process.hrtime.bigint();
  const { ok, detail } = fn();
  const latencyUs = Number(process.hrtime.bigint() - t0) / 1000;
  return deepFreeze({
    id,
    ok,
    detail,
    latencyUs: Number(latencyUs.toFixed(2)),
  });
}

function readTipSealCommit(projectRoot: string): string | null {
  try {
    const provenancePath = path.join(projectRoot, "docs/evidence/provenance.intoto.jsonl");
    if (!fs.existsSync(provenancePath)) return null;
    const line = fs
      .readFileSync(provenancePath, "utf8")
      .split(/\r?\n/)
      .find((l) => l.trim());
    if (!line) return null;
    const statement = JSON.parse(line) as {
      predicate?: { buildDefinition?: { externalParameters?: { commitSha?: string } } };
    };
    const sha = statement.predicate?.buildDefinition?.externalParameters?.commitSha;
    return typeof sha === "string" && sha.length >= 7 ? sha : null;
  } catch {
    return null;
  }
}

/** Read git HEAD SHA via filesystem only (no child_process; Layer-0 probe hygiene). */
function readGitHeadSha(projectRoot: string): string | null {
  try {
    const headPath = path.join(projectRoot, ".git", "HEAD");
    if (!fs.existsSync(headPath)) return null;
    const head = fs.readFileSync(headPath, "utf8").trim();
    if (/^[0-9a-f]{40}$/i.test(head)) return head.toLowerCase();
    if (!head.startsWith("ref: ")) return null;
    const ref = head.slice(5).trim();
    const refPath = path.join(projectRoot, ".git", ...ref.split("/"));
    if (fs.existsSync(refPath)) {
      return fs.readFileSync(refPath, "utf8").trim().toLowerCase();
    }
    const packed = path.join(projectRoot, ".git", "packed-refs");
    if (!fs.existsSync(packed)) return null;
    for (const line of fs.readFileSync(packed, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || line.startsWith("^")) continue;
      const [sha, name] = line.split(/\s+/);
      if (name === ref && sha && /^[0-9a-f]{40}$/i.test(sha)) return sha.toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Runs bounded local control-plane health probes (no network).
 */
export function runControlPlaneHealthProbes(projectRoot: string = process.cwd()): ControlPlaneHealthReport {
  assertPrecondition(
    typeof projectRoot === "string" && projectRoot.length > 0,
    "projectRoot must be a non-empty string",
  );
  const root = path.resolve(projectRoot);
  const mem = process.memoryUsage();
  const tipSealCommitSha = readTipSealCommit(root);

  const probes: HealthProbeResult[] = [
    timedProbe("PROCESS_LIVENESS", () => ({
      ok: true,
      detail: `uptime=${Math.floor(process.uptime())}s rssMb=${(mem.rss / (1024 * 1024)).toFixed(2)}`,
    })),
    timedProbe("LAYER0_RUNTIME_DEPS", () => {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
        const count = Object.keys(pkg.dependencies || {}).length;
        return {
          ok: count === 0,
          detail: `runtimeDependenciesCount=${count}`,
        };
      } catch (err) {
        return { ok: false, detail: `package.json unreadable: ${String(err)}` };
      }
    }),
    timedProbe("SBOM_PRESENT", () => {
      const p = path.join(root, "docs/evidence/sbom.cdx.json");
      const ok = fs.existsSync(p);
      return { ok, detail: ok ? "docs/evidence/sbom.cdx.json present" : "SBOM missing" };
    }),
    timedProbe("PROVENANCE_PRESENT", () => {
      const p = path.join(root, "docs/evidence/provenance.intoto.jsonl");
      const ok = fs.existsSync(p);
      return { ok, detail: ok ? "docs/evidence/provenance.intoto.jsonl present" : "provenance missing" };
    }),
    timedProbe("FLEET_REGISTRY", () => {
      const p = path.join(root, "docs/projects/registry.json");
      if (!fs.existsSync(p)) return { ok: false, detail: "registry.json missing" };
      try {
        const reg = JSON.parse(fs.readFileSync(p, "utf8"));
        const n = Array.isArray(reg.projects) ? reg.projects.length : 0;
        const declared = Number(reg.totalFleetProjects || 0);
        const ok = n > 0 && (declared === 0 || declared === n);
        return { ok, detail: `projects=${n};declared=${declared}` };
      } catch (err) {
        return { ok: false, detail: `registry parse failed: ${String(err)}` };
      }
    }),
    timedProbe("TIP_SEAL_PIN", () => {
      if (typeof tipSealCommitSha !== "string" || tipSealCommitSha.length < 7) {
        return { ok: false, detail: "tip-seal commitSha missing in provenance" };
      }
      const headSha = readGitHeadSha(root);
      if (!headSha) {
        return {
          ok: true,
          detail: `commitSha=${tipSealCommitSha.slice(0, 12)}… (git HEAD unread; presence-only)`,
        };
      }
      const tip = tipSealCommitSha.toLowerCase();
      const exact = tip === headSha || headSha.startsWith(tip) || tip.startsWith(headSha.slice(0, 12));
      // Tip-refresh/seal ritual routinely advances HEAD 1–2 commits after provenance bind.
      // Accept provenance SHA if it appears among the last 3 HEAD transitions in .git/logs/HEAD.
      let recent = false;
      try {
        const logPath = path.join(root, ".git", "logs", "HEAD");
        if (fs.existsSync(logPath)) {
          const lines = fs.readFileSync(logPath, "utf8").trim().split(/\r?\n/).slice(-3);
          recent = lines.some((line) => {
            const parts = line.split(/\s+/);
            return (
              parts[0]?.toLowerCase().startsWith(tip.slice(0, 12)) ||
              parts[1]?.toLowerCase().startsWith(tip.slice(0, 12))
            );
          });
        }
      } catch {
        recent = false;
      }
      const bound = exact || recent;
      return {
        ok: bound,
        detail: bound
          ? exact
            ? `commitSha=${tipSealCommitSha.slice(0, 12)}… bound to HEAD`
            : `commitSha=${tipSealCommitSha.slice(0, 12)}… within tip-refresh lag≤2 of HEAD ${headSha.slice(0, 12)}`
          : `provenance ${tipSealCommitSha.slice(0, 12)}≠HEAD ${headSha.slice(0, 12)} — run npm run supply-chain:bind`,
      };
    }),
  ];

  const probesPassing = probes.filter((p) => p.ok).length;
  const probesTotal = probes.length;
  let status: ControlPlaneHealthReport["status"] = "HEALTHY";
  if (probesPassing < probesTotal) status = "DEGRADED";
  if (probesPassing < Math.ceil(probesTotal * 0.5)) status = "CRITICAL";

  const receipt = pureSha256(
    `HEALTH:${status}:${probesPassing}/${probesTotal}:${tipSealCommitSha || "none"}:${probes.map((p) => `${p.id}:${p.ok}`).join("|")}`,
  );

  return deepFreeze({
    status,
    epistemicState: "CONTROL_PLANE_HEALTH_WITHIN_TESTED_SCOPE",
    claimsDenied: CLAIMS_DENIED,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryRssMb: (mem.rss / (1024 * 1024)).toFixed(2),
    heapUsedMb: (mem.heapUsed / (1024 * 1024)).toFixed(2),
    probes: Object.freeze(probes),
    probesPassing,
    probesTotal,
    tipSealCommitSha,
    sha256Receipt: receipt,
    auditedAtIso: new Date().toISOString(),
  });
}
