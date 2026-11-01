/**
 * Test Suite: EosCellBasedBulkheadGovernor (SPEC-109 / BDD-279 / BDD-280 / BDD-281)
 *
 * Verifies:
 * 1. BDD-279: Deterministic cell sharding via FNV-1a and blast radius bounding (<= 1/N).
 * 2. BDD-280: Poison pill repeated failure detection and global immune quarantine.
 * 3. BDD-281: Dynamic cell draining and bounded failover rerouting with headroom checks.
 * 4. MCP Server tool call handling for eos_cell_bulkhead_route and eos_cell_bulkhead_status.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { EosCellBasedBulkheadGovernor } from "../src/core/eosCellBasedBulkheadGovernor.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("EOS SPEC-109: Distributed Cell-Based Bulkhead Governor Suite", () => {
  it("BDD-279: Shards fleet requests deterministically and bounds blast radius to 1/N", () => {
    const governor = new EosCellBasedBulkheadGovernor({ cellCount: 8, cellCapacity: 50 });

    // Deterministic FNV-1a partition mapping
    const key1 = "repo:eos-system:task-42";
    const key2 = "repo:portafolio:task-99";
    const hash1 = EosCellBasedBulkheadGovernor.computeFnv1a32(key1);
    const hash2 = EosCellBasedBulkheadGovernor.computeFnv1a32(key2);

    assert.strictEqual(typeof hash1, "number");
    assert.strictEqual(hash1, EosCellBasedBulkheadGovernor.computeFnv1a32(key1), "FNV-1a must be strictly deterministic");

    const decision1 = governor.route(key1);
    const decision2 = governor.route(key1); // Same key must route to same cell
    assert.strictEqual(decision1.admitted, true);
    assert.strictEqual(decision2.admitted, true);
    assert.strictEqual(decision1.cellId, decision2.cellId, "Same partition key must have sticky affinity to same cell");

    const metrics = governor.getMetrics();
    assert.strictEqual(metrics.totalCells, 8);
    assert.strictEqual(metrics.healthyCells, 8);
    assert.strictEqual(metrics.maxBlastRadiusPct, 12.5, "For 8 cells, blast radius must be exactly 12.5% (1/8)");
    assert.ok(metrics.sha256Receipt.length === 64, "Metrics must include valid SHA-256 cryptographic receipt");
  });

  it("BDD-280: Detects toxic payloads and enforces global poison pill quarantine", () => {
    const governor = new EosCellBasedBulkheadGovernor({ cellCount: 4, cellCapacity: 20, maxConsecutiveFails: 3 });
    const toxicPayload = { query: "DROP TABLE users; -- SYNTAX_BOMB_CRASH_AST", depth: 9999 };

    const partitionKey = "tenant:malicious-input";
    const decision = governor.route(partitionKey, toxicPayload);
    assert.strictEqual(decision.admitted, true);

    const cellId = decision.cellId;

    // Fail 1: Not yet quarantined
    let failRes = governor.recordFailure(cellId, toxicPayload);
    assert.strictEqual(failRes.quarantined, false);

    // Fail 2: Still not quarantined
    governor.route(partitionKey, toxicPayload);
    failRes = governor.recordFailure(cellId, toxicPayload);
    assert.strictEqual(failRes.quarantined, false);

    // Fail 3: Triggers global quarantine
    governor.route(partitionKey, toxicPayload);
    failRes = governor.recordFailure(cellId, toxicPayload);
    assert.strictEqual(failRes.quarantined, true);
    assert.ok(failRes.signature, "Quarantine must return signature");
    assert.strictEqual(governor.isQuarantined(toxicPayload), true);

    // Any subsequent attempt to route this toxic payload (even to a different cell) is immediately rejected
    const blockedDecision = governor.route("tenant:innocent-key-different-cell", toxicPayload);
    assert.strictEqual(blockedDecision.admitted, false);
    assert.strictEqual(blockedDecision.cellId, -1);
    assert.ok(blockedDecision.reason?.includes("REJECTED_POISON_PILL"));
    assert.strictEqual(blockedDecision.quarantineSignature, failRes.signature);

    const metrics = governor.getMetrics();
    assert.strictEqual(metrics.totalQuarantinedSignatures, 1);
  });

  it("BDD-281: Drains degraded cells and reroutes safely to adjacent warm cells with headroom", () => {
    const governor = new EosCellBasedBulkheadGovernor({ cellCount: 4, cellCapacity: 10, drainHeadroomRatio: 0.8 });

    // Manually mark Cell 0 as DEGRADED or DRAINING
    governor.setCellStatus(0, "DRAINING");

    // Route a request whose hash points to Cell 0
    let keyForCell0 = "";
    for (let i = 0; i < 100; i++) {
      const candidateKey = `probe-key-${i}`;
      if (EosCellBasedBulkheadGovernor.computeFnv1a32(candidateKey) % 4 === 0) {
        keyForCell0 = candidateKey;
        break;
      }
    }
    assert.ok(keyForCell0.length > 0, "Must find partition key hashing to Cell 0");

    const reroutedDecision = governor.route(keyForCell0);
    assert.strictEqual(reroutedDecision.admitted, true);
    assert.strictEqual(reroutedDecision.isRerouted, true);
    assert.strictEqual(reroutedDecision.originalCellId, 0);
    assert.notStrictEqual(reroutedDecision.cellId, 0, "Traffic must be drained away from Cell 0");
    assert.ok(reroutedDecision.reason?.includes("REROUTED_FAILOVER"));
  });

  it("SPEC-109: Overload protection sheds requests when all candidate cells are saturated", () => {
    const governor = new EosCellBasedBulkheadGovernor({ cellCount: 2, cellCapacity: 2, drainHeadroomRatio: 0.5 });

    // Saturate Cell 0 and Cell 1
    governor.route("key-a");
    governor.route("key-a");
    governor.route("key-b");
    governor.route("key-b");

    // Next request must be shed
    const shedDecision = governor.route("key-c");
    assert.strictEqual(shedDecision.admitted, false);
    assert.ok(shedDecision.reason?.includes("SHED_LOAD_OVERLOAD"));
  });

  it("SPEC-109: MCP Server successfully handles eos_cell_bulkhead_route and eos_cell_bulkhead_status tool calls", () => {
    const server = new EosMcpServer(process.cwd(), "full");

    // Call eos_cell_bulkhead_route
    const routeRes = server.handleRequest({
      jsonrpc: "2.0",
      id: "mcp-test-109-route",
      method: "tools/call",
      params: {
        name: "eos_cell_bulkhead_route",
        arguments: {
          partitionKey: "fleet:repo-aberamentho",
          payload: { action: "sync_playlists" }
        }
      }
    });

    assert.strictEqual(routeRes.jsonrpc, "2.0");
    assert.strictEqual(routeRes.id, "mcp-test-109-route");
    const routeData = JSON.parse(routeRes.result.content[0].text);
    assert.ok(routeData);
    assert.strictEqual(routeData.admitted, true);
    assert.ok(routeData.cellId >= 0);

    // Call eos_cell_bulkhead_status
    const statusRes = server.handleRequest({
      jsonrpc: "2.0",
      id: "mcp-test-109-status",
      method: "tools/call",
      params: {
        name: "eos_cell_bulkhead_status",
        arguments: {
          cellId: routeData.cellId
        }
      }
    });

    assert.strictEqual(statusRes.jsonrpc, "2.0");
    assert.strictEqual(statusRes.id, "mcp-test-109-status");
    const statusData = JSON.parse(statusRes.result.content[0].text);
    assert.ok(statusData);
    assert.ok(statusData.totalCells >= 2);
    assert.ok(statusData.sha256Receipt);
    assert.strictEqual(statusData.targetCell?.cellId, routeData.cellId);
  });
});
