/**
 * BDD Test Suite — SPEC-244..SPEC-246 / CHANGE-123
 * Covers Live Git Contract Evolution, In-Toto/SLSA Ed25519 DSSE Attestor,
 * Golden SWE Benchmark Harness, CLI commands, and MCP dispatch.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EosLiveGitContractEvolutionCore } from "../src/core/eosLiveGitContractEvolutionCore.ts";
import { EosInTotoSlsaEd25519AttestorCore } from "../src/core/eosInTotoSlsaEd25519AttestorCore.ts";
import { EosGoldenSweBenchmarkHarnessCore } from "../src/core/eosGoldenSweBenchmarkHarnessCore.ts";
import { dispatchPhase7FrontierActionExt2 } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts";

const ROOT = process.cwd();

test("SPEC-244..SPEC-246 / CHANGE-123 — Live Contract Evolution, In-Toto Ed25519 & Golden SWE Bench", async (t) => {
  await t.test("BDD-1241: audits additive TypeScript contract pairs as MINOR backwardCompatible", () => {
    const report = EosLiveGitContractEvolutionCore.auditLiveGitContracts({
      projectRoot: ROOT,
      filePairsOverride: [
        {
          filePath: "src/core/billing.ts",
          baselineSource: "export interface Invoice { readonly id: string }\nexport function bill(id: string) {}",
          candidateSource:
            "export interface Invoice { readonly id: string; readonly currency?: string }\nexport function bill(id: string) {}\nexport function receipt(id: string) {}",
        },
      ],
    });
    assert.equal(report.filesAuditedCount, 1);
    assert.equal(report.totalBreakingChanges, 0);
    assert.equal(report.backwardCompatible, true);
    assert.equal(report.overallSemverBump, "MINOR");
  });

  await t.test("BDD-1242: detects exported symbol removal across live file pairs as MAJOR break", () => {
    const report = EosLiveGitContractEvolutionCore.auditLiveGitContracts({
      projectRoot: ROOT,
      filePairsOverride: [
        {
          filePath: "src/core/auth.ts",
          baselineSource: "export function login(u: string) {}\nexport function verifySession(t: string) {}",
          candidateSource: "export function login(u: string) {}",
        },
      ],
    });
    assert.equal(report.backwardCompatible, false);
    assert.equal(report.overallSemverBump, "MAJOR");
    assert.equal(report.totalBreakingChanges, 1);
    assert.ok(report.expandAndContractAdvice.length >= 1);
  });

  await t.test("BDD-1243: blocks path traversal on repoPath outside projectRoot", () => {
    assert.throws(
      () =>
        EosLiveGitContractEvolutionCore.auditLiveGitContracts({
          projectRoot: ROOT,
          repoPath: "../../external-repo",
        }),
      /Path traversal outside projectRoot is forbidden/,
    );
  });

  await t.test("BDD-1244: rejects unsafe Git baseRef option injection", () => {
    assert.throws(
      () =>
        EosLiveGitContractEvolutionCore.auditLiveGitContracts({
          projectRoot: ROOT,
          baseRef: "--exec=whoami",
        }),
      /Unsafe git reference rejected/,
    );
  });

  await t.test("BDD-1245: emits repeatable evolutionDigestSha256 and audits live workspace HEAD", () => {
    const opts = {
      projectRoot: ROOT,
      baseRef: "HEAD",
      filePairsOverride: [
        {
          filePath: "src/core/a.ts",
          baselineSource: "export const VERSION = 1;",
          candidateSource: "export const VERSION = 1;",
        },
      ],
    };
    const r1 = EosLiveGitContractEvolutionCore.auditLiveGitContracts(opts);
    const r2 = EosLiveGitContractEvolutionCore.auditLiveGitContracts(opts);
    assert.match(r1.evolutionDigestSha256, /^[0-9a-f]{64}$/);
    assert.equal(r1.evolutionDigestSha256, r2.evolutionDigestSha256);

    const liveWorkspace = EosLiveGitContractEvolutionCore.auditLiveGitContracts({ projectRoot: ROOT, baseRef: "HEAD" });
    assert.equal(liveWorkspace.baseRef, "HEAD");
    assert.match(liveWorkspace.evolutionDigestSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1246: issues In-Toto Statement v1 + SLSA v1.0 DSSE Ed25519 bundle and verifies cleanly", () => {
    const bundle = EosInTotoSlsaEd25519AttestorCore.issueShipAttestation({
      projectRoot: ROOT,
      ticketId: "SPOT-245",
      headCommitSha: "73792680",
      diffDigestSha256: "a".repeat(64),
      sarifDigestSha256: "b".repeat(64),
      contractDiffDigestSha256: "c".repeat(64),
      staffVerdict: "APPROVED",
    });
    assert.equal(bundle.verified, true);
    assert.equal(bundle.statement._type, "https://in-toto.io/Statement/v1");
    assert.equal(bundle.statement.predicateType, "https://slsa.dev/provenance/v1");
    assert.equal(bundle.statement.subject.length, 3);
    assert.equal(bundle.dsseEnvelope.payloadType, "application/vnd.in-toto+json");

    const check = EosInTotoSlsaEd25519AttestorCore.verifyDsseAttestation(bundle.dsseEnvelope, bundle.publicKeyPem);
    assert.equal(check.verified, true);
    assert.equal(check.statement?.predicate.buildDefinition.externalParameters.ticketId, "SPOT-245");
  });

  await t.test("BDD-1247: detects payload tampering during DSSE Ed25519 verification", () => {
    const bundle = EosInTotoSlsaEd25519AttestorCore.issueShipAttestation({ ticketId: "SPOT-TAMPER" });
    const rawJson = Buffer.from(bundle.dsseEnvelope.payloadBase64, "base64").toString("utf8");
    const tamperedJson = rawJson.replace("APPROVED", "BYPASSED");
    const tamperedEnvelope = {
      ...bundle.dsseEnvelope,
      payloadBase64: Buffer.from(tamperedJson, "utf8").toString("base64"),
    };
    const res = EosInTotoSlsaEd25519AttestorCore.verifyDsseAttestation(tamperedEnvelope, bundle.publicKeyPem);
    assert.equal(res.verified, false);
    assert.match(res.failureReason ?? "", /signature mismatch/i);
  });

  await t.test("BDD-1248: detects forged DSSE signature bytes", () => {
    const bundle = EosInTotoSlsaEd25519AttestorCore.issueShipAttestation({ ticketId: "SPOT-SIG" });
    const sigBuf = Buffer.from(bundle.dsseEnvelope.signatures[0].sigBase64, "base64");
    sigBuf[0] ^= 0xff;
    const forgedEnvelope = {
      ...bundle.dsseEnvelope,
      signatures: [{ keyid: bundle.keyId, sigBase64: sigBuf.toString("base64") }],
    };
    const res = EosInTotoSlsaEd25519AttestorCore.verifyDsseAttestation(forgedEnvelope, bundle.publicKeyPem);
    assert.equal(res.verified, false);
  });

  await t.test("BDD-1249: confines persisted attestation inside projectRoot and rejects traversal", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-attest-"));
    try {
      const bundle = EosInTotoSlsaEd25519AttestorCore.issueShipAttestation({
        projectRoot: tmpRoot,
        ticketId: "SPOT-DISK",
        writeAttestationToDisk: true,
      });
      assert.ok(bundle.writtenAttestationPath && fs.existsSync(bundle.writtenAttestationPath));
      const stored = JSON.parse(fs.readFileSync(bundle.writtenAttestationPath, "utf8"));
      assert.equal(stored.keyId, bundle.keyId);

      assert.throws(
        () =>
          EosInTotoSlsaEd25519AttestorCore.issueShipAttestation({
            projectRoot: tmpRoot,
            writeAttestationToDisk: true,
            outputRelPath: "../outside.intoto.json",
          }),
        /Path traversal outside projectRoot is forbidden/,
      );
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  await t.test("BDD-1250: produces repeatable keyId and attestationDigestSha256 for fixed keySeed", () => {
    const opts = {
      ticketId: "SPOT-DET",
      headCommitSha: "abc12345",
      keySeed: "fixed-seed-245",
      diffDigestSha256: "1".repeat(64),
      sarifDigestSha256: "2".repeat(64),
      contractDiffDigestSha256: "3".repeat(64),
    };
    const b1 = EosInTotoSlsaEd25519AttestorCore.issueShipAttestation(opts);
    const b2 = EosInTotoSlsaEd25519AttestorCore.issueShipAttestation(opts);
    assert.equal(b1.keyId, b2.keyId);
    assert.equal(b1.dsseEnvelope.signatures[0].sigBase64, b2.dsseEnvelope.signatures[0].sigBase64);
    assert.equal(b1.attestationDigestSha256, b2.attestationDigestSha256);
  });

  await t.test("BDD-1251: built-in 8-case adversarial SWE corpus scores F1=1.0 and FPR=0", () => {
    const report = EosGoldenSweBenchmarkHarnessCore.runGoldenBenchmark();
    assert.equal(report.totalCases, 8);
    assert.equal(report.truePositives, 6);
    assert.equal(report.trueNegatives, 2);
    assert.equal(report.falsePositives, 0);
    assert.equal(report.falseNegatives, 0);
    assert.equal(report.precision, 1);
    assert.equal(report.recall, 1);
    assert.equal(report.f1Score, 1);
    assert.equal(report.falsePositiveRate, 0);
    assert.equal(report.accuracy, 1);
  });

  await t.test("BDD-1252: computes exact confusion matrix metrics when FP/FN exist", () => {
    const report = EosGoldenSweBenchmarkHarnessCore.runGoldenBenchmark({
      casesOverride: [
        { caseId: "c1", category: "sec", expectedBlock: true, actualBlock: true },
        { caseId: "c2", category: "sec", expectedBlock: false, actualBlock: false },
        { caseId: "c3", category: "sec", expectedBlock: false, actualBlock: true },
        { caseId: "c4", category: "sec", expectedBlock: true, actualBlock: false },
      ],
    });
    assert.equal(report.precision, 0.5);
    assert.equal(report.recall, 0.5);
    assert.equal(report.f1Score, 0.5);
    assert.equal(report.falsePositiveRate, 0.5);
    assert.equal(report.accuracy, 0.5);
  });

  await t.test("BDD-1253: emits repeatable benchmarkDigestSha256 for built-in corpus", () => {
    const r1 = EosGoldenSweBenchmarkHarnessCore.runGoldenBenchmark();
    const r2 = EosGoldenSweBenchmarkHarnessCore.runGoldenBenchmark();
    assert.match(r1.benchmarkDigestSha256, /^[0-9a-f]{64}$/);
    assert.equal(r1.benchmarkDigestSha256, r2.benchmarkDigestSha256);
  });

  await t.test("BDD-1254: executes contract:live, attest:ship, bench:swe and enriched ship CLI", () => {
    const live = JSON.parse(
      execFileSync(process.execPath, [path.join(ROOT, "bin/eos.mjs"), "contract:live", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    assert.equal(live.baseRef, "HEAD");

    const attest = JSON.parse(
      execFileSync(process.execPath, [path.join(ROOT, "bin/eos.mjs"), "attest:ship", "--ticket=CLI-245", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    assert.equal(attest.verified, true);
    assert.equal(attest.statement._type, "https://in-toto.io/Statement/v1");

    const bench = JSON.parse(
      execFileSync(process.execPath, [path.join(ROOT, "bin/eos.mjs"), "bench:swe", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    assert.equal(bench.f1Score, 1);

    const shipOut = JSON.parse(
      execFileSync(process.execPath, [path.join(ROOT, "bin/eos.mjs"), "ship", "--ticket=SPOT-246", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    assert.equal(shipOut.dsseAttestation.verified, true);
    assert.equal(shipOut.sweBenchmark.f1Score, 1);
    assert.equal(shipOut.liveContractEvolution.baseRef, "HEAD");
  });

  await t.test("BDD-1255: dispatches CHANGE-123 MCP actions cleanly", () => {
    const mcpDeps = { projectRoot: ROOT, mcpCalls: 0, auditEntries: [] };
    const evo = dispatchPhase7FrontierActionExt2("live_contract_evolution", {}, mcpDeps);
    assert.equal(evo.action, "live_contract_evolution");
    assert.equal(evo.baseRef, "HEAD");

    const att = dispatchPhase7FrontierActionExt2("intoto_slsa_attest", { ticketId: "MCP-245" }, mcpDeps);
    assert.equal(att.action, "intoto_slsa_attest");
    assert.equal(att.verified, true);

    const bch = dispatchPhase7FrontierActionExt2("golden_swe_benchmark", {}, mcpDeps);
    assert.equal(bch.action, "golden_swe_benchmark");
    assert.equal(bch.f1Score, 1);
  });
});
