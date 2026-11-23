/**
 * Minimal smoke test for Glorian golden-path scaffold.
 * Values are substituted by Backstage fetch:template.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SovereignComponent } from "../src/index.mjs";

test("scaffold component reports healthy", () => {
  const component = new SovereignComponent();
  const health = component.getHealth();
  assert.equal(health.status, "HEALTHY");
  assert.equal(health.componentId, "${{ values.componentId }}");
  assert.ok(health.uptimeMs >= 0);
});
