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

### Módulo 26: Núcleo Criptográfico Homomórfico de Retículos (`EosHomomorphicLatticeCore`)

**Propósito:** Cómputo ciego confidencial basado en retículos (Ring Learning with Errors / esquema BFV) sobre anillos de polinomios ciclotómicos $R_q = \mathbb{Z}_q[X] / (X^N + 1)$ con cero dependencias externas (Ley V). Permite a nodos y agentes de trabajo no confiables o semi-honestos ejecutar operaciones aritméticas directamente sobre textos cifrados (adición, sustracción, escalamiento lineal) preservando la exactitud del texto plano sin descifrar jamás los datos en memoria. Incluye muestreo ternario y de error discreto gaussiano acotado, modulación de ruido, escala $\Delta = \lfloor q / t \rfloor$, seguimiento en tiempo real del presupuesto de ruido (noise budget en bits) y recibos criptográficos SHA-256.

```ts
import { EosHomomorphicLatticeCore } from "./src/core/eosHomomorphicLatticeCore.ts";

// 1. Inicialización del motor en anillo ciclotómico R_q
const core = new EosHomomorphicLatticeCore({
  polyDegree: 32,
  ciphertextModulus: 65537,
  plaintextModulus: 257,
});

// 2. Generación de claves pública / secreta
const keypair = core.generateKeypair();

// 3. Cifrado ciego de vectores planos
const ctA = core.encrypt(keypair.publicKey, [10, 20, 30, 40]);
const ctB = core.encrypt(keypair.publicKey, [5, 15, 25, 35]);

// 4. Cómputo homomórfico directo (sin descifrar)
const ctSuma = core.add(ctA, ctB);

// 5. Descifrado verificado con presupuesto de ruido
const resultado = core.decrypt(keypair.secretKey, ctSuma);
console.log(`Resultado ciego : [${resultado.plaintext.slice(0, 4).join(", ")}]`); // [15, 35, 55, 75]
console.log(`Presupuesto de ruido: ${resultado.noiseBudgetBits} bits`);
console.log(`Recibo SHA-256  : ${resultado.receipt.receiptSha256}`);
```

---

### Módulo 27: Motor de Cómputo Multipartito Seguro y Esquema Shamir (`EosSecureMpcShamirCore`)

**Propósito:** Evaluación multipartita segura (SMPC) basada en el esquema de compartición de secretos de Shamir $(k, N)$ y tríos multiplicativos de Beaver sobre campos finitos primos $\mathbb{Z}_p$ utilizando aritmética nativa `BigInt` sin dependencias externas (Ley V). Permite a enjambres de $N$ agentes evaluar operaciones conjuntas sobre valores privados (adición local homomórfica sin comunicación, escalamiento lineal, multiplicación segura $[x \cdot y]$) garantizando seguridad teórica de la información: cualquier subconjunto con menos de $k$ participantes no puede extraer ningún bit del secreto original. Incluye compromisos criptográficos SHA-256 por cada acción (Verifiable Secret Sharing) e interpolación de Lagrange con algoritmo extendido de Euclides para el inverso modular exacto.

```ts
import { EosSecureMpcShamirCore } from "./src/core/eosSecureMpcShamirCore.ts";

// 1. Inicialización de parámetros MPC: umbral k = 3, N = 5 partes
const core = new EosSecureMpcShamirCore({ threshold: 3, totalParties: 5 });

// 2. División de secreto confidencial
const shares = core.split(424242n);

// 3. Adición homomórfica no interactiva entre partes
const sharesB = core.split(1000n);
const sharesSuma = shares.map((s, i) => core.addShares(s, sharesB[i]));

// 4. Reconstrucción exacta con cualquier subconjunto >= k partes
const resultado = core.combine(sharesSuma.slice(0, 3));
console.log(`Secreto reconstruido: ${resultado.secret}`); // 425242n
console.log(`Recibo SHA-256      : ${resultado.receipt.receiptSha256}`);
```

---

### Módulo 28: Motor de Funciones de Retardo Verificables y Baliza de Aleatoriedad (`EosVerifiableDelayFunctionCore`)

**Propósito:** Evaluación de retardo estrictamente secuencial y pruebas de tiempo transcurrido (Proof of Elapsed Time) basadas en el protocolo de Wesolowski sobre grupos de orden desconocido (módulos compuestos RSA-1024 $\mathbb{Z}_N^*$) utilizando aritmética nativa `BigInt` sin dependencias externas (Ley V). Garantiza que calcular el resultado $y = x^{2^T} \pmod N$ requiera exactamente $T$ pasos secuenciales no paralelizables en tiempo $\Omega(T)$, mientras que la verificación mediante la prueba de Wesolowski $(\pi, \ell)$ con desafío de Fiat-Shamir toma $O(\log T)$ en tiempo sub-milisegundo ($< 1$ ms). Incluye baliza de aleatoriedad incesgada e inmanipulable mediante digestión SHA-256 de $y$, y recibos criptográficos inmutables para cada cálculo y verificación.

