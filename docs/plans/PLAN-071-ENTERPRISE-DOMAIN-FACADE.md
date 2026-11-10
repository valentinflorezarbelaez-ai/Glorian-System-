# PLAN-071: Enterprise Domain Facade & Standardized Ergonomics

- **Owner**: Valentín Flórez Arbeláez (Architect & Owner)
- **Status**: APPROVED
- **Date**: 2026-11-10
- **Governed by**: SPEC-186, CHANGE-071

## 1. Architectural Strategy

Implement an Enterprise Domain Facade (`src/core/eosEnterpriseFacade.ts`) following standard Hexagonal & Facade patterns:

1. **Purity**: Zero external dependencies (`dependencies: {}`), strict TypeScript types.
2. **Encapsulation**: Expose clean, standardized domain names wrapping the specialized internal core modules (`EosAstral`, `EosElohim`, `EosAin`, `GlorianConstitutionalTribunal`, `EosFleetMissionControl`, `EosOtelDistributedTracing`).
3. **Design by Contract**: Precondition and postcondition validation on all public APIs.
4. **Verification**: 100% test coverage across all BDD scenarios in `test/eosEnterpriseFacade.test.mjs`.

## 2. Alternatives Considered

- _Alternative A_: Rename existing core files directly (`EosAstral.ts` -> `EphemeralWorkspaceManager.ts`).
  - _Rejected_: Breaks backwards compatibility with existing MCP dispatchers, CLI commands, and historical OpenSpec artifacts.
- _Alternative B_: Enterprise Facade Pattern (Selected).
  - _Accepted_: Provides standard enterprise ergonomics while preserving internal specialized identity and 100% backward compatibility.
