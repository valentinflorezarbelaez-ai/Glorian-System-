# SPEC-079 — LOG-STRUCTURED MERGE-TREE (LSM-TREE) STORAGE ENGINE
**Version**: 70.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-062  
**Architecture Decision Record**: ADR-084  
**Domain Layer**: Layer-0 System Core (`src/core/eosLsmTreeStorageEngine.ts`)

---

## 1. Executive Summary
Inspired by Meta RocksDB, Google Bigtable, and Apache Cassandra storage architectures, SPEC-079 formalizes the EOS Log-Structured Merge-Tree (LSM-Tree) Storage Engine. Operating under strict Layer-0 purity with zero external npm dependencies, the engine organizes high-throughput agent event streams into: (1) an active in-memory `MemTable`, (2) immutable flushed `SSTables` (Sorted String Tables) with integrated probabilistic Bloom filters, and (3) a leveled compaction processor that eliminates deleted keys (tombstones) and duplicate versions, delivering $O(1)$ sequential NVMe write throughput and sub-millisecond point reads.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-278: In-Memory Sorted MemTable with Capacity Threshold
**Ubiquitous / Permanent**: EL SISTEMA almacenará escrituras entrantes en una estructura en memoria ordenada por clave (`MemTable`), garantizando inserción en $O(\log N)$ y lecturas inmediatas de última versión.

### FR-279: Inmutabilidad de SSTables Flasheadas y Filtros de Bloom
**Event-Driven**: CUANDO el `MemTable` alcance su umbral máximo de capacidad, EL SISTEMA volcará el contenido de forma atómica a un archivo o segmento inmutable `SSTable`, calculando un filtro de Bloom para descartar lecturas de claves ausentes con probabilidad de falso positivo $< 1\%$.

### FR-280: Jerarquía de Búsqueda Puntual (MemTable -> L0 SSTables -> L1)
**Ubiquitous / Permanent**: EL SISTEMA resolverá lecturas puntuales consultando primero el `MemTable` activo; si la clave no está presente, consultará los filtros de Bloom de las `SSTables` en orden cronológico inverso, evitando accesos innecesarios a disco.

### FR-281: Compactación por Niveles y Purga de Tombstones
**Event-Driven**: CUANDO el número de SSTables en el nivel 0 exceda el límite de compactación, EL SISTEMA fusionará los segmentos ordenados eliminando registros marcados como borrados (`tombstones`) y registros obsoletos.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-233: Sequential MemTable Insertion and Immutable SSTable Flush
```gherkin
ESCENARIO: Llenado de MemTable y Volcado Atómico a SSTable
  DADO un motor LSM-Tree con capacidad de MemTable de 5 registros
  CUANDO se insertan 6 pares clave-valor secuencialmente
  ENTONCES el motor dispara un volcado atómico a una nueva SSTable inmutable
  Y el MemTable activo se resetea conteniendo únicamente el sexto registro
```

### BDD-234: Bloom Filter Fast Non-Membership and Point-Lookup
```gherkin
ESCENARIO: Descarte Rápido de Claves Ausentes con Filtro de Bloom
  DADO una SSTable que contiene las claves 'telemetry:cpu' y 'telemetry:ram'
  CUANDO se consulta una clave inexistente 'telemetry:gpu'
  ENTONCES el filtro de Bloom determina instantáneamente que la clave no pertenece a la tabla
  Y se evita la lectura del bloque de datos
```
