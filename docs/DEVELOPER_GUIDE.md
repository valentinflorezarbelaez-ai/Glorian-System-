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

### Módulo 16: Motor de Búsqueda Vectorial HNSW Layer-0 (`EosHnswVectorIndex`)

**Propósito:** Búsqueda aproximada de vecinos más cercanos (ANN) de sub-milisegundo en grafos navegables de mundos pequeños jerárquicos (HNSW, Malkov & Yashunin 2018 TPAMI). Incorpora proyección autónoma de embeddings mediante hashing de subpalabras (shingles de 3 caracteres y tokens de código), soporte para distancias Coseno, Euclidiana y Producto Punto, serialización determinista con suma de comprobación SHA-256 e integración con CLI y MCP bajo cero dependencias externas (Ley V).

```ts
import { EosHnswVectorIndex } from "./src/core/eosHnswVectorIndex.ts";

const index = new EosHnswVectorIndex({ dimension: 64, metric: "cosine", M: 16 });

// 1. Indexar fragmentos de código o documentación
index.indexCodeSnippet("core/auth", "function verifyJwtToken(token) { return jwt.verify(token); }");
index.indexCodeSnippet(
  "core/crypto",
  "function mlDsaLatticeSign(msg, privKey) { return ringSisSign(msg, privKey); }",
);

// 2. Búsqueda semántica por lenguaje natural o código
const results = index.searchCode("autenticacion y verificacion de firmas criptograficas", 2);

for (const match of results) {
  console.log(
    `ID: ${match.id} | Similitud: ${(match.similarityScore * 100).toFixed(1)}% | Distancia: ${match.distance}`,
  );
}

// 3. Serialización y restauración hermética
const serialized = index.serialize();
const restored = EosHnswVectorIndex.deserialize(serialized);
console.log(`Elementos restaurados: ${restored.size()} | Checksum: ${serialized.sha256Checksum}`);
```

---

### Módulo 17: Motor de Grafo de Conocimiento Temporal y Datalog Layer-0 (`EosTemporalKnowledgeGraph`)

**Propósito:** Razonamiento deductivo y trazabilidad bi-temporal sobre grafos de conocimiento sin dependencias externas (Ley V). Almacena hechos como cuadruplas `(sujeto, predicado, objeto, [validFrom, validTo])`, soporta consultas de viaje en el tiempo (`asOf` e intersección `during`), evalúa reglas Datalog estratificadas mediante encadenamiento hacia adelante con operador $T_P$ hasta punto fijo determinista, y descubre caminos causales temporales entre componentes arquitectónicos.

```ts
import { EosTemporalKnowledgeGraph } from "./src/core/eosTemporalKnowledgeGraph.ts";

const graph = new EosTemporalKnowledgeGraph();

// 1. Aserción de hechos cuadripolares con intervalos de validez
graph.assertFact("gateway", "depends_on", "auth_service", 0, Infinity);
graph.assertFact("auth_service", "depends_on", "postgres", 0, 1000);
graph.assertFact("auth_service", "depends_on", "cockroachdb", 1001, Infinity);

// 2. Reglas Datalog para clausura transitiva
graph.addRule({ predicate: "transitive_depends", terms: ["?X", "?Y"] }, [
  { predicate: "depends_on", terms: ["?X", "?Y"] },
]);
graph.addRule({ predicate: "transitive_depends", terms: ["?X", "?Y"] }, [
  { predicate: "depends_on", terms: ["?X", "?Z"] },
  { predicate: "transitive_depends", terms: ["?Z", "?Y"] },
]);

// 3. Inferencia inductiva y consulta retrospectiva (Time-Travel)
const derivation = graph.evaluateRules();
const historicDependencies = graph.queryAsOf(500, "transitive_depends", ["gateway", null]);
console.log(
  `Punto fijo alcanzado: ${derivation.fixedPointReached} (${derivation.newFactsDerived} hechos derivados)`,
);
console.log(
  `Dependencias transitivas en t=500:`,
  historicDependencies.map((d) => d.object),
);
```

