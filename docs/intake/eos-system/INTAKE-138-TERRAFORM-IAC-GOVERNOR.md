# INTAKE-138: Terraform / OpenTofu Infrastructure as Code (IaC) Governor

## 1. Context & Business Need

In Fortune 500 and Big Tech organizations (AWS, Google Cloud, Azure, Spotify, Stripe), Kubernetes workloads do not exist in a vacuum; they depend on cloud infrastructure provisioned through Infrastructure as Code (IaC):

- Virtual Private Clouds (VPCs), subnets, routing tables, and internet gateways.
- Managed database clusters (AWS Aurora/RDS, Google Cloud SQL, Neon Postgres).
- Identity and Access Management (IAM) roles, service accounts, and least-privilege policies.
- Storage buckets (S3, GCS) and encryption keys (KMS).

Unregulated IaC deployments cause catastrophic security breaches and outages:

- Security groups inadvertently opening port 22 (SSH) or port 5432 (Postgres) to `0.0.0.0/0`.
- Object storage buckets created without encryption or with public read permissions.
- Inadvertent `terraform apply` executions that delete or recreate stateful database instances (`destroy` actions).

## 2. Objective

Introduce the **Terraform / OpenTofu Infrastructure as Code Governor** (`EosTerraformIaCGovernor`):

1. Hermetic syntax and format verification via `terraform fmt -check` and `terraform validate`.
2. OPA Rego v1 security baseline evaluation (`policies/iac/terraform_baseline.rego`) over Terraform plan JSON representations (`terraform show -json`).
3. Automated detection and fail-closed blocking of:
   - Public ingress to sensitive ports (`0.0.0.0/0` on SSH/RDP/Databases).
   - Unencrypted storage volumes and public object buckets.
   - Destructive state changes (`delete`/`replace`) on critical persistent resources.
4. Generation of immutable cryptographic execution receipts (`docs/evidence/TERRAFORM_RECEIPT.json`).
5. Provision of a gold-standard enterprise Terraform template (`templates/iac/glorian-enterprise-infra/`).

## 3. Architectural Boundary

- Pure Layer-0 TypeScript (`dependencies: {}`).
- Isolated CLI handler `bin/commands/cliTerraform.mjs`.
- Governed by SPEC-276 and BDD-1431 through BDD-1436.