```ts
import { EosVerifiableDelayFunctionCore } from "./src/core/eosVerifiableDelayFunctionCore.ts";

// 1. Inicialización de parámetros VDF (módulo RSA-1024, retardo T = 100)
const core = new EosVerifiableDelayFunctionCore({ defaultDelay: 100 });

// 2. Cómputo secuencial con generación de prueba de Wesolowski
const evaluacion = core.compute("entropy-seed-2026", 100);
console.log(`Salida evaluada y   : ${evaluacion.y.toString(16).slice(0, 16)}...`);
console.log(`Prueba Wesolowski π : ${evaluacion.proof.proofHex.slice(0, 16)}...`);
console.log(`Baliza aleatoria    : sha256:${evaluacion.randomnessBeacon}`);

// 3. Verificación rápida sub-milisegundo (O(log T) pasos)
const veredicto = core.verify(evaluacion.x, evaluacion.y, evaluacion.delayT, evaluacion.proof);
console.log(`¿Es auténtico?      : ${veredicto.valid}`); // true
console.log(`Tiempo verificación : ${veredicto.verificationTimeMs.toFixed(3)} ms`);
console.log(`Recibo SHA-256      : ${veredicto.receipt.receiptSha256}`);
```

---

### Módulo 29: Motor de Circuitos R1CS y Pruebas de Conocimiento Cero QAP (`EosZeroKnowledgeR1csCore`)

**Propósito:** Síntesis y verificación de circuitos aritméticos mediante sistemas de restricciones de rango 1 (R1CS: $(A\mathbf{s}) \odot (B\mathbf{s}) = C\mathbf{s}$) y programas aritméticos cuadráticos (QAP) sobre el cuerpo finito primo BN254 ($\mathbb{Z}_p$, $p \approx 2^{254}$) sin dependencias externas (Ley V). Permite a agentes autónomos generar argumentos no interactivos de conocimiento (zk-SNARK foundations) mediante el cómputo del polinomio cociente $H(x) = \frac{A(x)B(x) - C(x)}{T(x)}$ por interpolación de Lagrange y división polinomial exacta (resto estrictamente cero para testigos válidos). Incluye evaluación en puntos de desafío $\tau$ (heurística de Fiat-Shamir) con verificación constante $O(1)$ en sub-milisegundos ($< 1$ ms) y emisión de recibos criptográficos SHA-256.

```ts
import { EosZeroKnowledgeR1csCore } from "./src/core/eosZeroKnowledgeR1csCore.ts";

// 1. Inicialización del motor ZK sobre cuerpo BN254
const core = new EosZeroKnowledgeR1csCore();

// 2. Síntesis de circuito aritmético (ejemplo cúbico: x^3 + x + 5 = 35 con x = 3)
const { system, witness } = core.synthesizeExampleCircuit(3n);
console.log(`Variables en circuito : ${system.numVariables}`); // 5 wires
console.log(`Restricciones R1CS   : ${system.numConstraints}`); // 3 gates

// 3. Generación de prueba QAP no interactiva
const prueba = core.prove(system, witness.values);
console.log(`Digest de prueba     : sha256:${prueba.proofDigest}`);

// 4. Verificación O(1) de argumento de evaluación
const veredicto = core.verify(system, [witness.values[1]], prueba);
console.log(`¿Es válido?          : ${veredicto.valid}`); // true
console.log(`Tiempo verificación  : ${veredicto.verificationTimeMs.toFixed(3)} ms`);
console.log(`Recibo SHA-256       : ${veredicto.receipt.receiptSha256}`);
```

---

### Módulo 30: Motor de Tipos de Datos Replicados Libres de Conflictos (CRDT) y Sincronización de Estado (`EosCrdtStateSyncCore`)

**Propósito:** Sincronización multi-maestro descentralizada y libre de bloqueos basada en tipos de datos replicados libres de conflictos (CRDTs) con semilattices de unión convergentes ($\sqcup$) bajo Consistencia Eventual Fuerte (SEC) sin dependencias externas (Ley V). Proporciona relojes vectoriales de causalidad de Lamport, registros y conjuntos Last-Write-Wins (LWW) con desempate determinista, conjuntos Observed-Remove (ORSet) inmunes a anomalías de resurrección de elementos, y secuencias Replicated Growable Array (RGA) para edición colaborativa de texto y listas con predecesores causales. Incluye extracción de deltas mínimos para redes peer-to-peer y DTN, y emisión de recibos criptográficos SHA-256 por cada mutación y fusión.

