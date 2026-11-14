/**
 * BDD Test Suite — SPEC-241..SPEC-243 / CHANGE-122
 * Covers API Contract Semantic Diff, OASIS SARIF 2.1.0 & Unified Patch Synthesizer,
 * Fleet Multi-Repo Ship Orchestrator, CLI commands, and MCP dispatch.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EosApiContractSemanticDiffCore } from "../src/core/eosApiContractSemanticDiffCore.ts";
import { EosSarifDiagnosticPatchSynthesizerCore } from "../src/core/eosSarifDiagnosticPatchSynthesizerCore.ts";
import { EosFleetMultiRepoShipOrchestratorCore } from "../src/core/eosFleetMultiRepoShipOrchestratorCore.ts";
import { dispatchPhase7FrontierActionExt2 } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("SPEC-241..SPEC-243 / CHANGE-122 — Contract Diff, SARIF 2.1.0 & Fleet Ship Orchestrator", async (t) => {
  await t.test("BDD-1226: detects additive public symbols as backward-compatible MINOR bump", () => {
    const report = EosApiContractSemanticDiffCore.compareContracts({
      contractId: "C-1226",
      baselineSource: "export function computeScore(id: string) {}",
      candidateSource: "export function computeScore(id: string) {}\nexport function computeDigest(id: string) {}",
    });
    assert.equal(report.backwardCompatible, true);
    assert.equal(report.semverBumpRequired, "MINOR");
    assert.equal(report.breakingChanges.length, 0);
    assert.equal(report.additiveChanges.length, 1);
    assert.equal(report.additiveChanges[0].changeKind, "ADDITIVE_NON_BREAKING");
    assert.equal(report.additiveChanges[0].symbolName, "computeDigest");
  });

  await t.test("BDD-1227: flags removed exported function as REMOVED_PUBLIC_SYMBOL MAJOR break", () => {
    const report = EosApiContractSemanticDiffCore.compareContracts({
      contractId: "C-1227",
      baselineSource: "export function computeScore(id: string) {}\nexport function verifyToken(raw: string) {}",
      candidateSource: "export function computeScore(id: string) {}",
    });
    assert.equal(report.backwardCompatible, false);
    assert.equal(report.semverBumpRequired, "MAJOR");
    assert.equal(report.breakingChanges.length, 1);
    assert.equal(report.breakingChanges[0].changeKind, "REMOVED_PUBLIC_SYMBOL");
    assert.equal(report.breakingChanges[0].symbolName, "verifyToken");
  });

  await t.test("BDD-1228: flags increased required parameter arity as ARITY_INCREASED_BREAKING", () => {
    const report = EosApiContractSemanticDiffCore.compareContracts({
      contractId: "C-1228",
      baselineSource: "export function issueReceipt(id: string) {}",
      candidateSource: "export function issueReceipt(id: string, tenantId: string, flag?: boolean) {}",
    });
    assert.equal(report.backwardCompatible, false);
    assert.equal(report.semverBumpRequired, "MAJOR");
    assert.equal(report.breakingChanges[0].changeKind, "ARITY_INCREASED_BREAKING");
    assert.equal(report.breakingChanges[0].symbolName, "issueReceipt");
  });

  await t.test("BDD-1229: flags removed required interface field with Expand-and-Contract advice", () => {
    const report = EosApiContractSemanticDiffCore.compareContracts({
      contractId: "C-1229",
      baselineSource: "export interface ShipVerdict { readonly id: string; readonly score: number }",
      candidateSource: "export interface ShipVerdict { readonly id: string }",
    });
    assert.equal(report.backwardCompatible, false);
    assert.equal(report.breakingChanges[0].changeKind, "REMOVED_REQUIRED_FIELD");
    assert.equal(report.breakingChanges[0].symbolName, "ShipVerdict");
    assert.ok(report.expandAndContractAdvice.some((line) => line.includes("Expand")));
  });

  await t.test("BDD-1230: emits PATCH bump and repeatable SHA-256 digest for unchanged contracts", () => {
    const src = "export interface Ping { readonly ok: boolean }\nexport function ping(id: string, opt = 1) {}";
    const r1 = EosApiContractSemanticDiffCore.compareContracts({
      contractId: "C-1230",
      baselineSource: src,
      candidateSource: src,
    });
    const r2 = EosApiContractSemanticDiffCore.compareContracts({
      contractId: "C-1230",
      baselineSource: src,
      candidateSource: src,
    });
    assert.equal(r1.backwardCompatible, true);
    assert.equal(r1.semverBumpRequired, "PATCH");
    assert.match(r1.contractDiffDigestSha256, /^[0-9a-f]{64}$/);
    assert.equal(r1.contractDiffDigestSha256, r2.contractDiffDigestSha256);
  });

  await t.test("BDD-1231: synthesizes valid OASIS SARIF 2.1.0 with deduplicated rules", () => {
    const report = EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches({
      runTitle: "Glorian Verify SARIF",
      findings: [
        {
          ruleId: "EOS-BEYONCE-001",
          level: "error",
          message: "Production file modified without corresponding tests.",
          filePath: "src/core/service.ts",
          startLine: 10,
        },
        {
          ruleId: "EOS-BEYONCE-001",
          level: "error",
          message: "Production file modified without corresponding tests.",
          filePath: "src/core/other.ts",
          startLine: 18,
        },
        {
          ruleId: "EOS-DDL-002",
          level: "warning",
          message: "Prefer Expand-and-Contract column addition.",
          filePath: "migrations/001.sql",
          startLine: 4,
        },
      ],
    });
    assert.equal(report.sarifDocument.version, "2.1.0");
    assert.equal(report.sarifDocument.$schema, "https://json.schemastore.org/sarif-2.1.0.json");
    assert.equal(report.sarifDocument.runs[0].tool.driver.rules.length, 2);
    assert.equal(report.totalResults, 3);
    assert.equal(report.errorCount, 2);
    assert.equal(report.warningCount, 1);
  });

  await t.test("BDD-1232: emits unified diff hunks and SARIF fixes for remediable findings", () => {
    const report = EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches({
      findings: [
        {
          ruleId: "EOS-CONTRACT-001",
          level: "warning",
          message: "Make trailing parameter optional to preserve callers.",
          filePath: "src/core/example.ts",
          startLine: 12,
          startColumn: 8,
          originalLine: "export function ship(id: string, region: string) {}",
          replacementLine: "export function ship(id: string, region?: string) {}",
        },
      ],
    });
    assert.ok(report.synthesizedUnifiedDiff.includes("--- a/src/core/example.ts"));
    assert.ok(report.synthesizedUnifiedDiff.includes("@@ -12,1 +12,1 @@"));
    assert.ok(report.synthesizedUnifiedDiff.includes("-export function ship(id: string, region: string) {}"));
    assert.ok(report.synthesizedUnifiedDiff.includes("+export function ship(id: string, region?: string) {}"));
    assert.equal(report.sarifDocument.runs[0].results[0].fixes?.length, 1);
  });

  await t.test("BDD-1233: persists SARIF 2.1.0 JSON inside confined projectRoot", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sarif-"));
    try {
      const report = EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches({
        projectRoot: tmpRoot,
        writeSarifToDisk: true,
        findings: [
          {
            ruleId: "EOS-AUDIT-001",
            level: "note",
            message: "Clean check persisted.",
            filePath: "src/index.ts",
          },
        ],
      });
      assert.ok(report.writtenSarifPath && fs.existsSync(report.writtenSarifPath));
      const parsed = JSON.parse(fs.readFileSync(report.writtenSarifPath, "utf8"));
      assert.equal(parsed.version, "2.1.0");
      assert.equal(parsed.runs[0].results.length, 1);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  await t.test("BDD-1234: blocks path traversal on outputRelPath when writing SARIF", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sarif-esc-"));
    try {
      assert.throws(
        () =>
          EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches({
            projectRoot: tmpRoot,
            writeSarifToDisk: true,
            outputRelPath: "../outside-escape.sarif.json",
            findings: [],
          }),
        /Path traversal outside projectRoot is forbidden/,
      );
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  await t.test("BDD-1235: computes deterministic sarifDigestSha256 across repeated calls", () => {
    const opts = {
      runTitle: "Determinism Check",
      findings: [
        {
          ruleId: "EOS-DET-001",
          level: "warning",
          message: "Stable digest verification.",
          filePath: "src/core/a.ts",
          startLine: 5,
        },
      ],
    };
    const r1 = EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches(opts);
    const r2 = EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches(opts);
    assert.match(r1.sarifDigestSha256, /^[0-9a-f]{64}$/);
    assert.equal(r1.sarifDigestSha256, r2.sarifDigestSha256);
  });

  await t.test("BDD-1236: validates all 9 registered fleet projects as FLEET_SHIP_READY", () => {
    const fleet = EosFleetMultiRepoShipOrchestratorCore.orchestrateFleetShipReadiness({
      projectRoot: root,
    });
    assert.equal(fleet.totalProjects, 9);
    assert.equal(fleet.authorizedProjects, 9);
    assert.equal(fleet.blockedProjects, 0);
    assert.equal(fleet.averageReadinessScore, 100);
    assert.equal(fleet.fleetVerdict, "FLEET_SHIP_READY");
  });

  await t.test("BDD-1237: detects unmet Law IV gates and emits FLEET_PARTIAL_BLOCK", () => {
    const fleet = EosFleetMultiRepoShipOrchestratorCore.orchestrateFleetShipReadiness({
      projectRoot: root,
      projectsOverride: [
        {
          id: "clean-app",
          name: "Clean App",
          status: "REGISTERED",
          intake: "INTAKE_COMPLETE",
          specification: "SPECIFICATION_APPROVED",
          audit: "AUDIT_COMPLETE",
          ownerApproval: "OWNER_APPROVAL",
          authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
        },
        {
          id: "blocked-app",
          name: "Blocked App",
          status: "REGISTERED",
          intake: "INTAKE_COMPLETE",
          specification: "SPECIFICATION_APPROVED",
          audit: "AUDIT_PENDING",
          ownerApproval: "OWNER_PENDING",
          authorization: "LEVEL_1",
        },
      ],
    });
    assert.equal(fleet.totalProjects, 2);
    assert.equal(fleet.authorizedProjects, 1);
    assert.equal(fleet.blockedProjects, 1);
    assert.equal(fleet.fleetVerdict, "FLEET_PARTIAL_BLOCK");
    assert.ok(fleet.projectStatuses[1].missingPreconditions.includes("AUDIT_COMPLETE"));
    assert.ok(fleet.projectStatuses[1].missingPreconditions.includes("OWNER_APPROVAL"));
    assert.ok(fleet.projectStatuses[1].missingPreconditions.includes("IMPLEMENTATION_AUTHORIZED(LEVEL_2+)"));
  });

  await t.test("BDD-1238: rejects traversal on registryRelPath", () => {
    assert.throws(
      () =>
        EosFleetMultiRepoShipOrchestratorCore.orchestrateFleetShipReadiness({
          projectRoot: root,
          registryRelPath: "../../etc/passwd",
        }),
      /Path traversal outside projectRoot is forbidden/,
    );
  });

  await t.test("BDD-1239: produces identical fleetShipDigestSha256 for identical inputs", () => {
    const projectsOverride = [
      {
        id: "demo",
        name: "Demo Service",
        status: "REGISTERED",
        intake: "INTAKE_COMPLETE",
        specification: "SPECIFICATION_APPROVED",
        audit: "AUDIT_COMPLETE",
        ownerApproval: "OWNER_APPROVAL",
        authorization: "LEVEL_2_AUTHORIZED",
      },
    ];
    const r1 = EosFleetMultiRepoShipOrchestratorCore.orchestrateFleetShipReadiness({
      projectRoot: root,
      projectsOverride,
    });
    const r2 = EosFleetMultiRepoShipOrchestratorCore.orchestrateFleetShipReadiness({
      projectRoot: root,
      projectsOverride,
    });
    assert.match(r1.fleetShipDigestSha256, /^[0-9a-f]{64}$/);
    assert.equal(r1.fleetShipDigestSha256, r2.fleetShipDigestSha256);
  });

  await t.test("BDD-1240: executes contract:diff, sarif:export, fleet:ship CLI & MCP actions", async () => {
    const cliContract = JSON.parse(
      execFileSync(process.execPath, [path.join(root, "bin/eos.mjs"), "contract:diff", "--json"], {
        cwd: root,
        encoding: "utf8",
      }),
    );
    assert.equal(cliContract.backwardCompatible, true);

    const cliSarif = JSON.parse(
      execFileSync(process.execPath, [path.join(root, "bin/eos.mjs"), "sarif:export", "--json"], {
        cwd: root,
        encoding: "utf8",
      }),
    );
    assert.equal(cliSarif.sarifDocument.version, "2.1.0");

    const cliFleet = JSON.parse(
      execFileSync(process.execPath, [path.join(root, "bin/eos.mjs"), "fleet:ship", "--json"], {
        cwd: root,
        encoding: "utf8",
      }),
    );
    assert.equal(cliFleet.fleetVerdict, "FLEET_SHIP_READY");

    const mcpDeps = { projectRoot: root, mcpCalls: 0, auditEntries: [] };
    const mcpContract = dispatchPhase7FrontierActionExt2(
      "api_contract_diff",
      {
        baselineSource: "export function runTask(id: string) {}",
        candidateSource: "export function runTask(id: string) {}\nexport const VERSION = '1.0.0';",
      },
      mcpDeps,
    );
    assert.equal(mcpContract.action, "api_contract_diff");
    assert.equal(mcpContract.semverBumpRequired, "MINOR");

    const mcpSarif = dispatchPhase7FrontierActionExt2(
      "sarif_patch_synthesize",
      {
        findings: [
          {
            ruleId: "EOS-MCP-001",
            level: "warning",
            message: "Add optional field.",
            filePath: "src/core/mod.ts",
            startLine: 2,
          },
        ],
      },
      mcpDeps,
    );
    assert.equal(mcpSarif.action, "sarif_patch_synthesize");
    assert.equal(mcpSarif.sarifDocument.version, "2.1.0");

    const mcpFleet = dispatchPhase7FrontierActionExt2("fleet_ship_orchestrate", {}, mcpDeps);
    assert.equal(mcpFleet.action, "fleet_ship_orchestrate");
    assert.equal(mcpFleet.fleetVerdict, "FLEET_SHIP_READY");
  });
});
