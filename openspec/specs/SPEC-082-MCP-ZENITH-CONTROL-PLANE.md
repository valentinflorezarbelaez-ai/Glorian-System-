# SPEC-082: MCP ZENITH CONTROL PLANE TOOLS

## 1. Specification Metadata
- **Spec ID**: `SPEC-082`
- **Change**: `CHANGE-063`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Standard
- **Milestone**: Version `71.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-290: TrueTime Commit-Wait MCP Tool
- **Pattern (Event-Driven)**: CUANDO un agente o cliente MCP invoque la herramienta `eos_truetime_commit_wait` con parámetro de deriva $\epsilon$ opcional, EL SISTEMA retornará el intervalo de tiempo acotado $[\text{earliest}, \text{latest}]$, la incertidumbre $2\epsilon$, ejecutará la espera de linealizabilidad y atestará la transacción en el SQLite WAL ledger.

### FR-291: RocksDB LSM-Tree Put & Get MCP Tool
- **Pattern (Event-Driven)**: CUANDO un agente o cliente MCP invoque la herramienta `eos_lsm_storage_put_get` con acción `put` o `get`, EL SISTEMA insertará la tupla clave-valor en la MemTable en memoria o consultará su presencia utilizando el filtro de Bloom antes de acceder a la SSTable L0, reportando métricas de acierto/rechazo deterministas.

### FR-292: Threshold Cryptography Secret Sharing MCP Tool
- **Pattern (Event-Driven)**: CUANDO un agente o cliente MCP invoque la herramienta `eos_threshold_secret_split_combine` con acción `split` o `combine`, EL SISTEMA fragmentará un secreto en un esquema Shamir $(t, n)$ sobre el cuerpo primo $\mathbb{F}_p$ o reconstruirá el secreto exacto a partir de al menos $t$ fragmentos verificados.

### FR-293: MicroVM Enclave Hardware Generator MCP Tool
- **Pattern (Event-Driven)**: CUANDO un agente o cliente MCP invoque la herramienta `eos_microvm_enclave_generate` con configuración de vCPU, memoria y vsock, EL SISTEMA evaluará las capacidades de virtualización del host y retornará un descriptor JSON OCI Firecracker firmado criptográficamente.

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-239: Despacho de herramientas MCP TrueTime y LSM-Tree
  DADO un servidor MCP instanciado de EosMcpServer
  CUANDO se invoca "eos_truetime_commit_wait" y "eos_lsm_storage_put_get"
  ENTONCES ambas herramientas retornan respuestas válidas con firmas SHA-256
  Y el intervalo TrueTime reporta incertidumbre acotada y commit-wait cumplido.

ESCENARIO: BDD-240: Despacho de herramientas MCP Threshold Crypto y MicroVM
  DADO un servidor MCP instanciado de EosMcpServer
  CUANDO se invoca "eos_threshold_secret_split_combine" con modo split y combine
  Y se invoca "eos_microvm_enclave_generate"
  ENTONCES la reconstrucción recupera la clave original al 100%
  Y el descriptor OCI Firecracker contiene boot-source, machine-config y vsock válidos.
```