```ts
import { EosCrdtStateSyncCore } from "./src/core/eosCrdtStateSyncCore.ts";

// 1. Inicialización de dos réplicas concurrentes
const replica1 = new EosCrdtStateSyncCore("replica-1");
const replica2 = new EosCrdtStateSyncCore("replica-2");

// 2. Mutaciones locales concurrentes sin coordinación
replica1.setRegister("status", "ACTIVE_LEADER");
replica1.addToSet("nodes", "node-101");
replica1.insertSequence("doc", "H");

replica2.setRegister("status", "STANDBY");
replica2.addToSet("nodes", "node-102");
replica2.insertSequence("doc", "I");

// 3. Fusión semilattice bidireccional (convergencia automática)
const res1 = replica1.mergeSnapshot(replica2.exportSnapshot());
const res2 = replica2.mergeSnapshot(replica1.exportSnapshot());
console.log(`¿Convergencia idéntica? : ${res1.stateHashSha256 === res2.stateHashSha256}`); // true
console.log(`Hash de estado final     : sha256:${res1.stateHashSha256}`);
console.log(`Secuencia convergida RGA : "${replica1.readSequence("doc").join("")}"`);
```

---

### Módulo 31: Motor de Acumulador Criptográfico Merkle Mountain Range (`EosMerkleMountainRangeCore`)

**Propósito:** Estructura de datos acumuladora criptográfica de solo anexión (append-only) basada en Merkle Mountain Ranges (MMR) de Peter Todd y RFC 6962 sin dependencias externas (Ley V). Permite a los registros de auditoría y ledgers de transacciones indexar secuencias continuas de eventos con direccionamiento secuencial por posición $O(1)$, descomposición binaria de cumbres de montañas ($\{p_1, \dots, p_k\}$), compromiso raíz canónico mediante el algoritmo _bag-of-peaks_ ($\text{SHA-256}(\text{size} \,\|\, p_1 \,\|\, \dots \,\|\, p_k)$), generación de pruebas de inclusión sucintas de tamaño logarítmico $O(\log n)$ verificables en $< 1$ ms, y demostración de consistencia de prefijos históricos entre tamaños arbitrarios $M \le N$.

```ts
import { EosMerkleMountainRangeCore } from "./src/core/eosMerkleMountainRangeCore.ts";

// 1. Inicialización del acumulador MMR
const mmr = new EosMerkleMountainRangeCore();

// 2. Anexión inmutable de eventos o transacciones
for (let i = 0; i < 7; i++) {
  mmr.append(`tx-record-${i}`);
}
console.log(`Hojas totales : ${mmr.getLeafCount()}`); // 7
console.log(`Nodos en MMR  : ${mmr.getSize()}`); // 11
console.log(`Raíz canónica : sha256:${mmr.getRoot()}`);

// 3. Generación y verificación de prueba de inclusión logarítmica O(log n)
const prueba = mmr.getInclusionProof(2); // Hoja 2
const veredicto = mmr.verifyInclusion(prueba);
console.log(`¿Inclusión válida?  : ${veredicto.valid}`); // true
console.log(`Tiempo verificación : ${veredicto.verificationTimeMs.toFixed(3)} ms`);
console.log(`Recibo SHA-256      : ${veredicto.receipt.receiptSha256}`);
```

---

### Módulo 32: Motor de Funciones Aleatorias Verificables (ECVRF RFC 9381) (`EosVerifiableRandomFunctionCore`)

**Propósito:** Generación de aleatoriedad pública no manipulable, impredecible y públicamente verificable basada en funciones aleatorias verificables sobre curvas elípticas (ECVRF) bajo el estándar RFC 9381 y la curva secp256k1 ($y^2 = x^3 + 7 \pmod p$) sin dependencias externas (Ley V). Permite a participantes descentralizados evaluar una entrada $\alpha$ con su clave privada $sk$ para producir una salida pseudorandom $\beta$ y una prueba sucinta $\pi = (\Gamma, c, s)$ basada en el supuesto de Diffie-Hellman decisional (DDH) y desafío Fiat-Shamir. Cualquier nodo con la clave pública $PK$ puede verificar $\pi$ en sub-milisegundo ($< 2$ ms) y evaluar primitivas de elección de líderes o asignación de slots (`isElected`) con resistencia total a sesgos o manipulaciones.

```ts
import { EosVerifiableRandomFunctionCore } from "./src/core/eosVerifiableRandomFunctionCore.ts";

// 1. Generación determinista o aleatoria de par de claves secp256k1
const keyPair = EosVerifiableRandomFunctionCore.generateKeyPair("seed-vrf-node-1");

// 2. Evaluación de VRF sobre un mensaje/semilla de slot alpha
const core = new EosVerifiableRandomFunctionCore();
const evaluacion = core.evaluate(keyPair.secretKey, "epoch-slot-102");
console.log(`Salida pseudorandom beta : sha256:${evaluacion.beta}`);
console.log(`Punto VRF Gamma (Γ)      : ${evaluacion.proof.gammaHex}`);

// 3. Verificación pública no interactiva (O(1), < 2 ms)
const veredicto = core.verify(keyPair.publicKey, "epoch-slot-102", evaluacion.proof);
console.log(`¿Prueba auténtica?       : ${veredicto.valid}`); // true
console.log(`Tiempo verificación      : ${veredicto.verificationTimeMs.toFixed(3)} ms`);

// 4. Elección verificable de líder con umbral probabilístico
const eleccion = core.isElected(evaluacion.beta, 0.25);
console.log(`¿Elegido como líder?     : ${eleccion.isElected}`);
```

