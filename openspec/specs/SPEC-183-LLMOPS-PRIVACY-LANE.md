# SPEC-183: LLMOps Privacy Lane (Local / Open-Weight)

## Status

- **Status**: APPROVED
- **Date**: 2026-11-09
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution Law VI
- **Module**: `src/core/eosLlmOpsPrivacyLane.ts`

---

## 1. Context and Rationale

Glorian must optionally keep inference on-box (local SLM / open-weight HTTP) without shipping plaintext secrets to frontier cloud APIs. The privacy lane is a Layer-0 fail-closed policy gate — not a hardware TEE and not Level-5.

## 2. Functional Requirements (EARS Syntax)

- **FR-920 (Ubiquitous - Lane Resolution)**: `The system shall resolve EOS_LLM_PRIVACY_LANE into cloud_allowed, local, or open_weight.`

- **FR-921 (Unwanted Condition - Secret Scan)**: `IF a payload matches a plaintext secret pattern, THEN the system shall reject with REJECT_PLAINTEXT_SECRET regardless of lane.`

- **FR-922 (State-Driven - Local Lane)**: `WHILE the lane is local or open_weight, THE SYSTEM SHALL reject remote cloud provider endpoints.`

- **FR-923 (Event-Driven - Local Allow)**: `WHEN the lane is local or open_weight and the endpoint is local/open-weight, THE SYSTEM SHALL allow with ALLOW_LOCAL.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-LLMOPS-PRIVACY-002 local lane rejects remote OpenAI
  GIVEN EOS_LLM_PRIVACY_LANE=local
  WHEN evaluatePrivacyLane is called with api.openai.com
  THEN ok is false AND code is REJECT_REMOTE_PROVIDER

SCENARIO: BDD-LLMOPS-PRIVACY-004 plaintext secret always fail-closed
  GIVEN any privacy lane
  WHEN the payload contains a synthetic sk- assembled at runtime
  THEN ok is false AND code is REJECT_PLAINTEXT_SECRET
```

## 4. Non-Claims

Not NSA_GRADE · not Level-5 · not physical enclave attestation.
