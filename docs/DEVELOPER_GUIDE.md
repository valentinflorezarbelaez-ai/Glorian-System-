# Manual del Desarrollador: Glorian System (Control Plane & SDLC Accelerator)

Bienvenido a la guía de arquitectura y uso de **Glorian System**. Este documento explica de forma clara, estándar y práctica qué compone el sistema, para qué sirve cada subsistema, cómo integrarlo en tu flujo diario de trabajo y cómo conectarlo como servidor MCP a los entornos de desarrollo **Cursor** y **Google Antigravity**.

---

## 1. ¿Qué es Glorian System?

Glorian System es un **plano de control de ingeniería de software** diseñado para asistir, auditar, acelerar y gobernar el desarrollo de software en proyectos de cualquier escala y lenguaje (TypeScript, Python, Go, Rust, C/C++, Java).

### Principios Fundamentales de Diseño

- **Cero Dependencias de Runtime (`dependencies: {}`)**: Todo el código de Capa-0 se ejecuta sobre la biblioteca estándar de Node.js (`node:crypto`, `node:fs`, `node:path`, `node:net`, `node:events`). No hay riesgo de dependencias maliciosas ni saturación de `node_modules`.
- **Node.js 24 Strip-Only TypeScript**: Compilación instantánea sin compiladores pesados ni constructores complejos.
- **Design by Contract (DbC)**: Verificación rigurosa de precondiciones, poscondiciones e invariantes en cada llamada de función crítica.
- **Especificaciones Formales Previas (EARS y BDD)**: Ninguna función entra al sistema sin una especificación formal y escenarios de prueba asociados.

---

## 2. Integración con IDEs: Cursor y Google Antigravity (Vía MCP)

Glorian System implementa el protocolo abierto **Model Context Protocol (MCP)**, permitiendo que asistentes inteligentes en **Cursor** y **Google Antigravity** inspeccionen código, calculen radio de impacto (_blast radius_), ejecuten auditorías y administren workspaces de forma segura.

### A. Configuración en Cursor

En tu proyecto o en tu configuración global de Cursor (`~/.cursor/mcp.json` o `.cursor/mcp.json` en la raíz del repositorio):

```json
{
  "mcpServers": {
    "glorian-system": {
      "command": "node",
      "args": ["/ruta/absoluta/a/Glorian-System-/bin/eos.mjs", "mcp"]
    }
  }
}
```

### B. Configuración en Google Antigravity

En el archivo de configuración de extensiones MCP o ajustes del agente:

```json
{
  "servers": {
    "glorian": {
      "transport": "stdio",
      "command": "node",
      "args": ["/home/antigravity/valentinflorezarbelaez-ai/Glorian-System-/bin/eos.mjs", "mcp"]
    }
  }
}
```

### C. Modo Streaming HTTP / Server-Sent Events (Opcional)

Si prefieres conectar múltiples herramientas mediante HTTP en lugar de Stdio:

```bash
# Inicia el servidor MCP sobre HTTP/SSE en el puerto 3333
npm run mcp:stream
```

Endpoint disponible: `http://127.0.0.1:3333/sse`

---

## 3. Catálogo de Módulos Principales y Recetas de Código

El sistema expone submódulos limpios a través de los _subpath exports_ de `package.json`. Puedes importarlos directamente:

```ts
import { EosEnterpriseFacade } from "eos-system-landing/enterprise";
import {
  EosOtelPrometheusExporter,
  getDefaultPrometheusExporter,
} from "eos-system-landing/telemetry";
import { EosDistributedPeerMesh } from "eos-system-landing/peer-mesh";
import { EosHardwareMemoryArena } from "eos-system-landing/arena";
import { EosDelayTolerantMesh } from "eos-system-landing/dtn";
import { EosNeuroSymbolicVerifier } from "eos-system-landing/neuro-symbolic";
import { EosSlsaSupplyChainAttestation } from "eos-system-landing/provenance";
```

---

### Módulo 1: Fachada Empresarial (`EosEnterpriseFacade`)