---

### Módulo 33: Motor de Árbol de Merkle Disperso (Sparse Merkle Tree - SMT) con Pruebas de No-Membresía (`EosSparseMerkleTreeCore`)

**Propósito:** Almacenamiento autenticado de pares clave-valor sobre un trie binario de 256 niveles con direccionamiento criptográfico $\text{SHA256}(key)$ y pruebas sucintas tanto de membresía (inclusión) como de **no-membresía (exclusión)** sin dependencias externas (Ley V). Al precalcular y almacenar en memoria los hashes de subárboles vacíos ($Z_0 \dots Z_{256}$), el árbol disperso mantiene un coste de memoria proporcional únicamente al número de claves activas ($O(N \log 256)$) y genera compromisos de raíz canónicos deterministas independientes del orden de inserción. Permite a registros de identidad, listas de revocación (CRLs) y rollups descentralizados demostrar formalmente la ausencia de un registro o credencial en tiempo sub-milisegundo ($< 1$ ms).

```ts
import { EosSparseMerkleTreeCore } from "./src/core/eosSparseMerkleTreeCore.ts";

// 1. Inicialización del SMT de 256 niveles
const smt = new EosSparseMerkleTreeCore();

// 2. Inserción de pares clave-valor autenticados
smt.set("cert:alice-2026", "STATUS_ACTIVE");
smt.set("cert:bob-2026", "STATUS_ACTIVE");
console.log(`Hojas activas : ${smt.getLeafCount()}`); // 2
console.log(`Raíz canónica : sha256:${smt.getRoot()}`);

// 3. Generación y verificación de prueba de membresía
const pruebaInclusion = smt.getProof("cert:alice-2026");
console.log(`Tipo de prueba : ${pruebaInclusion.proofType}`); // "membership"
const veredictoInclusion = smt.verifyProof(pruebaInclusion);
console.log(`¿Membresía válida? : ${veredictoInclusion.valid}`); // true

// 4. Generación y verificación de prueba criptográfica de NO-MEMBRESÍA (Exclusión)
const pruebaExclusion = smt.getProof("cert:revocada-999");
console.log(`Tipo de prueba : ${pruebaExclusion.proofType}`); // "non_membership"
console.log(`Razón exclusión: ${pruebaExclusion.nonMembershipReason}`); // "EMPTY_SUBTREE" o "KEY_COLLISION"
const veredictoExclusion = smt.verifyProof(pruebaExclusion);
console.log(`¿Ausencia probada? : ${veredictoExclusion.valid}`); // true
```

---

### Módulo 34: Motor de Firmas de Umbral Schnorr FROST (RFC 9591) (`EosFrostThresholdSignatureCore`)

**Propósito:** Firmas digitales de umbral $(t, n)$ coordinadas en dos rondas y basadas en curvas elípticas (secp256k1) bajo el estándar IETF RFC 9591 (Flexible Round-Optimized Schnorr Threshold) sin dependencias externas (Ley V). Permite a un conjunto de $n$ participantes independientes generar firmas Schnorr estándar conjuntas requiriendo un quórum de al menos $t$ firmantes activos, garantizando que la firma final $(R, z)$ sea indistinguible en verificación de una firma Schnorr de clave única ordinaria ($z \cdot G \stackrel{?}{=} R + c \cdot PK$). Incorpora compartición de claves polinomiales de Shamir, interpolación de Lagrange en $\mathbb{Z}_q$, compromisos de nonces ocultos y vinculantes en la Ronda 1, factores vinculantes $\rho_i$ inmunes a ataques ROS (concurrent forgeries), y emisión de recibos criptográficos SHA-256 por cada operación de firma y verificación.

```ts
import { EosFrostThresholdSignatureCore } from "./src/core/eosFrostThresholdSignatureCore.ts";

// 1. Configuración de claves de umbral (t = 3, n = 5 participantes)
const setup = EosFrostThresholdSignatureCore.setup(3, 5, "entropy-seed-frost");
console.log(`Clave pública de grupo : 0x${setup.groupKey.groupPublicKeyHex}`);
console.log(`Participantes totales  : ${setup.keyShares.length}`);

// 2. Firma coordinada por un subconjunto de al menos t firmantes (p. ej. {1, 2, 3})
const subconjuntoActivo = [setup.keyShares[0], setup.keyShares[1], setup.keyShares[2]];
const core = new EosFrostThresholdSignatureCore();
const resultadoFirma = core.sign(setup.groupKey, subconjuntoActivo, "tx-transfer-funds");
console.log(`Firma Schnorr unificada: 0x${resultadoFirma.signatureHex}`);
console.log(`Recibo de firma SHA-256: sha256:${resultadoFirma.receipt.receiptSha256}`);

// 3. Verificación pública ordinaria de clave única (indistinguible en cadena)
const veredicto = core.verify(
  setup.groupKey.groupPublicKey,
  "tx-transfer-funds",
  resultadoFirma.signature,
);
console.log(`¿Firma de umbral válida? : ${veredicto.valid}`); // true
console.log(`Tiempo de verificación   : ${veredicto.verificationTimeMs.toFixed(3)} ms`);
```

