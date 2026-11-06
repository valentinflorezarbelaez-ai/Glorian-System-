import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("registry.json and AGENTS.md document Glorian System", () => {
  const registry = JSON.parse(fs.readFileSync("docs/projects/registry.json", "utf8"));
  const eosProject = registry.projects.find((p) => p.id === "eos-system");
  assert.ok(eosProject, "Project eos-system must exist in registry");
  assert.match(eosProject.name, /Glorian/i);

  const agentsMd = fs.readFileSync("AGENTS.md", "utf8");
  assert.match(agentsMd, /Glorian System/i);

  const readmeMd = fs.readFileSync("README.md", "utf8");
  assert.match(readmeMd, /Glorian System/i);
});
