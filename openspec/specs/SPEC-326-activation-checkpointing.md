# SPEC-326: Asynchronous Pipeline Parallelism & Activation Checkpointing Engine

**Specification ID**: `SPEC-326`  
**Change Reference**: `CHANGE-188`  
**Status**: APPROVED  
**Classification**: SOVEREIGN_DISTRIBUTED_CORE  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Functional Requirements (Formal EARS Syntax)

### FR-1: Full Activation Checkpointing Boundary Division (Ubiquitous)

EL SISTEMA particionará una secuencia de $L$ capas en $M$ segmentos contiguos de tamaño $S = \lceil L / M \rceil$, reteniendo en memoria activa únicamente las activaciones en las fronteras de los segmentos durante la pasada hacia adelante y descartando todas las activaciones intermedias no fronterizas.

### FR-2: Selective Activation Recomputation for Nonlinear Operations (Event-Driven)

CUANDO se ejecuta la pasada hacia atrás para un segmento de capas, EL SISTEMA recomputará bajo demanda las activaciones intermedias requeridas comenzando desde la frontera de checkpointing previa, aplicando las funciones no lineales hacia adelante y liberando los buffers transitorios inmediatamente tras el cálculo de los gradientes de la capa.

### FR-3: Asynchronous 1F1B Interleaved Micro-batch Memory Release (Event-Driven)

CUANDO se programan micro-lotes en una topología de paralelismo de pipeline 1F1B (One-Forward-One-Backward), EL SISTEMA intercalará la ejecución de pasadas hacia adelante y hacia atrás, liberando los checkpoints del micro-lote inmediatamente cuando su pasada hacia atrás en la etapa correspondiente concluye, acotando el número de activaciones vivas al número de etapas de pipeline $P$.

### FR-4: Activation Memory Ceiling Bounded by $O(\sqrt{L})$ (Ubiquitous)

EL SISTEMA mantendrá la memoria pico de activaciones estrictamente acotada por $O(\sqrt{L})$ cuando el número de checkpoints se configura óptimamente como $M \approx \sqrt{L}$, garantizando una reducción de memoria de hasta un 80% respecto a la propagación hacia atrás monolítica estándar.

### FR-5: Backward Gradient Mathematical Parity (Ubiquitous)

EL SISTEMA garantizará que todos los gradientes de pesos $\nabla W$ y gradientes de entrada $\nabla X$ computados mediante recomputación de activaciones coincidan numéricamente de manera idéntica con los calculados mediante retropropagación estándar completa, con un error absoluto $\epsilon \le 10^{-6}$.

### FR-6: Telemetry, Zero Leakage Invariant & Cryptographic Receipt (Ubiquitous)

EL SISTEMA verificará que tras completar la pasada hacia atrás de todos los micro-lotes no permanezca ninguna activación transitoria retenida en el heap ($M_{\text{leakage}} = 0$), emitiendo un recibo firmado SHA-256 en `docs/evidence/ACTIVATION_CHECKPOINTING_RECEIPT.json`.

---

## 2. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-1731: Full Activation Checkpointing & Segment Boundary Partitioning

```gherkin
ESCENARIO: BDD-1731 - Particionamiento de fronteras de checkpointing de activaciones
  DADO un modelo compuesto por L capas y una política de checkpointing con M segmentos
  CUANDO se ejecuta la pasada hacia adelante con retención de checkpoints
  ENTONCES únicamente se preservan en memoria las activaciones de entrada de cada frontera
  Y las activaciones intermedias internas son descartadas del cache
```

### BDD-1732: Selective Activation Recomputation & Transient Buffer Deallocation

```gherkin
ESCENARIO: BDD-1732 - Recomputación selectiva y desasignación inmediata de buffers
  DADO un segmento con activaciones intermedias descartadas y la frontera previa disponible
  CUANDO se ejecuta la pasada hacia atrás para el segmento
  ENTONCES las activaciones intermedias son recalculadas hacia adelante bajo demanda
  Y cada buffer de activación transitoria es desasignado inmediatamente tras computar el gradiente local
```

### BDD-1733: Asynchronous 1F1B Schedule with Early Activation Release

```gherkin
ESCENARIO: BDD-1733 - Cronograma 1F1B asíncrono con liberación temprana de activaciones
  DADO N micro-lotes y un pipeline de P etapas
  CUANDO se ejecuta el cronograma 1F1B intercalando forward y backward
  ENTONCES la memoria de activaciones activas no excede P micro-lotes concurrentes
  Y las activaciones de cada micro-lote se liberan de inmediato tras su pasada backward
```

### BDD-1734: Peak Activation Memory Ceiling Bounded to O(sqrt(L))

```gherkin
ESCENARIO: BDD-1734 - Cota estricta de memoria pico de activaciones
  DADO un modelo con L capas y M = ceil(sqrt(L)) checkpoints
  CUANDO se monitorea el consumo pico de activaciones durante el ciclo completo
  ENTONCES la memoria de activaciones pico es menor o igual a (M + L/M) unidades de activación
  Y representa un ahorro de al menos 70% frente al almacenamiento monolítico de L capas
```

### BDD-1735: Mathematical Gradient Parity Against Standard Backpropagation

```gherkin
ESCENARIO: BDD-1735 - Paridad matemática estricta de gradientes
  DADO pesos idénticos, entradas idénticas y gradientes de pérdida iniciales
  CUANDO se comparan los gradientes obtenidos por recomputación frente a backpropagation estándar
  ENTONCES la diferencia absoluta máxima de gradientes es menor o igual a 1e-6
```

### BDD-1736: CLI Toolchain Parity & Invariant Audit Receipt

```gherkin
ESCENARIO: BDD-1736 - Auditoría integral de invariantes y emisión de recibo firmado
  DADO el motor de checkpointing configurado con L capas y N micro-lotes
  CUANDO se invoca el comando toolchain:checkpoint:audit
  ENTONCES se verifican la cota de memoria O(sqrt(L)), paridad de gradientes y fuga nula
  Y se genera un recibo firmado SHA-256 en docs/evidence/ACTIVATION_CHECKPOINTING_RECEIPT.json
```
