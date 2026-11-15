# PLAN-138: Terraform / OpenTofu Infrastructure as Code (IaC) Governor

## 1. Architectural Strategy

- **Layer-0 Purity**: Uses Node.js native `spawnSync` from `node:child_process`, `node:fs`, `node:path`. Zero runtime dependencies.
- **Dual Execution Engine**:
  - Primary: Invokes `opa eval` over `policies/iac/terraform_baseline.rego` against plan JSON.
  - Fallback: Native pure Layer-0 deterministic AST evaluator in TypeScript for environments where OPA binary is temporarily unavailable or in fast unit tests.
- **Plan JSON Ingestion**: Accepts standard `terraform show -json <planfile>` outputs or raw plan JSON data objects.
- **Isolated CLI Handler**: Handled in `bin/commands/cliTerraform.mjs` to keep `cliDevOps.mjs` strictly within the 744-line headroom budget.

## 2. Alternatives Considered & Rejected

- _Alternative A: Third-party npm packages (`@cdktf/provider-aws`, `tflint-node`)_. Rejected due to Law V (Zero Runtime Dependencies) and supply chain attack risks.
- _Alternative B: Evaluating HCL directly with regexes_. Rejected because Terraform plans (`resource_changes`) contain computed attributes, dependencies, and before/after state diffs that regexes on raw HCL cannot faithfully reconstruct.

## 3. Security Invariants

- Invariant 1: Ingress with CIDR `0.0.0.0/0` on sensitive ports (22, 3389, 5432, 3306, 6379, 27017) is an automatic fail-closed violation.
- Invariant 2: Object storage (S3/GCS) with public ACLs (`public-read`, `allUsers`) or missing server-side encryption configuration is rejected.
- Invariant 3: Deletion of stateful database resources (`aws_db_instance`, `aws_rds_cluster`, `google_sql_database_instance`) without explicit override is blocked.
