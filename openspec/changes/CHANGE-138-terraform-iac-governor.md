# CHANGE-138: Terraform / OpenTofu Infrastructure as Code (IaC) Governor

## Executive Summary

Implements Phase D2 of the Glorian Sovereign Enterprise Control Plane:

1. **Terraform IaC Governor (`src/core/eosTerraformIaCGovernor.ts`)**:
   - `validateIaC(modulePath)`: Validates Terraform/OpenTofu formatting and syntax.
   - `auditPlan(planJson, options)`: Analyzes plan change sets against OPA Rego v1 security baseline (`policies/iac/terraform_baseline.rego`).
   - Blocks public ingress on sensitive ports, unencrypted storage, public bucket ACLs, and unauthorized resource destruction.
   - Generates cryptographic SHA-256 execution receipt (`docs/evidence/TERRAFORM_RECEIPT.json`).
2. **OPA IaC Security Baseline (`policies/iac/terraform_baseline.rego`)**:
   - Rego v1 rules evaluating Terraform planned resource changes (`resource_changes[_]`).
3. **Enterprise Infrastructure Template (`templates/iac/glorian-enterprise-infra`)**:
   - Compliant Terraform module defining private VPC, KMS-encrypted S3 bucket with public access block, and private Postgres security group.
4. **CLI Hygiene & Parity**:
   - Introduces `eos toolchain:tf:validate`, `eos toolchain:tf:plan`, and `eos toolchain:tf:audit`.
   - Increases governed CLI commands catalog from 357 to 360.

## Scope & Delta

- **Files Added**:
  - `docs/intake/eos-system/INTAKE-138-TERRAFORM-IAC-GOVERNOR.md`
  - `openspec/changes/CHANGE-138-terraform-iac-governor.md`
  - `openspec/specs/SPEC-276-TERRAFORM-IAC-GOVERNOR.md`
  - `docs/plans/PLAN-138-TERRAFORM-IAC-GOVERNOR.md`
  - `docs/tasks/TASKS-138-TERRAFORM-IAC-GOVERNOR.md`
  - `policies/iac/terraform_baseline.rego`
  - `src/core/eosTerraformIaCGovernor.ts`
  - `templates/iac/glorian-enterprise-infra/main.tf`
  - `templates/iac/glorian-enterprise-infra/variables.tf`
  - `templates/iac/glorian-enterprise-infra/outputs.tf`
  - `bin/commands/cliTerraform.mjs`
  - `test/eosTerraformIaCGovernor.test.mjs`
- **Files Modified**:
  - `src/core/index.ts`: export `EosTerraformIaCGovernor`.
  - `bin/commands/cliDevOps.mjs`: delegate `toolchain:tf:*` commands.
  - `bin/commands/cliHelpCatalog.mjs`: catalog new commands.
  - `docs/DEVELOPER_GUIDE.md`: document new commands and update count to 360.
