/**
 * EOS SYSTEM — ISSUE TO PR CANARY BRIDGE CORE TESTS
 * Tests for parseIssuePayload, analyzeDiffAndMigrationSafety, compileCanaryAndRollbackPlan
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosIssueToPrCanaryBridgeCore } from "../src/core/eosIssueToPrCanaryBridgeCore.ts";

// ============================================================================
// parseIssuePayload
// ============================================================================

test("parseIssuePayload returns CanonicalIssueDescriptor with all fields", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
    ticketId: "TEST-001",
    title: "Fix login bug",
    description: "Fix the login flow",
  });
  assert.ok(result.ticketId);
  assert.ok(result.sourceSystem);
  assert.ok(result.title);
  assert.ok(result.description);
  assert.ok(Array.isArray(result.acceptanceCriteria));
  assert.ok(result.priority);
  assert.ok(typeof result.slaHours === "number");
  assert.ok(Array.isArray(result.affectedComponents));
  assert.ok(result.suggestedTrack);
  assert.ok(result.issueDigestSha256);
});

test("parseIssuePayload normalizeTicketId from ticketId field", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ ticketId: "PROJ-123" });
  assert.equal(result.ticketId, "PROJ-123");
});

test("parseIssuePayload normalizeTicketId from key field", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ key: "LINE-456" });
  assert.equal(result.ticketId, "LINE-456");
});

test("parseIssuePayload normalizeTicketId from identifier field", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ identifier: "JIRA-789" });
  assert.equal(result.ticketId, "JIRA-789");
});

test("parseIssuePayload normalizeTicketId from number field", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ number: 42 });
  assert.equal(result.ticketId, "GH-42");
});

test("parseIssuePayload normalizeTicketId default TICKET-000", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({});
  assert.equal(result.ticketId, "TICKET-000");
});

test("parseIssuePayload normalizeTicketId trims and slices at 64 chars", () => {
  const long = "A".repeat(100);
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ ticketId: `  ${long}  ` });
  assert.equal(result.ticketId.length, 64);
});

test("parseIssuePayload normalizePriority P0/BLOCKER", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "P0" });
  assert.equal(result.priority, "P0");
});

test("parseIssuePayload normalizePriority BLOCKER keyword", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "BLOCKER" });
  assert.equal(result.priority, "P0");
});

test("parseIssuePayload normalizePriority SEV0", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "SEV0" });
  assert.equal(result.priority, "P0");
});

test("parseIssuePayload normalizePriority P1/CRITICAL", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "P1" });
  assert.equal(result.priority, "P1");
});

test("parseIssuePayload normalizePriority CRITICAL keyword", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "CRITICAL" });
  assert.equal(result.priority, "P1");
});

test("parseIssuePayload normalizePriority HIGH keyword", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "HIGH" });
  assert.equal(result.priority, "P1");
});

test("parseIssuePayload normalizePriority P2/medium default", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "medium" });
  assert.equal(result.priority, "P2");
});

test("parseIssuePayload normalizePriority P3/LOW", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "P3" });
  assert.equal(result.priority, "P3");
});

test("parseIssuePayload normalizePriority LOW keyword", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "LOW" });
  assert.equal(result.priority, "P3");
});

test("parseIssuePayload normalizePriority unknown defaults to P2", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "UNKNOWN" });
  assert.equal(result.priority, "P2");
});

test("parseIssuePayload normalizePriority undefined defaults to P2", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({});
  assert.equal(result.priority, "P2");
});

test("parseIssuePayload PRIORITY_SLA_MAP P0=4h", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "P0" });
  assert.equal(result.slaHours, 4);
});

test("parseIssuePayload PRIORITY_SLA_MAP P1=24h", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "P1" });
  assert.equal(result.slaHours, 24);
});

test("parseIssuePayload PRIORITY_SLA_MAP P2=72h", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "P2" });
  assert.equal(result.slaHours, 72);
});

test("parseIssuePayload PRIORITY_SLA_MAP P3=168h", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "P3" });
  assert.equal(result.slaHours, 168);
});

test("parseIssuePayload extractChecklistCriteria explicit array", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
    description: "No list here",
    acceptanceCriteria: ["Criterion 1", "Criterion 2"],
  });
  assert.equal(result.acceptanceCriteria.length, 2);
  assert.equal(result.acceptanceCriteria[0], "Criterion 1");
});

test("parseIssuePayload extractChecklistCriteria markdown bullets", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
    description: "- First item\n- Second item\n- Third item",
  });
  assert.ok(result.acceptanceCriteria.length >= 2);
});

test("parseIssuePayload extractChecklistCriteria numbered list", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
    description: "1. Step one\n2. Step two",
  });
  assert.ok(result.acceptanceCriteria.length >= 2);
});

test("parseIssuePayload extractChecklistCriteria default when no list", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
    description: "Just a plain description text",
  });
  assert.equal(result.acceptanceCriteria.length, 1);
  assert.ok(result.acceptanceCriteria[0].includes("unit and integration tests"));
});

test("parseIssuePayload classifyIssueTrack P0→HEAVY", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "P0" });
  assert.equal(result.suggestedTrack, "HEAVY_TRACK_SDD");
});

test("parseIssuePayload classifyIssueTrack P1→HEAVY", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ priority: "P1" });
  assert.equal(result.suggestedTrack, "HEAVY_TRACK_SDD");
});

test("parseIssuePayload classifyIssueTrack migration keyword→HEAVY", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
    priority: "P2",
    title: "Database migration",
  });
  assert.equal(result.suggestedTrack, "HEAVY_TRACK_SDD");
});

test("parseIssuePayload classifyIssueTrack default→FAST", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
    priority: "P2",
    title: "Update CSS colors",
    description: "Change button colors",
  });
  assert.equal(result.suggestedTrack, "FAST_TRACK_TDD");
});

test("parseIssuePayload sourceSystem defaults to manual", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({});
  assert.equal(result.sourceSystem, "manual");
});

test("parseIssuePayload sourceSystem from input", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ sourceSystem: "github" });
  assert.equal(result.sourceSystem, "github");
});

test("parseIssuePayload title from summary fallback", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ summary: "Fallback title" });
  assert.equal(result.title, "Fallback title");
});

test("parseIssuePayload title defaults to Untitled", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({});
  assert.equal(result.title, "Untitled engineering task");
});

test("parseIssuePayload description from body fallback", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ body: "Body text" });
  assert.equal(result.description, "Body text");
});

test("parseIssuePayload affectedComponents merges components and labels", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
    components: ["auth"],
    labels: ["frontend"],
  });
  assert.ok(result.affectedComponents.includes("auth"));
  assert.ok(result.affectedComponents.includes("frontend"));
});

test("parseIssuePayload issueDigestSha256 is 64 hex chars", () => {
  const result = EosIssueToPrCanaryBridgeCore.parseIssuePayload({ ticketId: "TEST-001" });
  assert.equal(result.issueDigestSha256.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(result.issueDigestSha256));
});

test("parseIssuePayload issueDigestSha256 is deterministic", () => {
  const input = { ticketId: "TEST-001", title: "Fix", description: "Desc" };
  const r1 = EosIssueToPrCanaryBridgeCore.parseIssuePayload(input);
  const r2 = EosIssueToPrCanaryBridgeCore.parseIssuePayload(input);
  assert.equal(r1.issueDigestSha256, r2.issueDigestSha256);
});

// ============================================================================
// analyzeDiffAndMigrationSafety
// ============================================================================

test("analyzeDiffAndMigrationSafety returns report with all fields", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({ changedFiles: [] });
  assert.ok(Array.isArray(result.touchedLayers));
  assert.ok(typeof result.beyonceRuleSatisfied === "boolean");
  assert.ok(result.migrationPattern);
  assert.ok(Array.isArray(result.unsafeDdlStatements));
  assert.ok(typeof result.blastRadiusScore === "number");
  assert.ok(Array.isArray(result.blockingRisks));
  assert.ok(result.diffDigestSha256);
});

test("analyzeDiffAndMigrationSafety empty files returns no layers", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({ changedFiles: [] });
  assert.equal(result.touchedLayers.length, 0);
  assert.equal(result.beyonceRuleSatisfied, true);
});

test("analyzeDiffAndMigrationSafety classifyFileLayer Tests", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "src/test/module.test.mjs" }],
  });
  assert.ok(result.touchedLayers.includes("Tests"));
});

test("analyzeDiffAndMigrationSafety classifyFileLayer DatabaseMigration", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "db/migration/001.sql" }],
  });
  assert.ok(result.touchedLayers.includes("DatabaseMigration"));
});

test("analyzeDiffAndMigrationSafety classifyFileLayer Documentation", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "docs/README.md" }],
  });
  assert.ok(result.touchedLayers.includes("Documentation"));
});

test("analyzeDiffAndMigrationSafety classifyFileLayer Domain", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "src/core/domain/model.ts" }],
  });
  assert.ok(result.touchedLayers.includes("Domain"));
});

test("analyzeDiffAndMigrationSafety classifyFileLayer Application", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "src/application/usecase.ts" }],
  });
  assert.ok(result.touchedLayers.includes("Application"));
});

test("analyzeDiffAndMigrationSafety classifyFileLayer Presentation", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "src/ui/component.tsx" }],
  });
  assert.ok(result.touchedLayers.includes("Presentation"));
});

test("analyzeDiffAndMigrationSafety classifyFileLayer Infrastructure default", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "infra/docker-compose.yml" }],
  });
  assert.ok(result.touchedLayers.includes("Infrastructure"));
});

test("analyzeDiffAndMigrationSafety Beyonce Rule satisfied with tests", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "src/core/module.ts" }, { path: "test/module.test.mjs" }],
  });
  assert.equal(result.beyonceRuleSatisfied, true);
});

test("analyzeDiffAndMigrationSafety Beyonce Rule violation: prod without tests", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "src/core/module.ts" }],
  });
  assert.equal(result.beyonceRuleSatisfied, false);
  assert.ok(result.blockingRisks.some((r) => r.includes("Beyonce Rule")));
});

test("analyzeDiffAndMigrationSafety Beyonce Rule satisfied: tests only", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "test/module.test.mjs" }],
  });
  assert.equal(result.beyonceRuleSatisfied, true);
});

test("analyzeDiffAndMigrationSafety detectUnsafeDdl DROP TABLE", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "db/migration.sql" }],
    sqlMigrationSnippet: "DROP TABLE users;",
  });
  assert.equal(result.migrationPattern, "UNSAFE_BREAKING_DDL");
  assert.ok(result.unsafeDdlStatements.some((s) => s.includes("DROP")));
});

test("analyzeDiffAndMigrationSafety detectUnsafeDdl TRUNCATE", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "db/migration.sql" }],
    sqlMigrationSnippet: "TRUNCATE TABLE logs;",
  });
  assert.equal(result.migrationPattern, "UNSAFE_BREAKING_DDL");
  assert.ok(result.unsafeDdlStatements.some((s) => s.includes("TRUNCATE")));
});

test("analyzeDiffAndMigrationSafety detectUnsafeDdl ADD COLUMN NOT NULL without DEFAULT", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "db/migration.sql" }],
    sqlMigrationSnippet: "ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL;",
  });
  assert.equal(result.migrationPattern, "UNSAFE_BREAKING_DDL");
  assert.ok(result.unsafeDdlStatements.some((s) => s.includes("ADD COLUMN")));
});

test("analyzeDiffAndMigrationSafety safe DDL with DEFAULT", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "db/migration.sql" }],
    sqlMigrationSnippet: "ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT 'unknown';",
  });
  assert.equal(result.migrationPattern, "SAFE_EXPAND_AND_CONTRACT");
});

test("analyzeDiffAndMigrationSafety empty SQL returns NONE", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [],
    sqlMigrationSnippet: "",
  });
  assert.equal(result.migrationPattern, "NONE");
});

test("analyzeDiffAndMigrationSafety computeBlastRadius increases with files", () => {
  const r1 = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "src/core/a.ts" }],
  });
  const r2 = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "src/core/a.ts" }, { path: "src/core/b.ts" }, { path: "src/core/c.ts" }],
  });
  assert.ok(r2.blastRadiusScore > r1.blastRadiusScore);
});

test("analyzeDiffAndMigrationSafety computeBlastRadius capped at 100", () => {
  const files = Array.from({ length: 50 }, (_, i) => ({
    path: `src/core/file${i}.ts`,
    additions: 100,
    deletions: 50,
  }));
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({ changedFiles: files });
  assert.ok(result.blastRadiusScore <= 100);
});

test("analyzeDiffAndMigrationSafety blockingRisks includes unsafe DDL", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [{ path: "db/migration.sql" }],
    sqlMigrationSnippet: "DROP TABLE users;",
  });
  assert.ok(result.blockingRisks.some((r) => r.includes("Unsafe breaking DDL")));
});

test("analyzeDiffAndMigrationSafety diffDigestSha256 is 64 hex chars", () => {
  const result = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({ changedFiles: [] });
  assert.equal(result.diffDigestSha256.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(result.diffDigestSha256));
});

// ============================================================================
// compileCanaryAndRollbackPlan
// ============================================================================

test("compileCanaryAndRollbackPlan returns plan with all fields", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  assert.ok(result.ticketId);
  assert.ok(result.featureFlagKey);
  assert.ok(Array.isArray(result.stages));
  assert.ok(result.sloGuardrails);
  assert.ok(result.killSwitchCommands);
  assert.ok(result.blamelessPostmortemTemplate);
  assert.ok(result.planDigestSha256);
});

test("compileCanaryAndRollbackPlan has 4 stages", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  assert.equal(result.stages.length, 4);
});

test("compileCanaryAndRollbackPlan stage CANARY_1 at 1%", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  const stage = result.stages.find((s) => s.stageName === "CANARY_1");
  assert.ok(stage !== undefined);
  assert.equal(stage.trafficPercent, 1);
  assert.equal(stage.soakMinutes, 15);
});

test("compileCanaryAndRollbackPlan stage CANARY_10 at 10%", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  const stage = result.stages.find((s) => s.stageName === "CANARY_10");
  assert.ok(stage !== undefined);
  assert.equal(stage.trafficPercent, 10);
  assert.equal(stage.soakMinutes, 30);
});

test("compileCanaryAndRollbackPlan stage CANARY_50 at 50%", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  const stage = result.stages.find((s) => s.stageName === "CANARY_50");
  assert.ok(stage !== undefined);
  assert.equal(stage.trafficPercent, 50);
  assert.equal(stage.soakMinutes, 60);
});

test("compileCanaryAndRollbackPlan stage GENERAL_AVAILABILITY at 100%", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  const stage = result.stages.find((s) => s.stageName === "GENERAL_AVAILABILITY");
  assert.ok(stage !== undefined);
  assert.equal(stage.trafficPercent, 100);
  assert.equal(stage.soakMinutes, 120);
});

test("compileCanaryAndRollbackPlan SLO guardrails defaults", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  assert.equal(result.sloGuardrails.maxErrorRateDeltaPercent, 0.5);
  assert.equal(result.sloGuardrails.maxLatencyP99Ms, 250);
});

test("compileCanaryAndRollbackPlan custom SLO guardrails", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
    maxErrorRateDeltaPercent: 1.0,
    maxLatencyP99Ms: 500,
  });
  assert.equal(result.sloGuardrails.maxErrorRateDeltaPercent, 1.0);
  assert.equal(result.sloGuardrails.maxLatencyP99Ms, 500);
});

test("compileCanaryAndRollbackPlan autoRollbackCondition includes SLO values", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
    maxErrorRateDeltaPercent: 2.5,
    maxLatencyP99Ms: 300,
  });
  const canary1 = result.stages.find((s) => s.stageName === "CANARY_1");
  assert.ok(canary1 !== undefined);
  assert.ok(canary1.autoRollbackCondition.includes("2.5"));
  const canary10 = result.stages.find((s) => s.stageName === "CANARY_10");
  assert.ok(canary10 !== undefined);
  assert.ok(canary10.autoRollbackCondition.includes("300"));
});

test("compileCanaryAndRollbackPlan killSwitchCommands includes feature flag", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-login",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  assert.ok(result.killSwitchCommands.disableFeatureFlagCmd.includes("new-login"));
  assert.ok(result.killSwitchCommands.disableFeatureFlagCmd.includes("TEST-001"));
});

test("compileCanaryAndRollbackPlan killSwitchCommands includes workflowId", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-456",
    approvalDiffSha256: "sha-abc",
  });
  assert.ok(result.killSwitchCommands.gitRevertBranchCmd.includes("wf-456"));
  assert.ok(result.killSwitchCommands.worktreeCleanupCmd.includes("wf-456"));
});

test("compileCanaryAndRollbackPlan blamelessPostmortemTemplate includes ticketId", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "PROJ-789",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  assert.ok(result.blamelessPostmortemTemplate.includes("PROJ-789"));
});

test("compileCanaryAndRollbackPlan blamelessPostmortemTemplate includes feature flag", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "dark-launch",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  assert.ok(result.blamelessPostmortemTemplate.includes("dark-launch"));
});

test("compileCanaryAndRollbackPlan blamelessPostmortemTemplate includes guardrail section", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  assert.ok(result.blamelessPostmortemTemplate.includes("Permanent Guardrail"));
});

test("compileCanaryAndRollbackPlan planDigestSha256 is 64 hex chars", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  assert.equal(result.planDigestSha256.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(result.planDigestSha256));
});

test("compileCanaryAndRollbackPlan planDigestSha256 is deterministic", () => {
  const input = {
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  };
  const r1 = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan(input);
  const r2 = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan(input);
  assert.equal(r1.planDigestSha256, r2.planDigestSha256);
});

test("compileCanaryAndRollbackPlan GENERAL_AVAILABILITY rollback condition", () => {
  const result = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "TEST-001",
    featureFlagKey: "new-feature",
    workflowId: "wf-123",
    approvalDiffSha256: "abc123",
  });
  const stage = result.stages.find((s) => s.stageName === "GENERAL_AVAILABILITY");
  assert.ok(stage !== undefined);
  assert.ok(stage.autoRollbackCondition.includes("sloBurnRate"));
});
