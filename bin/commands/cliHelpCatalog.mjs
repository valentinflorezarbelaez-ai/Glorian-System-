/**
 * Synchronized CLI Help Catalog for `eos help` and `eos help --all` (v75.0.0, SPEC-001..SPEC-250).
 * Audited for 100% handler parity by EosCliCatalogAndHygieneGovernorCore (SPEC-250).
 */

export const QUICK_HELP_TEXT = `
======================================================================
 EOS SYSTEM — MANUAL RÁPIDO Y ERGONOMÍA DE DESARROLLO (v75.0.0)
======================================================================

🎯 DESARROLLO RÁPIDO & PRUEBAS (DAILY WORKFLOW):
  eos pts                    Corre únicamente las pruebas impactadas por el diff (~350ms)
  eos search <termino>       Búsqueda instantánea FTS5 en specs, plans y ADRs (~100ms)
  eos test                   Ejecuta todas las suites automatizadas (node:test)
  eos turbo                  Verificación en memoria con telemetría en microsegundos (<350ms)
  eos diff:live [--json]     Inspecciona el git diff vivo (secretos, SQL DDL, Regla Beyoncé)
  eos hygiene:audit [--json] Audita paridad 100% del catálogo CLI y margen <=800 líneas (SPEC-250)
  eos ship [--ticket=ID]     Pipeline maestro pre-PR (Diff, Contract, SARIF, Fleet, SLSA, SWE, EDA, Apollo, Aladdin, Hygiene)

🛡️ SEGURIDAD, CADENA DE SUMINISTRO & FORMAL METHODS:
  eos sbom                   Genera inventario CycloneDX v1.5 con atestación SHA-256
  eos attest:ship [--write]  Statement v1 In-Toto + Provenance SLSA v1.0 firmado Ed25519 (SPEC-245)
  eos eda:prove [--json]     Equivalencia lógica LEC, timing STA y no-interferencia seL4 (SPEC-247)
  eos apollo:bundle [--json] Compila y verifica offline paquete Air-Gapped con DSSE (SPEC-248)
  eos aladdin:stress [--json] Simulación Monte Carlo VaR 95%/99%, CVaR 99% y contagio (SPEC-249)
  eos bench:swe [--json]     Corpus dorado SWE-Bench adversarial con Recall, F1 y FPR (SPEC-246)
  eos staff:judge [--json]   Juicio dual adversarial Staff Engineer bloqueante pre-merge (SPEC-237)
  eos verify                 Ejecuta las 7 aduanas de seguridad SecDevOps (fail-closed)

⚡ RESILIENCIA BIG TECH & AUTO-REPARACIÓN:
  eos jarvis:demo [--json]   Demostración completa SDLC Modo Jarvis (ADN Spotify + Soundcheck 100)
  eos fleet:ship [--probe]   Audita los 9 repositorios de la flota bajo Ley IV de EOS (SPEC-243)
  eos sapfix                 Bucle FDIR de auto-reparación AST y generación de PR (Meta SapFix)
  eos swarm                  Consenso BFT (3f+1) con veto de seguridad y slashing (DeepMind)
  eos dashboard [start]      Inicia el panel visual de telemetría en tiempo real (localhost:4321)

📖 AYUDA Y GLOSARIO:
  eos guide                  Muestra el glosario de arquitectura y equivalencias de la industria
  eos help --all             Muestra la lista exhaustiva de todos los subcomandos registrados
`;