**Propósito:** Proporcionar ergonomía estándar empresarial (CNCF/IEEE) para aislar cambios en workspaces efímeros, monitorear circuitos de protección (_circuit breakers_) y auditar la salud del sistema.

```ts
import { EosEnterpriseFacade } from "./src/core/eosEnterpriseFacade.ts";

const facade = new EosEnterpriseFacade();

// 1. Auditar salud del sistema
const health = facade.auditHealth();
console.log(`Estado: ${health.status}, Hash SHA-256: ${health.sha256Receipt}`);

// 2. Proteger una operación crítica con Circuit Breaker
const result = facade.circuitBreaker.executeWithProtection(() => {
  return "Operación ejecutada de forma segura";
});

// 3. Crear un workspace efímero con atestación
const ws = facade.workspaces.createWorkspace(".worktrees/tarea-nueva");
console.log(`Workspace activo: ${ws.workspaceId}, Token: ${ws.attestationToken}`);
```

---

### Módulo 2: Exportador OpenTelemetry / Prometheus (`EosOtelPrometheusExporter`)

**Propósito:** Calcular métricas RED de Google SRE (Rate, Errors, Duration con cuantiles P50, P90, P99) y exponerlas en formato canónico de texto Prometheus (0.0.4) para Datadog, Prometheus o Grafana.

```ts
import { getDefaultPrometheusExporter } from "./src/core/eosOtelPrometheusExporter.ts";

const exporter = getDefaultPrometheusExporter();

// Registrar una operación
const inicio = Date.now();
// ... lógica de negocio ...
exporter.recordOperation("api-gateway", Date.now() - inicio, true);

// Obtener métricas en formato texto Prometheus
const prometheusOutput = exporter.exportPrometheusText();
console.log(prometheusOutput);
// Salida incluye:
// # HELP glorian_requests_total Total number of requests tracked
// # TYPE glorian_requests_total counter
// # HELP glorian_request_duration_seconds Latency percentiles
// # TYPE glorian_request_duration_seconds summary
```

---

### Módulo 3: Malla Descentralizada Peer-to-Peer (`EosDistributedPeerMesh`)

**Propósito:** Coordinar clústeres multi-nodo sin coordinadores centrales mediante el protocolo gossip SWIM, detección automática de caídas (`ALIVE` $\rightarrow$ `SUSPECT` $\rightarrow$ `DEAD`) y sincronización causal con relojes vectoriales.

```ts
import { EosDistributedPeerMesh } from "./src/core/eosDistributedPeerMesh.ts";

const node = new EosDistributedPeerMesh({
  localNodeId: "nodo-primario",
  gossipFanout: 3,
});

// Registrar un par en el clúster
node.registerPeer({
  nodeId: "nodo-secundario",
  address: "192.168.1.50",
  port: 8080,
  status: "ALIVE",
  incarnation: 0,
});

// Compartir estado distribuido con reloj vectorial
node.setState("cluster.config.version", "2.4.0");

// Generar paquete para propagación epidémica
const paquete = node.createGossipPacket();
```

---

### Módulo 4: Simbiosis de Silicio y Memoria Directa (`EosHardwareMemoryArena`)

**Propósito:** Eliminar pausas de Garbage Collector (GC) mediante asignación lineal continua (_bump allocation_) alineada estrictamente a 64 bytes (línea de caché L1/L2) y pools de slabs en potencias de 2 (64B a 4096B).

```ts
import { EosHardwareMemoryArena } from "./src/core/eosHardwareMemoryArena.ts";

const arena = new EosHardwareMemoryArena(65536, 32);

// Ejecutar operaciones intensivas dentro de un alcance temporal (reset en O(1) con 0 B/op)
const respuesta = arena.withScope((bump) => {
  const buffer = bump.allocate(256); // Garantizado: byteOffset % 64 === 0
  buffer[0] = 123;
  return buffer[0] * 2;
});

// Asignar un slab reutilizable
const slab = arena.slabs.allocate(100); // Obtiene un slab de 128B
// ... procesar buffer ...
arena.slabs.release(slab); // Se limpia a ceros y vuelve a la lista libre
```

---

