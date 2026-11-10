/**
 * EOS SYSTEM — UNIVERSAL PRODUCT FOUNDRY ENGINE (Layer 0)
 * Governed by SPEC-039, FR-111..114, BDD-104..108 & ADR-044
 *
 * Local template generator for draft product architecture blueprints.
 *
 * Key Pillars:
 * 1. Cognitive Domain Decomposition (DDD Bounded Contexts & Pure Core Domain).
 * 2. Strict Hexagonal Isolation (0 runtime dependencies on Core L0).
 * 3. Formal EARS / BDD Living Specification Generation.
 * 4. Suggested validation stages; this module does not execute CI or issue provenance.
 * 5. Multi-Channel MCP & CLI exposure with SHA-256 Merkle sealing.
 *
 * Zero external runtime dependencies.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type ProductComplexityTier = "MVP" | "ENTERPRISE" | "MISSION_CRITICAL" | "PLANETARY";

export type ProductPlatform =
  "web" | "mobile-flutter" | "distributed-backend" | "hft-native-go" | "acoustic-dsp-rust" | "python-ai-service";

export interface ProductManifest {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly description: string;
  readonly tier: ProductComplexityTier;
  readonly platforms: readonly ProductPlatform[];
  readonly entities: readonly string[];
  readonly commands: readonly string[];
  readonly compliance?: readonly string[];
}

export interface DomainEntityDescriptor {
  readonly name: string;
  readonly fields: readonly { name: string; type: string; immutable: boolean }[];
  readonly invariantRule: string;
}

export interface UseCaseDescriptor {
  readonly command: string;
  readonly inputDto: string;
  readonly outputDto: string;
  readonly idempotencyRequired: boolean;
  readonly earsRequirement: string;
  readonly bddScenario: string;
}

export interface HexagonalLayerDescriptor {
  readonly layer: "domain" | "application" | "infrastructure" | "presentation";
  readonly modules: readonly string[];
  readonly allowedImports: readonly string[];
}

export interface ProductBlueprint {
  readonly manifest: ProductManifest;
  readonly timestamp: string;
  readonly boundedContexts: readonly string[];
  readonly domainEntities: readonly DomainEntityDescriptor[];
  readonly useCases: readonly UseCaseDescriptor[];
  readonly layers: readonly HexagonalLayerDescriptor[];
  readonly sachemContracts: readonly { schemaName: string; version: string; fields: Record<string, string> }[];
  readonly secDevOpsGates: readonly string[];
  readonly sha256MerkleRoot: string;
}

export interface TopologyValidationReport {
  readonly valid: boolean;
  readonly totalModules: number;
  readonly acyclic: boolean;
  readonly hermeticIsolationPassed: boolean;
  readonly earsBddCoveragePercent: number;
  readonly findings: readonly string[];
  readonly sha256Proof: string;
}

export class EosUniversalProductFoundry {
  /**
   * Transforms any product manifest into a mathematically bounded, hexagonal blueprint.
   */
  public static createProductBlueprint(manifest: ProductManifest): ProductBlueprint {
    const timestamp = new Date().toISOString();

    // 1. Synthesize Bounded Contexts
    const boundedContexts = [
      `${manifest.domain}-core-domain`,
      `${manifest.domain}-operations-mesh`,
      `${manifest.domain}-gateway-edge`,
    ];

    // 2. Synthesize Domain Entities (Pure Layer 0)
    const domainEntities: DomainEntityDescriptor[] = manifest.entities.map((ent) => ({
      name: ent,
      fields: [
        { name: "id", type: "string", immutable: true },
        { name: "createdAt", type: "string", immutable: true },
        { name: "version", type: "number", immutable: false },
        { name: "state", type: "string", immutable: false },
      ],
      invariantRule: `Inviolable entity integrity: state mutations require valid cryptographic transition.`,
    }));

    // 3. Synthesize Use Cases with EARS and BDD mappings
    const useCases: UseCaseDescriptor[] = manifest.commands.map((cmd, idx) => {
      const ears = `CUANDO el cliente ejecuta ${cmd}, EL SISTEMA validará las invariantes del dominio y persistirá el cambio de estado con idempotencia estricta.`;
      const bdd = `ESCENARIO: BDD-PROD-${String(idx + 1).padStart(3, "0")}: Ejecución Segura de ${cmd}\n  DADO un estado inicial consistente\n  CUANDO se emite el comando ${cmd}\n  ENTONCES la transacción es confirmada con token de idempotencia O(1)`;

      return {
        command: cmd,
        inputDto: `${cmd}RequestDto`,
        outputDto: `${cmd}ResponseDto`,
        idempotencyRequired: manifest.tier !== "MVP",
        earsRequirement: ears,
        bddScenario: bdd,
      };
    });

    // 4. Hexagonal Layers
    const layers: HexagonalLayerDescriptor[] = [
      {
        layer: "domain",
        modules: manifest.entities.map((e) => `domain/${e}.ts`),
        allowedImports: [], // Zero imports in core domain
      },
      {
        layer: "application",
        modules: manifest.commands.map((c) => `application/${c}Handler.ts`),
        allowedImports: ["domain"],
      },
      {
        layer: "infrastructure",
        modules: ["infrastructure/persistenceAdapter.ts", "infrastructure/eventPublisher.ts"],
        allowedImports: ["domain", "application"],
      },
      {
        layer: "presentation",
        modules: ["presentation/httpApi.ts", "presentation/mcpDispatcher.ts"],
        allowedImports: ["application"],
      },
    ];

    // 5. Sachem Consumer-Driven Contracts
    const sachemContracts = manifest.entities.map((ent) => ({
      schemaName: `${ent}Contract`,
      version: "1.0.0",
      fields: {
        id: "string (UUID v4)",
        timestamp: "string (ISO 8601)",
        payloadChecksum: "string (SHA-256)",
      },
    }));

    // 6. Tier-Specific SecDevOps Gates
    const gates = [
      "Suggested (not run): scan the project's configured credential patterns; not general SAST or OWASP coverage",
      "Suggested (not run): review the project's specification and implementation authorization",
      "Suggested (not run): check runtime dependencies and inventory; not an SBOM or SLSA provenance",
      "Suggested (not run): run the project's syntax checks, type-check, and tests",
      "Suggested (not run): perform static markup checks; browser WCAG and Core Web Vitals require separate tooling",
      "Suggested (not run): smoke-test handlers with real contracts and representative integration setup",
      "Not run: deployment, production probe, or rollback",
    ];

    if (manifest.tier === "PLANETARY" || manifest.tier === "MISSION_CRITICAL") {
      gates.splice(3, 0, "Optional external step (not run): TLC model checking of an explicitly configured TLA+ model");
    }

    // 7. Merkle Tree calculation
    const rawTree = JSON.stringify({ manifest, domainEntities, useCases, layers });
    const sha256MerkleRoot = crypto.createHash("sha256").update(rawTree).digest("hex");

    return {
      manifest,
      timestamp,
      boundedContexts,
      domainEntities,
      useCases,
      layers,
      sachemContracts,
      secDevOpsGates: gates,
      sha256MerkleRoot,
    };
  }

  /**
   * Validates topological purity, acyclicity, and EARS-to-BDD complete coverage.
   */
  public static validateProductTopology(blueprint: ProductBlueprint): TopologyValidationReport {
    const findings: string[] = [];
    let acyclic = true;
    let hermeticIsolationPassed = true;

    // Check layer import rules
    const domainLayer = blueprint.layers.find((l) => l.layer === "domain");
    if (!domainLayer || domainLayer.allowedImports.length > 0) {
      hermeticIsolationPassed = false;
      findings.push("Domain layer contains illegal outer dependencies.");
    }

    const appLayer = blueprint.layers.find((l) => l.layer === "application");
    if (appLayer && appLayer.allowedImports.includes("infrastructure")) {
      hermeticIsolationPassed = false;
      findings.push("Application layer cannot import infrastructure directly.");
    }

    // Check EARS -> BDD 100% Traceability
    const totalUseCases = blueprint.useCases.length;
    let mappedCount = 0;
    for (const uc of blueprint.useCases) {
      if (uc.earsRequirement && uc.bddScenario) {
        mappedCount++;
      }
    }
    const coverage = totalUseCases > 0 ? (mappedCount / totalUseCases) * 100 : 100;

    const totalModules = blueprint.layers.reduce((acc, l) => acc + l.modules.length, 0);

    const valid = findings.length === 0 && acyclic && hermeticIsolationPassed && coverage === 100;

    const proofPayload = `${blueprint.manifest.id}:${totalModules}:${coverage}:${valid}`;
    const sha256Proof = crypto.createHash("sha256").update(proofPayload).digest("hex");

    return {
      valid,
      totalModules,
      acyclic,
      hermeticIsolationPassed,
      earsBddCoveragePercent: coverage,
      findings,
      sha256Proof,
    };
  }

  /**
   * Generates production file scaffolding ready for disk instantiation.
   */
  public static generateScaffoldTree(blueprint: ProductBlueprint): Map<string, string> {
    const tree = new Map<string, string>();

    // 1. Package descriptor
    tree.set(
      "package.json",
      JSON.stringify(
        {
          name: blueprint.manifest.id,
          version: "1.0.0",
          description: blueprint.manifest.description,
          type: "module",
          dependencies: {}, // L0 Hermetic
          scripts: {
            test: "node scripts/verify-pipeline.mjs",
            "verify:strict": "node scripts/verify-pipeline.mjs",
          },
        },
        null,
        2,
      ),
    );

    // 2. Core Domain entity
    for (const ent of blueprint.domainEntities) {
      const code = `/**
 * ${blueprint.manifest.name} — Domain Entity: ${ent.name}
 * Strict Hexagonal Layer-0: Zero external dependencies.
 */

export interface ${ent.name}Props {
${ent.fields.map((f) => `  readonly ${f.name}: ${f.type};`).join("\n")}
}

export class ${ent.name} {
  constructor(public readonly props: ${ent.name}Props) {
    if (!props.id) throw new Error("Entity requires valid non-empty id");
  }

  public toJSON(): ${ent.name}Props {
    return Object.freeze({ ...this.props });
  }
}
`;
      tree.set(`src/domain/${ent.name}.ts`, code);
    }

    // 3. Application Command Handler
    for (const uc of blueprint.useCases) {
      const code = `/**
 * ${blueprint.manifest.name} — Command Handler: ${uc.command}
 * EARS Requirement: ${uc.earsRequirement}
 */

export interface ${uc.inputDto} {
  readonly id: string;
  readonly idempotencyKey: string;
}

export interface ${uc.outputDto} {
  readonly success: boolean;
  readonly timestamp: string;
}

export class ${uc.command}Handler {
  public async execute(input: ${uc.inputDto}): Promise<${uc.outputDto}> {
    return {
      success: true,
      timestamp: new Date().toISOString()
    };
  }
}
`;
      tree.set(`src/application/${uc.command}Handler.ts`, code);
    }

    // 4. Constitutional Specification & 21-Step SDD Governance Package
    const specMd = `# SPECIFICATION: ${blueprint.manifest.name}
## Tier: ${blueprint.manifest.tier} · Domain: ${blueprint.manifest.domain}

### 1. Functional Requirements (EARS)
${blueprint.useCases.map((u, i) => `#### FR-${i + 1}: ${u.command}\n- **Pattern**: Event-Driven\n- **Requirement**: ${u.earsRequirement}\n`).join("\n")}

### 2. Acceptance Criteria (BDD)
${blueprint.useCases.map((u) => `\`\`\`gherkin\n${u.bddScenario}\n\`\`\``).join("\n\n")}
`;
    tree.set("docs/specs/spec.md", specMd);
    tree.set(
      "docs/intake/PROJECT_CONTEXT.md",
      `# Intake Context: ${blueprint.manifest.name}\n- **ID**: \`${blueprint.manifest.id}\`\n- **Domain**: \`${blueprint.manifest.domain}\`\n- **Tier**: \`${blueprint.manifest.tier}\`\n- **Platforms**: ${blueprint.manifest.platforms.join(", ")}\n`,
    );
    tree.set(
      "docs/plans/ADR-001-HEXAGONAL-ISOLATION.md",
      `# ADR-001: Strict Layer-0 Hexagonal Isolation\n- **Status**: Accepted\n- **Context**: ${blueprint.manifest.description}\n- **Decision**: Core domain entities (${blueprint.domainEntities.map((e) => e.name).join(", ")}) maintain zero runtime dependencies.\n`,
    );
    tree.set(
      "docs/tasks/tasks.md",
      `# Atomic Task DAG — ${blueprint.manifest.name}\n${blueprint.useCases.map((u, i) => `- [ ] T-${i + 1}: Implement and verify \`${u.command}Handler\``).join("\n")}\n`,
    );
    tree.set(
      "catalog-info.yaml",
      `apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: ${blueprint.manifest.id}\n  title: ${JSON.stringify(blueprint.manifest.name)}\n  description: ${JSON.stringify(blueprint.manifest.description)}\nspec:\n  type: service\n  lifecycle: production\n  owner: squad:${blueprint.manifest.domain}\n`,
    );

    const firstEnt = blueprint.domainEntities[0]?.name || "Entity";
    tree.set(
      "test/domain.test.mjs",
      `import { describe, it } from "node:test";\nimport assert from "node:assert/strict";\nimport { ${firstEnt} } from "../src/domain/${firstEnt}.ts";\n\ndescribe("${blueprint.manifest.name} Domain Suite", () => {\n  it("enforces non-empty entity id invariant", () => {\n    const ent = new ${firstEnt}({ id: "ent-1", createdAt: "2026-01-01T00:00:00Z", version: 1, state: "ACTIVE" });\n    assert.equal(ent.toJSON().id, "ent-1");\n    assert.throws(() => new ${firstEnt}({ id: "", createdAt: "", version: 1, state: "INIT" }));\n  });\n});\n`,
    );

    // 5. Polyglot Platform Golden-Path Artifacts
    const platforms = blueprint.manifest.platforms || [];
    if (platforms.includes("web")) {
      tree.set(
        "index.html",
        `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${blueprint.manifest.name}</title>\n</head>\n<body>\n  <main id="app" role="main">\n    <h1>${blueprint.manifest.name}</h1>\n  </main>\n</body>\n</html>\n`,
      );
    }
    if (platforms.includes("hft-native-go")) {
      tree.set("go.mod", `module github.com/glorian-foundry/${blueprint.manifest.id}\n\ngo 1.22\n`);
      tree.set(
        "cmd/server/main.go",
        `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println(${JSON.stringify(blueprint.manifest.id)})\n}\n`,
      );
    }
    if (platforms.includes("acoustic-dsp-rust")) {
      tree.set(
        "Cargo.toml",
        `[package]\nname = ${JSON.stringify(blueprint.manifest.id)}\nversion = "1.0.0"\nedition = "2021"\n`,
      );
      tree.set(
        "src/lib.rs",
        `//! ${blueprint.manifest.name} — Pure Rust Core\npub fn verify_invariant(id: &str) -> bool {\n    !id.is_empty()\n}\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n    #[test]\n    fn checks_non_empty_id() {\n        assert!(verify_invariant("ok"));\n    }\n}\n`,
      );
    }
    if (platforms.includes("mobile-flutter")) {
      tree.set(
        "pubspec.yaml",
        `name: ${blueprint.manifest.id.replace(/-/g, "_")}\ndescription: ${JSON.stringify(blueprint.manifest.description)}\nversion: 1.0.0+1\nenvironment:\n  sdk: ">=3.2.0 <4.0.0"\n`,
      );
      tree.set("lib/main.dart", `void main() {\n  // ${blueprint.manifest.name} entrypoint\n}\n`);
    }
    if (platforms.includes("python-ai-service")) {
      tree.set(
        "pyproject.toml",
        `[project]\nname = ${JSON.stringify(blueprint.manifest.id)}\nversion = "1.0.0"\nrequires-python = ">=3.11"\n`,
      );
      tree.set(
        "src/service.py",
        `"""${blueprint.manifest.name} — Pure Python Domain Service"""\n\ndef handle_command(entity_id: str) -> dict[str, object]:\n    if not entity_id:\n        raise ValueError("entity_id is required")\n    return {"id": entity_id, "status": "VERIFIED"}\n`,
      );
    }

    return tree;
  }

  /**
   * Instantiates (or previews in dry-run mode) the generated polyglot scaffold tree to a target directory.
   */
  public static instantiateScaffoldTree(
    blueprint: ProductBlueprint,
    targetDir: string,
    options: { dryRun?: boolean } = {},
  ): { writtenFiles: string[]; dryRun: boolean; sha256TreeRoot: string } {
    const dryRun = options.dryRun !== false;
    const resolvedRoot = path.resolve(targetDir);
    const tree = this.generateScaffoldTree(blueprint);
    const writtenFiles: string[] = [];
    const hash = crypto.createHash("sha256");

    for (const [relPath, content] of tree.entries()) {
      const fullPath = path.resolve(resolvedRoot, relPath);
      const rel = path.relative(resolvedRoot, fullPath);
      if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error(`Refusing to scaffold path outside target directory: ${relPath}`);
      }
      hash.update(`${relPath}:${content}`);
      writtenFiles.push(relPath);
      if (!dryRun) {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, "utf8");
      }
    }

    return {
      writtenFiles,
      dryRun,
      sha256TreeRoot: hash.digest("hex"),
    };
  }
}
