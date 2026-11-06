# SPEC-047: DEEPMIND SOVEREIGN EVOLUTIONARY CODE SEARCH & VERIFIER-GUIDED ORCHESTRATION ENGINE (v53.0.0)

* **Status**: `SPECIFICATION_APPROVED`
* **Change Reference**: `CHANGE-040`
* **Architecture Plan**: `PLAN-040` (`ADR-053`)
* **Formal Model**: `docs/formal/EvolutionaryHarness.tla`

---

## 1. Formal Functional Requirements (IEEE 830 / EARS)

* **FR-147 (Multivariate Continuous Fitness Evaluation & AlphaEvolve Loop)**:
  `CUANDO se invoque la evolución o búsqueda estocástica sobre un módulo objetivo, EL SISTEMA evaluará cada candidato propuesto mediante una función de aptitud continua multivariada que cuantifique latencia de ejecución (ns), delta de memoria heap (bytes), pureza AST (0..100), complejidad ciclomática relativa y cumplimiento de contratos EARS/BDD, registrando en SQLite WAL el linaje genético de mutaciones (parentSha256, mutantSha256, fitnessVector).`

* **FR-148 (AlphaCode 2 Semantic Clustering & AST Deduplication)**:
  `CUANDO múltiples variantes o subagentes generen mutaciones candidatas en paralelo, EL SISTEMA agrupará los candidatos por firma estructural de AST y vector de salida sobre entradas sintéticas, descartando variantes redundantes o subóptimas y reteniendo únicamente los representantes del frente de Pareto.`

* **FR-149 (AlphaCodium Adversarial Double-Blind Flow Engineering)**:
  `MIENTRAS se ejecute la fase de pruebas y construcción bajo la Ley II, EL SISTEMA impondrá una separación estricta de doble ciego entre el rol Inquisidor (confinado a generar tests maliciosos y casos borde a partir exclusivamente de OpenSpec y modelos TLA+ sin acceso a código fuente) y el rol Constructor (restringido a escribir código para satisfacer los tests sin permisos de modificación sobre la suite de pruebas).`

* **FR-150 (Flash-to-Pro Model Cascading & Token Circuit Breaker)**:
  `SI una búsqueda evolutiva o ciclo de corrección agéntico no produce una mejora de aptitud superior al umbral mínimo tras 2 generaciones consecutivas, ENTONCES EL SISTEMA disparará un circuit breaker de contención de tokens deteniendo el bucle rápido y emitiendo un diagnóstico estructurado AST para escalamiento quirúrgico a modelos de razonamiento profundo.`

* **FR-151 (Cryptographic Interface Lock & Symbol Sandboxing)**:
  `CUANDO se orqueste la ejecución paralela de subagentes sobre un DAG de tareas, EL SISTEMA compilará y sellará con pureSha256 las firmas de interfaz compartidas (.d.ts o tipos de frontera), otorgando a cada subagente permisos de escritura exclusivos sobre un único módulo hoja y acceso inmutable de solo lectura sobre las interfaces selladas.`

* **FR-152 (Unified Core MCP Tool & CLI Surface)**:
  `EL SISTEMA expondrá la búsqueda evolutiva y gobernanza estocástica en una única herramienta MCP soberana en el perfil core (eos_evolve_module con anotaciones MCP 2025-03-26) y en la CLI universal (eos evolve [run|cluster|verify|lock]).`

---

## 2. Formal Acceptance Criteria (Gherkin BDD)

```gherkin
ESCENARIO: BDD-143 — Evaluación de aptitud multivariada continua estilo AlphaEvolve y preservación de linaje
  DADO un módulo de código fuente y múltiples candidatos de mutación (diffs sintéticos)
  CUANDO EosEvolutionaryHarness.evaluateCandidate evalúa cada variante
  ENTONCES calcula un vector numérico continuo [latencyNs, heapDeltaBytes, astPurity, cyclomaticComplexity, contractScore]
  Y registra el linaje de evolución (parentSha256 -> mutantSha256 -> fitness) en EosDurableSqliteLedger

ESCENARIO: BDD-144 — Clustering semántico y deduplicación de variantes estilo AlphaCode 2
  DADO un conjunto de 6 variantes candidatas generadas por agentes donde 4 producen AST idéntico o comportamiento duplicado
  CUANDO EosEvolutionaryHarness.clusterCandidates agrupa la población
  ENTONCES descarta las variantes duplicadas/inferiores y selecciona únicamente los representantes óptimos no dominados
  Y emite un reporte inmutable con digest SHA-256

ESCENARIO: BDD-145 — Aduana adversaria de doble ciego estilo AlphaCodium (Inquisidor vs Constructor)
  DADO un escenario de implementación bajo la Ley II y Ley IV
  CUANDO se valida el aislamiento de permisos entre Inquisidor (Red Team) y Constructor (Blue Team)
  ENTONCES el Inquisidor tiene prohibido escribir en directorios src/ y el Constructor tiene prohibido modificar archivos de test
  Y cualquier intento de violación de frontera por cualquiera de los dos roles es rechazado fail-closed

ESCENARIO: BDD-146 — Ruteo en cascada Flash-to-Pro y circuit breaker de tokens
  DADO un ciclo de optimización en Nivel 1 (exploración rápida) que falla en mejorar la función de aptitud durante 2 generaciones consecutivas
  CUANDO el arnés evalúa el progreso estancado
  ENTONCES activa inmediatamente el token circuit breaker deteniendo el bucle antes de agotar cuotas
  Y sintetiza un AST diagnostic payload con código ESCALATE_TO_DEEP_REASONING

ESCENARIO: BDD-147 — Bloqueo criptográfico de interfaces (Interface Lock) para paralelismo masivo
  DADO un conjunto de definiciones de interfaz TypeScript de frontera para un DAG de tareas
  CUANDO se invoca EosEvolutionaryHarness.lockInterfaceContract
  ENTONCES genera el digest SHA-256 inmutable de las firmas exportadas
  Y SI un subagente altera una firma compartida durante su ejecución en sandbox, ENTONCES el sistema invalida la mutación antes de la integración

ESCENARIO: BDD-148 — Despacho unificado MCP eos_evolve_module en perfil core y CLI eos evolve
  DADO el servidor EosMcpServer en perfil core
  CUANDO Google Antigravity consulta tools/list e invoca tools/call sobre eos_evolve_module
  ENTONCES la herramienta se encuentra registrada con ToolAnnotations completas y despacha exitosamente el ciclo evolutivo
```
