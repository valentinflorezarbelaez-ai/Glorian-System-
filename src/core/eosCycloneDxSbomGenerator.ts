/**
 * EOS SYSTEM — CYCLONEDX SBOM GENERATOR (Layer 0)
 * Governed by SPEC-151 (Google SLSA Level 3 / NTIA minimum elements)
 *
 * Generates a CycloneDX 1.5 Software Bill of Materials from the local
 * filesystem inventory. Since this project has zero runtime npm dependencies,
 * the SBOM documents internal components (modules) and their relationships.
 *
 * Outputs valid JSON conforming to https://cyclonedx.org/specification/overview/
 *
 * Zero external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface CycloneDXComponent {
  type: "library" | "framework" | "application" | "operating-system";
  name: string;
  version: string;
  bom_ref: string;
  description?: string;
  purl?: string;
  hashes?: { alg: string; content: string }[];
}

export interface CycloneDXSbom {
  bomFormat: "CycloneDX";
  specVersion: "1.5";
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: { vendor: string; name: string; version: string }[];
    component: CycloneDXComponent;
  };
  components: CycloneDXComponent[];
  dependencies: { ref: string; dependsOn: string[] }[];
}

/**
 * Generates a CycloneDX SBOM by scanning source modules.
 */
export function generateCycloneDxSbom(projectRoot: string): CycloneDXSbom {
  const srcDir = path.join(projectRoot, "src", "core");
  const files = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter((f) => f.endsWith(".ts")) : [];

  const components: CycloneDXComponent[] = files.map((file) => {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const name = file
      .replace(/\.ts$/, "")
      .replace(/^eos/, "")
      .replace(/\.types$/, "");
    return {
      type: "library" as const,
      name: `glorian:${name}`,
      version: "1.0.0",
      bom_ref: `pkg:npm/glorian/${name}@1.0.0`,
      description: `Layer-0 module ${file}`,
      purl: `pkg:npm/glorian/${name}@1.0.0`,
      hashes: [{ alg: "SHA-256", content: hash }],
    };
  });

  // Extract dependencies from imports
  const dependencyMap: Map<string, string[]> = new Map();
  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const importRegex = /from\s+"\.\/([\w]+)\.ts"/g;
    const deps: string[] = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const depFile = match[1];
      if (depFile !== "index" && files.includes(`${depFile}.ts`)) {
        deps.push(`pkg:npm/glorian/${depFile.replace(/^eos/, "").replace(/\.types$/, "")}@1.0.0`);
      }
    }
    const name = file
      .replace(/\.ts$/, "")
      .replace(/^eos/, "")
      .replace(/\.types$/, "");
    if (deps.length > 0) {
      dependencyMap.set(`pkg:npm/glorian/${name}@1.0.0`, [...new Set(deps)]);
    }
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

  const sbom: CycloneDXSbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: "Glorian", name: "eos-sbom-generator", version: "1.0.0" }],
      component: {
        type: "application",
        name: "glorian-system",
        version: packageJson.version ?? "1.0.0",
        bom_ref: `pkg:npm/glorian-system@${packageJson.version ?? "1.0.0"}`,
      },
    },
    components,
    dependencies: Array.from(dependencyMap.entries()).map(([ref, dependsOn]) => ({ ref, dependsOn })),
  };

  return sbom;
}