---

### Módulo 35: Motor de Compromisos Polinomiales Kate-Zaverucha-Goldberg (KZG) (`EosKzgPolynomialCommitmentCore`)

**Propósito:** Compromisos polinomiales de tamaño constante $O(1)$ y pruebas de evaluación sucintas basados en el esquema de Kate-Zaverucha-Goldberg (KZG) sobre curvas elípticas (secp256k1) sin dependencias externas (Ley V). Permite a los rollups descentralizados, capas de disponibilidad de datos (EIP-4844 / Blobs) y sistemas zk-SNARK comprometer un polinomio completo $p(x) = \sum_{i=0}^d c_i x^i$ en un único punto comprimido de curva elíptica $C = [p(\tau)] \in \mathbb{G}_1$ (33 bytes) mediante multiscalar multiplication (MSM) sobre un Structured Reference String (SRS) powers-of-tau. Permite abrir evaluaciones $p(z) = v$ calculando el polinomio cociente $q(x) = \frac{p(x) - v}{x - z}$ mediante división sintética con resto cero demostrable, generando una prueba constante $\pi = [q(\tau)] \in \mathbb{G}_1$ verificable en sub-milisegundo ($< 2$ ms). Soporta agregación por lotes (_batched multi-proofs_) con polinomio anulador $Z(x) = \prod (x - z_j)$ y polinomio interpolador de Lagrange $I(x)$.

```ts
import { EosKzgPolynomialCommitmentCore } from "./src/core/eosKzgPolynomialCommitmentCore.ts";

// 1. Configuración de parámetros SRS powers-of-tau
const srs = EosKzgPolynomialCommitmentCore.setup(16, "entropy-seed-kzg");
const core = new EosKzgPolynomialCommitmentCore(srs);

// 2. Compromiso O(1) de polinomio p(x) = 3x^3 + 2x^2 + 5x + 7
const polinomio = [7n, 5n, 2n, 3n];
const compromiso = core.commit(polinomio);
console.log(`Compromiso KZG (C) : 0x${compromiso.commitmentHex}`); // 33 bytes
console.log(`Grado de polinomio : ${compromiso.degree}`);

// 3. Apertura de evaluación en el punto z = 4 (v = p(4) = 251)
const apertura = core.open(polinomio, 4n);
console.log(`Valor evaluado v=p(z): ${apertura.claimedValue}`); // 251n
console.log(`Prueba de cociente π : 0x${apertura.proofHex}`);

// 4. Verificación algebraica constante O(1) en sub-milisegundo
const veredicto = core.verify(
  compromiso.commitmentPoint,
  4n,
  apertura.claimedValue,
  apertura.proofPoint,
);
console.log(`¿Evaluación auténtica?: ${veredicto.valid}`); // true
console.log(`Tiempo verificación   : ${veredicto.verificationTimeMs.toFixed(3)} ms`);
```

---

### Módulo 36: Motor de Encapsulación de Claves Post-Cuánticas NIST FIPS 203 ML-KEM-768 (`EosPostQuantumMlKemCore`)

**Propósito:** Mecanismo de encapsulación de claves resistente a computación cuántica basado en retículos modulares (Module Learning with Errors - M-LWE) bajo el estándar oficial NIST FIPS 203 (ML-KEM-768 / Categoría de Seguridad 3, equivalente a AES-192) sin dependencias externas (Ley V). Implementa aritmética polinomial exacta en el anillo $R_q = \mathbb{Z}_q[X]/(X^{256} + 1)$ con $q = 3329$ mediante la transformada de teoría de números (NTT / INTT) con raíz primitiva $\zeta = 17$, muestreo de ruido gaussiano mediante Centered Binomial Distribution (CBD con $\eta = 2$), y la transformada Fujisaki-Okamoto con **rechazo implícito determinista a tiempo constante** ($J(z, c)$) ante ataques de texto cifrado activo (IND-CCA2). Permite a los 9 nodos soberanos de la flota acordar secretos compartidos simétricos de 256 bits (32 bytes) a prueba de ataques cuánticos ("harvest-now, decrypt-later").

```ts
import { EosPostQuantumMlKemCore } from "./src/core/eosPostQuantumMlKemCore.ts";

// 1. Generación de par de claves post-cuánticas ML-KEM-768
const kem = new EosPostQuantumMlKemCore();
const parClaves = kem.generateKeyPair();
console.log(`Clave de encapsulación (ek): ${parClaves.encapsulationKey.length} bytes`); // 1184 bytes
console.log(`Clave de decapsulación (dk): ${parClaves.decapsulationKey.length} bytes`); // 2400 bytes

// 2. Encapsulación de secreto compartido contra clave pública (emisor / Alice)
const encapsulacion = kem.encapsulate(parClaves.encapsulationKey);
console.log(`Texto cifrado (c)          : ${encapsulacion.ciphertext.length} bytes`); // 1088 bytes
console.log(
  `Secreto compartido (K)     : 0x${Buffer.from(encapsulacion.sharedSecret).toString("hex")}`,
);

// 3. Decapsulación con clave secreta (receptor / Bob)
const decapsulacion = kem.decapsulate(parClaves.decapsulationKey, encapsulacion.ciphertext);
console.log(`¿Texto cifrado auténtico?  : ${decapsulacion.valid}`); // true
console.log(
  `¿Coincidencia de secretos? : ${Buffer.from(encapsulacion.sharedSecret).equals(Buffer.from(decapsulacion.sharedSecret))}`,
); // true
```

