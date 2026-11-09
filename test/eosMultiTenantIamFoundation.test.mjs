/**
 * SPEC-184 Multi-Tenant IAM Foundation hermetic gates.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { EosMultiTenantIamFoundation, evaluateIamAccess } from "../src/core/eosMultiTenantIamFoundation.ts";

test("BDD-IAM-001: cross-tenant access fail-closed", () => {
  const decision = evaluateIamAccess(
    {
      principal: { subjectId: "u1", tenantId: "tenant-a", roles: ["engineer"] },
      action: "read",
      resource: { resourceId: "ledger/demo", tenantId: "tenant-b" },
    },
    [
      {
        id: "pol-a",
        tenantId: "tenant-a",
        roles: ["engineer"],
        actions: ["read"],
      },
    ],
  );
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "DENY_TENANT_MISMATCH");
  assert.equal(decision.sha256Receipt.length, 64);
});

test("BDD-IAM-002: matching policy allows action", () => {
  const iam = new EosMultiTenantIamFoundation();
  iam.registerPolicy({
    id: "pol-ledger-read",
    tenantId: "tenant-t",
    roles: ["engineer"],
    actions: ["read"],
    resourcePrefix: "ledger/",
  });
  const decision = iam.evaluate({
    principal: { subjectId: "eng-1", tenantId: "tenant-t", roles: ["engineer"] },
    action: "read",
    resource: { resourceId: "ledger/demo", tenantId: "tenant-t" },
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.code, "ALLOW");
  assert.equal(decision.matchedPolicyId, "pol-ledger-read");
});

test("BDD-IAM-003: missing tenant policy denies", () => {
  const decision = evaluateIamAccess(
    {
      principal: { subjectId: "u1", tenantId: "orphan", roles: ["admin"] },
      action: "write",
      resource: { resourceId: "x", tenantId: "orphan" },
    },
    [],
  );
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "DENY_NO_POLICY");
});

test("BDD-928: malformed roles fail-closed without throwing", () => {
  const decision = evaluateIamAccess(
    {
      principal: { subjectId: "u1", tenantId: "tenant-a", roles: undefined },
      action: "read",
      resource: { resourceId: "ledger/demo", tenantId: "tenant-a" },
    },
    [
      {
        id: "pol-a",
        tenantId: "tenant-a",
        roles: ["engineer"],
        actions: ["read"],
        resourcePrefix: "ledger/",
      },
    ],
  );
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "DENY_INVALID_INPUT");
});

test("BDD-929: prefix matches a path segment, not a sibling identifier", () => {
  const decision = evaluateIamAccess(
    {
      principal: { subjectId: "eng-1", tenantId: "tenant-t", roles: ["engineer"] },
      action: "read",
      resource: { resourceId: "ledger-secret", tenantId: "tenant-t" },
    },
    [
      {
        id: "pol-ledger",
        tenantId: "tenant-t",
        roles: ["engineer"],
        actions: ["read"],
        resourcePrefix: "ledger",
      },
    ],
  );
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "DENY_ACTION_NOT_PERMITTED");

  const allowed = evaluateIamAccess(
    {
      principal: { subjectId: "eng-1", tenantId: "tenant-t", roles: ["engineer"] },
      action: "read",
      resource: { resourceId: "ledger/demo", tenantId: "tenant-t" },
    },
    [
      {
        id: "pol-ledger",
        tenantId: "tenant-t",
        roles: ["engineer"],
        actions: ["read"],
        resourcePrefix: "ledger",
      },
    ],
  );
  assert.equal(allowed.ok, true);
  assert.equal(allowed.code, "ALLOW");
});

test("BDD-930: parent-segment resource identifier is rejected", () => {
  const decision = evaluateIamAccess(
    {
      principal: { subjectId: "eng-1", tenantId: "tenant-t", roles: ["engineer"] },
      action: "read",
      resource: { resourceId: "ledger/../secrets", tenantId: "tenant-t" },
    },
    [
      {
        id: "pol-ledger",
        tenantId: "tenant-t",
        roles: ["engineer"],
        actions: ["read"],
        resourcePrefix: "ledger/",
      },
    ],
  );
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "DENY_INVALID_INPUT");
});

test("BDD-928b: malformed policy list fails closed", () => {
  const decision = evaluateIamAccess(
    {
      principal: { subjectId: "eng-1", tenantId: "tenant-t", roles: ["engineer"] },
      action: "read",
      resource: { resourceId: "ledger/demo", tenantId: "tenant-t" },
    },
    [{ id: "broken", tenantId: "tenant-t", roles: [], actions: ["read"] }],
  );
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "DENY_INVALID_INPUT");
});

test("registerPolicy rejects an unsafe resource prefix", () => {
  const iam = new EosMultiTenantIamFoundation();
  assert.throws(() =>
    iam.registerPolicy({
      id: "pol-bad",
      tenantId: "tenant-t",
      roles: ["engineer"],
      actions: ["read"],
      resourcePrefix: "ledger/../secrets",
    }),
  );
});
