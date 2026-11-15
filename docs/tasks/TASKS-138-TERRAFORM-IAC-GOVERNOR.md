# TASKS-138: Terraform / OpenTofu Infrastructure as Code (IaC) Governor

## Task DAG & Implementation Checklist

- [ ] **TASK-138-01**: Implement Rego v1 security baseline in `policies/iac/terraform_baseline.rego`.
  - Done criteria: Rules for `no_public_ingress`, `no_public_storage`, `enforce_encryption_at_rest`, `no_unauthorized_deletion`.
- [ ] **TASK-138-02**: Create enterprise Terraform template in `templates/iac/glorian-enterprise-infra/`.
  - Done criteria: `main.tf`, `variables.tf`, `outputs.tf` formatted with `terraform fmt`.
- [ ] **TASK-138-03**: Implement `src/core/eosTerraformIaCGovernor.ts`.
  - Done criteria: Methods `validateIaC`, `auditPlan`, dual OPA/native evaluation, receipt generation; lines <= 744.
- [ ] **TASK-138-04**: Export module from `src/core/index.ts`.
  - Done criteria: `src/core/index.ts` exports `EosTerraformIaCGovernor`; lines <= 744.
- [ ] **TASK-138-05**: Implement CLI handler in `bin/commands/cliTerraform.mjs` and wire in `bin/commands/cliDevOps.mjs`.
  - Done criteria: `toolchain:tf:validate`, `toolchain:tf:plan`, `toolchain:tf:audit` registered; lines <= 744.
- [ ] **TASK-138-06**: Update `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (357 -> 360 commands).
  - Done criteria: Parity ratio 1.0 verified by `hygiene:audit`.
- [ ] **TASK-138-07**: Implement automated test suite `test/eosTerraformIaCGovernor.test.mjs`.
  - Done criteria: BDD-1431 through BDD-1436 pass 100%.
