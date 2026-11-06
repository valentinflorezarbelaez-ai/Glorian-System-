import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosEnterpriseWorkspaceGovernor } from "../src/core/eosEnterpriseWorkspaceGovernor.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function buildSyntheticEnterpriseMonorepo(baseDir) {
  fs.mkdirSync(path.join(baseDir, "apps", "web"), { recursive: true });
  fs.mkdirSync(path.join(baseDir, "packages", "core-domain"), { recursive: true });
  fs.mkdirSync(path.join(baseDir, "services", "payments-go"), { recursive: true });
  fs.mkdirSync(path.join(baseDir, "crates", "crypto-engine"), { recursive: true });
  fs.mkdirSync(path.join(baseDir, "contracts"), { recursive: true });
  fs.mkdirSync(path.join(baseDir, "prisma"), { recursive: true });
  fs.mkdirSync(path.join(baseDir, ".github", "workflows"), { recursive: true });

  fs.writeFileSync(
    path.join(baseDir, "pnpm-workspace.yaml"),
    "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(baseDir, "turbo.json"),
    JSON.stringify({ $schema: "https://turbo.build/schema.json", tasks: { build: {}, test: {} } }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(baseDir, "pnpm-lock.yaml"),
    "lockfileVersion: '9.0'\nimporters:\n  .: {}\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(baseDir, "package.json"),
    JSON.stringify(
      {
        name: "acme-planetary-monorepo",
        private: true,
        workspaces: ["apps/*", "packages/*"],
        scripts: { "verify:strict": "turbo run test", test: "node --test" },
        devDependencies: { typescript: "5.8.0" }
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(path.join(baseDir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }), "utf8");

  // Frontend Web App
  fs.writeFileSync(
    path.join(baseDir, "apps", "web", "package.json"),
    JSON.stringify({ name: "@acme/web", dependencies: { next: "15.2.0", react: "19.0.0" } }, null, 2),
    "utf8"
  );
  fs.writeFileSync(path.join(baseDir, "apps", "web", "index.tsx"), "export const App = () => null;\n", "utf8");

  // Shared Core Domain Package
  fs.writeFileSync(
    path.join(baseDir, "packages", "core-domain", "package.json"),
    JSON.stringify({ name: "@acme/core-domain", devDependencies: { typescript: "5.8.0" } }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(baseDir, "packages", "core-domain", "ledger.ts"),
    "export interface Money { readonly cents: number; readonly currency: string; }\n",
    "utf8"
  );

  // Go Payment Microservice
  fs.writeFileSync(
    path.join(baseDir, "services", "payments-go", "go.mod"),
    "module github.com/acme/payments-go\n\ngo 1.24\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(baseDir, "services", "payments-go", "main.go"),
    "package main\nfunc main() {}\n",
    "utf8"
  );

  // Rust Crypto Engine Crate
  fs.writeFileSync(
    path.join(baseDir, "crates", "crypto-engine", "Cargo.toml"),
    '[package]\nname = "acme-crypto-engine"\nversion = "0.1.0"\nedition = "2021"\n',
    "utf8"
  );
  fs.writeFileSync(path.join(baseDir, "crates", "crypto-engine", "Cargo.lock"), "version = 3\n", "utf8");
  fs.writeFileSync(
    path.join(baseDir, "crates", "crypto-engine", "lib.rs"),
    "pub fn seal(input: &[u8]) -> usize { input.len() }\n",
    "utf8"
  );

  // Formal API & Schema Contracts
  fs.writeFileSync(
    path.join(baseDir, "contracts", "openapi.json"),
    JSON.stringify({ openapi: "3.1.0", info: { title: "Acme Payments API", version: "1.0.0" }, paths: {} }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(baseDir, "contracts", "settlement.proto"),
    'syntax = "proto3";\npackage acme.settlement;\nmessage SettlementEvent { string tx_id = 1; }\n',
    "utf8"
  );
  fs.writeFileSync(
    path.join(baseDir, "prisma", "schema.prisma"),
    'datasource db {\n  provider = "postgresql"\n}\nmodel Account {\n  id String @id\n}\n',
    "utf8"
  );
  fs.writeFileSync(
    path.join(baseDir, ".github", "workflows", "ci.yml"),
    "name: CI\non: [push]\njobs:\n  verify:\n    runs-on: ubuntu-latest\n",
    "utf8"
  );
}

test("BDD-138: Deep polyglot monorepo, workspace member, API contract, and supply-chain topology discovery", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ent-monorepo-"));
  try {
    buildSyntheticEnterpriseMonorepo(tmpDir);

    const topo = EosEnterpriseWorkspaceGovernor.inspectWorkspace(tmpDir);
    assert.equal(topo.archetype, "POLYGLOT_MONOREPO");
    assert.ok(topo.orchestrators.includes("turborepo"));
    assert.ok(topo.orchestrators.includes("pnpm_workspaces"));
    assert.ok(topo.orchestrators.includes("npm_workspaces"));

    assert.ok(topo.languages.includes("typescript"));
    assert.ok(topo.languages.includes("go"));
    assert.ok(topo.languages.includes("rust"));

    const memberNames = topo.members.map((m) => m.name);
    assert.ok(memberNames.includes("acme-planetary-monorepo"));
    assert.ok(memberNames.includes("@acme/web"));
    assert.ok(memberNames.includes("@acme/core-domain"));
    assert.ok(memberNames.includes("github.com/acme/payments-go"));
    assert.ok(memberNames.includes("acme-crypto-engine"));

    const contractStandards = topo.contracts.map((c) => c.standard);
    assert.ok(contractStandards.includes("openapi"));
    assert.ok(contractStandards.includes("protobuf"));
    assert.ok(contractStandards.includes("prisma"));
    assert.ok(topo.contracts.every((c) => c.validSyntax === true));

    assert.equal(topo.supplyChain.hasDeterministicLockfile, true);
    assert.equal(topo.supplyChain.secretHygieneClean, true);
    assert.equal(topo.enterpriseReadinessSignalsScore, 100);
    assert.equal(topo.sha256TopologyReceipt.length, 64);
    assert.equal(Object.isFrozen(topo), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("BDD-139: Constitutional Law IV Safe Enterprise Project Onboarding writes 0 bytes to external repo", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ent-onboard-"));
  const externalRepo = path.join(tmpRoot, "external-enterprise-app");
  const isolatedControlPlane = path.join(tmpRoot, "eos-control-plane");

  try {
    buildSyntheticEnterpriseMonorepo(externalRepo);
    fs.mkdirSync(path.join(isolatedControlPlane, "docs", "projects"), { recursive: true });

    const beforeExternalSnapshot = EosEnterpriseWorkspaceGovernor.inspectWorkspace(externalRepo).sha256TopologyReceipt;

    const onboardRes = EosEnterpriseWorkspaceGovernor.onboardWorkspace({
      targetPath: externalRepo,
      projectId: "acme-planetary",
      projectName: "Acme Planetary Platform",
      remoteUrl: "https://github.com/acme/planetary.git",
      controlPlaneRoot: isolatedControlPlane,
      dryRun: false
    });

    assert.equal(onboardRes.projectId, "acme-planetary");
    assert.equal(onboardRes.initialAuthorization, "LEVEL_1_READ_ONLY_AUDIT");
    assert.equal(onboardRes.externalBytesWritten, 0);
    assert.equal(onboardRes.registryUpdated, true);
    assert.ok(onboardRes.ledgerEntryId && onboardRes.ledgerEntryId.startsWith("EOS-LEDGER-"));
    assert.equal(onboardRes.sha256OnboardReceipt.length, 64);

    // Verify external repository received ZERO files or mutations
    const afterExternalSnapshot = EosEnterpriseWorkspaceGovernor.inspectWorkspace(externalRepo).sha256TopologyReceipt;
    assert.equal(afterExternalSnapshot, beforeExternalSnapshot);
    assert.equal(fs.existsSync(path.join(externalRepo, "docs", "intake")), false);

    // Verify all 4 governance dossiers + registry + SQLite WAL ledger exist inside isolatedControlPlane
    for (const artifact of onboardRes.generatedArtifacts) {
      assert.equal(
        fs.existsSync(path.join(isolatedControlPlane, artifact.relativeControlPlanePath)),
        true,
        `Missing control-plane artifact: ${artifact.relativeControlPlanePath}`
      );
    }

    const ledger = new EosDurableSqliteLedger(
      EosDurableSqliteLedger.defaultLedgerPath(isolatedControlPlane)
    );
    try {
      const chain = ledger.verifyChainIntegrity();
      assert.equal(chain.intact, true);
      assert.equal(chain.totalEntries, 1);
    } finally {
      ledger.close();
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("BDD-140: Multi-tenant registered fleet boundary allows READ_ONLY and blocks WRITE_GATED without Law IV LEVEL_2+", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ent-law4-"));
  const readOnlyRepo = path.join(tmpRoot, "readonly-service");
  const authorizedRepo = path.join(tmpRoot, "authorized-service");
  const controlPlane = path.join(tmpRoot, "control-plane");

  try {
    buildSyntheticEnterpriseMonorepo(readOnlyRepo);
    buildSyntheticEnterpriseMonorepo(authorizedRepo);
    fs.mkdirSync(path.join(controlPlane, "docs", "projects"), { recursive: true });

    // Onboard readOnlyRepo -> defaults to LEVEL_1_READ_ONLY_AUDIT
    EosEnterpriseWorkspaceGovernor.onboardWorkspace({
      targetPath: readOnlyRepo,
      projectId: "readonly-svc",
      controlPlaneRoot: controlPlane,
      dryRun: false
    });

    // Manually add a fully LEVEL_3_PRODUCTION_AUTHORIZED entry for authorizedRepo
    const regPath = path.join(controlPlane, "docs", "projects", "registry.json");
    const regDoc = JSON.parse(fs.readFileSync(regPath, "utf8"));
    regDoc.projects.push({
      id: "authorized-svc",
      name: "Authorized Tier-0 Service",
      localPath: authorizedRepo,
      remoteUrl: "https://github.com/acme/authorized.git",
      type: "enterprise-service",
      status: "REGISTERED",
      intake: "INTAKE_COMPLETE",
      specification: "SPECIFICATION_APPROVED",
      audit: "AUDIT_COMPLETE",
      ownerApproval: "OWNER_APPROVAL",
      authorization: "LEVEL_3_PRODUCTION_AUTHORIZED"
    });
    fs.writeFileSync(regPath, JSON.stringify(regDoc, null, 2), "utf8");

    // 1. READ_ONLY succeeds on LEVEL_1_READ_ONLY_AUDIT
    const roRes = EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace(
      "readonly-svc",
      "contracts",
      "READ_ONLY",
      controlPlane
    );
    assert.equal(roRes.writeBarrierStatus, "READ_ONLY_CONFINED");
    assert.ok(roRes.resolvedTargetPath.endsWith("contracts"));

    // 2. Path traversal (..) inside registered workspace is blocked fail-closed
    assert.throws(
      () =>
        EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace(
          "readonly-svc",
          "../../outside",
          "READ_ONLY",
          controlPlane
        ),
      /BOUNDARY_ESCAPE_BLOCKED/
    );

    // 3. WRITE_GATED on LEVEL_1_READ_ONLY_AUDIT is blocked by Law IV
    assert.throws(
      () =>
        EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace(
          "readonly-svc",
          ".",
          "WRITE_GATED",
          controlPlane
        ),
      /LAW_IV_WRITE_BARRIER_BLOCKED/
    );

    // 4. WRITE_GATED on LEVEL_3_PRODUCTION_AUTHORIZED with all 6 preconditions succeeds
    const wrRes = EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace(
      "authorized-svc",
      ".",
      "WRITE_GATED",
      controlPlane
    );
    assert.equal(wrRes.writeBarrierStatus, "AUTHORIZED");
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("BDD-141: Bounded structural verification gates pass clean enterprise workspaces and detect contract/secret faults", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ent-verify-"));
  const cleanDir = path.join(tmpRoot, "clean-enterprise");
  const faultyDir = path.join(tmpRoot, "faulty-enterprise");
  const ledgerPath = path.join(tmpRoot, "verify_ledger.sqlite");

  try {
    buildSyntheticEnterpriseMonorepo(cleanDir);
    const cleanReport = EosEnterpriseWorkspaceGovernor.verifyWorkspace(cleanDir, {
      ledgerDbPath: ledgerPath,
      projectId: "clean-enterprise"
    });
    assert.equal(cleanReport.overallPassed, true);
    assert.equal(cleanReport.epistemicState, "VERIFIED");
    assert.ok(cleanReport.recommendedCommands.some((c) => c.stack === "go"));
    assert.ok(cleanReport.recommendedCommands.some((c) => c.stack === "rust"));
    assert.ok(cleanReport.ledgerEntryId?.startsWith("EOS-LEDGER-"));

    // Create faulty workspace with malformed OpenAPI JSON + synthetic leaked GitHub PAT
    buildSyntheticEnterpriseMonorepo(faultyDir);
    fs.writeFileSync(path.join(faultyDir, "contracts", "openapi.json"), "{ broken_json: true ", "utf8");
    const syntheticToken = "ghp_" + "Z".repeat(30);
    fs.writeFileSync(path.join(faultyDir, "apps", "web", "leaked.ts"), `export const tok = "${syntheticToken}";\n`, "utf8");

    const faultyReport = EosEnterpriseWorkspaceGovernor.verifyWorkspace(faultyDir, {
      ledgerDbPath: ledgerPath,
      projectId: "faulty-enterprise"
    });
    assert.equal(faultyReport.overallPassed, false);
    assert.equal(faultyReport.epistemicState, "FINDINGS_IDENTIFIED");
    const failedGateIds = faultyReport.gates.filter((g) => !g.passed).map((g) => g.gateId);
    assert.ok(failedGateIds.includes("GATE-01-WORKSPACE-MANIFESTS"));
    assert.ok(failedGateIds.includes("GATE-02-FORMAL-CONTRACTS"));
    assert.ok(failedGateIds.includes("GATE-04-ZERO-PLAIN-SECRETS"));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("BDD-142: Unified MCP eos_enterprise_workspace dispatch in 'full' profile with MCP 2025-03-26 ToolAnnotations", () => {
  const coreServer = new EosMcpServer(projectRoot, "full");
  const listToolsRes = coreServer.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const tools = listToolsRes?.result?.tools || [];
  const entTool = tools.find((t) => t.name === "eos_enterprise_workspace");

  assert.ok(entTool, "eos_enterprise_workspace must be present in 'full' MCP profile");
  assert.equal(entTool.annotations.readOnlyHint, false);
  assert.equal(entTool.annotations.destructiveHint, false);

  const listCall = coreServer.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "eos_enterprise_workspace", arguments: { action: "list" } }
  });
  assert.ok(!listCall.error);
  const listPayload = JSON.parse(listCall.result.content[0].text);
  assert.ok(Array.isArray(listPayload.workspaces));
  assert.ok(listPayload.workspaces.some((w) => w.id === "eos-system" && w.writeAuthorizedUnderLawIV === true));

  const inspectCall = coreServer.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "eos_enterprise_workspace", arguments: { action: "inspect", projectId: "eos-system" } }
  });
  assert.ok(!inspectCall.error);
  const inspectPayload = JSON.parse(inspectCall.result.content[0].text);
  assert.equal(inspectPayload.archetype, "POLYGLOT_MONOREPO");
  assert.ok(inspectPayload.contracts.length >= 12);
  assert.equal(inspectPayload.supplyChain.secretHygieneClean, true);
});
