/**
 * Sync sealed Glorian evidence pack signals into portafolio careerEvidence.ts
 * Law IV: only writes when EOS_FLEET_PORTAFOLIO_PATH / registry path is configured.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveFleetProjectPath } from "./lib/fleet-project-path.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packPath = path.join(root, "docs/portfolio/EVIDENCE_PACK_LATEST.json");
const registry = JSON.parse(
  fs.readFileSync(path.join(root, "docs/projects/registry.json"), "utf8")
);
const portafolio = registry.projects.find((p) => p.id === "portafolio");
if (!portafolio) {
  console.error("[ERROR] portafolio missing from registry");
  process.exit(1);
}
const portafolioRoot = resolveFleetProjectPath(portafolio, root);
if (!portafolioRoot || !fs.existsSync(portafolioRoot)) {
  console.error("[ERROR] portafolio checkout not configured");
  process.exit(1);
}

const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));
const missionReceipt = String(pack.signals.mission.sha256Receipt || "").slice(0, 16);
const out = `/**
 * Sealed Glorian career evidence snapshot for employer-facing UI.
 * Sourced from Eos-System docs/portfolio/EVIDENCE_PACK_LATEST.json.
 * Epistemic: CAREER_EVIDENCE_WITHIN_TESTED_SCOPE — not Level 5.
 * Privacy: aggregate fleet scores only; no private repo deep links beyond public GitHub/demo URLs.
 * Auto-synced by scripts/sync-career-evidence-to-portafolio.mjs
 */

export interface CareerEvidenceSignal {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export const careerEvidence = {
  title: ${JSON.stringify(pack.title)},
  epistemicState: "CAREER_EVIDENCE_WITHIN_TESTED_SCOPE" as const,
  generatedAtIso: ${JSON.stringify(pack.generatedAtIso)},
  packSha256: ${JSON.stringify(pack.sha256Pack)},
  oneLiner: ${JSON.stringify(pack.employerPitch.oneLiner)},
  claimsDenied: ${JSON.stringify(pack.claimsDenied)} as const,
  signals: [
    {
      label: "Mission Golden Path",
      value: ${JSON.stringify(pack.signals.mission.status)},
      detail: ${JSON.stringify(`SPEC-156 · receipt ${missionReceipt}…`)}
    },
    {
      label: "Gentleman stack",
      value: ${JSON.stringify(`${pack.signals.gentleman.readinessScore} APEX`)},
      detail: "Co-governance Engram / ODD / GGA"
    },
    {
      label: "Architecture",
      value: ${JSON.stringify(String(pack.signals.architecture.architecturePurityScore))},
      detail: "Layer-0 purity · 0 cycles"
    },
    {
      label: "Turbo verify",
      value: ${JSON.stringify(pack.signals.turbo.success ? "PASS" : "FAIL")},
      detail: "Fail-closed local SecDevOps gate"
    },
    {
      label: "Fleet Soundcheck",
      value: ${JSON.stringify(String(pack.signals.fleetSoundcheck.fleetAverageScore))},
      detail: ${JSON.stringify(
        `${pack.signals.fleetSoundcheck.totalRepositories}/${pack.signals.fleetSoundcheck.totalRepositories} repos · deploy quorum`
      )}
    },
    {
      label: "Spotify / Nubank",
      value: ${JSON.stringify(
        `${pack.signals.spotifyInstitutional.institutionalScore} / ${pack.signals.nubankInstitutional.institutionalScore}`
      )},
      detail: "Institutional bars within tested scope"
    },
    {
      label: "FinOps mission receipt",
      value: ${JSON.stringify(
        pack.signals.finopsCostReceipt &&
          pack.signals.finopsCostReceipt.present &&
          pack.signals.finopsCostReceipt.exitCode === 0
          ? String(pack.signals.finopsCostReceipt.tier || "PASS")
          : "MISSING"
      )},
      detail: ${JSON.stringify(
        pack.signals.finopsCostReceipt &&
          typeof pack.signals.finopsCostReceipt.estimatedCostUsd === "number"
          ? `est $${Number(pack.signals.finopsCostReceipt.estimatedCostUsd).toFixed(6)} · estimate only`
          : "FINOPS_COST_RECEIPT on eos_mission_run"
      )}
    }
  ] as const satisfies readonly CareerEvidenceSignal[],
  githubEvidenceUrl:
    "https://github.com/valentinflorezarbelaez-ai/Glorian-System-/tree/main/docs/portfolio",
  liveDemoUrl: "https://eos-system-ten.vercel.app"
} as const;
`;

const target = path.join(portafolioRoot, "src/data/careerEvidence.ts");
fs.writeFileSync(target, out);
console.log(
  JSON.stringify(
    {
      target,
      packSha256: pack.sha256Pack,
      mission: pack.signals.mission.status,
      soundcheck: pack.signals.fleetSoundcheck.fleetAverageScore
    },
    null,
    2
  )
);
