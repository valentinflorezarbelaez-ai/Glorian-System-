# OPENSPEC BASE SPECIFICATION: HEXAGONAL LAYER-0 PURITY (SPEC-002)

## 1. Scope

Defines module boundaries, dependency flow, and external dependency invariants.

## 2. Requirements (EARS)

- **UBIQUITOUS**: THE SYSTEM SHALL maintain zero external runtime dependencies (`package.json` -> `dependencies: {}`).
- **UBIQUITOUS**: THE SYSTEM SHALL maintain unidirectional dependency flow: Presentation/UI -> Application -> Domain Core.
- **ERROR/UNWANTED**: IF a domain module contains imports of UI components or third-party web frameworks, THEN THE SYSTEM SHALL fail compilation with exit code 1.
- **UBIQUITOUS**: THE SYSTEM SHALL guarantee zero cyclic dependencies via directed DFS graph analysis.
