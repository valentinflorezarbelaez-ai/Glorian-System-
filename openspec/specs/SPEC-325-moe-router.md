# SPEC-325: Expert Parallelism & Mixture-of-Experts (MoE) Routing Engine

**Specification ID**: `SPEC-325`  
**Change Reference**: `CHANGE-187`  
**Status**: APPROVED  
**Classification**: SOVEREIGN_DISTRIBUTED_CORE  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Functional Requirements (Formal EARS Syntax)

### FR-1: Top-K Gating Router (Ubiquitous)

EL SISTEMA computará para cada token de entrada un vector de probabilidades de enrutamiento mediante la función softmax aplicada sobre las proyecciones afines $H \cdot W_g$, seleccionando exactamente $K$ expertos por token con probabilidades renormalizadas $\sum_{i \in \text{Top}K} G_i = 1$.

### FR-2: Capacity Factor Bounded Token Buffers (Ubiquitous)

EL SISTEMA acotará estrictamente la cantidad máxima de tokens asignables a cualquier experto mediante la capacidad $C_{\text{max}} = \lceil \frac{K \cdot T}{E} \cdot C \rceil$, donde $T$ es el número total de tokens del lote, $E$ el total de expertos y $C \ge 1.0$ el factor de capacidad, garantizando la ausencia de desbordamientos de memoria en los trabajadores.

### FR-3: Auxiliary Load-Balancing Loss (Event-Driven)

CUANDO se ejecuta la pasada hacia adelante de la capa MoE, EL SISTEMA evaluará la pérdida auxiliar de balanceo $\mathcal{L}_{\text{aux}} = \alpha \cdot E \sum_{i=1}^E f_i \cdot P_i$, donde $f_i$ es la fracción de tokens despachados al experto $i$, $P_i$ es la probabilidad promedio asignada al experto $i$ y $\alpha$ es el coeficiente de ponderación, minimizando la pérdida en caso de distribución perfectamente uniforme.

### FR-4: All-to-All Token Dispatch & Local Expert Execution (Event-Driven)

CUANDO los tokens han sido asignados a sus expertos correspondientes, EL SISTEMA redistribuirá las representaciones de los tokens mediante un intercambio colectivo All-to-All desde los trabajadores de datos hacia los trabajadores que alojan los expertos asignados, ejecutando concurrentemente las redes feed-forward locales.

### FR-5: All-to-All Output Combine & Weighted Recombination (Event-Driven)

CUANDO los expertos locales completan el cómputo de sus tokens asignados, EL SISTEMA redistribuirá las salidas mediante un segundo intercambio colectivo All-to-All hacia los trabajadores originales, combinando linealmente las representaciones ponderadas por los pesos de compuerta $G_i$.

### FR-6: Telemetry, Invariant Verification & Cryptographic Receipt (Ubiquitous)

EL SISTEMA garantizará que las salidas combinadas coincidan con la evaluación MoE monolítica centralizada dentro de una tolerancia $\epsilon \le 10^{-6}$, emitiendo un recibo firmado SHA-256 en `docs/evidence/MOE_ROUTER_RECEIPT.json`.

---

## 2. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-1725: Top-K Sparse Gating & Weight Normalization

```gherkin
ESCENARIO: BDD-1725 - Selección Top-K y normalización de pesos de compuerta
  DADO un lote de T tokens con representaciones en dimensión D
  CUANDO se evalúa el enrutador MoE con K=2 y E=8 expertos
  ENTONCES exactamente 2 expertos con las mayores probabilidades son seleccionados por token
  Y la suma de los pesos de compuerta de los expertos seleccionados es igual a 1.0 (+- 1e-6)
```

### BDD-1726: Expert Capacity Truncation & Token Buffer Bounds

```gherkin
ESCENARIO: BDD-1726 - Acotación estricta de capacidad por experto
  DADO un lote de T tokens y un factor de capacidad C=1.0
  CUANDO los tokens son asignados a los buffers de los expertos
  ENTONCES ningún buffer de experto excede ceil((K * T / E) * C)
  Y los tokens excedentes son descartados o manejados mediante bypass residual sin desbordar memoria
```

### BDD-1727: Auxiliary Load-Balancing Loss Calculation & Minima

```gherkin
ESCENARIO: BDD-1727 - Evaluación de la pérdida auxiliar de balanceo de carga
  DADO las probabilidades de enrutamiento y las asignaciones de tokens por experto
  CUANDO se computa la pérdida auxiliar L_aux con coeficiente alpha=0.01
  ENTONCES la pérdida alcanza su valor mínimo teórico cuando los tokens se distribuyen uniformemente (f_i = 1/E)
  Y penaliza estrictamente las distribuciones colapsadas en un único experto
```

### BDD-1728: Two-Phase All-to-All Token Dispatch & Combine

```gherkin
ESCENARIO: BDD-1728 - Comunicación colectiva All-to-All de despacho y recombinación
  DADO un cluster de P trabajadores y E expertos particionados equitativamente
  CUANDO se ejecuta la fase de despacho All-to-All y recombinación All-to-All
  ENTONCES cada trabajador recibe exactamente los tokens asignados a sus expertos locales
  Y los resultados recombinados se devuelven en el orden original de los tokens
```

### BDD-1729: Mathematical Parity Against Centralized MoE Reference

```gherkin
ESCENARIO: BDD-1729 - Paridad matemática frente a la evaluación MoE centralizada
  DADO entradas idénticas, pesos de router y pesos de expertos
  CUANDO se evalúa la capa MoE paralelizada frente a la capa MoE monolítica centralizada
  ENTONCES las activaciones finales coinciden numéricamente con error absoluto <= 1e-6
```

### BDD-1730: CLI Toolchain Parity & Invariant Audit Receipt

```gherkin
ESCENARIO: BDD-1730 - Auditoría integral de invariantes y emisión de recibo firmado
  DADO el motor MoE configurado con P trabajadores y E expertos
  CUANDO se invoca el comando toolchain:moe:audit
  ENTONCES se verifican todas las cotas de capacidad, paridad y balanceo de carga
  Y se genera un recibo firmado SHA-256 en docs/evidence/MOE_ROUTER_RECEIPT.json
```
