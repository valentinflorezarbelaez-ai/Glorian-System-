# @eos-system/core

> The EOS Engineering Operating System — AGI Harness, World-Class Consulting Engine, and Dynamic MCP Tool Forge.
> Zero external runtime dependencies.

## Install

```bash
npm install @eos-system/core
```

## Usage

```typescript
import { EosConsultantCore, EosAgiCore, EosDynamicToolForge } from "@eos-system/core";

// World-class consulting deliverable — offline, no API key needed
const consultant = new EosConsultantCore("/workspace");
const deliverable = consultant.engage({
  problem: "Our API endpoint /users takes 8 seconds with 10k rows",
  techStack: "typescript",
});
console.log(deliverable.executiveSummary);

// Tree of Thoughts AGI solving with deterministic tribunal
const core = new EosAgiCore("/workspace");
const result = core.solve(objective, branches, { testCommand: "npm test" });

// Auto-create MCP tools at runtime
const forge = new EosDynamicToolForge("/workspace");
forge.forge({ toolName: "measure_latency", description: "...", moduleSource: "...", inputSchema: {} });
```

## Key Exports

- `EosConsultantCore` — Offline consulting at Thoughtworks/McKinsey level
- `EosAgiCore` — Tree of Thoughts + Deterministic Tribunal + Episodic Axiom Memory
- `EosAxiomMemory` — Persistent cross-session learning store
- `EosMultiModelRouter` — Routes tasks to optimal AI model (Anthropic/Google/DeepSeek)
- `EosDynamicToolForge` — Auto-creates and registers MCP tools at runtime
- `EosContextWindowManager` — Token-budget-aware context assembly from blast radius
- `EosSpecDriftDetector` — Detects spec/code drift violations
- `EosLogger` / `createLogger` — Zero-dependency structured JSON logger

## Publishing

```bash
# From the monorepo root
cd packages/core
npm publish --access public
```

Requires `NPM_TOKEN` environment variable set. The GitHub Actions workflow `.github/workflows/eos-publish.yml` auto-publishes on release.

## Import Path

All imports use relative paths back to the monorepo `src/core/` directory. When importing in your project:

```typescript
// After npm install @eos-system/core
import { EosConsultantCore } from "@eos-system/core";

const consultant = new EosConsultantCore(process.cwd());
const deliverable = consultant.engage({
  problem: "Our API takes 8 seconds with 10k rows",
  techStack: "typescript",
});
```

## Zero Dependencies

This package has `"dependencies": {}`. Everything runs on Node.js 22+ built-ins:
- `node:crypto` for hashing
- `node:fs` for file operations
- `node:child_process` for test execution
- `node:https` for API calls
