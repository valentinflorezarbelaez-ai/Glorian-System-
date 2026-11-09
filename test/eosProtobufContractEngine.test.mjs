/**
 * BDD Test Suite — EosProtobufContractEngine (SPEC-144)
 * Tests varint, string, and roundtrip binary encoding fidelity.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosProtobufContractEngine } from "../src/core/eosProtobufContractEngine.ts";

describe("SPEC-144: Protobuf Wire-Format Agent Contracts", () => {
  const engine = new EosProtobufContractEngine();

  engine.registerSchema({
    name: "AgentDispatch",
    fields: [
      { tag: 1, name: "agentId", wireType: 2, type: "string" },
      { tag: 2, name: "priority", wireType: 0, type: "int32" },
      { tag: 3, name: "active", wireType: 0, type: "bool" },
      { tag: 4, name: "payload", wireType: 2, type: "bytes" },
      { tag: 5, name: "score", wireType: 1, type: "double" },
      { tag: 6, name: "labels", wireType: 2, type: "string", repeated: true },
    ],
  });

  engine.registerSchema({
    name: "BFTConsensus",
    fields: [
      { tag: 1, name: "term", wireType: 0, type: "uint64" },
      { tag: 2, name: "leader", wireType: 2, type: "string" },
      { tag: 3, name: "delta", wireType: 0, type: "sint32" },
    ],
  });

  it("BDD-420: encodes and decodes string + int32 roundtrip", () => {
    const original = { agentId: "agent-7", priority: 42, active: true };
    const encoded = engine.encode("AgentDispatch", original);
    assert.ok(encoded.byteSize > 0);
    assert.equal(encoded.sha256Digest.length, 64);

    const decoded = engine.decode("AgentDispatch", encoded.payload);
    assert.equal(decoded.agentId, "agent-7");
    assert.equal(decoded.priority, 42);
    assert.equal(decoded.active, true);
  });

  it("BDD-421: encodes and decodes bytes field", () => {
    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const encoded = engine.encode("AgentDispatch", { payload: data, agentId: "x" });
    const decoded = engine.decode("AgentDispatch", encoded.payload);
    assert.deepStrictEqual(decoded.payload, data);
  });

  it("BDD-422: encodes and decodes double (64-bit wire type)", () => {
    const encoded = engine.encode("AgentDispatch", { score: 3.14159265358979 });
    const decoded = engine.decode("AgentDispatch", encoded.payload);
    assert.ok(Math.abs(decoded.score - 3.14159265358979) < 1e-10);
  });

  it("BDD-423: handles repeated string fields", () => {
    const original = { agentId: "a", labels: ["env:prod", "team:core", "v:2"] };
    const encoded = engine.encode("AgentDispatch", original);
    const decoded = engine.decode("AgentDispatch", encoded.payload);
    assert.deepStrictEqual(decoded.labels, ["env:prod", "team:core", "v:2"]);
  });

  it("BDD-424: sint32 zigzag encoding handles negatives", () => {
    const encoded = engine.encode("BFTConsensus", { term: 100n, leader: "node-1", delta: -55 });
    const decoded = engine.decode("BFTConsensus", encoded.payload);
    assert.equal(decoded.delta, -55);
    assert.equal(decoded.leader, "node-1");
  });

  it("BDD-425: deterministic SHA-256 for identical input", () => {
    const msg = { agentId: "x", priority: 1 };
    const a = engine.encode("AgentDispatch", msg);
    const b = engine.encode("AgentDispatch", msg);
    assert.equal(a.sha256Digest, b.sha256Digest);
  });

  it("BDD-426: schema fingerprint is stable and 16 chars", () => {
    const fp = engine.schemaFingerprint("AgentDispatch");
    assert.equal(fp.length, 16);
    assert.equal(fp, engine.schemaFingerprint("AgentDispatch"));
  });

  it("BDD-427: skips unknown fields gracefully during decode", () => {
    // Encode AgentDispatch, decode as BFTConsensus (different schema)
    const encoded = engine.encode("AgentDispatch", { agentId: "x", priority: 99 });
    // BFTConsensus has no agentId field — should not crash, just skip
    const decoded = engine.decode("BFTConsensus", encoded.payload);
    assert.equal(decoded.agentId, undefined);
  });

  it("BDD-428: lists registered schemas", () => {
    const schemas = engine.listSchemas();
    assert.ok(schemas.includes("AgentDispatch"));
    assert.ok(schemas.includes("BFTConsensus"));
  });
});
