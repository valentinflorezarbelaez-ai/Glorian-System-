# SPEC-349: Self-Synthesizing Neural-Symbolic Prover & Inductive Invariant Engine

- **Spec ID**: `SPEC-349`
- **Change ID**: `CHANGE-211`
- **Status**: `SPECIFICATION_APPROVED`
- **Domain**: Automated Formal Reasoning & Invariant Synthesis
- **Standard**: IEEE 830 / ISO 29148 / EARS

---

## 1. Functional Requirements (EARS Syntax)

- **FR-1873 (Propositional SAT & CDCL Engine)**:
  `EL SISTEMA DEBE` proveer un motor SAT en forma clausal CNF con propagación unitaria booleana, literales vigilados (2-watched literals) y aprendizaje de lemas conflictivos (conflict-driven clause learning).

- **FR-1874 (Linear Integer Arithmetic Relaxation)**:
  `CUANDO` se evalúan restricciones aritméticas sobre variables enteras de transición, `EL SISTEMA DEBE` inferir cotas inferiores y superiores deterministas mediante propagación de intervalos e hiperplanos de corte.

- **FR-1875 (Trace-Guided Invariant Induction)**:
  `CUANDO` se ingiere un conjunto de trazas de ejecución de un autómata o bucle, `EL SISTEMA DEBE` inducir predicados candidatos combinando conjunciones de cotas de variables, relaciones de orden e implicaciones lógicas.

- **FR-1876 (Inductive Invariant Verification Triple)**:
  `CUANDO` se evalúa un predicado invariante candidato $I$, `EL SISTEMA DEBE` verificar formalmente las tres condiciones fundamentales:
  1. $\text{Init}(s) \implies I(s)$
  2. $I(s) \land \text{Next}(s, s') \implies I(s')$
  3. $I(s) \implies \text{Safety}(s)$

- **FR-1877 (Counterexample-Guided Abstraction Refinement - CEGAR)**:
  `SI` un candidato a invariante falla la condición de consecutividad produciendo un contraejemplo espurio, `ENTONCES EL SISTEMA DEBE` refinar el predicado agregando cláusulas de separación disyuntivas hasta restaurar la inductividad.

- **FR-1878 (Deterministic Proof Certificate & Tooling)**:
  `EL SISTEMA DEBE` generar un recibo formal de prueba matemática `NEURAL_SYMBOLIC_PROVER_RECEIPT.json` con hash criptográfico SHA-256 e integrarlo en la CLI `toolchain:prover:*` y la herramienta MCP `eos_neural_symbolic_prover_audit`.

---

## 2. BDD Acceptance Criteria

```gherkin
ESCENARIO: BDD-1873 DPLL / CDCL Propositional SAT Solver Core
  DADO un conjunto de cláusulas CNF con asignaciones parciales
  CUANDO se ejecuta la propagación unitaria y aprendizaje de cláusulas
  ENTONCES el solver identifica deterministamente satisfacibilidad (SAT) o insatisfacibilidad (UNSAT) sin recursión no acotada.

ESCENARIO: BDD-1874 Linear Integer Bound & Interval Propagation
  DADO un sistema de desigualdades lineales x >= L, x <= U, x + y <= K
  CUANDO se propagan restricciones de intervalo en las variables
  ENTONCES el motor infiere las cotas más ajustadas o detecta contradicción vacía en tiempo O(V * E).

ESCENARIO: BDD-1875 Trace-Based Predicate Candidate Induction
  DADO un historial de estados de ejecución discretos de un protocolo
  CUANDO el motor analiza correlaciones y límites numéricos de las variables
  ENTONCES sintetiza predicados atómicos candidatos sin requerir heurísticas externas.

ESCENARIO: BDD-1876 Inductive Invariant Verification Triple
  DADO un sistema con Init, Next, y propiedad de Safety
  CUANDO se evalúa un invariante inductivo I
  ENTONCES el verificador prueba la iniciación, consecutividad y adecuación de seguridad.

ESCENARIO: BDD-1877 CEGAR Refinement Loop
  DADO un invariante no inductivo que genera un estado espurio alcanzable
  CUANDO el bucle CEGAR extrae el contraejemplo y sintetiza una cláusula de exclusión
  ENTONCES el predicado refinado satisface la inductividad y bloquea el estado espurio.

ESCENARIO: BDD-1878 Self-Auditing Prover Harness & Receipt Emission
  DADO el plano de ejecución del demostrador neural-simbólico
  CUANDO se ejecuta la suite de auditoría formal
  ENTONCES emite el recibo NEURAL_SYMBOLIC_PROVER_RECEIPT.json con verificación al 100% y digest SHA-256.
```