### Módulo 37: Motor de Pruebas de Rango de Conocimiento Cero Bulletproofs (`EosBulletproofsRangeProofCore`)

**Propósito:** Pruebas no interactivas de conocimiento cero (NIZK) compactas sin ceremonia de configuración de confianza (zero trusted setup) basadas en el protocolo de doblado logarítmico del producto interno (Bünz et al., SPEC-222 / CHANGE-107). Permite demostrar que un valor secreto $v$ (e.g. cuotas de balance, límites computacionales o transacciones confidenciales) se encuentra acotado en el intervalo $[0, 2^m - 1]$ para $m \in \{16, 32, 64\}$ bits sin revelar su magnitud ni el factor de cegado $\gamma$ en el compromiso homomórfico Pedersen $V = v \cdot G + \gamma \cdot H$. Produce pruebas de tamaño $O(\log m)$ (14 elementos de grupo y 5 escalares para 32 bits) verificables en tiempo sub-milisegundo sobre secp256k1 en TypeScript puro (Ley V).

```ts
import { EosBulletproofsRangeProofCore } from "./src/core/eosBulletproofsRangeProofCore.ts";

// 1. Compromiso homomórfico de Pedersen
const compromiso = EosBulletproofsRangeProofCore.commit(42000n);
console.log(`Punto de compromiso (V): ${compromiso.pointHex}`);

// 2. Generación de prueba NIZK para rango [0, 2^32 - 1]
const prueba = EosBulletproofsRangeProofCore.prove(42000n, compromiso.gamma, 32);
console.log(`Rondas del producto interno: ${prueba.ipProof.L.length}`); // 5 rondas
console.log(`Digest SHA-256 de la prueba: sha256:${prueba.proofSha256}`);

// 3. Verificación algebraica sin ceremonia de confianza
const verificacion = EosBulletproofsRangeProofCore.verify(prueba);
console.log(`¿Prueba válida y sana?: ${verificacion.valid}`); // true
console.log(`Tiempo de verificación: ${verificacion.verificationTimeMs} ms`);
```

---

## 4. Guía Rápida de Comandos CLI

El ejecutable principal es `./bin/eos.mjs` (disponible como comandos `glorian` o `eos`):

