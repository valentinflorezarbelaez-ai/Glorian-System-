# INTAKE-167: FDIR Clinical Firewall for Knowledge Ontology & Sentinel Integration

- **Project**: `eos-system-control-plane` (Glorian System)
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Date**: 2026-11-16T10:25:00Z
- **Category**: Failure Detection, Isolation and Recovery (FDIR), Ontology Graph Integrity & Sentinel Daemon
- **Target Spec**: `SPEC-305`
- **Target Change**: `CHANGE-167`
- **Constitutional Mandate**: Section 5 (FDIR & Recovery Protocols — "La Sanación del Grafo")

---

## 1. Context & Business Need

Section 5 of the EOS Constitution establishes:

> _"La Sanación del Grafo: El módulo `EOSFDIROntology` actuará como el cortafuegos clínico sobre la Ontología de Conocimiento. Ante la detección de cualquier enlace huérfano (`ORPHAN_LINK_DETECTED`), el sistema lo aislará y purgará de forma automática, restituyendo la armonía relacional del Todo basándose en las verdades objetivas del Ledger."_

In distributed control planes and bi-temporal knowledge graphs (`EosOntologyCyclotron`), state mutations across multi-agent workflows (Antigravity, Cursor, Kiro, CLI) can leave orphaned edges when entities are tombstoned, deleted, or rolled back. If left unchecked, these dangling references create corrupted inferences in semantic queries, circular deadlock chains in code dependency graphs, and drift between the memory plane and the immutable Ledger.

To implement this constitutional requirement without third-party dependencies (Law V), Glorian System requires:

1. Clinical firewall scanner inspecting nodes, edges, bi-temporal intervals, and ledger anchors.
2. Immediate isolation and quarantine of orphan links (`ORPHAN_LINK_DETECTED`).
3. Autonomous surgical purging of corrupt edges while preserving node immutability.
4. Tarjan's Strongly Connected Components (SCC) algorithm to break circular semantic deadlocks.
5. Direct integration with `EosSentinelDaemon` to reflect live FDIR health in the 24/7 pulse.
6. Cryptographic audit receipt at `docs/evidence/FDIR_ONTOLOGY_RECEIPT.json`.

---

## 2. Invariants & Guardrails

1. **Law V Compliance**: 100% native Layer-0 Node.js 22.18+ / 24+ without external npm dependencies.
2. **Sub-millisecond Graph Scan**: Graph evaluation across $>1,000$ entities must complete in $< 15\text{ms}$.
3. **Idempotent Purging**: Re-running surgical healing on a sanitized graph must produce 0 mutations and preserve deterministic SHA-256 receipts.
4. **Epistemic Truth**: Emits verified receipt at `docs/evidence/FDIR_ONTOLOGY_RECEIPT.json`.
