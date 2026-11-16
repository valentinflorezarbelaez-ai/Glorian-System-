/**
 * EOS SYSTEM — CONSUMER-DRIVEN CONTRACT TEST ENGINE TESTS
 * Tests for EosContractTestEngine (Pact / Consumer-Driven Contract pattern)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosContractTestEngine } from "../src/core/eosContractTestEngine.ts";

test("register validates consumer is required", () => {
  const engine = new EosContractTestEngine();
  assert.throws(
    () =>
      engine.register({
        consumer: "",
        provider: "api",
        description: "test",
        request: { method: "GET", path: "/" },
        response: { status: 200 },
      }),
    /consumer required/,
  );
});

test("register validates provider is required", () => {
  const engine = new EosContractTestEngine();
  assert.throws(
    () =>
      engine.register({
        consumer: "app",
        provider: "",
        description: "test",
        request: { method: "GET", path: "/" },
        response: { status: 200 },
      }),
    /provider required/,
  );
});

test("register stores contract interaction", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1, name: "Alice" } },
  });
  const contracts = engine.listContracts("api");
  assert.equal(contracts.length, 1);
  assert.equal(contracts[0].consumer, "app");
});

test("verify passes when actual matches contract", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1, name: "Alice" } },
  });
  const result = engine.verify("app", "get user", {
    method: "GET",
    path: "/users/1",
    status: 200,
    body: { id: 1, name: "Alice" },
  });
  assert.equal(result.passed, true);
  assert.equal(result.mismatches.length, 0);
  assert.equal(result.interaction, "app/get user");
});

test("verify fails when contract not found", () => {
  const engine = new EosContractTestEngine();
  const result = engine.verify("app", "missing", {
    method: "GET",
    path: "/",
    status: 200,
  });
  assert.equal(result.passed, false);
  assert.equal(result.mismatches[0], "CONTRACT_NOT_FOUND");
});

test("verify detects method mismatch", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200 },
  });
  const result = engine.verify("app", "get user", {
    method: "POST",
    path: "/users/1",
    status: 200,
  });
  assert.equal(result.passed, false);
  assert.ok(result.mismatches[0].includes("method"));
});

test("verify detects path mismatch", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200 },
  });
  const result = engine.verify("app", "get user", {
    method: "GET",
    path: "/users/2",
    status: 200,
  });
  assert.equal(result.passed, false);
  assert.ok(result.mismatches[0].includes("path"));
});

test("verify detects status mismatch", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200 },
  });
  const result = engine.verify("app", "get user", {
    method: "GET",
    path: "/users/1",
    status: 500,
  });
  assert.equal(result.passed, false);
  assert.ok(result.mismatches[0].includes("status"));
});

test("verify detects missing body field", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1, name: "Alice", email: "a@b.com" } },
  });
  const result = engine.verify("app", "get user", {
    method: "GET",
    path: "/users/1",
    status: 200,
    body: { id: 1, name: "Alice" },
  });
  assert.equal(result.passed, false);
  assert.ok(result.mismatches.some((m) => m.includes("email")));
});

test("verify detects body field type drift", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1, name: "Alice" } },
  });
  const result = engine.verify("app", "get user", {
    method: "GET",
    path: "/users/1",
    status: 200,
    body: { id: "1", name: "Alice" },
  });
  assert.equal(result.passed, false);
  assert.ok(result.mismatches.some((m) => m.includes("type")));
});

test("verify allows additional fields in actual response", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1 } },
  });
  const result = engine.verify("app", "get user", {
    method: "GET",
    path: "/users/1",
    status: 200,
    body: { id: 1, name: "Alice", extra: "field" },
  });
  assert.equal(result.passed, true);
});

test("checkCompatibility returns compatible when no breaking changes", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1, name: "Alice" } },
  });
  const result = engine.checkCompatibility("api", { id: "number", name: "string" });
  assert.equal(result.compatible, true);
  assert.equal(result.breakingChanges.length, 0);
});

test("checkCompatibility detects removed field as breaking", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1, name: "Alice" } },
  });
  const result = engine.checkCompatibility("api", { id: "number" });
  assert.equal(result.compatible, false);
  assert.ok(result.breakingChanges.some((b) => b.includes("removed")));
});

test("checkCompatibility detects type drift as breaking", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1, name: "Alice" } },
  });
  const result = engine.checkCompatibility("api", { id: "string", name: "string" });
  assert.equal(result.compatible, false);
  assert.ok(result.breakingChanges.some((b) => b.includes("type drift")));
});

test("checkCompatibility allows added fields", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1 } },
  });
  const result = engine.checkCompatibility("api", { id: "number", name: "string", email: "string" });
  assert.equal(result.compatible, true);
});

test("listContracts filters by provider", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api1",
    description: "get user",
    request: { method: "GET", path: "/" },
    response: { status: 200 },
  });
  engine.register({
    consumer: "app",
    provider: "api2",
    description: "get item",
    request: { method: "GET", path: "/" },
    response: { status: 200 },
  });
  assert.equal(engine.listContracts("api1").length, 1);
  assert.equal(engine.listContracts("api2").length, 1);
  assert.equal(engine.listContracts().length, 2);
});

test("contractDigest is deterministic", () => {
  const engine1 = new EosContractTestEngine();
  const engine2 = new EosContractTestEngine();
  const interaction = {
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/users/1" },
    response: { status: 200, body: { id: 1 } },
  };
  engine1.register(interaction);
  engine2.register(interaction);
  assert.equal(engine1.contractDigest(), engine2.contractDigest());
  assert.ok(engine1.contractDigest().length === 64);
});

test("contractDigest is empty hash when no contracts", () => {
  const engine = new EosContractTestEngine();
  const digest = engine.contractDigest();
  assert.ok(digest.length === 64);
});

test("verify result is frozen", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "GET", path: "/" },
    response: { status: 200 },
  });
  const result = engine.verify("app", "get user", {
    method: "GET",
    path: "/",
    status: 200,
  });
  assert.throws(() => {
    result.passed = false;
  }, TypeError);
});

test("method comparison is case insensitive", () => {
  const engine = new EosContractTestEngine();
  engine.register({
    consumer: "app",
    provider: "api",
    description: "get user",
    request: { method: "get", path: "/" },
    response: { status: 200 },
  });
  const result = engine.verify("app", "get user", {
    method: "GET",
    path: "/",
    status: 200,
  });
  assert.equal(result.passed, true);
});