export const EXHAUSTIVE_HELP_TEXT = `
Uso Universal Exhaustivo (v75.0.0 — SPEC-001..SPEC-250):
  eos turbo                      Verificación ultrarrápida en memoria con telemetría en microsegundos
  eos verify                     Ejecuta las 7 aduanas de seguridad SecDevOps (fail-closed)
  eos audit                      Audita en paralelo todos los repositorios de la flota
  eos test                       Ejecuta las suites unitarias y de caos (node:test)
  eos mcp                        Inicia el servidor Model Context Protocol sobre stdio
  eos jarvis [directiva]         Ejecuta una directiva cognitiva JARVIS en terminal
  eos health                     Muestra la telemetría en vivo del sistema (CNCF / SRE)
  eos optimize <archivo>         Comprime el archivo extrayendo su esquema estructural
  eos amplify <prompt>           Amplifica un prompt informal a especificación EARS y BDD
  eos guard [directorio]         Audita pureza Hexagonal, capas L0 y detecta ciclos circulares
  eos judge <escenario>          Aplica el tribunal de decisión Bayesiano con los 7 Mandamientos
  eos blast <archivo>            Calcula el radio de impacto transitivo y pruebas predictivas (PTS)
  eos graph                      Muestra el grafo semántico, topología de módulos y código huérfano
  eos heal [archivo]             Ejecuta el bucle de auto-sanación FDIR (Meta SapFix) con recibo sellado
  eos worktree [list|add|rm]     Gestiona Git Worktrees aislados para agentes estilo Xirp
  eos sandbox doctor             Verifica que Docker local y la imagen fijada estén disponibles
  eos eval <archivo>             Ejecuta la evaluación cognitiva de 5 dimensiones (Google/Anthropic)
  eos spec [check|list]          Audita el sistema Living OpenSpec y previene deriva de Vibe Coding
  eos titan [xirp|spacex|..]     Ejecuta los benchmarks de los Titanes (Spotify, SpaceX, NVIDIA, Google)
  eos reconcile                  Reconcilia el estado declarativo estilo Google Borg sin deriva
  eos spotify                    Herramientas universales de ingeniería y cultura Spotify
  eos go [benchmark|bandit]      Acelerador nativo en Go (goroutines, streaming, BaRT)
  eos honk [directiva]           Bucle autónomo de codificación y self-healing estilo Spotify Honk
  eos flow [accion]              Flujo de proyecto con worktree, validación aislada y aprobación hash
  eos xirp [sync|inspect]        Motor de contexto Xirp para eliminar alucinaciones vía Backstage RFC-42
  eos fleetshift [accion]        Migración y refactorización masiva de flotas de repositorios
  eos dsp [benchmark]            Benchmark de filtros Biquad y Limitador ITU-R BS.1770 (-1.0 dBTP)
  eos fleet:elevate [--dry]      Auditoría y elevación de toda la flota al Golden Path Backstage
  eos rpc [service]              Despacho RPC y bus pub/sub estilo Apollo/Hermes con Circuit Breakers
  eos mix [keyA] [keyB]          Planificación y crossfader de mezcla DJ armónica sin choque de bajos
  eos features [usuario]         Centroide de gustos acústicos 8D con decaimiento EWMA
  eos fingerprint [ruta]         Extrae la huella de lenguaje, stack, herramientas y escala
  eos adapt [ruta] [--scaffold]  Diagnostica madurez (0-100) y eleva cualquier repo al Golden Path
  eos edge                       Arbitro Anycast global, cálculo Haversine y Hedged Requests
  eos datalog [modulo]           Análisis deductivo de radio de impacto en punto fijo (Mangle)
  eos mutate [archivo]           Sabotaje de código automatizado en AST (Testing the Tests)
  eos sim [semilla]              Hipervisor de simulación determinista de viaje en el tiempo
  eos schedule                   Planificador cooperativo a 120Hz (<8.33ms) y aritmética branchless
  eos pts                        Ejecuta selección predictiva inteligente de pruebas (PTS)
  eos sbom                       Genera inventario CycloneDX v1.5 con atestación SHA-256
  eos slsa [commit]              Emite declaración de procedencia in-toto SLSA Nivel 4
  eos cas                        Estadísticas de Content-Addressable Storage (Google Bazel)
  eos smt                        Demostrador matemático formal de seguridad ABAC (AWS DPLL/SAT)
  eos chaos:live [url]           Inyección de caos en producción con circuit breaker (Netflix)
  eos swarm                      Consenso BFT (3f+1) con veto de seguridad y slashing (DeepMind)
  eos search <query>             Búsqueda de texto completo SQLite FTS5 en specs, plans y ADRs
  eos guide                      Muestra el glosario de arquitectura y equivalencias de la industria
  eos doctor [ruta] [--write-ci] Diagnostica 5 pilares SDLC Soundcheck (0-100) y sintetiza CI
  eos fix [ruta] [--dry-run]     Auto-remedia cualquier repo (gitignore, tests, CI, docs)
  eos fuzz [--iterations=N]      Fuzzing dinámico guiado por cobertura
  eos arena [accion] [--rounds=N] Torneo adversario multi-agente bajo consenso BFT (Red/Blue/White)
  eos zk:prove [--spec=ID]       Atestación de estado Merkle de Conocimiento Cero (ZKP)
  eos compile [plataforma]       Compila ejecutable nativo hermético SEA (Node 24)
  eos pq:kem [--hybrid]          Encapsulación de claves post-cuántica (NIST FIPS 203 ML-KEM + X25519)
  eos pq:sign [msg] [--hybrid]   Firmas digitales de retículos post-cuánticos (NIST FIPS 204 ML-DSA)
  eos synthesize [codigo]        Sintetizador genético autónomo de código AST (Meta APR / SPEC-200)
  eos vector:index <id> <code>   Indexa código o texto en grafo vectorial HNSW Layer-0 (SPEC-201)
  eos vector:search <query>      Búsqueda semántica ANN con grafo HNSW Layer-0 (SPEC-201)
  eos tkg:assert <s> <p> <o>     Aserción de hechos bi-temporales con recibos inmutables (SPEC-202)
  eos tkg:query <pred>           Inferencia Datalog sobre grafo de conocimiento temporal (SPEC-202)
  eos wasm:decompile [target]    Descompila bytecode WebAssembly a formato WAT canónico (SPEC-203)
  eos wasm:prove [target]        Demostrador formal de seguridad de pila y CFI en WASM (SPEC-203)
  eos mcts:search / mcts:play    Planificador Monte Carlo Tree Search con política-valor (SPEC-204)
  eos tla:check / tla:synthesize Verificador simbólico TLA+ y síntesis formal de modelos (SPEC-205)
  eos raft:cluster / raft:status Simulación de consenso Raft distribuido con quórum WAL (SPEC-206)
  eos compress:ans / decompress:ans Compresor/descompresor de entropía rANS Layer-0 (SPEC-207)
  eos autodiff:grad / autodiff:train Diferenciación automática reversa y optimización SGD (SPEC-208)
  eos anomaly:detect / anomaly:forest Detector no supervisado Isolation Forest y streaming (SPEC-209)
  eos pbft:cluster / pbft:propose Consenso bizantino PBFT 3-fases supermayoritario 2f+1 (SPEC-210)
  eos homomorphic:keygen / homomorphic:encrypt / homomorphic:add Cifrado homomórfico BFV en anillo R_q (SPEC-211)
  eos mpc:split / mpc:combine    División secreta Shamir (k, N) e interpolación Lagrange (SPEC-212)
  eos vdf:compute / vdf:verify   Evaluación Wesolowski VDF y verificación O(1) en <5ms (SPEC-213)
  eos r1cs:synthesize / r1cs:prove / r1cs:verify Circuito R1CS y prueba QAP sub-milisegundo (SPEC-214)
  eos crdt:mutate / crdt:merge / crdt:delta Réplicas CRDT LWW/ORSet/RGA convergentes SEC (SPEC-215)
  eos mmr:append / mmr:prove / mmr:verify Merkle Mountain Range con inclusión O(log N) (SPEC-216)
  eos vrf:eval / vrf:verify / vrf:elect ECVRF RFC 9381 y elección inmanipulable de líder (SPEC-217)
  eos smt:set / smt:prove / smt:verify Sparse Merkle Tree con pruebas de exclusión (SPEC-218)
  eos frost:keygen / frost:sign / frost:verify Firmas de umbral FROST RFC 9591 en 2 rondas (SPEC-219)
  eos kzg:commit / kzg:open / kzg:verify / kzg:batch Compromisos polinomiales KZG (SPEC-220)
  eos ml-kem:keygen / ml-kem:encaps / ml-kem:decaps / ml-kem:benchmark ML-KEM-768 NIST FIPS 203 post-cuántico (SPEC-221)
  eos bp:commit / bp:prove / bp:verify / bp:benchmark Bulletproofs NIZK Pedersen O(log m) (SPEC-222)
  eos hotstuff:propose / hotstuff:vote / hotstuff:status Consenso pipelined HotStuff BFT (SPEC-223)
  eos tensor:quantize / tensor:matmul / tensor:embed / tensor:benchmark Tensores Q4_0/Q8_0/Q4_K y embeddings (SPEC-224)
  eos fleet:sync-all / fleet:audit-all / fleet:heal-all Sincronización y Soundcheck federado (SPEC-225)
  eos trace:demo / trace:export  Trazado distribuido W3C y exportación JSON OTLP (SPEC-226)
  eos ml-dsa:keygen / ml-dsa:sign / ml-dsa:verify Firmas de retículos NIST FIPS 204 ML-DSA-65 (SPEC-227)
  eos congestion:demo / congestion:admit / congestion:stats Limitador adaptativo AIMD P99 (SPEC-228)
  eos trie:demo / trie:prove / trie:verify Merkle Patricia Trie RLP y pruebas de estado (SPEC-229)
  eos timelock:demo / timelock:create / timelock:solve Rompecabezas temporal RSW96 y Sloth VDF (SPEC-230)
  eos cuckoo:demo / cuckoo:insert / cuckoo:query Filtro probabilístico Cuckoo con kicks (SPEC-231)
  eos hll:demo / hll:add / hll:estimate Estimación de cardinalidad HyperLogLog++ y fusión (SPEC-232)
  eos vss:demo / vss:split / vss:verify Verifiable Secret Sharing Feldman/Pedersen demo (SPEC-233)
  eos jarvis:demo / jarvis:dna / jarvis:sdlc / jarvis:rules Modo Jarvis ADN Spotify y Soundcheck (SPEC-234)
  eos polyglot:detect / polyglot:normalize Matriz Golden Path Java/Go/Python/Rust/TS (SPEC-235)
  eos bridge:parse / bridge:diff / bridge:canary Puente Issue->PR, Beyoncé y Canary SLA (SPEC-236)
  eos staff:judge / staff:demo   Juicio dual adversarial Staff Engineer e integración E2E (SPEC-237)
  eos diff:live [--base=HEAD]    Inspección del git diff vivo local (secretos, SQL, Beyoncé) (SPEC-238)
  eos repomap:build [--budget=N] Mapa de símbolos comprimido en presupuesto exacto de tokens (SPEC-239)
  eos pbt:check [--seed=1337]    Suite de Property-Based Testing con shrinking automático (SPEC-240)
  eos contract:diff [--id=ID]    Análisis SemVer de cambios rupturistas en contratos TS (SPEC-241)
  eos sarif:export [--write]     Exportación OASIS SARIF 2.1.0 con hunks unified diff (SPEC-242)
  eos fleet:ship [--probe]       Auditoría de los 9 proyectos de la flota bajo Ley IV (SPEC-243)
  eos contract:live [--base=HEAD] Auditoría SemVer multi-archivo AST en working tree real (SPEC-244)
  eos attest:ship [--write]      Statement v1 In-Toto + Provenance SLSA v1.0 Ed25519 DSSE (SPEC-245)
  eos bench:swe [--json]         Corpus dorado SWE-Bench con TP/TN/FP/FN, Recall, F1 y FPR (SPEC-246)
  eos eda:prove [--budget=500]   Equivalencia lógica LEC, slack STA y no-interferencia seL4 (SPEC-247)
  eos apollo:bundle [--write]    Paquete soberano Air-Gapped con Merkle + Ed25519 DSSE (SPEC-248)
  eos aladdin:stress [--trials=N] Simulación Monte Carlo VaR 95%/99%, CVaR 99% y contagio (SPEC-249)
  eos hygiene:audit [--json]     Auditoría Layer-0 de paridad CLI y margen <=800 líneas (SPEC-250)
  eos ship [--ticket=ID]         Comando maestro pre-PR integrando SPEC-236..SPEC-250
  eos dashboard [start] / ledger / metrics / guard / flow / release:seal / verify:action / slsa:attest

📦 ÍNDICE DE ALIAS Y SUBCOMANDOS ESPECIALIZADOS (100% REGISTRADOS):
  fast, wal, bench:nano, daemon, transmute, optimize:v8, fuzz:target, swarm:arena, zk:attest, sea:compile,
  pq:encap, ast:synthesize, hnsw:search, graph:datalog, wasm:disasm, titans, anycast, octave, warp, apex,
  disruptor, ring, nubank, nu, frontier, router, squeezer, topology, wasm, soul, architect, introspect,
  evolution, shield, defense, mangle, sabotage, simulate:models, formal, tla, jepsen, chaos:net, vault,
  memory, temple, sol, mcts:plan, tla:model-check, raft:consensus, ans:compress, ans:decompress, pbft:status,
  pbft:slash, homomorphic:decrypt, mpc:add, mpc:multiply, vdf:beacon, unitotal:audit, fuzz:hypervisor,
  replay:ledger, sync-stack, witness:interrogate, hotpatch, project, cheat-sheet, slo, perf, drift, flags,
  loadtest, canary:stat, ledger:replay, ledger:timetravel, raft:elect, sandbox:profile, smt:tree, zk,
  truetime:spanner, spanner:time, tss, enterprise:audit, enterprise, red:metrics, prom:red, action:verify,
  provenance:attest, project:doctor, remediate, doctor:fix, heal:repo, project:fix, diary, budget, finops,
  mind, mountains, autotune, nsa:encrypt, nsa:audit, nsa:zeroize, consensus, truetime:bounded, concurrency,
  hashring, antientropy, ratelimit, hft, zerocopy, chaos:run, chaos, vector, risk, aladdin, chain,
  product:create, product, product:deliver, factory:e2e, product:validate, loop, sovereign, invariant,
  contract, heal:surgical, tlc, pr:check, sandbox:vm, fleet:verify, ontology, quantum:seal, refactor, dst,
  synapse, fleet:soundcheck, mcts:tune, canary:rollout, antigravity, gentleman, gentle-ai, ledger, ast,
  nocturnal, evolve, mesh, agent-topology, sandbox, timetravel, truetime, lsm, threshold, microvm, simd, enforce,
  sparse-tree, enterprise:health, otel:metrics, mmr, raft, fuzzer, seccomp, zk:verify, aca, intercept
`;
