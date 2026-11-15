# PLAN-136: Architecture Plan for Kubernetes Deployment Pipeline & k6 Engine

## Architectural Decision Records (ADRs)

### ADR-136-001: 5-Stage Staged Gate for Kubernetes Apply

- **Context**: Applying manifests directly to clusters creates risks of misconfiguration, secret leakage, or unintended cluster modification.
- **Decision**: All Kubernetes writes orchestrated by Glorian must traverse 5 sequential stages: Context Check -> OPA Rego Evaluation -> Trivy Vulnerability Gate -> Server Dry-Run -> Explicit Live Apply.
- **Alternatives Rejected**: Direct `kubectl apply` without pre-admission gates (violates Law II and Law VI).

### ADR-136-002: Hermetic k6 Test Script Generation & Telemetry Capture

- **Context**: Running load tests requires dynamic k6 JavaScript test scripts without cluttering the repository with ad-hoc scripts.
- **Decision**: `EosK6LoadTestAdapter` synthesizes ephemeral, hermetic k6 test scripts in temporary memory/disk, invokes `k6 run --summary-export`, parses JSON results, and securely removes the test script.
- **Alternatives Rejected**: Requiring manually maintained `.js` scripts per endpoint (unscalable and brittle).

### ADR-136-003: Integration with Multi-Window SLO Governor

- **Context**: Load test results must not be isolated numbers; they must connect to Glorian's existing reliability governance (`SPEC-084` / `SPEC-271`).
- **Decision**: k6 output percentiles (P95, P99) are mapped directly against SLO error-budget thresholds to determine automated release eligibility.

---

## Architecture Diagram

```mermaid
flowchart TD
  User["CLI / Agent (`eos toolchain:deploy`)"] --> GatedDeploy["`EosKubernetesDeployGovernor`"]
  GatedDeploy --> B1{"Barrier 1: Context Guard<br/>`/^kind-/`"}
  B1 -- Unauthorized --> BlockCtx["`CONTEXT_UNAUTHORIZED`"]
  B1 -- Allowed --> B2{"Barrier 2: OPA Policy<br/>Rego Security Baseline"}
  B2 -- Violations Found --> BlockPolicy["`POLICY_VIOLATION`"]
  B2 -- Passed --> B3{"Barrier 3: Server Dry-Run<br/>`kubectl apply --dry-run=server`"}
  B3 -- Failed Admission --> BlockAdmission["`ADMISSION_REJECTED`"]
  B3 -- Passed --> B4{"Barrier 4: Explicit Authorization<br/>`--yes` provided?"}
  B4 -- No --> ReportDry["`DRY_RUN_PASSED`"]
  B4 -- Yes --> LiveApply["`kubectl apply -f manifest`<br/>`APPLIED` + Receipt"]
```
