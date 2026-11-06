# SPEC-054 — HERMETIC MICROVM & ISOLATED HYPERVISOR SANDBOX ENGINE
**Version**: 60.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-047  
**Architecture Decision Record**: ADR-060  
**Domain Layer**: Layer-0 System Core (`src/core/eosMicroVmSandbox.ts`)

---

## 1. Executive Summary
Inspired by AWS Firecracker microVMs, Google gVisor (`runsc`), and Vercel Sandbox architectures, SPEC-054 formalizes the EOS Hermetic MicroVM & Isolated Hypervisor Sandbox Engine. It provides physical runtime isolation for autonomous agent tasks, preventing untrusted code or massive test batteries from mutating host environments. The engine auto-detects virtualization runtimes (`FIRECRACKER`, `DOCKER_GVISOR`, `EPHEMERAL_NODE_VM`), enforces zero-network isolation, caps memory (512 MB default), enforces hard process timeouts, isolates file systems via read-only bind mounts, and records tamper-evident SHA-256 receipts in the durable SQLite WAL ledger with zero external runtime npm dependencies.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-189: Detección Dinámica de Hipervisor y Motor de Contenedores
**State-Driven**: MIENTRAS se inicializa el entorno de ejecución para un agente, EL SISTEMA detectará la presencia de Docker (`runsc` / gVisor), Firecracker o el entorno de fallback `node:vm` efímero, seleccionando el nivel máximo de aislamiento disponible.

### FR-190: Confinamiento Estricto de Recursos (Memoria y CPU)
**Ubiquitous / Permanent**: EL SISTEMA aplicará límites estrictos de memoria física (cgroups o `--max-old-space-size=512`) y matará cualquier proceso que exceda el límite presupuestado o entre en bucle infinito.

### FR-191: Barrera de Aislamiento de Red Cero (Zero-Network)
**Ubiquitous / Permanent**: EL SISTEMA bloqueará todo acceso a sockets de red salientes (`--network none` o interceptación hermética de `node:net`), impidiendo exfiltración de credenciales o conexiones no autorizadas.

### FR-192: Montaje de Solo Lectura y Capa Tmpfs Efímera
**State-Driven**: MIENTRAS se ejecuta código no confiable o experimental, EL SISTEMA montará el directorio del proyecto en modo estrictamente de solo lectura (`:ro`) y restringirá cualquier escritura a un overlay temporal en memoria (`tmpfs`) que será destruido al concluir.

### FR-193: Atestación Criptográfica y Registro de Telemetría
**Event-Driven**: CUANDO concluye una ejecución en sandbox, EL SISTEMA calculará el hash SHA-256 del comando ejecutado, código de salida, salida estándar y memoria consumida, sellando el recibo de ejecución.

### FR-194: Persistencia en Ledger SQLite WAL
**Event-Driven**: CUANDO se emite el recibo de ejecución aislada, EL SISTEMA persistirá la atestación en `EosDurableSqliteLedger` bajo la categoría `SECURITY_AUDIT` o `MISSION_DIRECTION`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-185: Runtime Virtualization Engine Detection
```gherkin
ESCENARIO: Detección de Capacidades de Aislamiento Host
  DADO un entorno host
  CUANDO el motor EosMicroVmSandbox ejecuta el diagnóstico
  ENTONCES retorna un informe con el motor seleccionado (FIRECRACKER, DOCKER_GVISOR o EPHEMERAL_NODE_VM)
  Y confirma los límites de memoria, red y almacenamiento configurados
```

### BDD-186: Hermetic Isolated Execution (Nominal)
```gherkin
ESCENARIO: Ejecución Aislada de Comando Limpio en Sandbox
  DADO un script o comando válido para evaluar
  CUANDO el sandbox lo ejecuta dentro del entorno confinado
  ENTONCES el código de salida es 0
  Y se capturan la salida estándar, latencia en ms y recibo SHA-256
```

### BDD-187: Zero-Network Barrier Enforcement
```gherkin
ESCENARIO: Bloqueo de Intentos de Conexión de Red Saliente
  DADO un script que intenta abrir un socket TCP hacia la red externa
  CUANDO el sandbox ejecuta el código bajo la política de aislamiento
  ENTONCES la conexión es rechazada inmediatamente con error de red
  Y el sistema host permanece 100% aislado
```

### BDD-188: Timeout & Resource Overrun Containment
```gherkin
ESCENARIO: Contención de Bucle Infinito por Timeout Forzado
  DADO un script que entra en un bucle infinito ("while(true)")
  CUANDO transcurre el tiempo límite presupuestado (timeoutMs)
  ENTONCES el motor destruye el subproceso forzosamente
  Y retorna estado "TIMEOUT_KILLED" con código de error controlado
```

### BDD-189: Cryptographic Attestation & Ledger Chain Recording
```gherkin
ESCENARIO: Sello Criptográfico de Ejecución y Registro en Ledger
  DADO un ciclo de ejecución completado en sandbox
  CUANDO se registra el recibo en el ledger durable
  ENTONCES el hash SHA-256 de 64 caracteres queda indexado en SQLite WAL
  Y es recuperable mediante búsqueda monotónica
```

### BDD-190: MCP Dispatch of eos_microvm_sandbox via EosMcpServer
```gherkin
ESCENARIO: Invocación de Herramienta MCP eos_microvm_sandbox
  DADO un servidor EosMcpServer en perfil "core"
  CUANDO se invoca "eos_microvm_sandbox" con acción "run" o "doctor"
  ENTONCES retorna la telemetría del sandbox y el resultado de ejecución hermética
```
