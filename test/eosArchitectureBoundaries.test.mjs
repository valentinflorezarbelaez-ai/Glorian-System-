import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { LAYER_ALLOWLIST, verifyArchitecture } from "../scripts/verify-architecture-boundaries.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function withFixture(files, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-arch-"));
  try {
    for (const [relPath, content] of Object.entries(files)) {
      const abs = path.join(dir, relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("AF-01: El grafo real cumple R1-R5 con métricas no triviales", () => {
  const report = verifyArchitecture(root);

  assert.equal(report.valid, true, JSON.stringify(report.violations, null, 2));
  assert.ok(report.metrics.srcModules > 200, `srcModules=${report.metrics.srcModules}`);
  assert.ok(report.metrics.internalEdges > 400, `internalEdges=${report.metrics.internalEdges}`);
  assert.equal(report.metrics.cycles, 0);
  assert.equal(report.metrics.allowlistedEdges, LAYER_ALLOWLIST.length);
});

test("AF-02: Detecta import externo, ciclo, inversión de capas e import del harness", () => {
  withFixture(
    {
      "src/core/a.ts": 'import lodash from "lodash";\nimport { b } from "../mcp/b.ts";\nexport const a = lodash ?? b;\n',
      "src/mcp/b.ts": 'import { a } from "../core/a.ts";\nexport const b = a;\n',
      "src/core/c.ts": 'import { helper } from "../../scripts/helper.mjs";\nexport const c = helper;\n',
      "scripts/helper.mjs": "export const helper = 1;\n"
    },
    (dir) => {
      const report = verifyArchitecture(dir, { allowlist: [] });
      const rules = new Set(report.violations.map((violation) => violation.rule));

      assert.equal(report.valid, false);
      assert.ok(rules.has("R1"), "R1 bare specifier not detected");
      assert.ok(rules.has("R2"), "R2 layer inversion not detected");
      assert.ok(rules.has("R3"), "R3 import cycle not detected");
      assert.ok(rules.has("R4"), "R4 harness import not detected");
    }
  );
});

test("AF-03: Ignora imports dentro de literales de plantilla y comentarios", () => {
  withFixture(
    {
      "src/core/fixture.ts": [
        '// import ghost from "left-pad";',
        '/* import other from "request"; */',
        "export const sample = `",
        'import { A } from "./moduleB.ts";',
        'const std = @import("std");',
        "export { x } from \"fake-pkg\";",
        "`;",
        "export const real = 1;"
      ].join("\n")
    },
    (dir) => {
      const report = verifyArchitecture(dir, { allowlist: [] });
      assert.equal(report.valid, true, JSON.stringify(report.violations, null, 2));
    }
  );
});

test("AF-04: El allowlist no tiene entradas obsoletas", () => {
  const report = verifyArchitecture(root);
  const stale = report.violations.filter((violation) => violation.detail.startsWith("stale allowlist entry"));

  assert.deepEqual(stale, []);
  assert.equal(LAYER_ALLOWLIST.length, 0, "Layer-0 must not depend on Layer-1 after burning down the debt");
});

test("AF-05: La CLI falla cerrada y devuelve 0 sobre el repositorio", () => {
  const output = execFileSync(process.execPath, [path.join(root, "scripts", "verify-architecture-boundaries.mjs")], {
    cwd: root,
    encoding: "utf8"
  });

  assert.match(output, /\[PASS\] R1 supply chain/);
});
