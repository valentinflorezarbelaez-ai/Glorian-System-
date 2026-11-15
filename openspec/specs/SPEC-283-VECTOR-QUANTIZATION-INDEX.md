# SPEC-283: Sharded Vector Indexing & SIMD-Style Quantization Governor

- **Status**: APPROVED
- **Change Reference**: `CHANGE-145`
- **Intake Reference**: `INTAKE-145`
- **Domain**: Vector Embeddings Compression, Scalar Quantization SQ8 & Sharded k-NN Retrieval
- **Date**: 2026-11-15

---

## 1. Functional Requirements (IEEE 830 / EARS)

### FR-283-01: Scalar Quantization (SQ8) Compression

- **Event-Driven**: CUANDO un vector de punto flotante FP32 es recibido, EL SISTEMA calculará los límites $[\min, \max]$ y mapeará linealmente cada componente a un entero de 8 bits con escala y desplazamiento asociados, logrando una reducción de huella de memoria de $4\times$.

### FR-283-02: High-Performance Unrolled Dot Product & Cosine Similarity

- **Ubiquitous / Permanent**: EL SISTEMA computará el producto punto y la similitud coseno ejecutando bucles desenrollados de paso 4 sobre buffers de enteros o flotantes, minimizando saltos condicionales y overhead de asignación en heap.

### FR-283-03: Sharded Partition Indexing

- **Event-Driven**: CUANDO un conjunto de vectores cuantizados es indexado, EL SISTEMA distribuirá los vectores en fragmentos (_shards_) basados en clave de partición o distancia a centroides para permitir escaneos acotados sub-lineales.

### FR-283-04: Top-$K$ Nearest-Neighbor Search

- **Event-Driven**: CUANDO una consulta vectorial es emitida con un límite $K$, EL SISTEMA evaluará la similitud coseno contra los vectores del índice, ordenará los candidatos y retornará los $K$ vecinos más cercanos con sus puntuaciones de similitud y metadatos.

### FR-283-05: Reconstruction and Dequantization Precision Guard

- **Error / Unwanted Condition**: SI el error relativo entre la similitud de vectores en FP32 y su aproximación cuantizada SQ8 excede el 5%, ENTONCES EL SISTEMA emitirá una advertencia de distorsión de escala preservando la coherencia del ranking.

### FR-283-06: Verifiable Vector Index Manifest & Cryptographic Receipt

- **Ubiquitous / Permanent**: EL SISTEMA generará un manifiesto verificable del índice vectorial en `docs/evidence/VECTOR_INDEX_RECEIPT.json` con conteo de vectores, dimensiones, número de shards, huella de memoria y firma SHA-256.

---

## 2. BDD Acceptance Criteria

```gherkin
ESCENARIO: BDD-1473 Scalar Quantization SQ8 and Dequantization Accuracy
  DADO un vector FP32 de 8 dimensiones con valores continuos
  CUANDO EosVectorQuantizationGovernor.quantizeSQ8 es invocado
  ENTONCES comprime los valores a Int8Array con scale y offset
  Y la reconstrucción mediante dequantizeSQ8 preserva los valores con error cuadrático medio MSE < 0.005.

ESCENARIO: BDD-1474 High-Throughput Unrolled Cosine Similarity Calculation
  DADO dos vectores normalizados
  CUANDO EosVectorQuantizationGovernor.cosineSimilarity es ejecutado
  ENTONCES calcula el producto punto exacto en [-1.0, 1.0]
  Y dos vectores idénticos arrojan una similitud de 1.0000.

ESCENARIO: BDD-1475 Sharded Vector Index Construction
  DADO un conjunto de 10 vectores multidimensionales distribuidos en 2 particiones
  CUANDO EosVectorQuantizationGovernor.buildIndex es invocado
  ENTONCES crea un índice particionado en shards conteniendo vectores cuantizados y metadatos.

ESCENARIO: BDD-1476 Top-K Nearest Neighbor Retrieval
  DADO un índice vectorial poblado y un vector de consulta
  CUANDO EosVectorQuantizationGovernor.searchKnn es ejecutado con topK = 3
  ENTONCES retorna exactamente 3 resultados ordenados descendentemente por puntuación de similitud
  Y el vecino más cercano coincide con el vector idéntico o más próximo.

ESCENARIO: BDD-1477 Shard Filtered Search Routing
  DADO un índice con múltiples particiones ("us-east", "eu-central")
  CUANDO searchKnn es invocado con filtro de partición específico
  ENTONCES examina únicamente los vectores de la partición seleccionada reduciendo el espacio de búsqueda.

ESCENARIO: BDD-1478 Cryptographic Index Evidence Receipt
  DADO un índice vectorial construido
  CUANDO generateReceipt es invocado
  ENTONCES emite docs/evidence/VECTOR_INDEX_RECEIPT.json con firma digital SHA-256 verificable.
```
