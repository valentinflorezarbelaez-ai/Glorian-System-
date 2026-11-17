# SPEC-329: Distributed Key-Value Cache Replication, Prefix Caching & Speculative KV Prefetching Engine

**Specification ID**: `SPEC-329`  
**Change Reference**: `CHANGE-191`  
**Status**: APPROVED  
**Classification**: SOVEREIGN_DISTRIBUTED_CORE  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Functional Requirements (Formal EARS Syntax)

### FR-1: Radix Tree Token Prefix Insertion & Zero-Copy Ancestor Sharing (Ubiquitous)

EL SISTEMA indexará las secuencias de tokens entrantes en un árbol Radix jerárquico de prefijos en memoria, particionando los tensores de clave-valor (KV) en bloques de tamaño fijo de $B$ tokens; cuando una nueva sesión comparte un prefijo con sesiones previas, EL SISTEMA reutilizará las referencias a los bloques físicos ancestrales sin duplicar memoria en el heap.

### FR-2: Longest-Prefix-Match Retrieval & TTFT Acceleration (Event-Driven)

CUANDO una nueva solicitud de inferencia presenta un prompt con tokens $[t_1, t_2, \dots, t_N]$, EL SISTEMA recorrerá el árbol Radix determinando la subsecuencia coincidente más larga en tiempo $O(M)$, recuperando los punteros a los bloques KV ya computados y omitiendo el re-cálculo de atención prefill para dichos tokens.

### FR-3: Distributed P2P Block Replication & Cryptographic Integrity (Event-Driven)

CUANDO un nodo trabajador genera nuevos bloques de caché KV asociados a prefijos compartidos o de alta frecuencia, EL SISTEMA replicará asíncronamente dichos bloques hacia los nodos pares de la topología distribuida, verificando la consistencia e integridad binaria mediante firmas criptográficas SHA-256 por bloque.

### FR-4: Speculative Draft KV Block Prefetching & Pipeline Staging (Event-Driven)

CUANDO el motor de decodificación especulativa genera secuencias de tokens borradores candidatos, EL SISTEMA pre-cargará especulativamente los bloques de KV-cache proyectados hacia la memoria de alta velocidad antes de la ejecución del paso de verificación, solapando la latencia de transferencia de memoria con el cómputo de generación.

### FR-5: Pinned-Immortal Context Protection & Two-Tier LRU/LFU Eviction (Ubiquitous)

EL SISTEMA protegerá de forma inviolable todos los bloques marcados con bandera de anclaje (`isPinned = true`, correspondiente a prompts de sistema o directivas raíz), haciéndolos inmunes a cualquier ciclo de desalojo; MIENTRAS la presión de memoria exceda el presupuesto máximo de bloques físicos $B_{\max}$, EL SISTEMA desalojará secuencialmente los nodos hoja no anclados basándose en una política ponderada de menor uso reciente y menor frecuencia (LRU/LFU).

### FR-6: Physical Memory Bound, Exact Attention Reconstitution & Cryptographic Receipt (Ubiquitous)

EL SISTEMA mantendrá la memoria total de bloques físicos estrictamente acotada por $B_{\max}$, garantizando que los estados de atención reconstituidos a partir de bloques cacheados coincidan exactamente con la evaluación fresca monolítica ($\epsilon = 0.0$), emitiendo un recibo firmado SHA-256 en `docs/evidence/DISTRIBUTED_KV_CACHE_REPLICATION_RECEIPT.json`.

---

## 2. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-1749: Radix Tree Prefix Insertion & Zero-Copy Block Sharing

```gherkin
ESCENARIO: BDD-1749 - Inserción en árbol Radix y compartición de bloques sin copia
  DADO un árbol Radix de prefijos vacío con tamaño de bloque B = 16
  CUANDO se insertan dos solicitudes de chat que comparten el mismo prefijo de sistema de 32 tokens
  ENTONCES ambas solicitudes referencian exactamente los mismos identificadores de bloques físicos ancestrales
  Y no se asignan bloques duplicados para los primeros 32 tokens
```

### BDD-1750: Longest-Prefix-Match Fast-Path Retrieval (TTFT Optimization)

```gherkin
ESCENARIO: BDD-1750 - Búsqueda de prefijo más largo y aceleración de TTFT
  DADO un árbol Radix con prefijos de contexto pre-indexados
  CUANDO se evalúa un prompt entrante que contiene un subconjunto de tokens indexados
  ENTONCES el motor localiza la coincidencia de prefijo más larga en O(M)
  Y retorna el porcentaje de tokens cacheados reduciendo el cómputo de prefill requerido
```

### BDD-1751: Distributed P2P KV Page Block Replication and Hash Integrity

```gherkin
ESCENARIO: BDD-1751 - Replicación P2P distribuida e integridad de hash
  DADO un clúster de inferencia con P nodos trabajadores
  CUANDO un nodo primario genera un bloque KV y lo replica a un nodo par
  ENTONCES el bloque queda registrado en la tabla de bloques del nodo destino
  Y el hash SHA-256 del contenido replicado coincide idénticamente con el origen
```

### BDD-1752: Speculative Draft Token Prefix Prefetching and Pipeline Overlap

```gherkin
ESCENARIO: BDD-1752 - Prebúsqueda especulativa de prefijos y solapamiento de pipeline
  DADO un conjunto de secuencias candidatas de tokens generadas por un modelo borrador
  CUANDO se invoca la prebúsqueda especulativa de bloques de caché KV
  ENTONCES los bloques proyectados se transfieren al buffer de ejecución activa de forma asíncrona
  Y quedan disponibles de inmediato para el verificador sin pausas bloqueantes
```

### BDD-1753: Pinned System Prompt Immunity and Context-Aware Eviction Under Pressure

```gherkin
ESCENARIO: BDD-1753 - Inmunidad de prompts anclados y desalojo consciente de contexto
  DADO un caché KV que ha alcanzado su capacidad máxima de bloques físicos
  CUANDO se dispara un ciclo de desalojo forzado por nuevas inserciones
  ENTONCES los bloques anclados como prompt de sistema permanecen intactos
  Y únicamente los bloques hoja no anclados con menor frecuencia y mayor antigüedad son liberados
```

### BDD-1754: Memory Ceiling Boundedness, Reconstruction Identity & Cryptographic Audit

```gherkin
ESCENARIO: BDD-1754 - Cota estricta de memoria, identidad de reconstrucción y auditoría criptográfica
  DADO un volumen intensivo de solicitudes multi-turno concurrentes
  CUANDO se audita la integridad del sistema de caché distribuido
  ENTONCES el número total de bloques físicos no excede B_max
  Y la reconstrucción de tensores de atención presenta paridad exacta epsilon = 0.0 emitiendo recibo firmado SHA-256
```
