# INTAKE-206: Autonomous Agentic Context Engine & Multimodal Prompt Ingestion (`SPEC-344`)

- **Change ID**: `CHANGE-206`
- **Spec ID**: `SPEC-344`
- **Status**: `INTAKE_COMPLETE`
- **Project**: `eos-system-control-plane`
- **Date**: 2026-11-18
- **Architect**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## 1. Context & Business Need

Following the successful creation and verification of the Sovereign Web Compiler (`SPEC-343` / `CHANGE-205`), Glorian System advances to **Frontera II: Agentic Context Engine & Multimodal Prompt Ingestion (`SPEC-344`)**.

Modern Agentic Engineering (exemplified by the _Agentic Engineer Starter_ curriculum and autonomous coding agent patterns) demands deterministic context ingestion, adaptive token budgeting, prompt injection sanitization, and lossless architectural signal extraction. Relying on heuristic prompt slicing causes context window overflow, hallucinated dependencies, and catastrophic forgetting during multi-turn agent execution.

This engine introduces `EosAgenticContextEngineCore`, providing pure Layer-0 sliding-window semantic chunking, prompt-injection defense barriers, budget-driven AST token compaction, and mathematical recall evaluation.

---

## 2. Invariant Principles & Constraints

1. **Law I & Law V**: Pure Layer-0 implementation (`dependencies: {}`), zero external tokenizer or embeddings dependencies.
2. **Law VI (Absolute Security)**: Fail-closed prompt injection defense scanning for indirect injection, adversarial boundary escaping, and unauthorized persona overrides.
3. **SPEC-250**: Strict module line ceiling $\le 800$ lines with $\ge 12$ lines headroom across all touched modules.
4. **SPEC-342**: Hermetic evidence receipt emission via `resolveEvidencePath` to `docs/evidence/AGENTIC_CONTEXT_ENGINE_RECEIPT.json`.
5. **Deterministic Recall**: Minimum 95% semantic retrieval recall across indexed engineering prompts.