### Módulo 5: Malla Tolerante a Retardos y Redes Particionadas (`EosDelayTolerantMesh`)

**Propósito:** Enviar datos entre nodos con conectividad intermitente o enlaces de alta latencia (aeroespacial, edge, satélites) implementando el protocolo RFC 5050/9171 Bundle Protocol con transferencia de custodia.

```ts
import { EosDelayTolerantMesh } from "./src/core/eosDelayTolerantMesh.ts";

const mesh = new EosDelayTolerantMesh("estacion-tierra");

// Crear un paquete con TTL de 2 horas
const paquete = mesh.createBundle("sonda-espacial", { telemetria: "ok" }, 7200000);

// Abrir ventana de contacto oportunista y transferir custodia
mesh.openContact("satelite-retransmisor", 30000);
const recibo = mesh.transferCustody(paquete.bundleId, "satelite-retransmisor");
console.log(`Custodia transferida, firma SHA-256: ${recibo.receiptSignatureSha256}`);
```

---

### Módulo 6: Verificación Neuro-Simbólica en Bucle Cerrado (`EosNeuroSymbolicVerifier`)

**Propósito:** Proteger la ejecución de agentes de IA comprobando precondiciones y poscondiciones matemáticas (lógica de Hoare), evaluando reglas SAT de cláusulas de Horn y bloqueando inyección de comandos o fuga de credenciales antes de tocar el sistema de archivos.

```ts
import { EosNeuroSymbolicVerifier } from "./src/core/eosNeuroSymbolicVerifier.ts";

const verifier = new EosNeuroSymbolicVerifier();

// Evaluar una acción propuesta por el agente
const veredicto = verifier.verifyAction({
  actionId: "ACCION-001",
  actionType: "SHELL_COMMAND",
  target: "npm test",
  declaredPreconditions: { auth: true },
});

if (veredicto.status === "VERIFIED_SAFE") {
  console.log("Acción formalmente verificada y segura para ejecución");
} else {
  console.error("Acción bloqueada por violaciones:", veredicto.violations);
}
```

---

### Módulo 7: Atestación de Cadena de Suministro SLSA Nivel 4 (`EosSlsaSupplyChainAttestation`)

**Propósito:** Generar declaraciones de procedencia in-toto v1.0, firmar artefactos con criptografía asimétrica Ed25519 nativa y emitir listas de materiales de software (SBOM CycloneDX v1.5) certificando cero dependencias de terceros.

```ts
import { EosSlsaSupplyChainAttestation } from "./src/core/eosSlsaSupplyChainAttestation.ts";

// 1. Generar par de claves Ed25519 nativo
const { publicKeyPem, privateKeyPem, keyId } =
  EosSlsaSupplyChainAttestation.generateEd25519KeyPair();

// 2. Generar declaración de procedencia in-toto v1.0 / SLSA Provenance v1.0
const declaracion = EosSlsaSupplyChainAttestation.generateProvenanceStatement({
  subjects: [{ name: "dist/binario", digest: { sha256: "hash-del-binario..." } }],
});

// 3. Firmar digitalmente la declaración
const sobreFirmado = EosSlsaSupplyChainAttestation.signStatement(declaracion, privateKeyPem, keyId);

// 4. Verificar integridad y autenticidad
const verificacion = EosSlsaSupplyChainAttestation.verifyEnvelope(sobreFirmado, publicKeyPem);
console.log(`¿Firma válida y sin alteraciones?: ${verificacion.verified}`);
```

---

### Módulo 8: Diagnóstico Universal de Proyectos (`EosUniversalProjectDoctor`)

**Propósito:** Evaluar cualquier repositorio en microsegundos según el estándar Spotify Soundcheck RFC-42 (0-100), detectar huella de lenguaje políglota (Go, Rust, Python, Node, Flutter, Java, C/C++), escanear credenciales expuestas y generar flujos de trabajo CI/CD herméticos.