---

### Módulo 18: Descompilador y Demostrador Formal de Bytecode WebAssembly (`EosWasmBytecodeDecompilerProver`)

**Propósito:** Desensamblado binario, decompilación a formato de texto WAT canónico y demostración formal de invariantes de seguridad en bytecode WebAssembly 2.0 bajo cero dependencias externas (Ley V). Simula la pila de operandos garantizando la imposibilidad de desbordamiento negativo (_underflow_), verifica la integridad del flujo de control (CFI) en saltos ramificados, audita límites estáticos de páginas de memoria lineal y clasifica la pureza matemática y el aislamiento de capacidades del módulo antes de su ejecución.

```ts
import { EosWasmBytecodeDecompilerProver } from "./src/core/eosWasmBytecodeDecompilerProver.ts";
import { WASM_BYTECODE_TEMPLATES } from "./src/core/eosWasmSandboxEngine.ts";

// 1. Decompilar bytecode binario a sintaxis canónica WAT (S-Expressions)
const wat = EosWasmBytecodeDecompilerProver.decompileToWat(WASM_BYTECODE_TEMPLATES.ADD);
console.log("WAT Decompilado:\n" + wat);

// 2. Demostración formal de seguridad e invariantes
const proof = EosWasmBytecodeDecompilerProver.proveModuleSafety(WASM_BYTECODE_TEMPLATES.ADD);
console.log(`¿Módulo verificado formalmente? : ${proof.verified}`);
console.log(`¿Seguridad de pila (No Underflow)?: ${proof.stackSafe}`);
console.log(`¿Límites de memoria respetados?   : ${proof.memoryBoundsSafe}`);
console.log(`¿Función matemáticamente pura?    : ${proof.isPure}`);
console.log(`Sello criptográfico SHA-256        : ${proof.sha256Receipt}`);
```

---

### Módulo 19: Orquestador Heurístico Monte Carlo Tree Search con Red Política-Valor (`EosMctsPolicyValueMesh`)

**Propósito:** Planificación heurística autónoma y resolución de decisiones combinatorias complejas (migraciones de microservicios, optimización de topologías y síntesis de parches) inspirado en AlphaZero (Silver et al. 2017). Implementa selección guiada por árboles de confianza superior polinomiales (PUCT), evaluación dual de distribución de probabilidades previas $P(s, a)$ y valor de estado escalar $V(s) \in [-1, 1]$, retropropagación de recompensas acumuladas, muestreo con temperatura $\tau$ y recibos inmutables de decisión sellados con SHA-256 sin requerir dependencias externas de Deep Learning (Ley V).

```ts
import { EosMctsPolicyValueMesh } from "./src/core/eosMctsPolicyValueMesh.ts";

const mcts = new EosMctsPolicyValueMesh({ simulations: 80, cPuct: 1.414, temperature: 0.0 });

const initialState = {
  id: "state_legacy_monolith",
  legalActions: ["extract_auth", "shard_database", "deploy_canary"],
  isTerminal: false,
};

const transitionFn = (state, action) => ({
  id: `${state.id}->${action}`,
  legalActions: ["cutover_traffic"],
  isTerminal: true,
  reward: action === "shard_database" ? 0.95 : 0.4,
});

const result = mcts.search(initialState, transitionFn);
console.log(`Acción óptima seleccionada : ✔ ${result.bestAction}`);
console.log(`Valor esperado Q          : ${result.expectedValue}`);
console.log(`Recibo de decisión SHA-256: ${result.sha256Receipt}`);
```

---

### Módulo 20: Verificador Simbólico de Modelos y Síntesis Bounded TLA+ (`EosAutonomousTlaModelChecker`)

**Propósito:** Verificación formal rigurosa de protocolos concurrentes, algoritmos distribuidos y máquinas de estado sin requerir Java, JVM ni TLC externo (Ley V). Explora el grafo de estados simbólico acotado a partir del predicado inicial $Init$ y la relación de transición $Next$, comprueba invariantes inductivos de seguridad $\square P$ (exclusión mutua, ausencia de pérdida de datos, invariantes de tipo), detecta interbloqueos (_deadlocks_), genera trazas mínimas de contraejemplo reproducibles y sintetiza módulos canónicos formales de TLA+ (Leslie Lamport).

