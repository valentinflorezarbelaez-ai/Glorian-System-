# SPEC-323: Tensor Parallel Multi-Head & Grouped-Query Attention (TP-MHA / TP-GQA) with Sequence Parallelism & Ring Attention

**Specification ID**: `SPEC-323`  
**Change Reference**: `CHANGE-185`  
**Status**: APPROVED  
**Classification**: SOVEREIGN_DISTRIBUTED_CORE  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Functional Requirements (Formal EARS Syntax)

### FR-1: Head Partitioning & GQA Ratio Preservation (Ubiquitous)

EL SISTEMA distribuirá de forma determinista $H_Q$ cabezas de consulta y $H_{KV}$ cabezas de clave-valor entre $P$ trabajadores tensoriales, preservando la proporción $H_Q / H_{KV}$ en cada partición local tal que $\sum_p H_Q^{(p)} = H_Q$ y $\sum_p H_{KV}^{(p)} = H_{KV}$.

### FR-2: Column-Parallel Projections (Event-Driven)

CUANDO se recibe el tensor de entrada $X \in \mathbb{R}^{B \times S \times d}$, EL SISTEMA calculará las proyecciones locales de atención $Q^{(p)} = X W_Q^{(p)}$, $K^{(p)} = X W_K^{(p)}$ y $V^{(p)} = X W_V^{(p)}$ en paralelo sin comunicación inter-trabajadores.

### FR-3: Local Head Attention Evaluation (Ubiquitous)

EL SISTEMA evaluará la atención escalada por producto punto para cada cabeza local utilizando el algoritmo de softmax online y reescalado dinámico, evitando la materialización de matrices globales de atención.

### FR-4: Row-Parallel Output Projection & Single All-Reduce Barrier (State-Driven)

MIENTRAS se computa la salida de atención unificada, EL SISTEMA ejecutará una proyección local por filas $O^{(p)} = A^{(p)} W_O^{(p)}$ seguida de exactamente una única barrera colectiva All-Reduce $O = \sum_p O^{(p)}$.

### FR-5: Sequence Parallelism Slicing (State-Driven)

MIENTRAS el modo de paralelismo de secuencia está activo, EL SISTEMA dividirá las activaciones a lo largo de la dimensión temporal $S / P$ durante las operaciones de normalización residual para acotar la memoria de activación.

### FR-6: Ring Attention Circular Shift (Event-Driven)

CUANDO la longitud de secuencia $S$ excede la capacidad de memoria local, EL SISTEMA ejecutará el protocolo Ring Attention pasando los bloques $(K, V)$ a través de la topología en anillo mientras los bloques $Q$ permanecen locales, convergiendo a la atención exacta de secuencia completa.

---

## 2. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-1713: Multi-Head & Grouped-Query Attention Head Partitioning

```gherkin
ESCENARIO: BDD-1713 - Particionamiento de cabezas de atención MHA y GQA
  DADO un modelo con H_Q = 8 cabezas de consulta y H_KV = 2 cabezas de clave-valor (GQA ratio 4:1)
  CUANDO se particiona sobre P = 2 trabajadores tensoriales
  ENTONCES cada trabajador recibe exactamente H_Q / P = 4 cabezas de consulta y H_KV / P = 1 cabeza de clave-valor
  Y la suma total de cabezas locales preserva estrictamente H_Q y H_KV
```

### BDD-1714: Column-Parallel Q, K, V Projections Without Communication

```gherkin
ESCENARIO: BDD-1714 - Proyecciones lineales paralelas por columnas para Q, K, V
  DADO un tensor de entrada X de dimensiones [B=2, S=4, d=8] y matrices de pesos particionadas
  CUANDO cada trabajador ejecuta su proyección local
  ENTONCES los tensores Q^(p), K^(p) y V^(p) se calculan con cero intercambio de mensajes
  Y coinciden numéricamente con los bloques correspondientes de la proyección centralizada
```

### BDD-1715: Local Head Attention Computation & Online Softmax

```gherkin
ESCENARIO: BDD-1715 - Evaluación de atención local por cabezas con softmax online
  DADO los tensores locales de consulta, clave y valor para las cabezas asignadas
  CUANDO se ejecuta la atención por producto punto escalada local
  ENTONCES la atención de cada cabeza se calcula independientemente sin sincronización
  Y la suma de probabilidades de atención por fila es estrictamente 1.0 +- 1e-6
```

### BDD-1716: Row-Parallel Output Projection & Single All-Reduce Barrier

```gherkin
ESCENARIO: BDD-1716 - Proyección de salida paralela por filas y barrera única All-Reduce
  DADO las salidas locales de atención concatenadas en cada trabajador
  CUANDO se aplica la proyección por filas W_O^(p) y la reducción All-Reduce
  ENTONCES la salida final coincide con la atención multi-cabeza monolítica central dentro de epsilon <= 1e-5
  Y se ejecuta exactamente una única barrera de comunicación colectiva
```

### BDD-1717: Ring Attention Circular Shift Over Distributed Sequence

```gherkin
ESCENARIO: BDD-1717 - Ring Attention con transferencia circular de bloques K y V
  DADO una secuencia larga dividida en P = 4 fragmentos locales de longitud S_local
  CUANDO los bloques K y V rotan a través del anillo durante P pasos
  ENTONCES la salida de atención acumulada es idéntica a la atención global completa sobre la secuencia no particionada
  Y la memoria máxima de activaciones en cada nodo se mantiene acotada a O(S_local)
```

### BDD-1718: Invariant Auditing & Cryptographic SHA-256 Receipt

```gherkin
ESCENARIO: BDD-1718 - Auditoría de invariantes y emisión de recibo firmado
  DADO el motor Tensor Parallel Attention configurado con P trabajadores
  CUANDO se ejecuta el método de auditoría integral
  ENTONCES se certifica la conservación de cabezas, la paridad matemática y la barrera única
  Y se genera un recibo firmado SHA-256 en docs/evidence/TENSOR_PARALLEL_ATTENTION_RECEIPT.json
```
