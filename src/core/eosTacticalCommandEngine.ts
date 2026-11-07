/**
 * SPEC-129: Tier S-0 Tactical Apex — Command Engine & OpenSpec Indexer
 *
 * Implements sub-millisecond fuzzy search, tactical action dispatching,
 * and build-time metadata extraction for the 129 OpenSpecs and 9 Fleet Repositories.
 *
 * Strict Hexagonal Layer-0: Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { contentDerivedIso, writeDeterministicArtifact } from "./eosDeterministicArtifact.ts";

export interface TacticalCommandItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: "FLEET" | "ACTION" | "TOOL" | "SPEC" | "DOCS";
  readonly icon: string;
  readonly shortcut?: string;
  readonly targetUrl?: string;
  readonly targetAnchor?: string;
  readonly payload?: Record<string, unknown>;
}

export interface OpenSpecMetadata {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly author?: string;
  readonly frCount: number;
  readonly bddCount: number;
  readonly file: string;
  readonly sha256: string;
}

export interface TacticalQueryResult {
  readonly query: string;
  readonly totalMatches: number;
  readonly durationMs: number;
  readonly items: TacticalCommandItem[];
}

export class EosTacticalCommandEngine {
  private readonly projectRoot: string;
  private itemsIndex: TacticalCommandItem[] = [];
  private specsIndex: OpenSpecMetadata[] = [];
  private initialized: boolean = false;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Initializes indices for fleet projects, tactical actions, and OpenSpecs.
   */
  public initialize(): void {
    if (this.initialized) return;

    this.itemsIndex = [];
    this.specsIndex = this.extractOpenSpecs();

    // 1. Index Fleet Projects
    const registryPath = path.join(this.projectRoot, "docs/projects/registry.json");
    if (fs.existsSync(registryPath)) {
      try {
        const raw = fs.readFileSync(registryPath, "utf8");
        const registry = JSON.parse(raw);
        if (Array.isArray(registry.projects)) {
          for (const proj of registry.projects) {
            this.itemsIndex.push({
              id: `fleet:${proj.id}`,
              title: proj.name || proj.id,
              description: `Fleet Project [${proj.governanceTier || "TIER-0"}] · ${proj.productionUrl || "Local"}`,
              category: "FLEET",
              icon: "🌐",
              shortcut: `f ${proj.id}`,
              targetUrl: proj.productionUrl,
              payload: { projectId: proj.id, localPath: proj.localPath },
            });
          }
        }
      } catch {
        // Fallback gracefully on parsing failure
      }
    }

    // 2. Index Tactical Actions
    const standardActions: TacticalCommandItem[] = [
      {
        id: "action:verify-cicd",
        title: "Verify CI/CD Pipeline (7 Stages)",
        description: "Executes the strict 7-stage gate (Secret Scan, SRI, Syntax, AST, WCAG, Smoke, Sarif)",
        category: "ACTION",
        icon: "⚡",
        shortcut: "v cicd",
        payload: { command: "npm run verify:strict" },
      },
      {
        id: "action:design-govern",
        title: "Run Tier S-0 Design Governor",
        description: "Audits CSS/HTML against the 4px grid, elevation shadows, and linear-curve anti-patterns",
        category: "ACTION",
        icon: "🎨",
        shortcut: "v design",
        payload: { command: "npm run design:govern" },
      },
      {
        id: "action:secret-scan",
        title: "Audit Fleet Secret-Scan (SPEC-123)",
        description: "Scans entire tree verifying 0 plain secrets and valid SHA-256 fingerprint allowlist",
        category: "ACTION",
        icon: "🔒",
        shortcut: "v secrets",
        payload: { command: "npm run secret-scan" },
      },
      {
        id: "action:fleet-radar",
        title: "Inspect Fleet Synapse Radar",
        description: "Jump to real-time telemetry card grid for all 9 registered production endpoints",
        category: "ACTION",
        icon: "📡",
        shortcut: "g radar",
        targetAnchor: "#fleet-synapse-radar",
      },
      {
        id: "action:specs-explorer",
        title: "Browse 129 OpenSpecs Catalog",
        description: "Jump to interactive architecture specification matrix (EARS & BDD coverage)",
        category: "ACTION",
        icon: "📜",
        shortcut: "g specs",
        targetAnchor: "#openspecs-explorer",
      },
      {
        id: "action:hero-hud",
        title: "Return to Mission Control Hero HUD",
        description: "Scroll to top-level Bento Grid telemetry dashboard",
        category: "ACTION",
        icon: "🛸",
        shortcut: "g top",
        targetAnchor: "#top",
      },
    ];
    this.itemsIndex.push(...standardActions);

    // 3. Index OpenSpecs into searchable items
    for (const spec of this.specsIndex) {
      this.itemsIndex.push({
        id: `spec:${spec.id.toLowerCase()}`,
        title: `${spec.id}: ${spec.title}`,
        description: `Status: [${spec.status}] · ${spec.frCount} EARS FRs · ${spec.bddCount} BDD Scenarios`,
        category: "SPEC",
        icon: "📑",
        shortcut: spec.id.toLowerCase(),
        targetUrl: spec.file,
        payload: { specId: spec.id, frCount: spec.frCount, bddCount: spec.bddCount },
      });
    }

    this.initialized = true;
  }

  /**
   * Scans openspec/specs directory to extract all formal architectural specifications.
   */
  public extractOpenSpecs(): OpenSpecMetadata[] {
    const specsDir = path.join(this.projectRoot, "openspec/specs");
    if (!fs.existsSync(specsDir)) return [];

    const files = fs.readdirSync(specsDir).filter((f) => f.endsWith(".md"));
    const specs: OpenSpecMetadata[] = [];

    for (const file of files) {
      const fullPath = path.join(specsDir, file);
      const content = fs.readFileSync(fullPath, "utf8");

      // Extract Spec ID from filename (e.g. SPEC-128-...)
      const idMatch = file.match(/^(SPEC-\d+)/i);
      const specId = idMatch ? idMatch[1].toUpperCase() : path.basename(file, ".md");

      // Extract Title
      const titleMatch = content.match(/^#\s+(?:SPEC-\d+[:\s-]+)?(.*)$/m);
      const title = titleMatch ? titleMatch[1].trim() : file;

      // Extract Status
      const statusMatch = content.match(/\*\*Status\*\*:\s*([^\n\r]+)/i);
      const status = statusMatch ? statusMatch[1].replace(/[`*]/g, "").trim() : "UNKNOWN";

      // Count EARS FR requirements
      const frMatches = content.match(/\bFR-\d+\b/g) || [];
      const uniqueFrs = new Set(frMatches).size;

      // Count BDD scenarios
      const bddMatches = content.match(/\bBDD-\d+\b/g) || [];
      const uniqueBdds = new Set(bddMatches).size;

      // Compute digest
      const sha256 = crypto.createHash("sha256").update(content).digest("hex");

      specs.push({
        id: specId,
        title,
        status,
        frCount: uniqueFrs,
        bddCount: uniqueBdds,
        file: `openspec/specs/${file}`,
        sha256,
      });
    }

    // Sort numerically by SPEC ID
    return specs.sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
  }

  /**
   * Searches the command palette items with sub-millisecond fuzzy ranking.
   */
  public search(query: string, limit: number = 15): TacticalQueryResult {
    this.initialize();
    const start = performance.now();
    const cleanQ = query.trim().toLowerCase();

    if (!cleanQ) {
      // Default: top actions & fleet targets
      const defaultItems = this.itemsIndex.slice(0, limit);
      return {
        query,
        totalMatches: this.itemsIndex.length,
        durationMs: Number((performance.now() - start).toFixed(2)),
        items: defaultItems,
      };
    }

    const scored: Array<{ item: TacticalCommandItem; score: number }> = [];

    for (const item of this.itemsIndex) {
      const titleLower = item.title.toLowerCase();
      const descLower = item.description.toLowerCase();
      const idLower = item.id.toLowerCase();
      let score = 0;

      if (titleLower === cleanQ || idLower === cleanQ) {
        score = 1000;
      } else if (titleLower.startsWith(cleanQ)) {
        score = 500;
      } else if (titleLower.includes(cleanQ)) {
        score = 250;
      } else if (descLower.includes(cleanQ)) {
        score = 100;
      } else {
        // Subsequence / token match
        const tokens = cleanQ.split(/\s+/);
        const matchesAll = tokens.every((t) => titleLower.includes(t) || descLower.includes(t));
        if (matchesAll) {
          score = 75;
        }
      }

      if (score > 0) {
        scored.push({ item, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, limit).map((s) => s.item);

    return {
      query,
      totalMatches: scored.length,
      durationMs: Number((performance.now() - start).toFixed(2)),
      items: selected,
    };
  }

  /**
   * Exports the complete static JSON index of OpenSpecs for client-side embedding.
   */
  public exportOpenSpecsJson(outputPath?: string): string {
    const specs = this.extractOpenSpecs();
    const target = outputPath || path.join(this.projectRoot, "docs/specs/openspec-catalog-index.json");
    const payload = {
      timestampIso: new Date().toISOString(),
      totalSpecs: specs.length,
      catalogSha256: crypto.createHash("sha256").update(JSON.stringify(specs)).digest("hex"),
      specs,
    };

    // Deterministic artifact: the committed timestampIso is reused in place, so an
    // unchanged spec set yields a byte-identical index with no working-tree churn.
    writeDeterministicArtifact(target, payload, {
      stampField: "timestampIso",
      stampFor: (seedSha) => contentDerivedIso(seedSha),
    });
    return target;
  }
}
