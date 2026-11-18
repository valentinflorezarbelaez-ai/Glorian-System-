# SPEC-338: Autonomous Causal Discovery & Structural Equation Modeling Engine (SCM)

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Error / Unwanted Condition)**: SI se intenta registrar una arista dirigida $u \to v$ que introduce un ciclo dirigido en el grafo causal, ENTONCES EL SISTEMA rechaza la operación de inmediato con el código `SCM_CYCLE_DETECTED`, preservando el invariante de aciclicidad (DAG).
- **FR-2 (Event-Driven)**: CUANDO se consulta si un conjunto de variables de condicionamiento $Z$ $d$-separa $X$ de $Y$ en el DAG causal, EL SISTEMA aplica moralización ancestral sobre $\text{Anc}(X \cup Y \cup Z)$ y bloquea caminos a través de cadenas y bifurcaciones condicionadas, mientras detecta la apertura de colisionadores ($A \to C \leftarrow B$) cuando $C$ o sus descendientes están en $Z$.
- **FR-3 (Event-Driven)**: CUANDO se verifica o busca un conjunto de ajuste de puerta trasera (_Backdoor Criterion_) para el par $(X, Y)$, EL SISTEMA exige que ningún nodo en $Z$ sea descendiente de $X$ y que $Z$ bloquee todos los caminos de puerta trasera entre $X$ e $Y$ que comienzan con una flecha hacia $X$.
- **FR-4 (Event-Driven)**: CUANDO se aplica el operador de intervención quirúrgica $\text{do}(X := x)$, EL SISTEMA construye el grafo mutilado $\mathcal{G}_{\overline{X}}$ eliminando todas las aristas entrantes a $X$, fija $X = x$ y calcula el Efecto Medio del Tratamiento ($\text{ATE}$) libre de sesgo de confusión.
- **FR-5 (Event-Driven)**: CUANDO se solicita una inferencia contrafáctica $\mathbb{E}[Y_{X \leftarrow x'} \mid E = e]$ sobre una observación factual $e$, EL SISTEMA ejecuta los tres pasos de Pearl: (1) _Abducción_ de las variables exógenas $U$ a partir de $e$, (2) _Acción_ mutilando el modelo con $\text{do}(X := x')$, y (3) _Predicción_ propagando $U$ en orden topológico.
- **FR-6 (Ubiquitous)**: EL SISTEMA expone una auditoría determinista que certifica la aciclicidad DAG, la exactitud de $d$-separación en colisionadores, la equivalencia entre ajuste de puerta trasera e intervención $\text{do}(X)$, la consistencia contrafáctica ($X = x \implies Y_x = Y$) y emite un recibo firmado con SHA-256 en `docs/evidence/CAUSAL_SCM_RECEIPT.json`.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1803 Construcción de Grafo Causal Acíclico (DAG) y Rechazo Fail-Closed de Ciclos
  DADO un modelo causal estructural con nodos registrados Z -> X -> M -> Y y Z -> Y
  CUANDO se solicita el orden topológico del grafo y posteriormente se intenta añadir la arista Y -> Z
  ENTONCES el orden topológico ubica a cada padre antes de sus hijos
  Y la arista Y -> Z es rechazada inmediatamente con código SCM_CYCLE_DETECTED.

ESCENARIO: BDD-1804 Evaluación Exacta de d-Separación en Cadenas, Confusores y Colisionadores (Berkson)
  DADO un DAG con bifurcación X <- Z -> Y y un colisionador X -> C <- Y con descendiente C -> D
  CUANDO se evalúa d-separación entre X e Y bajo diferentes conjuntos de condicionamiento
  ENTONCES {Z} bloquea el camino de confusión cuando no hay colisionador, pero {Z, C} o {Z, D} abre el camino del colisionador
  Y el verificador identifica correctamente la apertura inducida por condicionar en C o en su descendiente D.

ESCENARIO: BDD-1805 Criterio de Puerta Trasera (Backdoor Criterion) y Eliminación de Sesgo de Confusión
  DADO un SCM lineal donde el confusor Z afecta tanto al tratamiento X como al resultado Y (Z -> X, Z -> Y, X -> Y)
  CUANDO se compara la regresión observacional ingenua E[Y|X] con la estimación ajustada por puerta trasera controlando por {Z}
  ENTONCES la regresión ingenua sufre sesgo de confusión significativo
  Y el estimador ajustado por puerta trasera recupera el efecto causal verdadero coincidiendo con E[Y|do(X=1)] - E[Y|do(X=0)].

ESCENARIO: BDD-1806 Cirugía de Grafo Mutilado e Intervención Quirúrgica do(X := x)
  DADO un SCM con ecuaciones estructurales acopladas
  CUANDO se ejecuta la intervención do(X := x)
  ENTONCES todas las aristas entrantes a X son eliminadas en el modelo mutilado mientras las ecuaciones aguas abajo permanecen intactas
  Y el estado de los ancestros de X permanece invariante ante la intervención sobre X.

ESCENARIO: BDD-1807 Razonamiento Contrafáctico en Tres Pasos de Pearl (Abducción, Acción y Predicción)
  DADO un individuo con evidencia factual observada (Z = z, X = x, Y = y)
  CUANDO se consulta qué valor habría tomado Y si X hubiera sido fijado contrafácticamente a x'
  ENTONCES el paso de abducción recupera exactamente las perturbaciones exógenas u del individuo
  Y el paso de predicción sobre el modelo mutilado do(X := x') calcula Y_{X <- x'}(u) satisfaciendo el axioma de consistencia Y_{X <- x}(u) = y.

ESCENARIO: BDD-1808 Auditoría Determinista y Recibo Criptográfico SHA-256
  DADO el motor EosCausalStructuralModelCore
  CUANDO se ejecuta audit()
  ENTONCES todas las verificaciones (dagAcyclicEnforced, colliderDsepVerified, backdoorDeconfounded, doInterventionExact, counterfactualConsistent) son true
  Y se emite el recibo firmado en docs/evidence/CAUSAL_SCM_RECEIPT.json.
```
