# SPEC-369: Episodic Memory Graph & Cross-Project Experience Synapse

**Document ID**: `SPEC-369-episodic-memory-graph`  
**Change Target**: `CHANGE-231`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Lifecycle Tier**: `production`  
**Author**: `user:valentin-florez-arbelaez` & Antigravity  
**Date**: `2026-11-19`

---

## 1. Functional Requirements (EARS Standard)

- **FR-369-01 (Episodic Ingestion)**:  
  `CUANDO` un agente completa un ciclo de resolución de problemas, `EL SISTEMA` ingerirá un episodio estructurado conteniendo identificador, repositorio origen, síntoma de error, causa raíz diagnosticada, solución aplicada y recibo de verificación.

- **FR-369-02 (Graph Topology & Synaptic Edges)**:  
  `CUANDO` se registra un nuevo episodio, `EL SISTEMA` calculará bordes sinápticos causales y asociativos enlazándolo con episodios previos que compartan patrones de error, símbolos afectados o estrategias de remediación similares.

- **FR-369-03 (Cross-Project Associative Query)**:  
  `CUANDO` se consulta la memoria episódica con un síntoma o contexto de consulta, `EL SISTEMA` ejecutará una búsqueda asociativa transversal a través de los 9 repositorios de la flota y retornará los episodios más relevantes ordenados por puntuación de afinidad.

- **FR-369-04 (Temporal Decay & Reinforcement)**:  
  `MIENTRAS` transcurre el tiempo, `EL SISTEMA` aplicará una curva de decaimiento temporal Ebbinghaus a los nodos de memoria, pero reforzará dinámicamente el peso de aquellos nodos que sean recuperados y aplicados con éxito.

- **FR-369-05 (Causal Path Traversal)**:  
  `CUANDO` se solicita el análisis causal de un síntoma, `EL SISTEMA` recorrerá el grafo de memoria siguiendo los bordes de dependencia y causalidad, identificando secuencias recurrentes de fallas y soluciones canónicas.

- **FR-369-06 (Bounded Memory Pruning)**:  
  `SI` la cantidad de nodos o el consumo de memoria excede los umbrales configurados, `ENTONCES EL SISTEMA` podará los episodios con menor ponderación sináptica preservando intactas las rutas causales críticas.

- **FR-369-07 (Cryptographic Receipt & Audit)**:  
  `EL SISTEMA` emitirá un recibo criptográfico inmutable SHA-256 certificando la integridad del grafo, conteo de nodos y bordes, distribución por repositorio y métricas de recuperación.

---

## 2. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-1993 - Structured Ingestion of Problem-Solving Episodes
  DADO un ciclo de resolución completado con diagnóstico y parche
  CUANDO el agente ingesta el episodio en la memoria episódica
  ENTONCES el nodo queda registrado con identificador único, repo origen, firma SHA-256 y timestamp
  Y se valida la integridad de todos los campos obligatorios.

ESCENARIO: BDD-1994 - Associative Cross-Project Retrieval across Fleet
  DADO un grafo de memoria con episodios de múltiples repositorios
  CUANDO se consulta un síntoma o patrón de error abstracto
  ENTONCES el motor sináptico retorna episodios coincidentes ordenados por similitud
  Y los resultados incluyen experiencias transferibles de repositorios distintos al actual.

ESCENARIO: BDD-1995 - Dynamic Synaptic Edge Construction and Causal Traversal
  DADO múltiples episodios relacionados por causa raíz o remediación
  CUANDO se indexan en el grafo
  ENTONCES se construyen automáticamente aristas ponderadas de relación causal
  Y la consulta de ruta causal retorna el encadenamiento de dependencias sin ciclos infinitos.

ESCENARIO: BDD-1996 - Temporal Ebbinghaus Decay and Recall Reinforcement
  DADO un nodo de memoria con peso inicial
  CUANDO transcurre el tiempo sin accesos
  ENTONCES su peso decrece siguiendo la curva de decaimiento
  Y si el nodo es recuperado y validado, su peso se incrementa exponencialmente.

ESCENARIO: BDD-1997 - Bounded Capacity and Safe Topological Pruning
  DADO un grafo que alcanza su límite de capacidad máxima de nodos
  CUANDO se ingresa un nuevo episodio
  ENTONCES el sistema poda los nodos de menor ponderación y retiene los nodos canónicos
  Y la integridad topológica del grafo se preserva sin referencias huérfanas.

ESCENARIO: BDD-1998 - Full Diagnostic Audit and Memory Synapse Receipt
  DADO el estado actual de la memoria episódica
  CUANDO se ejecuta la auditoría del grafo sináptico
  ENTONCES se emite un recibo formal SHA-256 con el resumen de nodos, aristas y cobertura de flota
  Y el reporte cumple con los estándares del plano de control de Glorian.
```
