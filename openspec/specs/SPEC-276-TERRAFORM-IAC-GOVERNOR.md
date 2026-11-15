# SPEC-276: Terraform / OpenTofu Infrastructure as Code (IaC) Governor

## 1. Specification Metadata

- **Specification ID**: `SPEC-276`
- **Component ID**: `eos-system-control-plane`
- **Lifecycle Stage**: `production`
- **Governed Change**: `CHANGE-138`
- **Architectural Regime**: Layer-0 Zero-Dependency Hexagonal
- **Scenarios Covered**: `BDD-1431` through `BDD-1436`

---

## 2. Requirements Engineering (EARS Standard)

### Functional Requirements

- **FR-276-01 (Ubiquitous - IaC Formatting & Syntax)**: EL SISTEMA mantendrá una función de validación que ejecute `terraform fmt -check` y valide la sintaxis canónica de archivos HCL/Terraform sin alterar el árbol de trabajo a menos que se solicite.
- **FR-276-02 (Event-Driven - Sensitive Port Ingress Guard)**: CUANDO se audite un plan de Terraform, EL SISTEMA identificará cualquier regla de ingress de security group que permita tráfico desde `0.0.0.0/0` en puertos sensibles (22, 3389, 5432, 3306, 6379, 27017) y marcará la regla con severidad `CRITICAL`.
- **FR-276-03 (State-Driven - Storage Encryption Baseline)**: MIENTRAS existan recursos de almacenamiento planificados (buckets S3, volúmenes EBS, instancias RDS), EL SISTEMA verificará que declaren cifrado en reposo (KMS o AES-256) y bloqueará la admisión si el cifrado está desactivado.
- **FR-276-04 (Event-Driven - Public Storage Bucket Blocking)**: CUANDO se detecte la creación o modificación de un bucket de almacenamiento de objetos, EL SISTEMA verificará que no tenga ACLs públicas (`public-read`, `allUsers`) y que cuente con bloqueos de acceso público habilitados.
- **FR-276-05 (State-Driven - Destructive State Mutation Protection)**: MIENTRAS un plan de Terraform contenga acciones destructivas (`delete` o `replace`) sobre recursos con estado crítico (bases de datos, tablas de almacenamiento), EL SISTEMA rechazará el plan a menos que se provea autorización explícita (`--allow-destroy`).
- **FR-276-06 (Ubiquitous - Immutable IaC Receipt)**: EL SISTEMA emitirá tras cada auditoría o validación un recibo estructurado con hash SHA-256 inmutable (`docs/evidence/TERRAFORM_RECEIPT.json`).

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-1431 - Terraform Format & Syntax Validation
  DADO un módulo Terraform con sintaxis canónica HCL
  CUANDO se invoca EosTerraformIaCGovernor.validateIaC
  ENTONCES la ejecución retorna status "PASS" con cero errores sintácticos
  Y se emite un recibo criptográfico SHA-256.

ESCENARIO: BDD-1432 - OPA Security Baseline Allows Compliant Enterprise Infrastructure Plan
  DADO un plan de Terraform JSON que define VPC privada, S3 cifrado con KMS y Security Group acotado
  CUANDO se evalúa mediante EosTerraformIaCGovernor.auditPlan
  ENTONCES la auditoría retorna status "PASS" con allowed=true
  Y no se reporta ninguna violación de seguridad.

ESCENARIO: BDD-1433 - Rejection of Security Group with Public Ingress on Sensitive Ports
  DADO un plan de Terraform que abre el puerto 22 (SSH) o 5432 (Postgres) a 0.0.0.0/0
  CUANDO se ejecuta la auditoría mediante EosTerraformIaCGovernor.auditPlan
  ENTONCES la auditoría falla con status "POLICY_VIOLATION"
  Y se reporta la regla "no_public_ingress" detallando el puerto y CIDR inseguro.

ESCENARIO: BDD-1434 - Rejection of Unencrypted Storage and Public Bucket ACLs
  DADO un plan de Terraform con un bucket S3 que usa acl="public-read" o sin cifrado KMS
  CUANDO se audita mediante EosTerraformIaCGovernor.auditPlan
  ENTONCES la auditoría falla reportando violaciones "no_public_storage" o "enforce_encryption_at_rest"
  Y se detiene el pipeline de provisión.

ESCENARIO: BDD-1435 - Unauthorized Database Destruction Blocking
  DADO un plan de Terraform que contiene una acción "delete" sobre un recurso rds_cluster o db_instance
  CUANDO se audita sin el flag allowDestroy=true
  ENTONCES la auditoría retorna status "DESTRUCTION_REJECTED"
  Y se previene la pérdida catastrófica de datos.

ESCENARIO: BDD-1436 - End-to-End CLI Verification and Receipt Persistence
  DADO un archivo de plan Terraform o directorio de módulo
  CUANDO se ejecutan los comandos toolchain:tf:validate y toolchain:tf:audit
  ENTONCES se generan salidas estructuradas y el archivo docs/evidence/TERRAFORM_RECEIPT.json queda persistido con SHA-256.
```