```ts
import { EosUniversalProjectDoctor } from "./src/core/eosUniversalProjectDoctor.ts";

const reporte = EosUniversalProjectDoctor.diagnose("./mi-proyecto");
console.log(`Stack detectado : ${reporte.detectedStack}`);
console.log(`Puntaje global  : ${reporte.overallScore} / 100 [${reporte.readinessStatus}]`);
console.log(`Pilar Seguridad : ${reporte.pillars.security.score} / 25`);
```

---

### Módulo 9: Auto-Remediación y Modernización de Código (`EosUniversalCodeRemediator`)

**Propósito:** Auto-remediar y elevar cualquier repositorio externo a estándares de producción: generar `.gitignore` adaptado al stack, crear arneses y pruebas smoke iniciales, inyectar documentación y licencias SPDX, y sintetizar pipelines CI/CD con soporte de simulación (dry-run).

```ts
import { EosUniversalCodeRemediator } from "./src/core/eosUniversalCodeRemediator.ts";

// Modo simulación (sin escribir en disco)
const plan = EosUniversalCodeRemediator.remediate("./mi-proyecto", { dryRun: true });
console.log(`Acciones planeadas: ${plan.actions.length}`);

// Modo remediación activa
const recibo = EosUniversalCodeRemediator.remediate("./mi-proyecto", { dryRun: false });
console.log(`Puntaje elevado: ${recibo.initialScore} -> ${recibo.projectedOrFinalScore} / 100`);
```

---

### Módulo 10: Oráculo de Fuzzing Dinámico (`EosDynamicFuzzingOracle`)

**Propósito:** Pruebas de estrés y resiliencia en tiempo de ejecución (inspirado en DARPA Cyber Grand Challenge y LLVM LibFuzzer): genera mutaciones numéricas límite (IEEE 754, enteros 32/64 bits), anomalías Unicode (bytes nulos, surrogates, inyecciones), y trampas estructurales (polución de prototipos, referencias circulares), midiendo percentiles de latencia ($p_{50}, p_{95}, p_{99}$) y emitiendo recibos SHA-256.

```ts
import { EosDynamicFuzzingOracle } from "./src/core/eosDynamicFuzzingOracle.ts";

// Ejecutar campaña de fuzzing sobre cualquier función
const resultado = EosDynamicFuzzingOracle.runCampaign(
  (entrada) => JSON.stringify(entrada),
  "serializador_json",
  { iterations: 50 },
);

console.log(`Puntaje de estabilidad : ${resultado.stabilityScore} / 100`);
console.log(`Latencia p50           : ${resultado.latencyMetricsUs.p50Us} µs`);
console.log(`Colapsos detectados    : ${resultado.crashCount}`);
```

---

### Módulo 11: Arena Adversaria Multi-Agente (`EosSwarmAdversarialArena`)

**Propósito:** Torneos adversarios de auto-auditoría basados en Teoría de Juegos (Palantir AIP, Lockheed Skunk Works Swarms Vectis, DeepMind): despliega agentes Rojo (Atacante), Azul (Defensor) y Blanco (Árbitro) evaluando acciones bajo consenso Bizantino BFT ($3f+1$).

```ts
import { EosSwarmAdversarialArena } from "./src/core/eosSwarmAdversarialArena.ts";

const torneo = EosSwarmAdversarialArena.executeTournament("git push origin main", 3);
console.log(`Veredicto BFT           : ${torneo.bftVerdict}`);
console.log(`Puntaje de Resiliencia  : ${torneo.resilienceScore} / 100`);
console.log(`Rondas mitigadas        : ${torneo.mitigatedRounds} / ${torneo.totalRounds}`);
```

---

### Módulo 12: Atestación de Estado de Conocimiento Cero (`EosZkStateProof`)

**Propósito:** Demostración matemática y verificación de cumplimiento (inspirado en Criptografía Post-Cuántica, Intel SGX / Apple Secure Enclave y W3C Verifiable Credentials): construye árboles de Merkle binarios sobre hojas de estado selladas con sales de cegado (_blinding salts_), emitiendo pruebas de inclusión $O(\log N)$ que permiten verificar cumplimiento normativo sin revelar código confidencial ni secretos.

