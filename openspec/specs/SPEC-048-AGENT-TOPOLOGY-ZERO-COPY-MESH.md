# SPEC-048: AGENT TOPOLOGY COMPILER & ZERO-COPY COMMUNICATION MESH (v54.0.0)

* **Status**: `SPECIFICATION_APPROVED`
* **Change Reference**: `CHANGE-041`
* **Architecture Plan**: `PLAN-041` (`ADR-054`)
* **Formal Model**: `docs/formal/AgentTopologyMesh.tla`

---

## 1. Formal Functional Requirements (IEEE 830 / EARS)

* **FR-153 (Acyclic Agent Topology DAG Compilation & Symbol Sandboxing)**:
  `CUANDO se registre un grafo de tareas para ejecución paralela de subagentes, EL SISTEMA compilará la topología asegurando que sea un Grafo Acíclico Dirigido (DAG) sin ciclos de dependencia, asignará propiedad exclusiva de archivos a cada subagente y sellará un plan de ejecución determinista con digest SHA-256.`

* **FR-154 (Zero-Copy Compact Event Ring Buffer Mesh)**:
  `CUANDO un subagente emita una actualización de progreso o mutación de estado, EL SISTEMA transmitirá la notificación a través de una malla de búfer circular en memoria (LMAX Disruptor pattern) conteniendo únicamente el delta quirúrgico de AST, el identificador de nodo y el recibo de hash, prohibiendo la retransmisión de archivos completos redundantes.`

* **FR-155 (Deadlock-Free Topological Execution Scheduling)**:
  `MIENTRAS se orquesten múltiples subagentes concurrentes, EL SISTEMA liberará la ejecución de cada agente únicamente cuando todos sus predecesores topológicos hayan alcanzado el estado VERIFIED, garantizando inmunidad matemática contra interbloqueos (deadlock-freedom).`

* **FR-156 (Token Coordination Overhead Reduction Threshold)**:
  `EL SISTEMA medirá el costo de tokens de coordinación entre agentes comparando el tamaño de los eventos compactos contra el payload de archivos completos, garantizando una reducción de sobrecosto superior al 70% en comparación con la transmisión de contexto completo.`

* **FR-157 (Durable Ring Buffer Attestation & SQLite WAL Recording)**:
  `CUANDO se complete un ciclo de eventos en la malla de topología, EL SISTEMA consolidará el recibo Merkle de la secuencia de eventos y lo persistirá de forma atómica en EosDurableSqliteLedger.`

* **FR-158 (Unified Core MCP Tool & CLI Surface)**:
  `EL SISTEMA expondrá el compilador de topología y la malla de eventos en una única herramienta MCP soberana en el perfil core (eos_agent_topology_mesh con anotaciones MCP 2025-03-26) y en la CLI universal (eos topology [compile|publish|verify]).`

---

## 2. Formal Acceptance Criteria (Gherkin BDD)

```gherkin
ESCENARIO: BDD-149 — Compilación de DAG de subagentes y detección estricta de ciclos
  DADO un grafo de tareas con 5 subagentes y dependencias secuenciales válidas vs un grafo con ciclo circular (A -> B -> C -> A)
  CUANDO EosAgentTopologyMesh.compileTopology analiza ambos grafos
  ENTONCES compila con éxito el grafo válido asignando sandboxes disyuntos
  Y rechaza inmediatamente el grafo cíclico con error CYCLIC_DEPENDENCY_DETECTED

ESCENARIO: BDD-150 — Publicación y consumo en anillo circular zero-copy en memoria
  DADO un anillo de eventos configurado con capacidad potencia de 2 (ej. 64 ranuras)
  CUANDO múltiples subagentes publican eventos de mutación AST compactos
  ENTONCES los eventos se indexan mediante máscara binaria bit a bit sin sobregiro de memoria
  Y los consumidores leen la secuencia exacta sin pérdida de mensajes ni duplicaciones

ESCENARIO: BDD-151 — Planificación topológica libre de interbloqueos (Deadlock-Freedom)
  DADO un DAG compilado de 4 agentes donde el agente D depende de B y C, y ambos dependen de A
  CUANDO se simula la ejecución asíncrona de los agentes
  ENTONCES D solo es habilitado cuando B y C han sellado su estado VERIFIED
  Y el orden topológico garantiza cero estados de bloqueo mutuo

ESCENARIO: BDD-152 — Medición empírica de reducción de tokens de coordinación (>70%)
  DADO un conjunto de 20 mensajes entre agentes transmitidos vía eventos compactos de malla vs retransmisión de archivos completos
  CUANDO EosAgentTopologyMesh.calculateTokenEfficiency calcula el ratio de compresión de coordinación
  ENTONCES la eficiencia de reducción de bytes/tokens es >= 70%

ESCENARIO: BDD-153 — Persistencia de recibo de malla en EosDurableSqliteLedger
  DADO un lote de eventos procesados en la malla de topología
  CUANDO se sella la secuencia de eventos
  ENTONCES genera un recibo SHA-256 y apéndice una entrada en EosDurableSqliteLedger verificable monotónicamente

ESCENARIO: BDD-154 — Despacho unificado MCP eos_agent_topology_mesh en perfil core y CLI eos topology
  DADO el servidor EosMcpServer en perfil core
  CUANDO Google Antigravity invoca tools/list y tools/call sobre eos_agent_topology_mesh
  ENTONCES la herramienta se encuentra en el catálogo core y ejecuta exitosamente la compilación y verificación
```
