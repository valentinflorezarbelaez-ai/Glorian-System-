# SPEC-335: Threshold Secret Sharing & Ring-LWE Homomorphic Secure Aggregation Engine (PQ-MPC)

> **Scope notice**: reference implementation. Default parameters are not secure; see `INTAKE-197` §3.

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO se solicita dividir un secreto `s ∈ F_q` en `N` participaciones con umbral `T` (`2 ≤ T ≤ N ≤ 64`), EL SISTEMA genera un polinomio aleatorio de grado `T-1` con término independiente `s`, evalúa en `x = 1..N` y emite cada participación con un compromiso SHA-256.
- **FR-2 (Error / Unwanted Condition)**: SI se intenta reconstruir con menos de `T` participaciones, con abscisas duplicadas o con una participación cuyo compromiso SHA-256 no coincide, ENTONCES EL SISTEMA rechaza la operación con un código de error explícito (`PQMPC_BELOW_THRESHOLD`, `PQMPC_DUPLICATE_SHARE`, `PQMPC_COMMITMENT_MISMATCH`) sin revelar valores parciales.
- **FR-3 (Event-Driven)**: CUANDO se cifra un vector de enteros `m_j ∈ [0, t)` de longitud `≤ n`, EL SISTEMA produce un cifrado Ring-LWE `(c0, c1)` sobre `Z_q[x]/(x^n + 1)` usando aleatoriedad fresca, de modo que dos cifrados del mismo vector difieren.
- **FR-4 (Event-Driven)**: CUANDO se suman cifrados o se multiplica un cifrado por un escalar público `k < t`, EL SISTEMA devuelve un cifrado cuyo descifrado es la suma (o el producto) componente a componente módulo `t`.
- **FR-5 (State-Driven)**: MIENTRAS la clave secreta del anillo permanezca compartida entre `N` custodios con umbral `T`, EL SISTEMA solo produce el texto claro agregado cuando se combinan al menos `T` descifrados parciales distintos mediante coeficientes de Lagrange, y cualquier subconjunto válido de `T` custodios produce el mismo resultado.
- **FR-6 (Ubiquitous)**: EL SISTEMA expone una auditoría que ejecuta autopruebas de corrección (reparto/reconstrucción, cifrado/descifrado, agregación homomórfica, rechazo bajo umbral, detección de manipulación) y emite un recibo con digest SHA-256 y un aviso explícito de alcance de seguridad.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1785 Reparto y Reconstrucción Shamir T-de-N
  DADO un secreto s y parámetros N = 5, T = 3
  CUANDO se reparte el secreto y se reconstruye con cualquier subconjunto de 3 participaciones
  ENTONCES el valor reconstruido es exactamente s
  Y la reconstrucción con 2 participaciones es rechazada con PQMPC_BELOW_THRESHOLD.

ESCENARIO: BDD-1786 Detección de Participaciones Manipuladas
  DADO un conjunto de participaciones con compromisos SHA-256
  CUANDO se altera el valor y de una participación
  ENTONCES la reconstrucción es rechazada con PQMPC_COMMITMENT_MISMATCH
  Y las abscisas duplicadas son rechazadas con PQMPC_DUPLICATE_SHARE.

ESCENARIO: BDD-1787 Cifrado Ring-LWE Aleatorizado y Descifrado Correcto
  DADO un conjunto de claves umbral generado para N = 5, T = 3
  CUANDO se cifra dos veces el mismo vector
  ENTONCES los cifrados difieren
  Y el descifrado umbral de cada uno recupera el vector original.

ESCENARIO: BDD-1788 Agregación Homomórfica Aditiva y Multiplicación Escalar
  DADO cinco participantes con vectores privados
  CUANDO se suman sus cifrados y se multiplica el agregado por un escalar público
  ENTONCES el descifrado umbral es igual a la suma escalada componente a componente módulo t.

ESCENARIO: BDD-1789 Descifrado Umbral con Tolerancia a Ausencias
  DADO un agregado cifrado y cinco custodios de participaciones de clave
  CUANDO tres custodios cualesquiera aportan descifrados parciales
  ENTONCES todos los subconjuntos de tres producen el mismo agregado
  Y dos descifrados parciales son rechazados con PQMPC_BELOW_THRESHOLD.

ESCENARIO: BDD-1790 Auditoría, Determinismo por Semilla y Validación de Parámetros
  DADO dos motores inicializados con la misma semilla
  CUANDO se ejecuta la auditoría
  ENTONCES ambos recibos reportan todas las autopruebas en true con digests idénticos y securityNotice presente
  Y parámetros inválidos (grado no potencia de 2, T > N, T < 2) son rechazados.
```
