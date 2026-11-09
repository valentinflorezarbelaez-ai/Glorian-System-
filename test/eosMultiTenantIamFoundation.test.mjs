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
