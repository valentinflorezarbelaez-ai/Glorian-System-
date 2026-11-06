import test from "node:test";
import assert from "node:assert/strict";

import { EosKubernetesFleetOperator } from "../src/core/eosKubernetesFleetOperator.ts";

test("BDD-263: Síntesis y validación de esquemas OpenAPI v3 para CRDs de Kubernetes (SPEC-094)", () => {
  const clusterCrd = EosKubernetesFleetOperator.generateCrdManifest("EosCluster");

  assert.ok(clusterCrd.includes("apiVersion: apiextensions.k8s.io/v1"));
  assert.ok(clusterCrd.includes("kind: CustomResourceDefinition"));
  assert.ok(clusterCrd.includes("name: eosclusters.operator.eos.system"));
  assert.ok(clusterCrd.includes("vcpuCount"));
  assert.ok(clusterCrd.includes("memoryMib"));
  assert.ok(clusterCrd.includes("replicas"));

  const enclaveCrd = EosKubernetesFleetOperator.generateCrdManifest("EosEnclave");
  assert.ok(enclaveCrd.includes("name: eosenclaves.operator.eos.system"));
  assert.ok(enclaveCrd.includes("kind: EosEnclave"));
});

test("BDD-264: Evaluación determinista de políticas de autorización ABAC con rechazo fail-closed (SPEC-094)", () => {
  const operator = new EosKubernetesFleetOperator([
    {
      id: "admin-all",
      principalRole: "admin",
      actionPattern: "*",
      targetNamespace: "*",
      effect: "ALLOW"
    },
    {
      id: "dev-read-only",
      principalRole: "developer",
      actionPattern: "cluster:get",
      targetNamespace: "staging",
      effect: "ALLOW"
    },
    {
      id: "deny-prod-mutation",
      principalRole: "developer",
      actionPattern: "cluster:*",
      targetNamespace: "production",
      effect: "DENY"
    }
  ]);

  // 1. Admin executing cluster deletion in production -> ALLOW (200)
  const adminReq = {
    principal: { username: "valentin", role: "admin" },
    action: "cluster:delete",
    resource: { kind: "EosCluster", namespace: "production", name: "prod-omega-1" }
  };
  const adminDecision = operator.evaluateAccess(adminReq);
  assert.equal(adminDecision.allowed, true);
  assert.equal(adminDecision.statusCode, 200);
  assert.equal(adminDecision.matchedPolicyId, "admin-all");

  // 2. Developer executing cluster deletion in production -> DENIED (403)
  const devDeleteReq = {
    principal: { username: "junior-dev", role: "developer" },
    action: "cluster:delete",
    resource: { kind: "EosCluster", namespace: "production", name: "prod-omega-1" }
  };
  const devDeleteDecision = operator.evaluateAccess(devDeleteReq);
  assert.equal(devDeleteDecision.allowed, false);
  assert.equal(devDeleteDecision.statusCode, 403);
  assert.ok(devDeleteDecision.reason.includes("EXPLICIT_DENY"));

  // 3. Developer reading staging cluster -> ALLOW (200)
  const devReadReq = {
    principal: { username: "junior-dev", role: "developer" },
    action: "cluster:get",
    resource: { kind: "EosCluster", namespace: "staging", name: "stage-beta" }
  };
  const devReadDecision = operator.evaluateAccess(devReadReq);
  assert.equal(devReadDecision.allowed, true);
  assert.equal(devReadDecision.statusCode, 200);

  // 4. Default Deny: Unknown action/role
  const unknownReq = {
    principal: { username: "guest", role: "guest" },
    action: "cluster:inspect",
    resource: { kind: "EosCluster", namespace: "staging", name: "stage-beta" }
  };
  const unknownDecision = operator.evaluateAccess(unknownReq);
  assert.equal(unknownDecision.allowed, false);
  assert.equal(unknownDecision.statusCode, 403);
  assert.ok(unknownDecision.reason.includes("DEFAULT_DENY"));
});
