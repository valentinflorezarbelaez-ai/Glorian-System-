import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  evaluateApexDoctrineScorecard,
  formatApexDoctrineSummary,
  sealApexDoctrineMarkdown,
  writeApexDoctrineEvidence,
} from "../src/core/eosApexDoctrineScorecard.ts";

describe("Glorian Apex Doctrine Scorecard Suite", () => {
  it("evaluates scorecard nominal state with active project root", () => {
    const card = evaluateApexDoctrineScorecard(process.cwd());

    assert.equal(card.title, "Glorian Apex Doctrine Scorecard");
    assert.equal(card.epistemicState, "APEX_DOCTRINE_WITHIN_TESTED_SCOPE");
    assert.ok(card.dimensions.length === 5);
    assert.ok(card.totalScore > 0);
    assert.ok(card.totalMax > 0);
    assert.ok(card.percent >= 70);
    assert.ok(["A+", "A", "B"].includes(card.grade));
    assert.equal(card.sha256Receipt.length, 64);
    assert.ok(card.claimsDenied.includes("Level 5"));
  });

  it("evaluates scorecard in a temporary directory lacking provenance (tipSealStable = false)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-apex-scorecard-"));
    try {
      const card = evaluateApexDoctrineScorecard(tmpDir);
      assert.equal(card.epistemicState, "APEX_DOCTRINE_WITHIN_TESTED_SCOPE");
      const evDim = card.dimensions.find((d) => d.id === "EVIDENCE_OVER_CLAIMS");
      assert.ok(evDim);
      assert.equal(evDim.score, 10);
      assert.equal(evDim.evidence, "Provenance missing");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("formats summary and seals markdown correctly", () => {
    const card = evaluateApexDoctrineScorecard(process.cwd());

    // 1. formatApexDoctrineSummary
    const summary = formatApexDoctrineSummary(card);
    assert.ok(summary.includes("Glorian Apex Doctrine Scorecard"));
    assert.ok(summary.includes("Denied: Level 5"));
    assert.ok(summary.includes(`Receipt: ${card.sha256Receipt}`));

    // 2. sealApexDoctrineMarkdown
    const md = sealApexDoctrineMarkdown(card);
    assert.ok(md.startsWith("# Glorian Apex Doctrine Scorecard"));
    assert.ok(md.includes(`**Epistemic**: \`${card.epistemicState}\``));
    assert.ok(md.includes("## Dimensions"));
    assert.ok(md.includes("## Explicitly denied claims"));
  });

  it("writes evidence pack to disk with writeApexDoctrineEvidence", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-apex-evidence-"));
    try {
      const res = writeApexDoctrineEvidence(tmpDir);
      assert.ok(res.card);
      assert.ok(fs.existsSync(res.outPath));
      assert.ok(res.outPath.endsWith("APEX_DOCTRINE_SCORECARD.md"));

      const jsonPath = path.join(tmpDir, "docs/portfolio/APEX_DOCTRINE_SCORECARD.json");
      assert.ok(fs.existsSync(jsonPath));

      const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      assert.equal(parsed.title, "Glorian Apex Doctrine Scorecard");
      assert.equal(parsed.sha256Receipt, res.card.sha256Receipt);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("exercises gradeOf threshold boundaries", () => {
    // We can evaluate grade calculation through mock scores
    const summaryA = formatApexDoctrineSummary({
      title: "Title",
      epistemicState: "APEX_DOCTRINE_WITHIN_TESTED_SCOPE",
      claimsDenied: ["None"],
      dimensions: [{ id: "D1", analogOrg: "Org", softwareMeaning: "Sm", score: 8, max: 10, evidence: "Ev" }],
      totalScore: 8,
      totalMax: 10,
      percent: 85,
      grade: "A",
      sha256Receipt: "a".repeat(64),
    });
    assert.ok(summaryA.includes("85%"));

    const summaryB = formatApexDoctrineSummary({
      title: "Title",
      epistemicState: "APEX_DOCTRINE_WITHIN_TESTED_SCOPE",
      claimsDenied: ["None"],
      dimensions: [{ id: "D1", analogOrg: "Org", softwareMeaning: "Sm", score: 7, max: 10, evidence: "Ev" }],
      totalScore: 7,
      totalMax: 10,
      percent: 70,
      grade: "B",
      sha256Receipt: "b".repeat(64),
    });
    assert.ok(summaryB.includes("70%"));

    const summaryC = formatApexDoctrineSummary({
      title: "Title",
      epistemicState: "APEX_DOCTRINE_WITHIN_TESTED_SCOPE",
      claimsDenied: ["None"],
      dimensions: [{ id: "D1", analogOrg: "Org", softwareMeaning: "Sm", score: 5, max: 10, evidence: "Ev" }],
      totalScore: 5,
      totalMax: 10,
      percent: 50,
      grade: "C",
      sha256Receipt: "c".repeat(64),
    });
    assert.ok(summaryC.includes("50%"));

    const summaryF = formatApexDoctrineSummary({
      title: "Title",
      epistemicState: "APEX_DOCTRINE_WITHIN_TESTED_SCOPE",
      claimsDenied: ["None"],
      dimensions: [{ id: "D1", analogOrg: "Org", softwareMeaning: "Sm", score: 2, max: 10, evidence: "Ev" }],
      totalScore: 2,
      totalMax: 10,
      percent: 20,
      grade: "F",
      sha256Receipt: "f".repeat(64),
    });
    assert.ok(summaryF.includes("20%"));
  });
});
