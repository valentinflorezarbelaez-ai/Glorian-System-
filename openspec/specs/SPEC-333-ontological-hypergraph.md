# SPEC-333: Autonomous Ontological Hypergraph & Bitemporal Entity Resolution Engine

**Status**: `APPROVED`

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO se asienta una nueva afirmación o entidad en el grafo ontológico, EL SISTEMA indexa el registro con dos dimensiones temporales ortogonales: tiempo válido $[v_{\text{from}}, v_{\text{to}}]$ y tiempo de transacción $[t_{\text{from}}, t_{\text{to}}]$, preservando inmutabilidad histórica.
- **FR-2 (Event-Driven)**: CUANDO se define una relación hiperespacial entre $N \ge 2$ entidades, EL SISTEMA sintetiza un hiperarco atómico tipado (`OntologicalHyperedge`) con roles asignados a cada participante sin requerir nodos intermediarios sintéticos de unión.
- **FR-3 (Event-Driven)**: CUANDO se ejecuta una resolución de entidades sobre registros provenientes de fuentes dispares, EL SISTEMA ejecuta concordancia exacta por identificadores y cotejo difuso determinista por huella léxica, unificando registros homólogos bajo una entidad canónica con puntaje de confianza calibrado $\ge 0.80$.
- **FR-4 (State-Driven)**: MIENTRAS se evalúa una consulta de lectura o recorrido de subgrafo bajo un contexto de seguridad con nivel de autorización $L$ y compartimentos $C$, EL SISTEMA oculta o redacta todo nodo o hiperarco cuya clasificación supere $L$ o cuyos compartimentos requeridos no pertenezcan al subconjunto $C$.
- **FR-5 (Event-Driven)**: CUANDO se solicita una reconstrucción histórica ("as-of"), EL SISTEMA filtra el estado ontológico exactamente en el instante de tiempo de transacción $T_{\text{tx}}$ especificado y evalúa las verdades vigentes en el tiempo válido $T_{\text{valid}}$ sin mutar el historial.
- **FR-6 (Ubiquitous / Permanent)**: EL SISTEMA mantiene la integridad referencial estricta de todos los participantes en hiperarcos activos y garantiza la trazabilidad criptográfica SHA-256 de cada aserción registrada.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1773 Asentamiento y Consulta Bitemporal con Reconstrucción As-Of
  DADO un motor de hipergrafo ontológico inicializado
  CUANDO se asienta un componente con tiempo de validez [T0, T2] registrado en tiempo de transacción T1, y posteriormente se corrige en T3
  ENTONCES la consulta "as-of" en tiempo de transacción T2 refleja la afirmación original
  Y la consulta "as-of" en tiempo de transacción T4 refleja la corrección sin pérdida de auditoría histórica.

ESCENARIO: BDD-1774 Síntesis y Enlace de Hiperarcos Multi-Entidad (N-arias)
  DADO un conjunto de 4 entidades ontológicas (un servicio, una escuadra, un certificado TLS y un clúster K8s)
  CUANDO se crea un hiperarco de tipo "DEPLOYMENT_AUTHORIZATION" que vincula las 4 entidades con roles específicos
  ENTONCES el hipergrafo indexa el hiperarco atómico preservando los 4 roles
  Y permite la navegación bidireccional desde cualquiera de las entidades participantes.

ESCENARIO: BDD-1775 Deduplicación y Resolución Determinista de Entidades
  DADO un catálogo con múltiples registros fragmentados del mismo componente (e.g. Backstage, GitHub repo, alertas Datadog)
  CUANDO se ejecuta el resolvedor ontológico de entidades
  ENTONCES el motor identifica los registros homólogos mediante identificadores y similitud de atributos
  Y genera una entidad canónica consolidada con un puntaje de confianza >= 0.85 y enlaces de alias explícitos.

ESCENARIO: BDD-1776 Aislamiento de Seguridad Multinivel (MLS) y Redacción Automática Fail-Closed
  DADO un grafo ontológico que contiene entidades con clasificación UNCLASSIFIED, SECRET y TOP_SECRET con compartimento CYBER
  CUANDO un usuario con acreditación SECRET y sin compartimento CYBER consulta el subgrafo
  ENTONCES el motor devuelve las entidades UNCLASSIFIED y SECRET sin compartimento
  Y redacta estrictamente las entidades TOP_SECRET o pertenecientes a CYBER sin filtrar metadatos sensibles.

ESCENARIO: BDD-1777 Recorrido Topológico de Subgrafos y Cálculo de Radio de Impacto (Blast Radius)
  DADO un hipergrafo que modela dependencias de servicios, colas de mensajería y bases de datos
  CUANDO se solicita el radio de impacto de una falla o compromiso sobre un nodo central
  ENTONCES el motor calcula transitivamente todas las entidades aguas abajo afectadas hasta una profundidad máxima D
  Y retorna el camino mínimo de interconexión entre la fuente y los nodos críticos.

ESCENARIO: BDD-1778 Auditoría de Invariantes y Certificación Formal del Hipergrafo
  DADO un ciclo de aserción, deduplicación y consultas bitemporales en el hipergrafo
  CUANDO se ejecuta la auditoría del motor ontológico
  ENTONCES se certifica que bitemporalMonotonicity es true, mlsLatticeContainment es true y referentialIntegrity es true
  Y se emite el recibo firmado en docs/evidence/ONTOLOGICAL_HYPERGRAPH_RECEIPT.json.
```