```ts
import { EosAutonomousTlaModelChecker } from "./src/core/eosAutonomousTlaModelChecker.ts";

const model = EosAutonomousTlaModelChecker.generateDefaultDistributedLockModel();

// 1. Verificación de invariantes y detección de deadlocks
const result = EosAutonomousTlaModelChecker.checkModel(model, {
  maxDepth: 15,
  checkDeadlocks: true,
});
console.log(`¿Modelo formalmente verificado? : ${result.verified}`);
console.log(`Estados alcanzables explorados   : ${result.totalStatesExplored}`);
console.log(`Transiciones transitadas         : ${result.totalTransitionsExplored}`);
console.log(`Sello criptográfico SHA-256      : ${result.sha256Receipt}`);

// 2. Síntesis autónoma de especificación canónica TLA+
const tlaModule = EosAutonomousTlaModelChecker.synthesizeTlaModule(model);
console.log("Especificación TLA+ sintetizada:\n" + tlaModule);
```

---

### Módulo 21: Motor de Consenso Distribuido Raft con FSM Replicada (`EosRaftConsensusEngine`)

**Propósito:** Consenso distribuido tolerante a fallos y máquinas de estado finito (FSM) linealizables replicadas entre nodos sin requerir daemons externos como etcd, ZooKeeper o Consul (Ley V). Implementa el protocolo Raft completo (Ongaro & Ousterhout, Stanford 2014) en TypeScript puro: elección de líderes con quórum de mayoría estricta ($\lfloor N/2 \rfloor + 1$), replicación de entradas con RPC `AppendEntries`, resolución y truncamiento de conflictos de logs desfasados, aislamiento y resiliencia ante particiones de red (prevención total de _split-brain_), compactación de logs mediante Merkle snapshots y recibos criptográficos SHA-256 inmutables.

```ts
import { EosRaftCluster } from "./src/core/eosRaftConsensusEngine.ts";

const cluster = new EosRaftCluster("glorian-cluster-01", ["node-1", "node-2", "node-3"]);

// 1. Elección de líder por quórum de mayoría
const election = cluster.startElection("node-1");
console.log(`Líder electo: ${cluster.leaderId} en término ${election.term}`);

// 2. Proposición y replicación linealizable en FSM
const proposal = cluster.propose({ type: "SET", key: "cluster_epoch", value: "2026.11" });
console.log(`¿Comando confirmado en FSM? : ${proposal.committed}`);

// 3. Recibo criptográfico de consenso SHA-256
const receipt = cluster.generateReceipt();
console.log(`Recibo de consenso SHA-256  : ${receipt.sha256Receipt}`);
```

---

### Módulo 22: Compresor de Entropía Asymmetric Numeral Systems (`EosAnsEntropyCompressor`)

**Propósito:** Compresión y descompresión de entropía sin pérdidas de ultra-alto rendimiento basada en rANS (Jarek Duda, 2014) en TypeScript puro sin dependencias nativas externas (Ley V). Combina la tasa de compresión casi óptima de la codificación aritmética (límite de Shannon $H(X)$) con el rendimiento y procesamiento por bytes de la codificación Huffman. Implementa normalización exacta de frecuencias a escala potencia de dos ($M = 4096$), mantenimiento acotado de estado $x \in [L, b \cdot L - 1]$, reconstrucción 100% libre de pérdidas (round-trip) y recibos criptográficos SHA-256 inmutables.

