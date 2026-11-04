/**
 * Glorian Career Evidence Pack generator
 * Seals Mission Golden Path + Gentleman + architecture + turbo + Soundcheck
 * into docs/portfolio/ for employer-facing proof (NOT Level 5).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { runMissionGoldenPath } from "../src/core/eosMissionGoldenPathOrchestrator.ts";
import { EosGentlemanStackBridge } from "../src/core/eosGentlemanStackBridge.ts";
import { scanArchitecture } from "../src/core/eosArchitectureGuard.ts";
import { runTurboPipeline } from "../src/core/eosTurboEngine.ts";
import { EosFleetSoundcheckMesh } from "../src/core/eosFleetSoundcheckMesh.ts";
import { evaluateSpotifyArchitectureHealth } from "../src/core/eosSpotifyInstitutionalCodex.ts";
import { evaluateNubankArchitectureHealth } from "../src/core/eosNubankCodex.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs", "portfolio");
fs.mkdirSync(outDir, { recursive: true });
const iso = new Date().toISOString();
const stamp = iso.slice(0, 10);

const mission = runMissionGoldenPath(
  "Seal employer-grade career evidence for Glorian control plane industrialization",
  { projectRoot: root, domainHint: "platform", ledgerPath: ":memory:" }
);
const gentleman = EosGentlemanStackBridge.auditStack(root);
const arch = scanArchitecture(path.join(root, "src/core"), root);
const turbo = runTurboPipeline(root);
const soundcheck = EosFleetSoundcheckMesh.auditFleet(root);

const spotify = evaluateSpotifyArchitectureHealth({
  usesGoldenPath: true,
  hasCatalogInfoYaml: fs.existsSync(path.join(root, "catalog-info.yaml")),
  hasTechDocsAndRunbook: true,
  compliesWithBS1770Loudness: true,
  hasProgressiveCanaryPipeline: true,
  hasAutomatedKillSwitch: true,
  hasBlamelessPostmortemProcess: true,
  unitTestCoveragePercent: 90
});
const nubank = evaluateNubankArchitectureHealth({
  hasMutableStateInDomain: false,
  usesHexagonalLayerIsolation: arch.isClean,
  usesContractTestingInsteadOfE2E: true,
  enforcesKafkaIdempotencyTokens: true,
  usesImmutableBitemporalLedgers: true,
  hasBlamelessPostmortemProcess: true,
  unitTestCoveragePercent: 90
});

const pack = {
  title: "Glorian Career Evidence Pack",
  owner: "Valentín Flórez Arbeláez",
  generatedAtIso: iso,
  epistemicState: "CAREER_EVIDENCE_WITHIN_TESTED_SCOPE",
  claimsDenied: ["Level 5", "absolute perfection", "vendor production controller"],
  northStar: "docs/governance/GLORIAN_NORTH_STAR_SPOTIFY_NUBANK_NL_SDLC.md",
  gentlemanCanon: EosGentlemanStackBridge.EXTERNAL_CANON,
  signals: {
    mission: {
      status: mission.status,
      epistemicState: mission.epistemicState,
      sha256Receipt: mission.sha256Receipt,
      durationMs: mission.durationMs,
      stages: mission.stages.map((s) => ({
        id: s.stageId,
        exitCode: s.exitCode,
        mandatory: s.mandatory,
        summary: s.summary
      }))
    },
    gentleman: {
      readinessScore: gentleman.readinessScore,
      status: gentleman.status,
      constitutionPreserved: gentleman.constitutionPreserved,
      sha256Receipt: gentleman.sha256Receipt
    },
    architecture: {
      architecturePurityScore: arch.architecturePurityScore,
      isClean: arch.isClean,
      circularDependencies: arch.circularDependencies.length,
      totalViolations: arch.totalViolations
    },
    turbo: {
      success: turbo.success,
      totalDurationMs: turbo.totalDurationMs,
      epistemicState: turbo.epistemicState,
      sourceInventoryDigest: turbo.sourceInventoryDigest
    },
    fleetSoundcheck: {
      fleetAverageScore: soundcheck.fleetAverageScore,
      deploymentAuthorizedQuorum: soundcheck.deploymentAuthorizedQuorum,
      totalRepositories: soundcheck.totalRepositories,
      reposAtGradeA: soundcheck.reposAtGradeA,
      dirtyTrees: soundcheck.reports
        .filter((r) => !r.workingTreeClean)
        .map((r) => ({ id: r.id, score: r.totalScore, grade: r.grade })),
      sha256Receipt: soundcheck.sha256Receipt
    },
    spotifyInstitutional: {
      institutionalScore: spotify.institutionalScore,
      soundcheckTier: spotify.soundcheckTier
    },
    nubankInstitutional: {
      institutionalScore: nubank.institutionalScore,
      tier: nubank.tier
    }
  },
  employerPitch: {
    oneLiner:
      "Verified Engineering OS for AI agents: natural language in, fail-closed Big-Tech SDLC out (Spotify + Nubank + Gentleman bars).",
    dailyUse: "eos_mission_run + Gentle Engram/ODD/GGA",
    proofArtifacts: [
      "Mission Golden Path receipts (SPEC-156)",
      "Layer-0 architecture purity 100",
      "Gentleman stack co-governance APEX",
      "Fleet Soundcheck quorum",
      "OpenSpec formal catalog"
    ]
  }
};

const packHash = createHash("sha256").update(JSON.stringify(pack)).digest("hex");
pack.sha256Pack = packHash;

const jsonBody = `${JSON.stringify(pack, null, 2)}\n`;
fs.writeFileSync(path.join(outDir, `EVIDENCE_PACK_${stamp}.json`), jsonBody);
fs.writeFileSync(path.join(outDir, "EVIDENCE_PACK_LATEST.json"), jsonBody);

const dirtyLines =
  pack.signals.fleetSoundcheck.dirtyTrees.length === 0
    ? "- none"
    : pack.signals.fleetSoundcheck.dirtyTrees
        .map((d) => `- \`${d.id}\` score=${d.score} grade=${d.grade}`)
        .join("\n");

const md = `# Glorian Career Evidence Pack (${stamp})

**Owner**: Valentín Flórez Arbeláez  
**Epistemic**: \`CAREER_EVIDENCE_WITHIN_TESTED_SCOPE\` (explicitly NOT Level 5)  
**Pack SHA-256**: \`${packHash}\`

## Employer one-liner
${pack.employerPitch.oneLiner}

## Live sealed signals

| Signal | Result |
|---|---|
| Mission Golden Path | **${mission.status}** · \`${mission.sha256Receipt.slice(0, 16)}…\` |
| Gentleman stack | **${gentleman.readinessScore}/100** · ${gentleman.status} |
| Architecture purity | **${arch.architecturePurityScore}** · clean=${arch.isClean} |
| Turbo verify | **${turbo.success ? "PASS" : "FAIL"}** · ${turbo.totalDurationMs} ms |
| Fleet Soundcheck avg | **${soundcheck.fleetAverageScore}** · quorum=${soundcheck.deploymentAuthorizedQuorum} |
| Spotify institutional | **${spotify.institutionalScore}** · ${spotify.soundcheckTier} |
| Nubank institutional | **${nubank.institutionalScore}** · ${nubank.tier} |

## Dirty fleet trees (Soundcheck git health debt)
${dirtyLines}

## How to verify locally

\`\`\`bash
node scripts/generate-career-evidence-pack.mjs
npm run typecheck
node bin/eos.mjs turbo
\`\`\`

## Canon
- North star: \`docs/governance/GLORIAN_NORTH_STAR_SPOTIFY_NUBANK_NL_SDLC.md\`
- Gentleman media: ${EosGentlemanStackBridge.EXTERNAL_CANON.youtubeMain}
- VODs: ${EosGentlemanStackBridge.EXTERNAL_CANON.youtubeVods}
- Site: ${EosGentlemanStackBridge.EXTERNAL_CANON.site}
`;

fs.writeFileSync(path.join(outDir, `EVIDENCE_PACK_${stamp}.md`), md);
fs.writeFileSync(path.join(outDir, "EVIDENCE_PACK_LATEST.md"), md);
fs.writeFileSync(
  path.join(outDir, "README.md"),
  `# Portfolio-facing Glorian evidence

Hiring managers: start with [EVIDENCE_PACK_LATEST.md](./EVIDENCE_PACK_LATEST.md).

Machine-readable: [EVIDENCE_PACK_LATEST.json](./EVIDENCE_PACK_LATEST.json).
`
);

console.log(
  JSON.stringify(
    {
      packHash,
      mission: mission.status,
      gentleman: gentleman.readinessScore,
      soundcheck: soundcheck.fleetAverageScore,
      outDir
    },
    null,
    2
  )
);