| Comando                                                | Descripción                                                                                |
| :----------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| `node bin/eos.mjs help`                                | Muestra el menú completo de comandos disponibles.                                          |
| `node bin/eos.mjs enterprise:health`                   | Audita la salud del sistema y emite tabla de estado con recibo SHA-256.                    |
| `node bin/eos.mjs enterprise:health --json`            | Emite el reporte de salud en formato JSON machine-readable para CI/CD.                     |
| `node bin/eos.mjs doctor [ruta] [--write-ci]`          | Diagnostica los 5 pilares Soundcheck (0-100) y opcionalmente sintetiza pipeline CI.        |
| `node bin/eos.mjs remediate [ruta] [--dry-run]`        | Auto-remedia el repositorio: genera .gitignore, pruebas smoke, CI y gobernanza.            |
| `node bin/eos.mjs fuzz [--iterations=N]`               | Fuzzing dinámico guiado por cobertura sobre funciones y primitivas del sistema.            |
| `node bin/eos.mjs arena [accion] [--rounds=N]`         | Torneo adversario multi-agente bajo consenso BFT 3f+1 (Red vs Blue vs White).              |
| `node bin/eos.mjs zk:prove [--spec=ID]`                | Genera y verifica prueba Merkle de Conocimiento Cero (ZKP) para un requisito o spec.       |
| `node bin/eos.mjs compile [plataforma] [--dry-run]`    | Compila Glorian en ejecutable nativo hermético SEA (Ed25519 + SLSA Nivel 4).               |
| `node bin/eos.mjs pq:kem [--hybrid] [--json]`          | Encapsula clave post-cuántica (NIST FIPS 203 ML-KEM + X25519) con verificación inmediata.  |
| `node bin/eos.mjs pq:sign [msg] [--hybrid] [--json]`   | Genera y verifica firma digital de retículos (NIST FIPS 204 ML-DSA + Ed25519).             |
| `node bin/eos.mjs synthesize [codigo] [--json]`        | Sintetiza y repara código automáticamente mediante mutación genética y cruce de AST.       |
| `node bin/eos.mjs vector:search <query> [--k=N]`       | Búsqueda semántica ANN con grafo HNSW Layer-0 y proyección de subpalabras (SPEC-201).      |
| `node bin/eos.mjs vector:index <id> <code>`            | Indexa fragmentos de código o documentos en el espacio vectorial HNSW multidimensional.    |
| `node bin/eos.mjs tkg:query <pred> [--as-of=T]`        | Inferencia deductiva y consulta Datalog sobre grafo de conocimiento temporal (SPEC-202).   |
| `node bin/eos.mjs tkg:assert <s> <p> <o>`              | Aserción de hechos cuadripolares bi-temporales con recibos criptográficos SHA-256.         |
| `node bin/eos.mjs wasm:decompile [target] [--wat]`     | Descompila bytecode WebAssembly a formato de texto WAT canónico (SPEC-203).                |
| `node bin/eos.mjs wasm:prove [target] [--json]`        | Demostrador formal de seguridad de pila, memoria y CFI en WASM (SPEC-203).                 |
| `node bin/eos.mjs mcts:search [problem]`               | Planificador heurístico Monte Carlo Tree Search con red política-valor (SPEC-204).         |
| `node bin/eos.mjs mcts:play [problem]`                 | Simulación interactiva de toma de decisiones estratégicas óptimas (SPEC-204).              |
| `node bin/eos.mjs tla:check [modelo]`                  | Verificador de modelos simbólico TLA+ y prueba de invariantes inductivos (SPEC-205).       |
| `node bin/eos.mjs tla:synthesize [mod]`                | Sintetiza especificación canónica formal TLA+ a partir de contratos TypeScript (SPEC-205). |
| `node bin/eos.mjs raft:cluster [--nodes=N]`            | Simula clúster de consenso Raft distribuido con FSM replicada (SPEC-206).                  |
| `node bin/eos.mjs raft:status [--json]`                | Estado en vivo del clúster Raft, quórum de mayoría y recibo criptográfico (SPEC-206).      |
| `node bin/eos.mjs compress:ans [texto]`                | Compresor de entropía rANS Layer-0 cercano al límite de Shannon (SPEC-207).                |
| `node bin/eos.mjs decompress:ans <base64>`             | Descompresor sin pérdidas rANS con verificación de integridad SHA-256 (SPEC-207).          |
| `node bin/eos.mjs autodiff:grad`                       | Diferenciación automática en modo reverso con oráculo de gradientes (SPEC-208).            |
| `node bin/eos.mjs autodiff:train [--epochs=N]`         | Optimización cerrada de parámetros vía SGD y tensor core multidimensional (SPEC-208).      |
| `node bin/eos.mjs anomaly:detect [--threshold=F]`      | Detector de anomalías no supervisado con Isolation Forest (SPEC-209).                      |
| `node bin/eos.mjs anomaly:forest [--trees=N]`          | Simulación de ensamble de árboles aleatorios iTrees en streaming (SPEC-209).               |
| `node bin/eos.mjs pbft:cluster [--nodes=A,B,C,D]`      | Consenso bizantino PBFT 3-fases con quórum supermayoritario 2f+1 y slashing (SPEC-210).    |
| `node bin/eos.mjs homomorphic:keygen [--degree=N]`     | Generación de par de claves en anillo ciclotómico R_q con cifrado BFV (SPEC-211).          |
| `node bin/eos.mjs homomorphic:add [--json]`            | Cómputo ciego homomórfico (adición de textos cifrados) con recibo SHA-256 (SPEC-211).      |
| `node bin/eos.mjs mpc:split [--secret=N]`              | División de secreto Shamir (k, N) con compromisos de integridad SHA-256 (SPEC-212).        |
| `node bin/eos.mjs mpc:combine [--json]`                | Reconstrucción exacta vía interpolación de Lagrange y suma homomórfica (SPEC-212).         |
| `node bin/eos.mjs vdf:compute [--delay=N] [--seed=S]`  | Cómputo de retardo secuencial T pasos y prueba Wesolowski (SPEC-213).                      |
| `node bin/eos.mjs vdf:verify [--delay=N] [--seed=S]`   | Verificación O(log T) sub-milisegundo de prueba de retardo (SPEC-213).                     |
| `node bin/eos.mjs vdf:beacon [--seed=S]`               | Baliza de aleatoriedad inmanipulable derivada de VDF (SPEC-213).                           |
| `node bin/eos.mjs r1cs:synthesize [--secret=N]`        | Síntesis de circuito R1CS y asignación de testigo (SPEC-214).                              |
| `node bin/eos.mjs r1cs:prove [--secret=N]`             | Generación de prueba QAP evaluada a desafío Fiat-Shamir τ (SPEC-214).                      |
| `node bin/eos.mjs r1cs:verify [--json]`                | Verificación O(1) sub-milisegundo de prueba de conocimiento cero (SPEC-214).               |
| `node bin/eos.mjs crdt:mutate [--node=N]`              | Mutación local de estado CRDT (LWW, ORSet, RGA) con reloj vectorial (SPEC-215).            |
| `node bin/eos.mjs crdt:merge [--json]`                 | Fusión semilattice bidireccional con consistencia eventual fuerte SEC (SPEC-215).          |
| `node bin/eos.mjs crdt:delta [--json]`                 | Extracción y aplicación de parches delta mínimos entre réplicas (SPEC-215).                |
| `node bin/eos.mjs mmr:append [--count=N]`              | Anexa registros al acumulador MMR y calcula cumbres de montaña y raíz (SPEC-216).          |
| `node bin/eos.mjs mmr:prove [--leaf=N]`                | Genera prueba de inclusión O(log n) para una hoja del acumulador MMR (SPEC-216).           |
| `node bin/eos.mjs mmr:verify [--leaf=N]`               | Verifica la autenticidad de una prueba de inclusión MMR en sub-milisegundo (SPEC-216).     |
| `node bin/eos.mjs vrf:eval [--alpha=S]`                | Evaluación de función aleatoria verificable ECVRF RFC 9381 (SPEC-217).                     |
| `node bin/eos.mjs vrf:verify [--json]`                 | Verificación no interactiva de prueba VRF y reconstrucción de beta en <2ms (SPEC-217).     |
| `node bin/eos.mjs vrf:elect [--thresh=F]`              | Elección verificable e inmanipulable de líder de consenso mediante score VRF (SPEC-217).   |
| `node bin/eos.mjs smt:set [--key=K] [--value=V]`       | Mutación autenticada de clave-valor en Sparse Merkle Tree (SPEC-218).                      |
| `node bin/eos.mjs smt:prove [--key=K]`                 | Genera prueba de membresía o no-membresía (exclusión) en tiempo O(log n) (SPEC-218).       |
| `node bin/eos.mjs smt:verify [--key=K]`                | Verifica criptográficamente existencia o ausencia en SMT en sub-milisegundo (SPEC-218).    |
| `node bin/eos.mjs frost:keygen [--t=N] [--signers=N]`  | Configuración distribuida de claves de umbral FROST (RFC 9591 / SPEC-219).                 |
| `node bin/eos.mjs frost:sign [--message=M] [--active]` | Firma de umbral en dos rondas con factores anti-ROS y agregación Lagrange (SPEC-219).      |
| `node bin/eos.mjs frost:verify [--message=M]`          | Verificación no interactiva indistinguible de Schnorr de clave única (SPEC-219).           |
| `node bin/eos.mjs kzg:commit [--coeffs=C]`             | Compromiso polinomial O(1) Kate-Zaverucha-Goldberg (SPEC-220).                             |
| `node bin/eos.mjs kzg:open [--coeffs=C] [--point=z]`   | Generación de prueba de apertura q(x) = (p(x)-v)/(x-z) (SPEC-220).                         |
| `node bin/eos.mjs kzg:verify [--coeffs=C] [--point=z]` | Verificación no interactiva O(1) de prueba de evaluación KZG (SPEC-220).                   |
| `node bin/eos.mjs kzg:batch [--points=Z]`              | Prueba y verificación por lotes multi-punto con polinomio anulador (SPEC-220).             |
| `node bin/eos.mjs ml-kem:keygen [--json]`              | Genera par de claves post-cuánticas ML-KEM-768 (NIST FIPS 203 / SPEC-221).                 |
| `node bin/eos.mjs ml-kem:encaps [--ek=EK]`             | Encapsula secreto compartido de 32B y emite texto cifrado de 1088B (SPEC-221).             |
| `node bin/eos.mjs ml-kem:decaps [--dk=DK] [--ct=CT]`   | Decapsula con rechazo implícito determinista constante ante falsificaciones (SPEC-221).    |
| `node bin/eos.mjs ml-kem:benchmark [--iterations=N]`   | Benchmark de operaciones post-cuánticas por segundo (>1000 ops/sec) (SPEC-221).            |
| `node bin/eos.mjs bp:commit [--value=V]`               | Compromiso homomórfico Pedersen V = v*G + gamma*H (SPEC-222).                              |
| `node bin/eos.mjs bp:prove [--value=V] [--m=32]`       | Genera prueba NIZK Bulletproofs acotada a [0, 2^m - 1] con doblado logarítmico (SPEC-222). |
| `node bin/eos.mjs bp:verify [--m=32]`                  | Verifica algebraicamente la prueba NIZK sin ceremonia de confianza en <5ms (SPEC-222).     |
| `node bin/eos.mjs bp:benchmark [--m=16]`               | Benchmark de operaciones por segundo para compromiso, prueba y verificación (SPEC-222).    |
| `node bin/eos.mjs metrics`                             | Exporta métricas OpenMetrics / Prometheus directamente a la terminal.                      |
| `node bin/eos.mjs guard [directorio]`                  | Inspecciona la arquitectura de dependencias de cualquier repositorio local.                |
| `node bin/eos.mjs flow inspect <ruta>`                 | Analiza la estructura y salud arquitectónica de un proyecto externo en modo solo lectura.  |
| `node bin/eos.mjs worktree list`                       | Lista los árboles de trabajo (_worktrees_) aislados de Git.                                |

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
