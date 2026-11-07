# TASKS-024: THE SOVEREIGN GNOSTIC TEMPLE SENTINEL & INVIOLABLE FINOPS BUDGET SHIELD

<!-- Governed by EOS Supreme Constitution & SDLC Protocol -->

- **Task Package**: `TASKS-024`
- **Spec**: `SPEC-031`
- **Plan**: `PLAN-024`
- **Target Release**: `v39.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect & Tony Stark)
- **Status**: `IN_PROGRESS`

---

## 1. Task DAG & Execution Sequence

```
[TASK-024-1: Core Gnostic Temple Sentinel (eosGnosticTemple.ts)]
                         |
                         v
[TASK-024-2: Inviolable FinOps Budget Shield (eosFinOpsBudget.ts)]
                         |
                         v
[TASK-024-3: CLI & MCP Tools Integration in bin/eos.mjs and eosMcpServer.ts]
                         |
                         v
[TASK-024-4: Test Suite test/eosGnosticFinOps.test.mjs]
                         |
                         v
[TASK-024-5: Master CI/CD Verification & Production Gate]
```

## 2. Task Definitions & Done Criteria

1. **TASK-024-1: Core Gnostic Temple Sentinel (`src/core/eosGnosticTemple.ts`)**

   - Implement `EosGnosticTemple` with:
     - `auditThreeBrains(hoursIntellectual, hoursEmotional, hoursMotor)`: Returns percentage distribution and warns if intellectual > 70%.
     - `evaluateClaveDeSol(subject, object, place)`: Returns Awake Consciousness Score (0-100) and recommendation.
     - `checkCircadianVeto(currentDate)`: Checks if time is between 22:30 and 05:00 and issues `CIRCADIAN_REST_VETO`.
     - `prescribeOctaveShock(currentInterval)`: Injects conscious shock for _Mi-Fa_ and _Si-Do_ stagnation.
   - Done criteria: 100% pure Layer-0, zero external dependencies.

2. **TASK-024-2: Inviolable FinOps Budget Shield (`src/core/eosFinOpsBudget.ts`)**

   - Implement `EosFinOpsBudget` with:
     - Token rate table (Gemini, Claude, GPT, DeepSeek, Grok) in micro-cents ($0.000001 USD).
     - `recordUsage(provider, model, promptTokens, completionTokens)`: Adds to ledger and checks against $15.00 limit.
     - `isBudgetAvailable(estimatedCost)`: Returns false if cost exceeds limit (fail-closed).
     - `getCajitasState()`: Returns balances for El Refugio, Food, Rent, Third Factor/Charity.
   - Done criteria: Zero financial leakages, fail-closed at limit.

3. **TASK-024-3: CLI & MCP Tools Integration**

   - Add CLI subcommands in `bin/eos.mjs`: `eos temple`, `eos sol`, `eos diary`, `eos budget`.
   - Register MCP tools in `src/mcp/eosMcpServer.ts`: `eos_gnostic_temple_audit`, `eos_finops_budget_check`, `eos_clave_de_sol_evaluate`.
   - Done criteria: Accessible via CLI and MCP stdio/SSE.

4. **TASK-024-4: Test Suite (`test/eosGnosticFinOps.test.mjs`)**

   - Write comprehensive node:test suite verifying all 5 pillars of SPEC-031.
   - Done criteria: 100% pass rate.

5. **TASK-024-5: Master CI/CD Verification & Production Gate**
   - Register in `scripts/verify-cicd-pipeline.mjs` (suite 33/33).
   - Register in `scripts/verify-landing.mjs`.
   - Bump version to `39.0.0` in `package.json`.
   - Update `IMPLEMENTATION_AUTHORIZATION.md` and `AGENTS.md`.
   - Done criteria: 7/7 CI/CD stages pass with Exit Code 0.

---

_Signed by Principal Architect: Valentín Flórez Arbeláez_
