# SPEC-152: Universal Agent Session Contract & Product Golden Path Enforcement

## 1. Specification Metadata
- **Specification ID**: `SPEC-152`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-043`, `SPEC-145`, `SPEC-147`, `SPEC-151`
- **Architectural Decisions**: `ADR-0189`, `ADR-0190`
- **Module Target**: `src/core/eosUniversalAgentSessionContract.ts`, `src/core/eosProductDeliveryOrchestrator.ts`, `src/mcp/eosMcpServer.ts`, `test/eosUniversalAgentSessionContract.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-483 (Event-Driven / Session open)**: `WHEN an agent opens a session with ideFamily in {cursor, antigravity, claude-code, vscode} and a non-empty directive, THE SYSTEM SHALL classify the mission via EosAntigravityDirector, bind a sessionId, store the prescribed mandatory MCP DAG, and return a 64-character SHA-256 sessionReceipt.`

- **FR-484 (Event-Driven / DAG progress)**: `WHEN recordToolInvocation is called with a valid sessionId and toolName, THE SYSTEM SHALL mark that tool complete if it appears in the session DAG.`

- **FR-485 (Unwanted condition / Write without contract)**: `IF authorizeWrite is called without a live session, with a mismatched receipt, with writeBarrierStatus BLOCKED_BY_LAW_IV, or with any mandatory DAG tool incomplete, THEN THE SYSTEM SHALL deny the write and return decision deny.`

- **FR-486 (Event-Driven / Authorized write)**: `WHEN authorizeWrite is called with a live session whose mandatory DAG tools are all recorded and whose write barrier is AUTHORIZED, THE SYSTEM SHALL allow the write and include the sessionReceipt in the decision.`

- **FR-487 (Event-Driven / Real gates on materialization)**: `WHEN EosProductDeliveryOrchestrator.deliverProduct runs with dryRun false and no injected gates port, THE SYSTEM SHALL use createRealVerificationGatePort which inspects package.json runtime dependencies, scans the delivery payload for secret patterns, and evaluates the mutation floor.`

- **FR-488 (Unwanted condition / Scorecard floor)**: `IF the Product Quality Scorecard score is less than 80 after gates pass, THEN THE SYSTEM SHALL return status BLOCKED with reason SCORECARD_FLOOR.`

- **FR-489 (Ubiquitous / Scope)**: `THE SYSTEM SHALL NOT claim Level 5 autonomy, multi-host consensus, or hot Rust-to-Wasm compilation under this specification.`

---

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: BDD-461 Multi-IDE session binding
  GIVEN a project root with a registered eos-system target
  WHEN openSession is called for ideFamily cursor with a product delivery directive
  THEN sessionId is a non-empty string
  AND sessionReceipt matches /^[a-f0-9]{64}$/
  AND prescribedMcpDag contains at least one mandatory tool
  AND ideFamily equals cursor

SCENARIO: BDD-462 Pre-write DAG enforcement
  GIVEN an open session with a mandatory DAG
  WHEN authorizeWrite is called before recording DAG tools
  THEN decision equals deny
  AND missingTools is a non-empty array
  WHEN each mandatory tool is recorded and authorizeWrite is called again
  THEN decision equals allow

SCENARIO: BDD-463 Unknown IDE family rejected
  GIVEN an invalid ideFamily value
  WHEN openSession is invoked
  THEN the call throws an Error containing "Unsupported ideFamily"

SCENARIO: BDD-464 Real gates on write materialization
  GIVEN deliverProduct with dryRun false and no injected gates
  WHEN the orchestrator selects the verification port
  THEN turbo_purity evidence contains RUNTIME_DEPENDENCIES
  AND status is SUCCESS or BLOCKED or FAILED (never hermetic LAYER0_DEPENDENCIES_EMPTY as the sole turbo evidence)

SCENARIO: BDD-465 Scorecard floor fail-closed
  GIVEN a delivery whose computed scorecard would be below 80
  WHEN deliverProduct finishes gate evaluation
  THEN status equals BLOCKED
  AND reason equals SCORECARD_FLOOR

SCENARIO: BDD-466 MCP session contract dispatch
  GIVEN EosMcpServer
  WHEN eos_agent_session_contract is called with action open for ideFamily antigravity
  THEN the result contains sessionId and sessionReceipt
  WHEN action authorize_write is called without completing the DAG
  THEN allowed equals false
```
