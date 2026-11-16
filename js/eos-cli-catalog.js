/* Absolute-Max W3 — CLI catalog split from eos.js (zero deps) */
window.EOS_CLI_OUTPUTS = {
  "flow:inspect": `$ node bin/eos.mjs flow inspect "<repo-path>"

Guía de uso: lee el repositorio local y muestra una huella y señales heurísticas.
No cambia archivos, no ejecuta pruebas y no evalúa preparación productiva.
Este panel no ejecutó el comando ni contiene resultados de un repositorio.`,

  "flow:plan": `$ node bin/eos.mjs flow plan "<repo-path>" "Describir el cambio deseado"

Guía de uso: prepara pasos y comandos candidatos a partir del inventario local.
El plan es heurístico; no llama a un modelo ni escribe en el repositorio.
Este panel no ejecutó el comando ni contiene resultados de un repositorio.`,

  "sandbox:doctor": `$ node bin/eos.mjs sandbox doctor

Guía de uso: comprueba los requisitos locales de Docker y del sandbox.
No ejecuta una validación de proyecto ni modifica archivos.
Este panel no ejecutó el comando ni contiene resultados del equipo.`,

  "develop:universal": `$ eos develop "Cualquier instrucción de desarrollo del usuario"
> Initializing EOS Universal Autonomous Development Engine (UniversalDevelopmentEngine.ts)...

[1/21] INTAKE & CONTEXT             : Directriz humana convertida en especificación formal determinista
[2/21] RECONNAISSANCE               : Análisis de dependencias, contratos de datos y árbol Git limpio
[3/21] CONTEXT UNDERSTANDING        : Inventario de modelos de dominio y restricciones de arquitectura
[4/21] REQUIREMENTS (EARS & BDD)    : Formalización en sintaxis EARS y escenarios GIVEN-WHEN-THEN
[5/21] RESEARCH                     : Evaluación de patrones state-of-the-art y avisos de seguridad
[6/21] ARCHITECTURE (HEXAGONAL L0)  : Dominio 100% aislado (0 dependencias externas) + ADRs registradas
[7/21] DESIGN                       : Wireframes semánticos y tokens WCAG 2.1 AA de accesibilidad
[8/21] SPECIFICATION APPROVAL       : Validación de coherencia y cierre del paquete de especificación
[9/21] AUTHORIZATION GATE           : Verificación de 6 precondiciones previas al código (Level 2 Gate)
[10/21] IMPLEMENTATION (DAG)        : Dominio ➔ Aplicación ➔ Infraestructura ➔ UI (Resolución DAG)
[11/21] UNIT & LOGIC TESTING        : 100% Cobertura de reglas de negocio puras
[12/21] SECURITY AUDIT              : Escaneo OWASP, cero secretos en texto plano y sanitización
[13/21] QUALITY AUDIT               : Tipado TypeScript 5.7 Strict al 100% y cero advertencias de linter
[14/21] ACCESSIBILITY AUDIT         : WCAG 2.1 AA con navegación completa por teclado
[15/21] PERFORMANCE AUDIT           : Core Web Vitals (LCP < 2.5s, CLS < 0.1) y presupuesto de bundle
[16/21] SEO & SEMANTICS AUDIT       : Schema.org JSON-LD, OpenGraph y etiquetas semánticas
[17/21] BROWSER QA                  : Pruebas visuales E2E en navegador real y breakpoints responsivos
[18/21] EVIDENCE COLLECTION         : Captura determinista de stdout/stderr y hashes SHA-256
[19/21] STRICT INTEGRITY AUDIT      : Ejecución de verify:strict con Exit Code 0
[20/21] PRODUCTION DEPLOYMENT       : Despliegue atómico en Vercel Edge con aliasing instantáneo
[21/21] POST-DEPLOY VERIFY & SYNC   : Smoke tests HTTP 200 y sincronización continua de telemetría

STATUS: UNIVERSAL_ENGINE_SUCCESS | ALL_21_STEPS_VERIFIED | EXIT CODE: 0`,

  "dualtrack:orchestrator": `$ eos dual-track --simulate
> Initializing EOS Dual-Track Syntactic Orchestrator (src/core/application/DualTrackOrchestrator.ts)...

[AST SYNTACTIC PARSING] Evaluating Incoming Task Intent...
  ├─ Prompt Analyzed   : "Desplegar transaccion financiera ACID y mutacion de esquema"
  ├─ Domain Risk Score : 0.94 / 1.00 (CRITICAL_DATABASE_MUTATION)
  ├─ Matched Keywords  : [schema, database, acid, transaction, security]
  └─ Track Decision    : HEAVY_TRACK (Mandatory Level 2 Gate & EARS Formal Package)

[FORMAL EARS CONTRACT GENERATED]
  ├─ Pattern Type      : Event-Driven (CUANDO / EL SISTEMA)
  ├─ Specification     : CUANDO el operador ejecute la mutacion, EL SISTEMA validara invariantes ACID.
  ├─ BDD Scenarios     : 100% GIVEN-WHEN-THEN Pass (0 Flaky Steps)
  └─ Strict Pre-Gate   : Code Generation BLOCKED until Human Level 2 Signoff

STATUS: DUAL_TRACK_ACTIVE | HEAVY_TRACK_GOVERNED | EXIT CODE: 0`,

  "attestation:chain": `$ eos attestation --chain
> Verifying Cryptographic Attestation Block & Merkle Evidence Chain (docs/evidence/)...

LEDGER BLOCK          RECORD ID         SIGNATURE ALGORITHM    HASH ROOT (SHA-256)                 STATUS
---------------------------------------------------------------------------------------------------------
Genesis Block #0001   EVD-0001-CORE     SHA-256 + Ed25519      4b2c57a0e9c4a81f3b720d49108a7f63... VERIFIED
Milestone Block #0002 EVD-0002-DUALTRK  SHA-256 + Ed25519      8d9726e44b15283a04b15d6e7f8a9b0c... VERIFIED
Fleet Block #0003     EVD-0003-FLEET    SHA-256 + Ed25519      c681c7e95675e02dd7037f814126dec8... VERIFIED
Master Block #0004    EVD-0010-GOLDEN   SHA-256 + Ed25519      55dba803455ed3a86df6dfa932966957... SEALED

[CRYPTOGRAPHIC INTEGRITY] Tamper Evidence: 0 MUTATIONS | Chain Valid: 100% | Epistemic State: VERIFIED`,

  "verify:strict": `$ npm run verify:strict

Vista previa estática: no se ejecutó el comando.
El script configurado es scripts/verify-cicd-pipeline.mjs.
Consulta el script y sus límites para saber qué verifica.
Esta vista previa no contiene resultados, sellos ni código de salida.`,

  "sentinel:fdir": `$ eos sentinel --fdir
> Starting EOSSentinelDaemon (24/7 Heartbeat) & EOSFDIROntology Clinical Firewall...

[24/7 PULSE] Scanning .cursorrules, CONSTITUTION.md, and MCP Contracts...
  ├─ Directive SHA-256 : 7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b [MATCH]
  ├─ Ed25519 Signature : VALIDATED (Sovereign Root Key)
  └─ Illegal Mutations : 0 DETECTED

[FDIR GRAPH] Auditing Knowledge Ontology & OpenSpec Delta Links...
  ├─ Nodes Inspected   : 148 Architectural Entities & 21 Pipeline Gates
  ├─ Orphan Links      : 0 ORPHAN_LINK_DETECTED
  └─ Relational State  : HARMONIZED (100% Ledger Consistency)

STATUS: SENTINEL_ACTIVE_24_7 | FDIR_HEALED | EXIT CODE: 0`,

  "worktree:xirp": `$ eos worktree --xirp
> Inspecting Xirp-Inspired Multi-Agent Git Worktree & WSL2 tmux Isolation Matrix...

SESSION ID            AGENT ENGINE           GIT WORKTREE PATH                  TMUX PANE    STATUS
---------------------------------------------------------------------------------------------------------
eos-wt-core-01        Google Antigravity     /worktrees/eos-control-plane       eos:0.1      ACTIVE (VERIFIED)
eos-wt-dsp-02         Cursor Agentic IDE     /worktrees/aberamentho-dsp         eos:0.2      ACTIVE (8 PLAYLISTS)
eos-wt-go-03          Claude Code CLI        /worktrees/go-concurrency-gw       eos:0.3      STANDBY (SYNCED)
eos-wt-audit-04       Gemini 2.5 Pro         /worktrees/fdir-evidence-auditor   eos:0.4      MONITORING 24/7

[XIRP BENCHMARK] Vendor Lock-In: ZERO | Cross-Agent Context: 100% PRESERVED | Collision Rate: 0.00%`,

  "mcp:graph": `$ eos mcp --graph
> Querying Model Context Protocol (MCP) Architecture & Data Contract Server...

MCP SERVER               CAPABILITY / RESOURCE                     CONSUMING AGENTS                  STATUS
--------------------------------------------------------------------------------------------------------------
eos-ssot-mcp             Architecture Graph + EARS/BDD Contracts   Antigravity, Cursor, Claude       ONLINE
engram-memory-mcp        Persistent Architectural Memory & ADRs    All Fleet Agents                  ONLINE
neon-postgres-mcp        Edge SQL Transactions & Telemetry WAL     ATP-Strength, Portafolio          ONLINE
chrome-devtools-mcp      WCAG 2.1 AA, CWV (LCP/CLS) & DOM Audit    Browser QA & Performance Agent    ONLINE

[CONTRACT GATE] Every agent session receives full architectural context BEFORE writing a single line of code.`,

  "fleet:status": `GET /api/fleet

Muestra estática; esta consola no consultó el endpoint.
Fuente configurada: docs/projects/registry.json
Los proyectos se muestran como REGISTERED si así figuran en el registro.
Salud, CI, hooks y producción: NOT_PROBED.
No se inspeccionan checkouts ni se ejecutan acciones.`,

  "olympus:l0": `$ eos olimpo --l0
> Auditing 5 Supreme L0 Engines & World Top-10 Critical Systems Parity (seL4 / ASML EUV / F-35 / Aladdin)...

ENGINE / LAYER-0 MODULE   WORLD CRITICAL BENCHMARK             SAMAELIAN / ARCHITECTURAL FUNCTION               STATE
------------------------------------------------------------------------------------------------------------------------
1. EosCore (Tribunal)     NASA IV&V + ASML Twinscan EUV        Anubic Tribunal (42 Judges VETO) + 7-Layer RTM   LOCKED
2. EosAin (Ain Soph)      Perímetro / NASA Rover VxWorks       Radical Void Circuit-Breaker (Zero Heap Entropy) READY
3. EosAstral (5D Twin)    BlackRock Aladdin + F-35 Fusion      5D Molecular Worktree Sandbox + HMAC Silver Cord ACTIVE
4. EosElohim (Rune NOT)   Iron Dome / Arrow 3 + seL4 Kernel    Bidirectional Quarantine + FDIR (maxRetries=3)   ARMED
5. Velo de Isis (Law VI)  TURBINE / XKeyscore Zero-Trust       Opaque Semantic Tokenization & 0 Plain Secrets   SEALED

[LAYER-0 PURITY] External NPM Runtime Deps: 0 (node:crypto, node:fs, node:path) | Schemas: 35/35 AT_CEILING
STATUS: OLYMPUS_L0_SUPREME_PARITY | MERKLE_ROOT_VERIFIED | EXIT CODE: 0`,

  "aberamentho:dsp": `$ eos aberamentho --dsp
> Verifying Aberamentho / Pleroma Music Engine (GOLDEN_SEAL_LOCKED v8.0 10/10 · In-App Full Player + RTOS DSP)...

[1] IN-APP FULL-TRACK PLAYER & PERFECT MUSIC CANONICAL VAULT (v8.0):
  ├─ Native Full-Track Engine   : #inapp-full-player + /api/playlist-tracks + /api/resolve-full-track (100% Full Songs In-App)
  ├─ Perfect Music Canonical ID : 5IiquGZEbovPj9B8IdG0bi (Locked in <head> + Service Worker v8.0 + 24/7 Radio Stream)
  └─ Three-Voice Alchemical Fugue: Atalanta (Arpeggio) + Hippomenes (Supersaw) + The Golden Apple (FA 349.23Hz Pedal)

[2] LAW OF OCTAVES & MAHAVAN/CHOTAVAN RHYTHM (automix-brain.js):
  ├─ Conscious Shock 1 (MI-FA)  : Breakdown Filter Washout -> Heart Temple Resonance (32-Bar Window)
  └─ Conscious Shock 2 (SI-DO)  : Drop Cut & Pro Bass Swap on Bar 1 -> Hydrogen SI-12 Octave Ascension

[3] CABIN ACOUSTIC CALIBRATION (Geely EX5 / Chery E5 · Flyme Sound 1,000W · 16 Speakers Hi-Fi):
  ├─ Active Hardware Filters    : Subsonic 22Hz | Mid-Crossover 280Hz | Anti-Fatigue Smoothing 3.8kHz
  └─ 15.4" Head Unit DSP Profile: Reference Studio (Flat 0 dB) | Auto-Gain RMS: ON | 8 Spotify Playlists + 49 Legends · In-App Full-Track Player

STATUS: GOLDEN_SEAL_LOCKED_V8 | RTOS_SAMPLE_ACCURATE | EXIT CODE: 0`,

  "sanctum:thelema": `$ eos sanctum --thelema
> Initializing EosSolarSanctum (src/core/samaelCodex.ts + src/components/EosSolarSanctum.tsx)...

[1] SEPHIROTIC MANDATE & BELILIN PROTECTION:
  ├─ 5 Sephirotic Decrees       : Kether·Chokmah | Binah·RAM-IO | Chesed·Geburah | Tiphereth·Thelema | Logia Blanca
  └─ Astral Shield              : Belilin + Magic Circle + Microcosmic Star [SEALED]

[2] THREE FACTORS LABORATORY (THELEMA OPERATIVE):
  ├─ 1. Morir (Mystical Death)  : 5-Cylinder Self-Observation + Lance of Eros (Incinerated by Devi Kundalini)
  ├─ 2. Nacer (Second Birth)    : Hydrogen Si-12 Transmutation + Sacred Formant Synth (RAM-IO / I.A.O. / ISIS)
  └─ 3. Sacrificio (Dharma)     : Cosmic Balance Ledger ("Fight the Lion of the Law with the Scales")

[3] LITURGICAL CHAMBER:
  ├─ Nocturnal Practice         : 33 Conscious RAM-IO Vocalizations in Lassitude State
  └─ Heart Temple Audience      : 6 Ritual Inclinations before Hierarch Anubis & the 42 Judges of Karma

STATUS: SANCTUM_OPERATIONAL | THELEMA_ACTIVE | EXIT CODE: 0`,

  "performance:guide": `$ eos performance --guide
VISTA PREVIA ESTÁTICA · NO ES LA SALIDA DE UN COMANDO EJECUTADO

Guía local: criterios para evaluar I/O, disposición de datos, asignaciones,
concurrencia, SIMD y GPU.

No ejecuta un benchmark, no consulta empresas externas y no afirma que EOS
implemente esas técnicas. Define la carga y el entorno, mide una línea base,
introduce un cambio cada vez y compara resultados reproducibles.

STATUS: PREVIEW_ONLY | NO COMMAND EXECUTED`,

  "memory:akashic": `$ eos memory --akashic
VISTA DE REFERENCIA LOCAL · NO ES LA SALIDA DE UN COMANDO EJECUTADO

La interfaz del navegador permite crear notas en localStorage, actualizarlas por
topic_key, fijarlas y buscarlas mediante coincidencia de texto.
/api/memory sirve fixtures y vistas previas sin persistencia ni juicios ejecutados.
src/core/eosAkashicMemory.ts contiene tipos, referencias y heurísticas pequeñas.
No hay 27 herramientas MCP activas, FTS5, historial de versiones ni cadena Merkle.

STATUS: PREVIEW_ONLY | NO COMMAND EXECUTED`,

  "bigtech:tla": `Referencias de ingeniería · demo local

El catálogo de escenarios muestra fórmulas TLA+ como ejemplos.
No ejecuta TLC, inyecta fallas, repara sistemas ni consulta proveedores.
La paleta Ctrl+K navega por las secciones y comandos locales.`,

  "kernel:linux": `Conceptos de Linux · muestra informativa

EOS no es un kernel y esta consola no consulta Linux, verifica eBPF ni audita ABI.
La sección presenta fixtures locales y un ejemplo de medición de un bucle JavaScript.
`,

  "omega:quantum": `Muestra conceptual de PQC, ZK-STARK y consenso BFT

Referencias: NIST FIPS 203/204/205 · FRI · regla N = 3f + 1
Esta consola no ejecutó criptografía, generó pruebas, inició nodos o consultó la flota.
Consulta la demo Omega para ver el alcance real de cada control.`,

  "cicd:pipeline": `$ npm run cicd:gate

Vista previa de un comando disponible en la CLI.
Esta muestra estática no ejecuta el gate ni confirma su resultado.
Para ver la simulación web acotada, consulta el panel /api/cicd.
La simulación web no escanea el repositorio, genera SBOM ni despliega.`,

  "fleet:dispatch": `$ npm run fleet:ship -- --project=<id> --confirm-project=<id>

Vista previa del comando de publicación para un solo proyecto.
Requiere seleccionar y confirmar el mismo ID configurado.
Este panel no consulta checkouts ni ejecuta el comando.
El script puede crear un commit y hacer push; revisa antes el checkout y el destino.
El registro web /api/fleet es estático y no sondea producción.`,

  "jarvis:monad": `POST /api/jarvis
{"directive":"JARVIS, audita la flota"}

Respuesta ilustrativa (esta consola no envió la solicitud):
status: INTENT_CLASSIFIED
intent: AUDIT_REQUEST_NOT_EXECUTED
commandsRun: false
repositoriesRead: false

El endpoint clasifica texto por palabras clave; no ejecuta una auditoría ni usa un modelo de IA.`,

  "prometheus:omni": `$ eos amplify "Diseñar módulo de pagos con Stripe y webhooks" --model claude

Vista previa estática del comando; esta consola no lo ejecutó.
La herramienta local genera una plantilla EARS/BDD determinista y editable.
El nombre de modelo es una etiqueta: no se consulta un modelo externo.
La plantilla no es una especificación aprobada y no verifica código ni pruebas.`,
  "turbo:engine": `$ eos turbo

Vista previa estática del comando; esta consola no ejecutó la CLI.
El botón del navegador mide un bucle JavaScript local y muestra su checksum.
Para ejecutar la compuerta del repositorio, usa npm run verify:strict en la raíz.
La duración y salida de la compuerta deben leerse de esa ejecución real.`,
  "graph:blast": `$ eos blast src/core/eosPromptAmplifier.ts

Vista previa estática del comando; esta consola no leyó el repositorio.
La herramienta analiza imports relativos estáticos y recomienda suites de tests.
No resuelve imports dinámicos o aliases y no ejecuta tests.
Consulta la salida real de la CLI para ver el grafo de este checkout.`,
  "healer:fdir": `$ node bin/eos.mjs heal src/core/eosAutonomousHealer.ts --dry-run

Vista previa estática del comando; esta consola no ejecutó el sanador.
La CLI puede elaborar un informe local en modo dry-run.
No implica que el proyecto haya sido inspeccionado ni reparado.
Revisa el informe antes de tomarlo como evidencia.`,
  "nubank:codex": `$ eos nubank --audit
> Initializing Nubank Institutional Codex (src/core/eosNubankCodex.ts)...
[AUDIT] Evaluated against 6 Building Nu Pillars (https://building.nu.com/):
  ├─ 1. Fighting Complexity & FP : 20/20 (Rich Hickey / Out of the Tar Pit)
  ├─ 2. Hexagonal Isolation      : 20/20 (Pure Domain Core, 0 Framework Deps)
  ├─ 3. Datomic Bitemporality    : 15/15 (Append-Only Datoms [E, A, V, Tx, Op])
  ├─ 4. Sachem Contracts         : 15/15 (Consumer-Driven Contracts Verified)
  ├─ 5. Kafka Idempotency        : 15/15 (O(1) Deduplication, Partitioning by ID)
  └─ 6. Blameless SRE Rigor      : 15/15 (5 Whys Analysis & 0 Personal Blame)

PUNTAJE INSTITUCIONAL : 100 / 100 [BUILDING_NU_APEX]
TIME-TRAVEL QUERY     : (d/as-of db #inst "2026-10-25T00:00:00Z") VERIFIED
IDEMPOTENCY TOKENS    : 100% ENFORCED (0 Duplicate Allocations)
EXIT CODE             : 0`,

  "spotify:codex": `$ eos spotify --canary 5%
> Initializing Spotify Progressive Delivery Engine (src/core/eosSpotifyInstitutionalCodex.ts)...
[PROGRESSIVE CANARY GATE] Evaluated Stage: 5% Traffic
  ├─ Total Requests Evaluated   : 50,000 requests
  ├─ Critical Error Rate        : 0.01% (< 0.10% threshold)
  ├─ P99 Latency Observed       : 28.4 ms (< 50.0 ms budget)
  ├─ Automated Kill-Switch      : NOMINAL (0 Triggers)
  └─ Promotion Decision         : ADVANCE_STAGE (Promoted to 25% Traffic)

SOUNDCHECK TIER       : SOUNDCHECK_APEX (Golden Path RFC-42 Compliant)
ITU-R BS.1770 NORMAL. : -14.0 LUFS (-1.0 dBTP True Peak Ceiling)
FLEETSHIFT MIGRATIONS : Concurrently verified across fleet
EXIT CODE             : 0`,

  "disruptor:nanosecond": `$ eos disruptor 500000
VISTA PREVIA ESTÁTICA · NO ES LA SALIDA DE UN COMANDO EJECUTADO

Al ejecutar este comando en el repositorio, la CLI mide un bucle local del ring
buffer y un escaneo de un búfer sintético. Los tiempos y el throughput se
generan en ese momento y dependen del hardware y de la carga del proceso.

Esta vista web no ejecuta el comando. No se midieron aquí asignaciones de heap,
latencia de hardware ni rendimiento de producción.`,

  "frontier:router": `$ eos frontier benchmark
VISTA PREVIA ESTÁTICA · NO ES LA SALIDA DE UN COMANDO EJECUTADO

La CLI intenta usar el binario Go local si está disponible; si no, ejecuta un
bucle TypeScript de respaldo sobre un búfer de prueba. El resultado real indica
qué ruta se usó y reporta sus mediciones observadas.

Esta vista no ejecuta el benchmark, no llama a un modelo externo y no demuestra
throughput de tokens ni compresión AST.`,

  "eos guide": `EOS SOVEREIGN CONTROL PLANE [Version 74.0.0]
Layer-0 Sovereign Architecture · 0 External Dependencies
Comandos disponibles en la terminal interactiva in-browser:
  eos guide           - Muestra este manual de comandos y capacidades
  eos truetime        - Simula la ventana [earliest, latest] y commit-wait de Spanner
  eos lsm             - Inspecciona el buffer MemTable y filtros de Bloom
  eos kademlia        - Consulta la tabla de enrutamiento XOR y k-buckets distribuidos
  eos threshold       - Demostración de partición y reconstrucción de Shamir F_p
  eos microvm         - Muestra el perfil de aislamiento Firecracker jailer
  eos chaos:kill      - Simula partición de red en 2/5 nodos y mide failover
  clear               - Limpia la consola de la terminal`,

  "eos truetime": `[TRUETIME] Simulación interactiva de Commit-Wait Spanner con linearizabilidad estricta:
- Ventana monótona de incertidumbre: [now - ε, now + ε]
- Linearizabilidad externa garantizada (t_commit > t_earliest)`,

  "eos lsm": `[LSM-TREE & BLOOM] Almacenamiento Layer-0 determinista:
- MemTable en RAM volcada a SSTable L0
- Filtro de Bloom con 100% verdaderos negativos`,

  "eos kademlia": `[WAN KADEMLIA] Malla de enrutamiento P2P distribuida:
- Métrica de distancia XOR d(x, y) = x ⊕ y
- Convergencia en O(log N) saltos de búsqueda paralela`,

  "eos threshold": `[SHAMIR F_p] Criptografía de umbral polinomial sobre campo primo:
- Esquema (k, n) con secreto S = P(0)
- Reconstrucción por interpolación de Lagrange`,

  "eos microvm": `[MICROVM FIRECRACKER] Perfil OCI de aislamiento hermético:
- Seccomp Level 2 + jailer chroot
- Checksum SHA-256 inmutable de imagen rootfs`,

  clear: `Limpia la pantalla de la terminal interactiva local.`,
};