```ts
import { EosAnsEntropyCompressor } from "./src/core/eosAnsEntropyCompressor.ts";

const data = "GLORIAN_SOVEREIGN_SYSTEM_2026_LAYER_0_ZERO_DEPENDENCIES";

// 1. Compresión rANS
const compressedResult = EosAnsEntropyCompressor.compress(data);
console.log(`Ratio de compresión    : ${compressedResult.metadata.compressionRatio}x`);
console.log(
  `Entropía de Shannon    : ${compressedResult.metadata.shannonEntropyBitsPerSymbol} bits/símbolo`,
);
console.log(`Recibo SHA-256         : ${compressedResult.sha256Receipt}`);

// 2. Descompresión exacta sin pérdidas
const decompressedResult = EosAnsEntropyCompressor.decompress(compressedResult.compressed);
console.log(`¿Coincidencia exacta?  : ${decompressedResult.verified}`);
```

---

### Módulo 23: Núcleo de Tensores Multidimensionales y Autodiferenciación en Modo Reverso (`EosReverseModeAutodiff`)

**Propósito:** Cálculo analítico exacto de gradientes multidimensionales $\nabla_\theta \mathcal{L}$ para optimización de parámetros, auto-calibración heurística y aprendizaje cerrado sin requerir PyTorch ni TensorFlow (Ley V). Proporciona un tensor multidimensional sobre `Float64Array` continuo con indexación strided, grafo de computación dinámico (cinta/Wengert list), retropropagación en modo reverso con regla de la cadena multivariable, activaciones no lineales (ReLU, Sigmoid, Tanh), multiplicación de matrices 2D (`matmul`), oráculo de verificación contra diferencias finitas centrales y optimizador de descenso de gradiente estocástico (SGD) con recibos criptográficos SHA-256.

```ts
import {
  EosTensor,
  EosReverseModeAutodiff,
  EosSgdOptimizer,
} from "./src/core/eosReverseModeAutodiff.ts";

// 1. Tensores con seguimiento de gradiente
const X = EosTensor.from([1.0, 2.0, 3.0, 4.0], [2, 2], false);
const W = EosTensor.from([0.1, 0.1], [2, 1], true);
const target = EosTensor.from([5.0, 11.0], [2, 1], false);

// 2. Paso de optimización SGD
const optimizer = new EosSgdOptimizer([W], 0.05);
const receipt = EosReverseModeAutodiff.trainStep(
  () => {
    const pred = X.matmul(W);
    return EosReverseModeAutodiff.mseLoss(pred, target);
  },
  optimizer,
  15,
);

console.log(`Convergencia confirmada: ${receipt.lossDecreased}`);
console.log(`Pérdida final          : ${receipt.finalLoss}`);
console.log(`Recibo SHA-256         : ${receipt.sha256Receipt}`);
```

---

### Módulo 24: Detector de Anomalías No Supervisado con Streaming Isolation Forest (`EosIsolationForestDetector`)

**Propósito:** Detección no supervisada de anomalías en telemetría de alta frecuencia, latencias SRE, consumo de recursos y eventos distribuidos mediante árboles de aislamiento aleatorios recursivos (iTrees) basados en Liu, Ting & Zhou (2008) sin dependencias externas de Machine Learning (Ley V). Explota la susceptibilidad natural de los puntos atípicos a aislarse cerca de la raíz con longitudes de camino $\mathbb{E}(h(x))$ significativamente menores que los puntos normales. Implementa la corrección matemática de búsqueda infructuosa en BST $c(n)$ con la constante de Euler-Mascheroni ($\gamma \approx 0.5772156649$), umbralización normalizada $s(x, \psi) \in [0, 1]$, ventana deslizante para flujos en streaming y recibos criptográficos SHA-256 inmutables.

```ts
import {
  EosIsolationForest,
  EosStreamingIsolationForest,
} from "./src/core/eosIsolationForestDetector.ts";

// 1. Detección por lotes con ensamble de iTrees
const forest = new EosIsolationForest({ nTrees: 100, threshold: 0.6 });
forest.fit([
  [20, 25],
  [22, 24],
  [21, 26],
  [400, 99],
]); // Inliers + Outlier

const report = forest.predict([
  [20, 25],
  [400, 99],
]);
console.log(`Anomalías detectadas: ${report.anomalyCount}`);
console.log(`Sello SHA-256       : ${report.sha256Receipt}`);

// 2. Detección en streaming con ventana deslizante
const streaming = new EosStreamingIsolationForest({ windowCapacity: 100 });
streaming.ingest([20.5, 25.1]); // Normal
const alert = streaming.ingest([500.0, 999.0]); // Anomalía en tiempo real
```

