/**
 * ============================================================================
 * EOS SYSTEM — UNIVERSAL POLYGLOT REPOSITORY ADAPTER (Layer 0)
 * ============================================================================
 * Universal Project Archetype Detector and Execution Planner.
 * Enables EOS to govern repositories in Go, Rust, Clojure, TypeScript, Python,
 * and Flutter/Dart under the Spotify, Nubank, and EOS Soundcheck standards.
 *
 * Zero external runtime dependencies. Layer-0 Pure.
 * ============================================================================
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export type ProjectArchetype =
  | "GO_MICROSERVICE"
  | "RUST_CORE"
  | "CLOJURE_DATOMIC"
  | "NODE_ZERO_DEPS"
  | "PYTHON_DATA_PIPELINE"
  | "FLUTTER_DART_CLIENT"
  | "UNKNOWN";

export interface PolyglotExecutionPlan {
  readonly archetype: ProjectArchetype;
  readonly verifyCommand: string;
  readonly raceCheckCommand: string;
  readonly benchmarkCommand: string;
  readonly targetCompanyStandard:
    "Spotify / Cloud Native" | "Nubank / Functional" | "EOS Sovereign" | "Universal Mobile";
  readonly detectedIndicators: string[];
}

/**
 * Detects in microseconds the architectural nature of any codebase
 * and returns the deterministic verification, race detection, and benchmark commands.
 */
export function detectPolyglotPlan(projectRoot: string): PolyglotExecutionPlan {
  const indicators: string[] = [];

  // 1. Go Microservice (Spotify & Cloud Native)
  if (existsSync(join(projectRoot, "go.mod"))) {
    indicators.push("go.mod");
    if (existsSync(join(projectRoot, "Dockerfile"))) indicators.push("Dockerfile");
    return {
      archetype: "GO_MICROSERVICE",
      verifyCommand: "go vet ./...",
      raceCheckCommand: "go test -v -race ./...",
      benchmarkCommand: "go test -bench=. -benchmem ./...",
      targetCompanyStandard: "Spotify / Cloud Native",
      detectedIndicators: indicators,
    };
  }

  // 2. Rust Core / Audio DSP (Spotify Audio Engine / Librespot)
  if (existsSync(join(projectRoot, "Cargo.toml"))) {
    indicators.push("Cargo.toml");
    return {
      archetype: "RUST_CORE",
      verifyCommand: "cargo clippy -- -D warnings",
      raceCheckCommand: "cargo test -- --nocapture",
      benchmarkCommand: "cargo bench",
      targetCompanyStandard: "Spotify / Cloud Native",
      detectedIndicators: indicators,
    };
  }

  // 3. Clojure / Datomic (Nubank Core Banking)
  if (existsSync(join(projectRoot, "deps.edn")) || existsSync(join(projectRoot, "project.clj"))) {
    if (existsSync(join(projectRoot, "deps.edn"))) indicators.push("deps.edn");
    if (existsSync(join(projectRoot, "project.clj"))) indicators.push("project.clj");
    return {
      archetype: "CLOJURE_DATOMIC",
      verifyCommand: "clojure -M:test",
      raceCheckCommand: "lein test",
      benchmarkCommand: "clojure -M:bench",
      targetCompanyStandard: "Nubank / Functional",
      detectedIndicators: indicators,
    };
  }

  // 4. Flutter / Dart (Nubank & Spotify Mobile Apps)
  if (existsSync(join(projectRoot, "pubspec.yaml"))) {
    indicators.push("pubspec.yaml");
    return {
      archetype: "FLUTTER_DART_CLIENT",
      verifyCommand: "dart analyze",
      raceCheckCommand: "flutter test --coverage",
      benchmarkCommand: "dart run benchmark/run.dart",
      targetCompanyStandard: "Universal Mobile",
      detectedIndicators: indicators,
    };
  }

  // 5. Python Data & ML Pipeline (Spotify Scio/Klio & RecSys)
  if (existsSync(join(projectRoot, "pyproject.toml")) || existsSync(join(projectRoot, "requirements.txt"))) {
    if (existsSync(join(projectRoot, "pyproject.toml"))) indicators.push("pyproject.toml");
    if (existsSync(join(projectRoot, "requirements.txt"))) indicators.push("requirements.txt");
    return {
      archetype: "PYTHON_DATA_PIPELINE",
      verifyCommand: "ruff check . && mypy .",
      raceCheckCommand: "pytest -v",
      benchmarkCommand: "pytest --benchmark-only",
      targetCompanyStandard: "Spotify / Cloud Native",
      detectedIndicators: indicators,
    };
  }

  // 6. Node.js Layer-0 Pure (EOS System Control Plane)
  if (existsSync(join(projectRoot, "package.json"))) {
    indicators.push("package.json");
    return {
      archetype: "NODE_ZERO_DEPS",
      verifyCommand: "npm run verify:strict",
      raceCheckCommand: "node --test test/*.test.mjs",
      benchmarkCommand: "node bin/eos.mjs turbo",
      targetCompanyStandard: "EOS Sovereign",
      detectedIndicators: indicators,
    };
  }

  return {
    archetype: "UNKNOWN",
    verifyCommand: "node bin/eos.mjs guard",
    raceCheckCommand: "node bin/eos.mjs turbo",
    benchmarkCommand: "node bin/eos.mjs eval",
    targetCompanyStandard: "EOS Sovereign",
    detectedIndicators: indicators,
  };
}