```ts
import { EosZkStateProof } from "./src/core/eosZkStateProof.ts";

const { proof, publicMerkleRoot, verified } =
  EosZkStateProof.generateDefaultRepositoryProof("SPEC-193");

console.log(`Requisito verificado    : ${proof.claimId}`);
console.log(`Raíz pública de Merkle  : sha256:${publicMerkleRoot}`);
console.log(`¿Prueba ZK válida?      : ${verified}`);
```

---

### Módulo 13: Compilador Hermético de Ejecutable Único (SEA) (`EosHermeticSeaCompiler`)

**Propósito:** Síntesis determinista de binarios nativos autónomos auto-contenidos (Single-Executable Applications / SEA) para despliegue en entornos soberanos, air-gapped o distroless. Clona el runtime del host, inyecta el blob de la aplicación, sella con firma digital asimétrica Ed25519, emite atestación de procedencia in-toto v1.0 / SLSA Nivel 4 y genera SBOM CycloneDX v1.5 con 0 dependencias externas en tiempo de ejecución (Ley V).

```ts
import { EosHermeticSeaCompiler } from "./src/core/eosHermeticSeaCompiler.ts";

const result = EosHermeticSeaCompiler.compileStandaloneBinary({
  dryRun: true, // o false para sintetizar el ejecutable real en dist/
  targetPlatform: "linux-x64",
});

console.log(`Binario generado   : ${result.binaryPath}`);
console.log(`Digest SHA-256     : sha256:${result.sha256}`);
console.log(`Firma Ed25519      : ${result.signaturePath}`);
console.log(`SLSA Nivel 4       : ${result.provenancePath}`);
console.log(`Recibo Compilador  : sha256:${result.sha256Receipt}`);
```

---

### Módulo 14: Criptografía Post-Cuántica ML-KEM y ML-DSA (`EosPostQuantumCryptography`)

**Propósito:** Blindaje criptográfico inmune a computadoras cuánticas según los estándares **NIST FIPS 203** (ML-KEM / Kyber) y **NIST FIPS 204** (ML-DSA / Dilithium) con soporte híbrido post-cuántico (X25519 + ML-KEM y Ed25519 + ML-DSA). Ofrece intercambio de claves inmune a ataques _Harvest Now, Decrypt Later_ (HNDL) con rechazo implícito constante frente a manipulación de texto cifrado.

```ts
import { EosPostQuantumCryptography } from "./src/core/eosPostQuantumCryptography.ts";

// 1. Intercambio de Claves Híbrido Post-Cuántica (X25519 + ML-KEM-768)
const bobKeys = EosPostQuantumCryptography.generateHybridKemKeyPair();
const aliceEnc = EosPostQuantumCryptography.encapsulateHybridKem(bobKeys.publicKey);
const bobDec = EosPostQuantumCryptography.decapsulateHybridKem(
  aliceEnc.ciphertext,
  bobKeys.privateKey,
);

console.log(`Clave compartida derivada : ${aliceEnc.sharedSecretHex}`);
console.log(`¿Coincidencia exacta?     : ${bobDec.sharedSecretHex === aliceEnc.sharedSecretHex}`);

// 2. Firmas Digitales de Retículos (ML-DSA-65)
const dsaKeys = EosPostQuantumCryptography.generateMlDsaKeyPair();
const signature = EosPostQuantumCryptography.signMlDsa("MENSAJE_CRITICO", dsaKeys.signingKeyHex);
const valid = EosPostQuantumCryptography.verifyMlDsa(
  "MENSAJE_CRITICO",
  signature.signatureHex,
  dsaKeys.verificationKeyHex,
);
console.log(`¿Firma post-cuántica válida? : ${valid}`);
```

---

### Módulo 15: Sintetizador Genético de Código AST (`EosGeneticAstSynthesizer`)

**Propósito:** Síntesis autónoma de código y reparación automática de programas (inspirado en Meta APR, DARPA CRASH/VDO y AlphaCode 2): modela código en árboles de sintaxis abstracta (AST) y aplica algoritmos genéticos (mutaciones puntuales de operadores, reparación de límites _off-by-one_, salvaguardas contra nulos y cruzamiento de subárboles) guiados por funciones de fitness multiobjetivo para elevar la aptitud del código al 100% de forma determinista y sin dependencias externas.

