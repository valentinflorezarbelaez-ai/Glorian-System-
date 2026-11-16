/**
 * EOS SYSTEM — ERROR CATALOG TESTS
 * Tests for error classes hierarchy, EOS_ERROR_CODES catalog, and error properties
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EosFleetError,
  EosFleetPathNotFoundError,
  EosFleetGitError,
  EosPipelineError,
  EosSecretLeakError,
  EosArchitectureViolationError,
  EosCircularDependencyError,
  EosHealingError,
  EOS_ERROR_CODES,
} from "../src/core/eosErrorCatalog.ts";

// ============================================================================
// EOS_ERROR_CODES catalog
// ============================================================================

test("EOS_ERROR_CODES has 10 entries", () => {
  const codes = Object.keys(EOS_ERROR_CODES);
  assert.equal(codes.length, 10);
});

test("EOS_ERROR_CODES is frozen", () => {
  assert.throws(() => {
    Object.defineProperty(EOS_ERROR_CODES, "NEW_CODE", { value: "test" });
  });
});

test("EOS_ERROR_CODES includes EOS_FLEET_001", () => {
  assert.equal(EOS_ERROR_CODES.EOS_FLEET_001, "Fleet operation failed");
});

test("EOS_ERROR_CODES includes EOS_FLEET_002", () => {
  assert.equal(EOS_ERROR_CODES.EOS_FLEET_002, "Fleet project local path not found");
});

test("EOS_ERROR_CODES includes EOS_FLEET_003", () => {
  assert.equal(EOS_ERROR_CODES.EOS_FLEET_003, "Fleet git status check failed");
});

test("EOS_ERROR_CODES includes EOS_PIPELINE_001", () => {
  assert.equal(EOS_ERROR_CODES.EOS_PIPELINE_001, "CI/CD pipeline stage failed");
});

test("EOS_ERROR_CODES includes EOS_PIPELINE_002", () => {
  assert.equal(EOS_ERROR_CODES.EOS_PIPELINE_002, "Plaintext secret detected — Law VI violation");
});

test("EOS_ERROR_CODES includes EOS_ARCH_001", () => {
  assert.equal(EOS_ERROR_CODES.EOS_ARCH_001, "Hexagonal architecture invariant violated");
});

test("EOS_ERROR_CODES includes EOS_ARCH_002", () => {
  assert.equal(EOS_ERROR_CODES.EOS_ARCH_002, "Circular import dependency cycle detected");
});

test("EOS_ERROR_CODES includes EOS_HEAL_001", () => {
  assert.equal(EOS_ERROR_CODES.EOS_HEAL_001, "Autonomous healing operation failed");
});

test("EOS_ERROR_CODES includes MCP codes", () => {
  assert.ok("EOS_MCP_TOOL_NOT_FOUND" in EOS_ERROR_CODES);
  assert.ok("EOS_MCP_TOOL_EXECUTION_ERROR" in EOS_ERROR_CODES);
});

// ============================================================================
// EosFleetError
// ============================================================================

test("EosFleetError extends Error", () => {
  const err = new EosFleetError("test message");
  assert.ok(err instanceof Error);
});

test("EosFleetError has correct name", () => {
  const err = new EosFleetError("test message");
  assert.equal(err.name, "EosFleetError");
});

test("EosFleetError has code EOS_FLEET_001", () => {
  const err = new EosFleetError("test message");
  assert.equal(err.code, "EOS_FLEET_001");
});

test("EosFleetError stores message", () => {
  const err = new EosFleetError("Workspace scan timed out");
  assert.equal(err.message, "Workspace scan timed out");
});

test("EosFleetError stores optional projectId", () => {
  const err = new EosFleetError("test", "my-project");
  assert.equal(err.projectId, "my-project");
});

test("EosFleetError projectId is undefined when not provided", () => {
  const err = new EosFleetError("test");
  assert.equal(err.projectId, undefined);
});

// ============================================================================
// EosFleetPathNotFoundError
// ============================================================================

test("EosFleetPathNotFoundError extends EosFleetError", () => {
  const err = new EosFleetPathNotFoundError("proj-1", "/path/to/repo");
  assert.ok(err instanceof EosFleetError);
  assert.ok(err instanceof Error);
});

test("EosFleetPathNotFoundError has correct name", () => {
  const err = new EosFleetPathNotFoundError("proj-1", "/path/to/repo");
  assert.equal(err.name, "EosFleetPathNotFoundError");
});

test("EosFleetPathNotFoundError has code EOS_FLEET_002", () => {
  const err = new EosFleetPathNotFoundError("proj-1", "/path/to/repo");
  assert.equal(err.code, "EOS_FLEET_002");
});

test("EosFleetPathNotFoundError stores localPath", () => {
  const err = new EosFleetPathNotFoundError("proj-1", "/path/to/repo");
  assert.equal(err.localPath, "/path/to/repo");
});

test("EosFleetPathNotFoundError message includes projectId and path", () => {
  const err = new EosFleetPathNotFoundError("proj-1", "/path/to/repo");
  assert.ok(err.message.includes("proj-1"));
  assert.ok(err.message.includes("/path/to/repo"));
});

test("EosFleetPathNotFoundError inherits projectId from base", () => {
  const err = new EosFleetPathNotFoundError("proj-1", "/path/to/repo");
  assert.equal(err.projectId, "proj-1");
});

// ============================================================================
// EosFleetGitError
// ============================================================================

test("EosFleetGitError extends EosFleetError", () => {
  const err = new EosFleetGitError("proj-1", "not a git repository");
  assert.ok(err instanceof EosFleetError);
});

test("EosFleetGitError has correct name", () => {
  const err = new EosFleetGitError("proj-1", "not a git repository");
  assert.equal(err.name, "EosFleetGitError");
});

test("EosFleetGitError has code EOS_FLEET_003", () => {
  const err = new EosFleetGitError("proj-1", "not a git repository");
  assert.equal(err.code, "EOS_FLEET_003");
});

test("EosFleetGitError stores gitError", () => {
  const err = new EosFleetGitError("proj-1", "fatal: not a git repo");
  assert.equal(err.gitError, "fatal: not a git repo");
});

test("EosFleetGitError message includes git error", () => {
  const err = new EosFleetGitError("proj-1", "fatal: not a git repo");
  assert.ok(err.message.includes("fatal: not a git repo"));
});

// ============================================================================
// EosPipelineError
// ============================================================================

test("EosPipelineError extends Error", () => {
  const err = new EosPipelineError("test message");
  assert.ok(err instanceof Error);
});

test("EosPipelineError has correct name", () => {
  const err = new EosPipelineError("test message");
  assert.equal(err.name, "EosPipelineError");
});

test("EosPipelineError has code EOS_PIPELINE_001", () => {
  const err = new EosPipelineError("test message");
  assert.equal(err.code, "EOS_PIPELINE_001");
});

test("EosPipelineError stores optional stage", () => {
  const err = new EosPipelineError("test", "lint");
  assert.equal(err.stage, "lint");
});

test("EosPipelineError stage is undefined when not provided", () => {
  const err = new EosPipelineError("test");
  assert.equal(err.stage, undefined);
});

// ============================================================================
// EosSecretLeakError
// ============================================================================

test("EosSecretLeakError extends EosPipelineError", () => {
  const err = new EosSecretLeakError("src/config.ts", "AWS_SECRET_KEY");
  assert.ok(err instanceof EosPipelineError);
  assert.ok(err instanceof Error);
});

test("EosSecretLeakError has correct name", () => {
  const err = new EosSecretLeakError("src/config.ts", "AWS_SECRET_KEY");
  assert.equal(err.name, "EosSecretLeakError");
});

test("EosSecretLeakError has code EOS_PIPELINE_002", () => {
  const err = new EosSecretLeakError("src/config.ts", "AWS_SECRET_KEY");
  assert.equal(err.code, "EOS_PIPELINE_002");
});

test("EosSecretLeakError stores filePath", () => {
  const err = new EosSecretLeakError("src/config.ts", "AWS_SECRET_KEY");
  assert.equal(err.filePath, "src/config.ts");
});

test("EosSecretLeakError stores secretType", () => {
  const err = new EosSecretLeakError("src/config.ts", "AWS_SECRET_KEY");
  assert.equal(err.secretType, "AWS_SECRET_KEY");
});

test("EosSecretLeakError message includes Law VI violation", () => {
  const err = new EosSecretLeakError("src/config.ts", "AWS_SECRET_KEY");
  assert.ok(err.message.includes("Law VI violation"));
});

test("EosSecretLeakError stage is set to secret-scan", () => {
  const err = new EosSecretLeakError("src/config.ts", "AWS_SECRET_KEY");
  assert.equal(err.stage, "secret-scan");
});

// ============================================================================
// EosArchitectureViolationError
// ============================================================================

test("EosArchitectureViolationError extends Error", () => {
  const err = new EosArchitectureViolationError("test message");
  assert.ok(err instanceof Error);
});

test("EosArchitectureViolationError has correct name", () => {
  const err = new EosArchitectureViolationError("test message");
  assert.equal(err.name, "EosArchitectureViolationError");
});

test("EosArchitectureViolationError has code EOS_ARCH_001", () => {
  const err = new EosArchitectureViolationError("test message");
  assert.equal(err.code, "EOS_ARCH_001");
});

test("EosArchitectureViolationError stores optional file", () => {
  const err = new EosArchitectureViolationError("test", "src/core/module.ts");
  assert.equal(err.file, "src/core/module.ts");
});

test("EosArchitectureViolationError stores optional rule", () => {
  const err = new EosArchitectureViolationError("test", "file.ts", "no-upward-import");
  assert.equal(err.rule, "no-upward-import");
});

test("EosArchitectureViolationError file and rule are undefined when not provided", () => {
  const err = new EosArchitectureViolationError("test");
  assert.equal(err.file, undefined);
  assert.equal(err.rule, undefined);
});

// ============================================================================
// EosCircularDependencyError
// ============================================================================

test("EosCircularDependencyError extends EosArchitectureViolationError", () => {
  const cycle = ["a.ts", "b.ts", "a.ts"];
  const err = new EosCircularDependencyError(cycle);
  assert.ok(err instanceof EosArchitectureViolationError);
  assert.ok(err instanceof Error);
});

test("EosCircularDependencyError has correct name", () => {
  const err = new EosCircularDependencyError(["a.ts", "b.ts", "a.ts"]);
  assert.equal(err.name, "EosCircularDependencyError");
});

test("EosCircularDependencyError has code EOS_ARCH_002", () => {
  const err = new EosCircularDependencyError(["a.ts", "b.ts", "a.ts"]);
  assert.equal(err.code, "EOS_ARCH_002");
});

test("EosCircularDependencyError stores cycle array", () => {
  const cycle = ["a.ts", "b.ts", "c.ts", "a.ts"];
  const err = new EosCircularDependencyError(cycle);
  assert.deepEqual(err.cycle, cycle);
});

test("EosCircularDependencyError message includes cycle path", () => {
  const err = new EosCircularDependencyError(["a.ts", "b.ts", "a.ts"]);
  assert.ok(err.message.includes("a.ts"));
  assert.ok(err.message.includes("b.ts"));
});

test("EosCircularDependencyError sets file to first cycle element", () => {
  const err = new EosCircularDependencyError(["a.ts", "b.ts", "a.ts"]);
  assert.equal(err.file, "a.ts");
});

test("EosCircularDependencyError sets rule to no-circular-imports", () => {
  const err = new EosCircularDependencyError(["a.ts", "b.ts", "a.ts"]);
  assert.equal(err.rule, "no-circular-imports");
});

// ============================================================================
// EosHealingError
// ============================================================================

test("EosHealingError extends Error", () => {
  const err = new EosHealingError("test message");
  assert.ok(err instanceof Error);
});

test("EosHealingError has correct name", () => {
  const err = new EosHealingError("test message");
  assert.equal(err.name, "EosHealingError");
});

test("EosHealingError has code EOS_HEAL_001", () => {
  const err = new EosHealingError("test message");
  assert.equal(err.code, "EOS_HEAL_001");
});

test("EosHealingError stores optional targetFile", () => {
  const err = new EosHealingError("Patch conflict", "src/api/fleet.ts");
  assert.equal(err.targetFile, "src/api/fleet.ts");
});

test("EosHealingError targetFile is undefined when not provided", () => {
  const err = new EosHealingError("test");
  assert.equal(err.targetFile, undefined);
});

// ============================================================================
// Error hierarchy — instanceof chain
// ============================================================================

test("EosFleetPathNotFoundError instanceof chain is correct", () => {
  const err = new EosFleetPathNotFoundError("proj", "/path");
  assert.ok(err instanceof EosFleetPathNotFoundError);
  assert.ok(err instanceof EosFleetError);
  assert.ok(err instanceof Error);
});

test("EosFleetGitError instanceof chain is correct", () => {
  const err = new EosFleetGitError("proj", "error");
  assert.ok(err instanceof EosFleetGitError);
  assert.ok(err instanceof EosFleetError);
  assert.ok(err instanceof Error);
});

test("EosSecretLeakError instanceof chain is correct", () => {
  const err = new EosSecretLeakError("file.ts", "SECRET");
  assert.ok(err instanceof EosSecretLeakError);
  assert.ok(err instanceof EosPipelineError);
  assert.ok(err instanceof Error);
});

test("EosCircularDependencyError instanceof chain is correct", () => {
  const err = new EosCircularDependencyError(["a.ts", "b.ts", "a.ts"]);
  assert.ok(err instanceof EosCircularDependencyError);
  assert.ok(err instanceof EosArchitectureViolationError);
  assert.ok(err instanceof Error);
});

// ============================================================================
// Error codes match catalog
// ============================================================================

test("All error instance codes exist in EOS_ERROR_CODES", () => {
  const errors = [
    new EosFleetError("test"),
    new EosFleetPathNotFoundError("proj", "/path"),
    new EosFleetGitError("proj", "err"),
    new EosPipelineError("test"),
    new EosSecretLeakError("file.ts", "SECRET"),
    new EosArchitectureViolationError("test"),
    new EosCircularDependencyError(["a.ts", "b.ts", "a.ts"]),
    new EosHealingError("test"),
  ];
  for (const err of errors) {
    assert.ok(err.code in EOS_ERROR_CODES, `Code ${err.code} not in catalog`);
  }
});
