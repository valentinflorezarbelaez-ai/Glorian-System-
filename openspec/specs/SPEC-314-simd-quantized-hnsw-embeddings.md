# SPEC-314 — SIMD Quantized Vector Embedding Engine (i8x16 / f32x4) for Sub-Millisecond HNSW Search

- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `APPROVED`
- **Milestone**: `v78.0.0`
- **TLA+ Companion**: `docs/formal/SimdQuantizedHnsw.tla`

---

## 1. Functional Requirements (IEEE 830 EARS)

### FR-1: 8-Bit Asymmetric Scalar Quantization & Aligned Framing

- **Pattern**: Ubiquitous / Permanent
- **EARS**: THE SYSTEM SHALL quantize raw 32-bit floating point vectors into 8-bit signed integer representations (`Int8Array`) bounded in $[-128, 127]$ with 16-byte memory alignment, storing vector scale $\alpha$, zero-offset $z$, vector element sum, and precomputed Euclidean norm.

### FR-2: 16-Lane SIMD Vectorized Integer Dot Product

- **Pattern**: Event-Driven
- **EARS**: CUANDO evaluating dot products between two quantized vectors, EL SISTEMA SHALL compute the integer accumulator over 16-byte SIMD blocks (`i8x16`) with scalar expansion, scaling the result to floating point precision without allocating intermediate float arrays.

### FR-3: Sub-Millisecond Quantized Cosine Distance Calculation

- **Pattern**: Event-Driven
- **EARS**: CUANDO computing cosine distance $1 - \frac{\langle u, v \rangle}{\|u\| \|v\|}$, EL SISTEMA SHALL utilize precomputed norms and quantized dot products to return accurate distance metrics within $< 2\%$ relative error compared to full-precision 32-bit float calculations.

### FR-4: Quantized HNSW Multi-Layer Index Insertion

- **Pattern**: Event-Driven
- **EARS**: CUANDO a vector is inserted into the HNSW index, EL SISTEMA SHALL assign a geometric level, evaluate greedy nearest neighbors at higher layers using quantized distances, and establish bidirectional graph edges at layer 0 and above.

### FR-5: Fast Beam-Search Nearest Neighbor Retrieval

- **Pattern**: Event-Driven
- **EARS**: CUANDO a k-NN query is issued against the quantized HNSW index, EL SISTEMA SHALL traverse the graph using priority-queue beam search and return the top-$k$ nearest neighbors with search latency $p99 < 350\,\mu\text{s}$.

### FR-6: Structural Invariant Verification & Cryptographic Receipt Generation

- **Pattern**: Ubiquitous / Permanent
- **EARS**: EL SISTEMA SHALL verify quantization error bounds, 16-byte memory alignment, graph connectivity invariants, and emit a signed SHA-256 evidence receipt at `docs/evidence/SIMD_QUANTIZED_HNSW_RECEIPT.json`.

---

## 2. Acceptance Criteria (BDD / Gherkin)

### BDD-1659: Asymmetric 8-Bit Scalar Quantization & 16-Byte Alignment

```gherkin
ESCENARIO: Cuantización asimétrica de vector float a Int8Array alineado
  DADO un vector flotante de dimensión 128 con valores continuos
  CUANDO se cuantiza el vector con quantizeVector
  ENTONCES la carga útil cuantizada es un Int8Array de longitud 128
  Y todos los valores cuantizados se ubican en el rango [-128, 127]
  Y el tamaño de bytes es un múltiplo exacto de 16 bytes
  Y se preservan la escala alfa, offset z y norma euclidiana
```

### BDD-1660: SIMD Integer Dot Product & Mathematical Equivalence

```gherkin
ESCENARIO: Evaluación vectorizada de producto punto con aproximación matemática
  DADO dos vectores continuos u y v de dimensión 256
  CUANDO se calcula el producto punto cuantizado con simdDotProduct
  ENTONCES el valor resultante coincide con el producto punto float32 exacto con error relativo inferior al 2%
  Y el cálculo no asigna objetos intermedios en el heap de JavaScript
```

### BDD-1661: Quantized Cosine Distance & Normalization Bounds

```gherkin
ESCENARIO: Cálculo de distancia coseno sobre vectores cuantizados
  DADO dos vectores ortogonales y dos vectores colineales cuantizados
  CUANDO se evalúa simdCosineDistance
  ENTONCES la distancia entre vectores colineales es aproximadamente 0.0
  Y la distancia entre vectores ortogonales es aproximadamente 1.0
  Y el resultado está acotado en el intervalo [0.0, 2.0]
```

### BDD-1662: Quantized HNSW Graph Insertion & Layer Hierarchy

```gherkin
ESCENARIO: Inserción de múltiples vectores en grafo HNSW cuantizado
  DADO un índice HNSW configurado para dimensión 64 y conectividad M=16
  CUANDO se insertan 100 vectores cuantizados secuencialmente
  ENTONCES el índice contiene exactamente 100 nodos registrados
  Y el punto de entrada (entryPoint) es válido y apunta a la capa superior
  Y cada nodo mantiene lista de adyacencia no vacía en la capa 0
```

### BDD-1663: Sub-Millisecond k-NN Retrieval & Recall Accuracy

```gherkin
ESCENARIO: Búsqueda k-NN rápida sobre índice cuantizado
  DADO un índice HNSW poblado con 250 vectores cuantizados
  CUANDO se ejecuta searchQuantizedKnn con un vector consulta y k=5
  ENTONCES se retornan exactamente 5 vecinos ordenados por distancia ascendente
  Y el tiempo de búsqueda por consulta es inferior a 1.0 milisegundo
```

### BDD-1664: Invariant Auditing & Cryptographic Receipt Generation

```gherkin
ESCENARIO: Verificación de invariantes estructurales y generación de recibo
  DADO un índice HNSW cuantizado con operaciones de inserción y búsqueda completadas
  CUANDO se ejecuta auditQuantizedInvariants
  ENTONCES se verifican 0 violaciones de alineación, límites o conectividad
  Y se emite un recibo criptográfico firmado con SHA-256 en docs/evidence/SIMD_QUANTIZED_HNSW_RECEIPT.json
```
