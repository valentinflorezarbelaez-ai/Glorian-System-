# SPEC-324: ZeRO (Zero Redundancy Optimizer) & Fully Sharded Data Parallel (FSDP) Engine

**Specification ID**: `SPEC-324`  
**Change Reference**: `CHANGE-186`  
**Status**: APPROVED  
**Classification**: SOVEREIGN_DISTRIBUTED_CORE  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Functional Requirements (Formal EARS Syntax)

### FR-1: ZeRO-Stage 1 Optimizer State Sharding (Ubiquitous)

EL SISTEMA dividirá equitativamente los estados del optimizador (momentos $m$ y $v$ de primer y segundo orden de Adam, y pesos maestros en FP32) entre $P$ trabajadores tensoriales, requiriendo que cada trabajador $p$ mantenga en memoria exclusivamente la partición $[p \cdot \frac{\Psi}{P}, (p+1) \cdot \frac{\Psi}{P} - 1]$.

### FR-2: ZeRO-Stage 2 Gradient Sharding & Reduce-Scatter (Event-Driven)

CUANDO se completa la pasada hacia atrás de un lote de entrenamiento, EL SISTEMA ejecutará una operación colectiva Reduce-Scatter sobre los gradientes, almacenando en cada trabajador únicamente su fragmento local de gradiente $g^{(p)}$ y liberando inmediatamente el resto de la memoria de gradientes.

### FR-3: ZeRO-Stage 3 / FSDP Parameter Sharding (State-Driven)

MIENTRAS el modo ZeRO-Stage 3 (FSDP) esté activo, EL SISTEMA mantendrá en reposo únicamente una fracción $1 / P$ de los parámetros del modelo en cada trabajador, reconstruyendo los parámetros de cada capa justo a tiempo mediante All-Gather durante la pasada hacia adelante y liberándolos inmediatamente tras computar la capa.

### FR-4: Just-In-Time Parameter Re-Gathering & Backward Reduce-Scatter (Event-Driven)

CUANDO se ejecuta la pasada hacia atrás bajo ZeRO-Stage 3, EL SISTEMA reconstruirá los parámetros de la capa mediante All-Gather para computar los gradientes respecto a la entrada y los parámetros, ejecutando a continuación un Reduce-Scatter del gradiente de la capa y liberando los parámetros temporales.

### FR-5: ZeRO-Infinity Host CPU Offloading (Event-Driven)

CUANDO se habilita el modo de descarga a host (offload), EL SISTEMA transferirá los estados de optimizador particionados a la memoria RAM del sistema anfitrión, pre-cargándolos asíncronamente antes de la fase de actualización del optimizador.

### FR-6: Mathematical Parity & Memory Invariant Verification (Ubiquitous)

EL SISTEMA garantizará que los parámetros actualizados tras cada paso del optimizador coincidan numéricamente con un optimizador Adam centralizado dentro de una tolerancia absoluta $\epsilon \le 10^{-6}$, y que la memoria máxima por trabajador se reduzca proporcionalmente a $O(\Psi / P)$.

---

## 2. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-1719: ZeRO-Stage 1 Optimizer State Partitioning & Memory Reduction

```gherkin
ESCENARIO: BDD-1719 - Particionamiento de estados de optimizador ZeRO-Stage 1
  DADO un modelo con Psi = 16 parámetros y P = 4 trabajadores
  CUANDO se inicializa el optimizador bajo ZeRO-Stage 1
  ENTONCES cada trabajador mantiene exactamente Psi / P = 4 estados de optimizador (m, v)
  Y la memoria total de estados de optimizador por trabajador se reduce a 1/P de DDP estándar
```

### BDD-1720: ZeRO-Stage 2 Gradient Sharding via Reduce-Scatter

```gherkin
ESCENARIO: BDD-1720 - Fragmentación de gradientes con Reduce-Scatter en ZeRO-Stage 2
  DADO gradientes locales computados en cada trabajador para un lote de entrenamiento
  CUANDO se ejecuta la reducción de gradientes bajo ZeRO-Stage 2
  ENTONCES se ejecuta una operación Reduce-Scatter
  Y cada trabajador retiene exclusivamente su cuota de 1/P gradientes reducidos acumulados
  Y los gradientes no locales son liberados inmediatamente de la memoria
```

### BDD-1721: ZeRO-Stage 3 / FSDP Just-In-Time Parameter Reconstruction

```gherkin
ESCENARIO: BDD-1721 - Reconstrucción de parámetros capa por capa bajo ZeRO-Stage 3
  DADO un modelo multicapa con parámetros fragmentados a lo largo de P trabajadores
  CUANDO se evalúa la pasada hacia adelante de una capa
  ENTONCES los parámetros de dicha capa se reconstruyen temporalmente mediante All-Gather
  Y son liberados de inmediato una vez completada la activación de la capa
  Y la memoria persistente de parámetros en cada trabajador no excede Psi / P
```

### BDD-1722: ZeRO-Stage 3 Backward Execution & Immediate Gradient Freeing

```gherkin
ESCENARIO: BDD-1722 - Pasada hacia atrás con All-Gather de parámetros y Reduce-Scatter de gradientes
  DADO la activación hacia atrás de una capa bajo ZeRO-Stage 3
  CUANDO se computan los gradientes de la capa
  ENTONCES los parámetros son recolectados bajo demanda y los gradientes son reducidos vía Reduce-Scatter
  Y tanto los parámetros recolectados como los gradientes reducidos no locales son purgados inmediatamente
```

### BDD-1723: Mathematical Parity Against Centralized Adam Optimizer

```gherkin
ESCENARIO: BDD-1723 - Equivalencia matemática exacta frente a Adam monolítico
  DADO tensores de parámetros iniciales y un flujo de gradientes distribuidos
  CUANDO se aplican N pasos de optimización bajo ZeRO-1, ZeRO-2 y ZeRO-3
  ENTONCES los parámetros finales de todos los esquemas ZeRO coinciden con Adam centralizado con error maximo <= 1e-6
```

### BDD-1724: Invariant Auditing & Cryptographic SHA-256 Receipt

```gherkin
ESCENARIO: BDD-1724 - Auditoría integral de invariantes y emisión de recibo firmado
  DADO el motor ZeRO/FSDP configurado con P trabajadores
  CUANDO se ejecuta el método audit()
  ENTONCES se certifica la acotación de memoria O(Psi / P), la paridad matemática y la ausencia de fugas
  Y se genera un recibo firmado SHA-256 en docs/evidence/ZERO_FSDP_RECEIPT.json
```
