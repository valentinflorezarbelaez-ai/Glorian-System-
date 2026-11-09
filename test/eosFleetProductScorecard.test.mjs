/**
 * Fleet product scorecard hermetic gates.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFleetProductScorecard,
  writeFleetProductScorecards,
} from "../src/core/eosFleetProductScorecard.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("BDD-FLEET-SC-001: LEVEL_3 registered project scores at least A", () => {
  const card = buildFleetProductScorecard({
    id: "portafolio",
    name: "Portafolio",
    status: "REGISTERED",
    intake: "INTAKE_COMPLETE",
    specification: "SPECIFICATION_APPROVED",
    audit: "AUDIT_COMPLETE",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
    productionUrl: "https://example.vercel.app",
  });
  assert.ok(card.score >= 90);
  assert.ok(card.grade === "A" || card.grade === "A+");
  assert.equal(card.sha256Receipt.length, 64);
  assert.equal(card.liveProbe, null);
  assert.equal(card.liveReachability, 70);
});

test("BDD-FLEET-SC-003: live probe boosts reachability when HTTPS is healthy", () => {
  const card = buildFleetProductScorecard(
    {
      id: "portafolio",
      name: "Portafolio",
      status: "REGISTERED",
      intake: "INTAKE_COMPLETE",
      specification: "SPECIFICATION_APPROVED",
      audit: "AUDIT_COMPLETE",
      authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
      productionUrl: "https://example.vercel.app",
    },
    {
      reachable: true,
      httpStatus: 200,
      latencyMs: 120,
      probedAt: "2026-11-09T22:00:00.000Z",
    },
  );
  assert.equal(card.liveReachability, 100);
  assert.equal(card.liveProbe?.httpStatus, 200);
  assert.ok(card.score >= 90);
});

test("BDD-FLEET-SC-002: writeFleetProductScorecards persists registry products", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-sc-"));
  try {
    const registry = JSON.parse(
      fs.readFileSync(path.join(projectRoot, "docs", "projects", "registry.json"), "utf8"),
    );
    const result = writeFleetProductScorecards(tmp, registry.projects || []);
    assert.ok(result.scorecards.length >= 5);
    assert.ok(result.written.every((p) => p.includes("scorecard.json")));
    assert.ok(fs.existsSync(path.join(tmp, "docs", "products", "portafolio", "scorecard.json")));
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      // ignore
    }
  }
});
