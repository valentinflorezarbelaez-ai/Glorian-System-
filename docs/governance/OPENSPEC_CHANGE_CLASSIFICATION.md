# OpenSpec Change Classification (Tip-Refresh)

**Date**: 2026-11-04  
**Purpose**: Acotar el conjunto activo de deltas sin reabrir ladders sellados ni romper el catálogo vivo en `openspec/changes/`.

## Active / recently materialized

| Change | Status | Spec | Notes |
|---|---|---|---|
| `CHANGE-080-REPOSITORY-KNOWLEDGE-GRAPH.md` | Materializing in-tree (`EosKnowledgeGraphEngine` + MCP `eos_query_knowledge_graph`; BDD-404..409 green) | SPEC-145 | Tip-refresh treats this as the sole Horizon-3 delta; seal EVD when owner authorizes Level 3 close-out |

## Sealed historical living deltas

Los demás archivos en `openspec/changes/` (CHANGE-001 … CHANGE-079 y duplicados históricos) se tratan como **registro histórico vivo** ya aplicado o superseded. No se mueven masivamente a `/archive` en esta oleada para preservar `eos_check_openspec` / `EosOpenSpecSync.listChanges()` (lee `*.md` en el directorio raíz de changes).

Clases observadas en tip-refresh:

- `APPLIED_AND_VERIFIED` / `IMPLEMENTED*` / `APPROVED` / `SUPERSEDED` → sellados
- `PROPOSED` fuera de CHANGE-080 → tratados como histórico ya materializado en specs/código (no reabrir)

## Invariant

- `eos_check_openspec` debe permanecer `valid: true` con `orphanLinks: []`.
- Nuevo trabajo = nuevo CHANGE vía SDD; no editar changes sellados salvo corrección factual tip-refresh.