```ts
import { EosGeneticAstSynthesizer } from "./src/core/eosGeneticAstSynthesizer.ts";

const result = EosGeneticAstSynthesizer.synthesize({
  initialCode: "a - b",
  generations: 8,
  populationSize: 12,
  testCases: [
    { input: [1, 2], expected: 3 },
    { input: [10, 20], expected: 30 },
  ],
});

console.log(`Código inicial      : a - b`);
console.log(`Código sintetizado  : ${result.bestCandidate.code}`);
console.log(`Puntaje de fitness  : ${result.finalFitness} / 100`);
console.log(`Mutaciones aplicadas: ${result.bestCandidate.appliedMutations.join(", ")}`);
console.log(`Parche Diff:\n${result.diffPatch}`);
```

---

## 4. Guía Rápida de Comandos CLI

El ejecutable principal es `./bin/eos.mjs` (disponible como comandos `glorian` o `eos`):

| Comando                                              | Descripción                                                                               |
| :--------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `node bin/eos.mjs help`                              | Muestra el menú completo de comandos disponibles.                                         |
| `node bin/eos.mjs enterprise:health`                 | Audita la salud del sistema y emite tabla de estado con recibo SHA-256.                   |
| `node bin/eos.mjs enterprise:health --json`          | Emite el reporte de salud en formato JSON machine-readable para CI/CD.                    |
| `node bin/eos.mjs doctor [ruta] [--write-ci]`        | Diagnostica los 5 pilares Soundcheck (0-100) y opcionalmente sintetiza pipeline CI.       |
| `node bin/eos.mjs remediate [ruta] [--dry-run]`      | Auto-remedia el repositorio: genera .gitignore, pruebas smoke, CI y gobernanza.           |
| `node bin/eos.mjs fuzz [--iterations=N]`             | Fuzzing dinámico guiado por cobertura sobre funciones y primitivas del sistema.           |
| `node bin/eos.mjs arena [accion] [--rounds=N]`       | Torneo adversario multi-agente bajo consenso BFT 3f+1 (Red vs Blue vs White).             |
| `node bin/eos.mjs zk:prove [--spec=ID]`              | Genera y verifica prueba Merkle de Conocimiento Cero (ZKP) para un requisito o spec.      |
| `node bin/eos.mjs compile [plataforma] [--dry-run]`  | Compila Glorian en ejecutable nativo hermético SEA (Ed25519 + SLSA Nivel 4).              |
| `node bin/eos.mjs pq:kem [--hybrid] [--json]`        | Encapsula clave post-cuántica (NIST FIPS 203 ML-KEM + X25519) con verificación inmediata. |
| `node bin/eos.mjs pq:sign [msg] [--hybrid] [--json]` | Genera y verifica firma digital de retículos (NIST FIPS 204 ML-DSA + Ed25519).            |
| `node bin/eos.mjs synthesize [codigo] [--json]`      | Sintetiza y repara código automáticamente mediante mutación genética y cruce de AST.      |
| `node bin/eos.mjs metrics`                           | Exporta métricas OpenMetrics / Prometheus directamente a la terminal.                     |
| `node bin/eos.mjs guard [directorio]`                | Inspecciona la arquitectura de dependencias de cualquier repositorio local.               |
| `node bin/eos.mjs flow inspect <ruta>`               | Analiza la estructura y salud arquitectónica de un proyecto externo en modo solo lectura. |
| `node bin/eos.mjs worktree list`                     | Lista los árboles de trabajo (_worktrees_) aislados de Git.                               |

---

## 5. Verificación de Calidad y Mantenimiento

Para asegurar que el repositorio se mantenga en el estado más alto de estabilidad:

```bash
# 1. Comprobación estricta de tipos TypeScript (0 errores)
npm run typecheck

# 2. Análisis estático de código con ESLint (0 advertencias, 0 errores)
npm run lint

# 3. Verificación de estilo y formato con Prettier
npm run format:check

# 4. Ejecución de la suite completa de pruebas
npm test
```
