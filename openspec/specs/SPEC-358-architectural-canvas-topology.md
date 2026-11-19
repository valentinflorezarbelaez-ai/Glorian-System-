# SPEC-358: Live Self-Introspecting Architectural Canvas & Bi-Directional Interactive Topology Engine

**Specification ID**: `SPEC-358`  
**Change ID**: `CHANGE-220`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Lifecycle Tier**: `production`  
**Classification**: `MISSION_CRITICAL_CORE_ENGINE`  
**Standard**: `IEEE 830 / ISO 29148 / EARS / BDD / Leslie Lamport TLA+`  
**Status**: `SPECIFICATION_APPROVED`

---

## 1. Context & Architectural Vision

`SPEC-358` codifies the **Autonomous Live Architectural Canvas & Bi-Directional Interactive Topology Engine** for Glorian System. Grounded in Bret Victor's philosophy of _Seeable Systems_ and Álvaro Moya's _LIDR Agentic Engineering Starter_ principles (eliminating architecture drift and 0 PR rework via executable live visual context), this engine provides deterministic, pure Layer-0 topological harvesting, hierarchical graph layout, interactive mutation with cycle-prevention, blast-radius calculation, and multi-format vector rendering (SVG/JSON).

---

## 2. Functional Requirements (EARS Standard)

- **FR-358-01 (Ubiquitous Harvesting)**:
  `EL SISTEMA cosechará introspectivamente la topología arquitectónica de módulos, especificaciones OpenSpec y modelos TLA+ en un grafo acíclico dirigido (DAG) sin dependencias externas de runtime.`

- **FR-358-02 (Event-Driven Layout Calculation)**:
  `CUANDO se invoque el motor de layout topológico, EL SISTEMA calculará coordenadas (x, y) de capas jerárquicas y ordenamiento baricéntrico para minimizar cruces de aristas en tiempo determinista sub-10ms.`

- **FR-358-03 (State-Driven Bi-Directional Mutation)**:
  `MIENTRAS se modifiquen nodos o aristas en el canvas, EL SISTEMA validará que no se introduzcan ciclos ilegales y mantendrá invariantes de aislamiento hexagonal de Capa 0.`

- **FR-358-04 (Error-Driven Invariant Guarding)**:
  `SI una mutación de topología introduce una dependencia circular o viola una regla de contención de capa, ENTONCES EL SISTEMA rechazará la mutación fail-closed y emitirá un diagnóstico estructurado.`

- **FR-358-05 (Event-Driven Causal Blast Radius)**:
  `CUANDO se seleccione un nodo componente en el canvas, EL SISTEMA calculará transitivamente el blast radius causal exacto de todos los módulos, especificaciones y contratos aguas arriba y aguas abajo.`

- **FR-358-06 (Ubiquitous Pure SVG Vector Rendering)**:
  `EL SISTEMA serializará el grafo topológico en una representación SVG pura y vectorial con tokens de diseño Tier S-0, etiquetas semánticas y dimensiones reactivas sin bibliotecas gráficas pesadas.`

- **FR-358-07 (Event-Driven Formal Verification & Audit Receipt)**:
  `CUANDO se ejecute la auditoría formal, EL SISTEMA validará la conformidad del grafo, verificará la correspondencia con el Modelo 101 de TLA+ y emitirá el recibo criptográfico SHA-256 en ARCHITECTURAL_CANVAS_RECEIPT.json.`

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-1927 Introspección y Cosecha Automática del Grafo Arquitectónico
  DADO el plano de control de Glorian System con módulos TypeScript, OpenSpecs y modelos TLA+
  CUANDO EosTopologyHarvester analiza los metadatos y dependencias del sistema
  ENTONCES genera un grafo CanvasTopology conteniendo nodos tipados (CORE_MODULE, OPENSPEC, TLA_MODEL, FLEET_REPO)
  Y todos los nodos poseen identificadores únicos y atributos estructurales válidos.

ESCENARIO: BDD-1928 Algoritmo de Layout Jerárquico Sugiyama en Capa 0
  DADO un grafo topológico con múltiples niveles de abstracción
  CUANDO EosCanvasLayoutEngine asigna capas jerárquicas y ordena nodos por baricentro
  ENTONCES cada nodo recibe coordenadas deterministas (x, y) y dimensiones de bounding box
  Y la cantidad de cruces de aristas se minimiza cumpliendo holgura geométrica.

ESCENARIO: BDD-1929 Detección de Ciclos y Rechazo Fail-Closed de Mutaciones Inválidas
  DADO un grafo topológico válido y acíclico
  CUANDO un usuario o agente intenta agregar una arista que crea una dependencia circular
  ENTONCES EosInteractiveTopologyManager detecta el ciclo inmediatamente mediante búsqueda en profundidad (DFS)
  Y la mutación es rechazada con un error estructurado CYCLE_DETECTED sin alterar el estado previo.

ESCENARIO: BDD-1930 Cálculo Determinista del Radio de Impacto Causal (Blast Radius)
  DADO un grafo arquitectónico con dependencias transitivas entre módulos y especificaciones
  CUANDO se solicita el blast radius para un nodo crítico de infraestructura o dominio
  ENTONCES el motor identifica con precisión el conjunto cerrado de componentes afectados directamente e indirectamente
  Y categoriza el nivel de riesgo (LOW, MEDIUM, HIGH, CRITICAL).

ESCENARIO: BDD-1931 Renderizado Vectorial SVG Puro con Tokens Tier S-0
  DADO un grafo topológico procesado y posicionado por el motor de layout
  CUANDO EosCanvasSvgRenderer genera la representación gráfica del canvas
  ENTONCES produce un documento SVG válido con nodos rectangulares redondeados, aristas de Bézier, paleta de colores Tier S-0 y leyenda semántica
  Y la salida está completamente libre de dependencias externas de canvas o DOM simulado.

ESCENARIO: BDD-1932 Benchmark de Rendimiento Topológico y Recibo Formal de Auditoría
  DADO un entorno de integración continua o ejecución local
  CUANDO EosArchitecturalCanvasCore ejecuta el benchmark con grafos sintéticos de más de 1,000 nodos y aristas
  ENTONCES el tiempo de cálculo de layout y blast radius es inferior a 25ms
  Y genera un recibo ARCHITECTURAL_CANVAS_RECEIPT.json con veredicto CONFORMANT y estado PRODUCTION_READY_WITHIN_TESTED_SCOPE.
```
