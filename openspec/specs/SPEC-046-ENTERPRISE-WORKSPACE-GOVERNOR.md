# SPEC-046: ENTERPRISE MULTI-PROJECT WORKSPACE GOVERNOR & POLYGLOT TOPOLOGY ENGINE (v52.0.0)

* **Status**: `SPECIFICATION_APPROVED`
* **Change Reference**: `CHANGE-039`
* **Architecture Plan**: `PLAN-039` (`ADR-052`)
* **Formal Model**: `docs/formal/EnterpriseWorkspaceGovernor.tla`

---

## 1. Formal Functional Requirements (IEEE 830 / EARS)

* **FR-142 (Deep Polyglot Monorepo, Workspace Member & API Contract Topology Discovery)**:
  `CUANDO se solicite la inspección arquitectónica de un proyecto empresarial (monorepo o servicio), EL SISTEMA escaneará de forma acotada (sin seguir enlaces simbólicos) su topología políglota detectando orquestadores de workspace (Turborepo, Nx, pnpm/npm workspaces, Cargo workspace, Go work, Python uv/Poetry, Bazel, Gradle, Melos), sub-paquetes/servicios internos, contratos formales de interfaz (OpenAPI, Protobuf, GraphQL, JSON Schema, Prisma/SQL, TLA+) y postura de cadena de suministro (lockfiles deterministas, contenedores, IaC y CI/CD), sellando un digest Merkle SHA-256.`

* **FR-143 (Constitutional Law IV Safe Enterprise Project Onboarding)**:
  `CUANDO se ejecute el onboarding de un repositorio externo hacia el plano de control EOS, EL SISTEMA generará exclusivamente dentro del directorio de EOS el expediente constitucional base (docs/intake/<projectId>/PROJECT_CONTEXT.md, inventory.json, docs/specs/<projectId>/SPEC-001-BASELINE.md en formato EARS+BDD y docs/audits/<projectId>/AUDIT-001-BASELINE.json) y registrará el proyecto en docs/projects/registry.json con nivel inicial LEVEL_1_READ_ONLY_AUDIT, escribiendo cero bytes en el repositorio externo.`

* **FR-144 (Multi-Tenant Registered Fleet Boundary & Law IV Write Gate)**:
  `MIENTRAS el servidor MCP o el gobernador empresarial resuelvan un identificador de proyecto registrado en docs/projects/registry.json, EL SISTEMA permitirá operaciones de lectura confinadas dentro de la raíz real del proyecto registrado rechazando enlaces simbólicos y rutas fuera de frontera, y SI se solicita cualquier operación con modo de escritura externa sin las 6 precondiciones de la Ley IV y autorización LEVEL_2+, ENTONCES EL SISTEMA bloqueará la operación de forma fail-closed.`

* **FR-145 (Polyglot Verification Matrix & Bounded Structural Gate Execution)**:
  `CUANDO se solicite verificar un proyecto empresarial gobernado, EL SISTEMA sintetizará la matriz determinista de compuertas de verificación acorde a sus lenguajes y contratos detectados (TypeScript, Node, Go, Rust, Python, Flutter/Dart, manifiestos JSON/OpenAPI y escaneo de secretos) y ejecutará validaciones estructurales de solo lectura emitiendo un recibo criptográfico en EosDurableSqliteLedger.`

* **FR-146 (Unified CLI & MCP Enterprise Governance Surface)**:
  `EL SISTEMA expondrá la gobernanza empresarial multi-proyecto tanto en la CLI (eos project list|inspect|onboard|verify) como en el servidor MCP (eos_enterprise_workspace con anotaciones MCP 2025-03-26 e inclusión en el perfil core) para que Google Antigravity dirija repositorios empresariales de cualquier escala.`

---

## 2. Formal Acceptance Criteria (Gherkin BDD)

```gherkin
ESCENARIO: BDD-138 — Descubrimiento profundo de monorepo políglota, sub-servicios, contratos API y postura de lockfiles
  DADO un monorepo empresarial con pnpm-workspace.yaml, turbo.json, paquetes TypeScript, un microservicio Go (go.mod), un crate Rust (Cargo.toml) y esquemas OpenAPI + Protobuf + Prisma
  CUANDO EosEnterpriseWorkspaceGovernor.inspectWorkspace analiza el directorio
  ENTONCES identifica todos los orquestadores, enumera cada miembro del workspace con su lenguaje y rol arquitectónico, cataloga los contratos OpenAPI/Protobuf/Prisma, verifica la presencia de lockfiles
  Y produce un reporte inmutable con digest SHA-256 de 64 caracteres ignorando enlaces simbólicos

ESCENARIO: BDD-139 — Onboarding constitucional seguro bajo Ley IV (cero escrituras en el repositorio externo)
  DADO un repositorio empresarial externo aún no registrado en docs/projects/registry.json
  CUANDO se invoca onboardWorkspace en modo persistente sobre un plano de control EOS aislado
  ENTONCES crea los artefactos de intake, especificación EARS/BDD, auditoría JSON y la entrada REGISTERED con LEVEL_1_READ_ONLY_AUDIT dentro del plano de control EOS
  Y el repositorio externo permanece 100% libre de archivos escritos o modificados, registrando recibo en EosDurableSqliteLedger

ESCENARIO: BDD-140 — Resolución multi-tenant de flota registrada y bloqueo fail-closed de escritura externa sin Ley IV
  DADO un proyecto registrado con LEVEL_1_READ_ONLY_AUDIT y otro proyecto registrado con LEVEL_3_PRODUCTION_AUTHORIZED + 6 precondiciones completas
  CUANDO se evalúa resolveAuthorizedWorkspace en modo READ_ONLY y en modo WRITE_GATED
  ENTONCES READ_ONLY permite inspección confinada en ambos proyectos rechazando path traversal (..)
  Y WRITE_GATED bloquea de inmediato al proyecto LEVEL_1_READ_ONLY_AUDIT con código LAW_IV_WRITE_BARRIER_BLOCKED mientras autoriza únicamente al proyecto con las 6 precondiciones completas

ESCENARIO: BDD-141 — Síntesis y ejecución acotada de compuertas de verificación empresariales y validación de contratos
  DADO un workspace empresarial con manifiestos JSON, especificación OpenAPI y código fuente limpio vs un workspace con JSON corrupto o secreto expuesto
  CUANDO se ejecuta verifyWorkspace en modo estructural de solo lectura
  ENTONCES valida sintaxis de manifiestos/contratos JSON, higiene de secretos, determinismo de lockfiles y plan de comandos nativos por stack (tsc, go vet, cargo check, pytest, dart analyze)
  Y reporta PASS en el workspace íntegro y FINDINGS_IDENTIFIED cuando detecta contrato inválido o credencial filtrada

ESCENARIO: BDD-142 — Despacho unificado vía MCP (eos_enterprise_workspace en perfil core) y CLI (eos project)
  DADO una instancia de EosMcpServer en perfil core y la CLI bin/eos.mjs
  CUANDO Google Antigravity invoca tools/list y tools/call sobre eos_enterprise_workspace (actions: list, inspect, verify)
  ENTONCES la herramienta aparece en el catálogo core con ToolAnnotations MCP 2025-03-26 válidas y responde con telemetría verificada sobre la flota registrada de EOS
```
