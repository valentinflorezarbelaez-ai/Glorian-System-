# SPEC-330: Tree-Structured Speculative Decoding, Multi-Candidate Rejection Sampling & Dynamic Draft-Target Verification Engine

**Title**: Tree-Structured Speculative Decoding, Multi-Candidate Rejection Sampling & Dynamic Draft-Target Verification Engine  
**Domain**: Neural Inference Optimization, Speculative Decoding, Tree Attention, Rejection Sampling  
**Version**: 1.0.0  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Created**: 2026-11-17

---

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO el orquestador de inferencia recibe un contexto inicial y un presupuesto de candidatos $K$, EL SISTEMA construirá un árbol jerárquico de hipótesis especulativas (Draft Tree) aplanado en secuencias unidimensionales con codificación posicional relativa a la profundidad del nodo.
- **FR-2 (Permanent / Ubiquitous)**: EL SISTEMA mantendrá una matriz de atención causal 2D $M \in \{0, 1\}^{K \times K}$ donde el elemento $M_{i, j} = 1$ si y sólo si el nodo $j$ es ancestro estricto o idéntico al nodo $i$ en la topología del árbol.
- **FR-3 (Event-Driven)**: CUANDO el modelo target evalúa los logits de todos los nodos del árbol en un único forward pass, EL SISTEMA ejecutará el muestreo con rechazo modificado evaluando $\min\left(1, \frac{p(x_i)}{q(x_i)}\right)$ en orden topológico desde la raíz hasta las hojas.
- **FR-4 (State-Driven / Invariant)**: MIENTRAS una rama especulativa experimenta un rechazo en el nodo $r$, EL SISTEMA invalidará inmediatamente todos los nodos descendientes de $r$ y muestreará un token de recuperación a partir de la distribución residual normalizada $p'(x) = \frac{\max(0, p(x) - q(x))}{\sum_y \max(0, p(y) - q(y))}$.
- **FR-5 (State-Driven)**: MIENTRAS la tasa histórica de aceptación $\alpha = \frac{\text{tokens\_aceptados}}{\text{tokens\_especulados}}$ oscile, EL SISTEMA modulará dinámicamente la profundidad y el factor de ramificación del árbol especulativo para maximizar la aceleración neta sin desperdiciar cómputo.
- **FR-6 (Permanent / Ubiquitous)**: EL SISTEMA garantizará que cada ciclo de verificación produzca estrictamente $\ge 1$ token aceptado hacia la secuencia final generada, con divergencia de Kullback-Leibler nula ($D_{KL} = 0.0$) respecto a la distribución del modelo target.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1755 Construcción de Árbol Especulativo y Aplanamiento Posicional
  DADO un modelo draft ligero y un prefijo de contexto de 16 tokens
  CUANDO se generan candidatos especulativos organizados en una topología de árbol de profundidad 3 y ramificación 2
  ENTONCES el sistema aplana el árbol en un tensor 1D de tokens candidatos
  Y genera un vector de posiciones correspondiente a la profundidad exacta de cada nodo en el árbol.

ESCENARIO: BDD-1756 Síntesis de Máscara de Atención Causal 2D de Árbol
  DADO un árbol especulativo con K nodos indexados
  CUANDO se sintetiza la matriz de atención causal 2D M
  ENTONCES M[i, j] es 1 si el nodo j es ancestro del nodo i o j == i
  Y M[i, j] es 0 para cualquier nodo j que no pertenezca al linaje ancestral directo de i.

ESCENARIO: BDD-1757 Muestreo con Rechazo Modificado y Cero Divergencia de Distribución
  DADO un conjunto de probabilidades de draft q(x) y target p(x) para un nodo candidato
  CUANDO el valor pseudoaleatorio es menor o igual a p(x) / q(x)
  ENTONCES el token candidato es aceptado atómicamente
  Y si es rechazado, el token emitido proviene de la distribución residual p'(x) con suma total igual a 1.0.

ESCENARIO: BDD-1758 Selección de Camino Más Largo Aceptado y Progreso Garantizado
  DADO un árbol evaluado por el modelo target donde múltiples ramas fueron parcialmente aceptadas
  CUANDO el algoritmo de recorrido topológico busca la trayectoria óptima
  ENTONCES selecciona la rama con el mayor número de tokens consecutivos aceptados
  Y concatena exactamente un token de corrección o extensión, garantizando >= 1 token nuevo por ciclo.

ESCENARIO: BDD-1759 Modulación Dinámica de Topología según Tasa de Aceptación Alpha
  DADO un historial de inferencia con tasa de aceptación alpha variable
  CUANDO alpha >= 0.75, el sistema incrementa la profundidad o ramificación del árbol
  Y cuando alpha < 0.40, el sistema contrae el árbol a una estructura lineal mínima para evitar sobrecarga.

ESCENARIO: BDD-1760 Identidad de Salida y Aceleración Especulativa
  DADO un proceso de generación comparado contra decodificación auto-regresiva estándar
  CUANDO se mide la secuencia generada y la latencia
  ENTONCES la distribución de tokens generados es estadísticamente indistinguible de la referencia (DKL = 0.0)
  Y la aceleración efectiva supera 2.0x en escenarios de alta coherencia.
```