---

### Módulo 25: Motor de Consenso Bizantino Tolerante a Fallos (`EosPbftConsensusEngine`)

**Propósito:** Replicación de máquinas de estados (SMR) y consenso distribuido tolerante a fallos bizantinos (PBFT) basado en Castro & Liskov (1999) en TypeScript puro sin dependencias externas (Ley V). Garantiza seguridad y vivacidad bajo la cota $N \ge 3f + 1$ donde $f$ es el número máximo de nodos arbitrarios, maliciosos o caídos tolerados. Implementa el protocolo formal de 3 fases (`PRE-PREPARE`, `PREPARE`, `COMMIT`), umbral supermayoritario de quórum $2f + 1$, detección automática de equivocación (double-propose) del primario con recibos de penalización (slashing) criptográficos, failover distribuido con protocolo de cambio de vista (`VIEW-CHANGE` $\to$ `NEW-VIEW`) y máquina de estados replicada linealizable con recibos inmutables SHA-256.

```ts
import { EosPbftCluster } from "./src/core/eosPbftConsensusEngine.ts";

// 1. Inicialización de cluster BFT con 4 validadores (f = 1, quórum = 3)
const cluster = new EosPbftCluster(["node-0", "node-1", "node-2", "node-3"]);

// 2. Proposición y consenso de 3 fases
const receipt = cluster.propose({
  type: "SET",
  key: "ledger_epoch",
  value: "byzantine_secure",
});
console.log(`Secuencia comprometida: #${receipt.sequenceNumber}`);
console.log(`Recibo SHA-256        : ${receipt.sha256Receipt}`);

