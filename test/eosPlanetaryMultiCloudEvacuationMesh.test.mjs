/**
 * Unit Test Suite for EosPlanetaryMultiCloudEvacuationMesh
 * Specification: SPEC-121 (IEEE 830 / ISO 29148 / AWS-GCP-Vercel Planetary Disaster Model)
 * Acceptance Criteria: BDD-330 to BDD-334
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosPlanetaryMultiCloudEvacuationMesh } from "../src/core/eosPlanetaryMultiCloudEvacuationMesh.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-330: Catastrophic Degradation Detection & Sub-500ms Multi-Cloud Evacuation", () => {
  const mesh = EosPlanetaryMultiCloudEvacuationMesh.getInstance();
  mesh.reset();

  // Ingest severe degradation telemetry on GCP (error rate > 50%, latency > 2000ms)
  mesh.updateTelemetry("gcp", 2200, 65.5);

  const directive = mesh.evacuateCloudProvider("gcp", "Critical regional BGP blackhole detected in us-central1");
  assert.ok(directive.evacuationId.startsWith("EVAC-"));
  assert.equal(directive.evacuatedProviderId, "gcp");
  assert.ok(directive.evacuationDurationMs < 500, `Evacuation took ${directive.evacuationDurationMs}ms, must be < 500ms`);
  assert.equal(directive.quorumAchieved, true);
  assert.equal(directive.quorumVoters.length, 2);
  assert.ok(directive.quorumVoters.includes("aws"));
  assert.ok(directive.quorumVoters.includes("vercel"));

  // Check reweighted topology
  const gcpRe = directive.reweightedTopology.find((r) => r.providerId === "gcp");
  assert.ok(gcpRe);
  assert.equal(gcpRe.newWeight, 0);

  const awsRe = directive.reweightedTopology.find((r) => r.providerId === "aws");
  const vercelRe = directive.reweightedTopology.find((r) => r.providerId === "vercel");
  assert.ok(awsRe && vercelRe);
  assert.ok(awsRe.newWeight > awsRe.previousWeight);
  assert.ok(vercelRe.newWeight > vercelRe.previousWeight);
  assert.equal(awsRe.newWeight + vercelRe.newWeight, 100);

  assert.equal(directive.merkleStateRootSha256.length, 64);
  assert.equal(directive.sha256Attestation.length, 64);

  const status = mesh.getStatus();
  assert.equal(status.totalEvacuationsExecuted, 1);
  assert.equal(status.state, "EVACUATED_FAILOVER_ACTIVE");
});

test("BDD-331: Planetary Quorum Preservation & Split-Brain Prevention", () => {
  const mesh = EosPlanetaryMultiCloudEvacuationMesh.getInstance();
  mesh.reset();

  // 1st evacuation: evacuate GCP (surviving: AWS, Vercel => 2 nodes => quorum ok)
  mesh.evacuateCloudProvider("gcp", "First regional failure");

  // Attempting 2nd evacuation when only 2 healthy nodes remain:
  // If we try to evacuate AWS, only 1 node (Vercel) would survive => fails quorum consensus (< 2)
  assert.throws(
    () => {
      mesh.evacuateCloudProvider("aws", "Second catastrophic failure");
    },
    /QUORUM_LOST/
  );

  const health = mesh.getHealthMatrix();
  assert.equal(health.quorumState, "QUORUM_ESTABLISHED");
  assert.equal(health.activeCloudsCount, 2);
});

test("BDD-332: Anti-Flapping Circuit Breaker & Progressive Stabilization", () => {
  const mesh = EosPlanetaryMultiCloudEvacuationMesh.getInstance();
  mesh.reset();

  mesh.evacuateCloudProvider("aws", "Temporary latency spike");

  // Test 1: Incomplete or flapping probe burst (only 8 passes out of 10)
  const flakyProbes = [true, true, true, false, true, true, true, false, true, true];
  const rejectedReintegration = mesh.reintegrateProvider("aws", flakyProbes);
  assert.equal(rejectedReintegration.success, false);
  assert.equal(rejectedReintegration.status, "COOLDOWN");
  assert.ok(rejectedReintegration.reason.includes("FLAPPING_SUPPRESSED"));

  const status = mesh.getStatus();
  assert.equal(status.flappingSuppressedCount, 1);

  // Test 2: Solid 10/10 synthetic probe passes
  const solidProbes = [true, true, true, true, true, true, true, true, true, true];
  const successfulReintegration = mesh.reintegrateProvider("aws", solidProbes);
  assert.equal(successfulReintegration.success, true);
  assert.equal(successfulReintegration.status, "HEALTHY");
  assert.ok(successfulReintegration.reason.includes("passed 10/10"));

  const finalHealth = mesh.getHealthMatrix();
  assert.equal(finalHealth.activeCloudsCount, 3);
  assert.equal(finalHealth.evacuatedCloudsCount, 0);
  assert.equal(finalHealth.totalTrafficAllocatedPercent, 100);
});

test("BDD-333: Planetary Health Matrix & Multi-Cloud Cryptographic Snapshot", () => {
  const mesh = EosPlanetaryMultiCloudEvacuationMesh.getInstance();
  mesh.reset();

  const health = mesh.getHealthMatrix();
  assert.equal(health.nodes.length, 3);
  assert.equal(health.activeCloudsCount, 3);
  assert.equal(health.evacuatedCloudsCount, 0);
  assert.equal(health.totalTrafficAllocatedPercent, 100);
  assert.equal(health.quorumState, "QUORUM_ESTABLISHED");
  assert.equal(health.merkleStateRootSha256.length, 64);
  assert.equal(health.sha256Attestation.length, 64);

  const status = mesh.getStatus();
  assert.equal(status.state, "NOMINAL");
  assert.equal(status.merkleStateRootSha256.length, 64);
});

test("BDD-334: MCP Tool Dispatch for Planetary Multi-Cloud Evacuation Mesh", async () => {
  const mcpServer = new EosMcpServer();

  // Test 1: eos_planetary_mesh_health_matrix
  const matrixReq = {
    jsonrpc: "2.0",
    id: "test-mesh-1",
    method: "tools/call",
    params: {
      name: "eos_planetary_mesh_health_matrix",
      arguments: {}
    }
  };
  const matrixRes = await mcpServer.handleRequest(matrixReq);
  assert.equal(matrixRes.error, undefined);
  assert.ok(matrixRes.result);
  const matrixData = JSON.parse(matrixRes.result.content[0].text);
  assert.equal(matrixData.activeCloudsCount, 3);
  assert.equal(matrixData.totalTrafficAllocatedPercent, 100);

  // Test 2: eos_planetary_mesh_evacuate_traffic
  const evacReq = {
    jsonrpc: "2.0",
    id: "test-mesh-2",
    method: "tools/call",
    params: {
      name: "eos_planetary_mesh_evacuate_traffic",
      arguments: {
        providerId: "vercel",
        reason: "Simulated Edge POP cut"
      }
    }
  };
  const evacRes = await mcpServer.handleRequest(evacReq);
  assert.equal(evacRes.error, undefined);
  assert.ok(evacRes.result);
  const evacData = JSON.parse(evacRes.result.content[0].text);
  assert.equal(evacData.evacuatedProviderId, "vercel");
  assert.equal(evacData.quorumAchieved, true);
  assert.equal(evacData.sha256Attestation.length, 64);

  // Test 3: eos_planetary_mesh_status
  const statusReq = {
    jsonrpc: "2.0",
    id: "test-mesh-3",
    method: "tools/call",
    params: {
      name: "eos_planetary_mesh_status",
      arguments: {
        reset: true
      }
    }
  };
  const statusRes = await mcpServer.handleRequest(statusReq);
  assert.equal(statusRes.error, undefined);
  assert.ok(statusRes.result);
  const statusData = JSON.parse(statusRes.result.content[0].text);
  assert.equal(statusData.state, "NOMINAL");
  assert.equal(statusData.activeCloudsCount, 3);
});
