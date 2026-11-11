# CHANGE-083: Hermetic Single-Executable Application (SEA) Binary Compiler

## Metadata

- **Change ID**: `CHANGE-083`
- **Spec ID**: `SPEC-198`
- **Component**: `eos-system-control-plane`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: PROPOSED
- **Date**: 2026-11-10
- **Scope**: Layer-0 Hermetic SEA Compiler, CLI Command, MCP Action, Test Suite

## Description

Implements an autonomous, zero-dependency binary compiler (`EosHermeticSeaCompiler`) that packages Glorian into standalone native executables:

1. Generates declarative `sea-config.json` and compiles the Node 24 SEA blob (`dist/glorian.blob`).
2. Synthesizes a standalone native executable by cloning the host runtime (`process.execPath`), injecting the SEA blob into the executable resource section, and toggling the `NODE_SEA_FUSE` sentinel.
3. Digitally signs the resulting native binary with native Ed25519 asymmetric cryptography.
4. Emits a SLSA Level-4 / in-toto v1.0 Provenance statement linking the output binary digest to the build commit and environment.
5. Emits a CycloneDX v1.5 SBOM attesting zero third-party runtime dependencies.

## Zero Runtime Dependencies

Operates exclusively using Node.js built-ins (`node:fs`, `node:path`, `node:crypto`, `node:child_process`) and Layer-0 primitives (`assertPrecondition`, `pureSha256`, `deepFreeze`).