// 3. Simulación de ataque por equivocación y emisión de recibo de slashing
const slashReceipt = cluster.simulateEquivocation(
  "node-0",
  { type: "SET", key: "audit", value: "honest" },
  { type: "SET", key: "audit", value: "forged" },
);
console.log(`Validador penalizado  : ${slashReceipt.slashedNodeId}`);
```

---

## 4. Guía Rápida de Comandos CLI

El ejecutable principal es `./bin/eos.mjs` (disponible como comandos `glorian` o `eos`):

| Comando                                              | Descripción                                                                                |
| :--------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| `node bin/eos.mjs help`                              | Muestra el menú completo de comandos disponibles.                                          |
| `node bin/eos.mjs enterprise:health`                 | Audita la salud del sistema y emite tabla de estado con recibo SHA-256.                    |
| `node bin/eos.mjs enterprise:health --json`          | Emite el reporte de salud en formato JSON machine-readable para CI/CD.                     |
| `node bin/eos.mjs doctor [ruta] [--write-ci]`        | Diagnostica los 5 pilares Soundcheck (0-100) y opcionalmente sintetiza pipeline CI.        |
| `node bin/eos.mjs remediate [ruta] [--dry-run]`      | Auto-remedia el repositorio: genera .gitignore, pruebas smoke, CI y gobernanza.            |
| `node bin/eos.mjs fuzz [--iterations=N]`             | Fuzzing dinámico guiado por cobertura sobre funciones y primitivas del sistema.            |
| `node bin/eos.mjs arena [accion] [--rounds=N]`       | Torneo adversario multi-agente bajo consenso BFT 3f+1 (Red vs Blue vs White).              |
| `node bin/eos.mjs zk:prove [--spec=ID]`              | Genera y verifica prueba Merkle de Conocimiento Cero (ZKP) para un requisito o spec.       |
| `node bin/eos.mjs compile [plataforma] [--dry-run]`  | Compila Glorian en ejecutable nativo hermético SEA (Ed25519 + SLSA Nivel 4).               |
| `node bin/eos.mjs pq:kem [--hybrid] [--json]`        | Encapsula clave post-cuántica (NIST FIPS 203 ML-KEM + X25519) con verificación inmediata.  |
| `node bin/eos.mjs pq:sign [msg] [--hybrid] [--json]` | Genera y verifica firma digital de retículos (NIST FIPS 204 ML-DSA + Ed25519).             |
| `node bin/eos.mjs synthesize [codigo] [--json]`      | Sintetiza y repara código automáticamente mediante mutación genética y cruce de AST.       |
| `node bin/eos.mjs vector:search <query> [--k=N]`     | Búsqueda semántica ANN con grafo HNSW Layer-0 y proyección de subpalabras (SPEC-201).      |
| `node bin/eos.mjs vector:index <id> <code>`          | Indexa fragmentos de código o documentos en el espacio vectorial HNSW multidimensional.    |
| `node bin/eos.mjs tkg:query <pred> [--as-of=T]`      | Inferencia deductiva y consulta Datalog sobre grafo de conocimiento temporal (SPEC-202).   |
| `node bin/eos.mjs tkg:assert <s> <p> <o>`            | Aserción de hechos cuadripolares bi-temporales con recibos criptográficos SHA-256.         |
| `node bin/eos.mjs wasm:decompile [target] [--wat]`   | Descompila bytecode WebAssembly a formato de texto WAT canónico (SPEC-203).                |
| `node bin/eos.mjs wasm:prove [target] [--json]`      | Demostrador formal de seguridad de pila, memoria y CFI en WASM (SPEC-203).                 |
| `node bin/eos.mjs mcts:search [problem]`             | Planificador heurístico Monte Carlo Tree Search con red política-valor (SPEC-204).         |
| `node bin/eos.mjs mcts:play [problem]`               | Simulación interactiva de toma de decisiones estratégicas óptimas (SPEC-204).              |
| `node bin/eos.mjs tla:check [modelo]`                | Verificador de modelos simbólico TLA+ y prueba de invariantes inductivos (SPEC-205).       |
| `node bin/eos.mjs tla:synthesize [mod]`              | Sintetiza especificación canónica formal TLA+ a partir de contratos TypeScript (SPEC-205). |
| `node bin/eos.mjs raft:cluster [--nodes=N]`          | Simula clúster de consenso Raft distribuido con FSM replicada (SPEC-206).                  |
| `node bin/eos.mjs raft:status [--json]`              | Estado en vivo del clúster Raft, quórum de mayoría y recibo criptográfico (SPEC-206).      |
| `node bin/eos.mjs compress:ans [texto]`              | Compresor de entropía rANS Layer-0 cercano al límite de Shannon (SPEC-207).                |
| `node bin/eos.mjs decompress:ans <base64>`           | Descompresor sin pérdidas rANS con verificación de integridad SHA-256 (SPEC-207).          |
| `node bin/eos.mjs autodiff:grad`                     | Diferenciación automática en modo reverso con oráculo de gradientes (SPEC-208).            |
| `node bin/eos.mjs autodiff:train [--epochs=N]`       | Optimización cerrada de parámetros vía SGD y tensor core multidimensional (SPEC-208).      |
| `node bin/eos.mjs anomaly:detect [--threshold=F]`    | Detector de anomalías no supervisado con Isolation Forest (SPEC-209).                      |
| `node bin/eos.mjs anomaly:forest [--trees=N]`        | Simulación de ensamble de árboles aleatorios iTrees en streaming (SPEC-209).               |
| `node bin/eos.mjs metrics`                           | Exporta métricas OpenMetrics / Prometheus directamente a la terminal.                      |
| `node bin/eos.mjs guard [directorio]`                | Inspecciona la arquitectura de dependencias de cualquier repositorio local.                |
| `node bin/eos.mjs flow inspect <ruta>`               | Analiza la estructura y salud arquitectónica de un proyecto externo en modo solo lectura.  |
| `node bin/eos.mjs worktree list`                     | Lista los árboles de trabajo (_worktrees_) aislados de Git.                                |

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
