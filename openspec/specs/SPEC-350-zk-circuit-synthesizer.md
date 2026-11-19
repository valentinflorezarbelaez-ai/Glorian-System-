# SPEC-350: Autonomous Zero-Knowledge Circuit Synthesizer & Arithmetization Engine

- **Spec ID**: `SPEC-350`
- **Change ID**: `CHANGE-212`
- **Status**: `SPECIFICATION_APPROVED`
- **Domain**: Cryptographic Arithmetization & Zero-Knowledge Circuits
- **Standard**: IEEE 830 / ISO 29148 / EARS

---

## 1. Functional Requirements (EARS Syntax)

- **FR-1879 (Finite Field Arithmetic Operations)**:
  `EL SISTEMA DEBE` proveer operaciones completas de campo finito $\mathbb{F}_p$ (suma, resta, multiplicación, inverso modular Fermat y división) sobre el primo escalar BN254 mediante `BigInt` sin dependencias externas.

- **FR-1880 (R1CS Constraint Representation)**:
  `EL SISTEMA DEBE` estructurar las restricciones aritméticas en formato Rank-1 Constraint System (R1CS): $\langle A_i, w \rangle \cdot \langle B_i, w \rangle \equiv \langle C_i, w \rangle \pmod p$, donde $w$ es el vector de testigos con $w_0 = 1$.

- **FR-1881 (Boolean & Logic Gate Arithmetization)**:
  `CUANDO` se aplican restricciones booleanas o compuertas lógicas sobre variables, `EL SISTEMA DEBE` sintetizar restricciones cuadráticas equivalentes ($b \cdot (1 - b) \equiv 0 \pmod p$) para forzar integridad binaria.

- **FR-1882 (Multiplexer & Conditional Switching)**:
  `CUANDO` un circuito realiza una bifurcación condicional $\text{if } sel \text{ then } b \text{ else } a$, `EL SISTEMA DEBE` generar la restricción R1CS $sel \cdot (b - a) \equiv (out - a) \pmod p$.

- **FR-1883 (Witness Generation & Satisfiability Verification)**:
  `CUANDO` se proveen entradas públicas y privadas al circuito, `EL SISTEMA DEBE` computar el vector de testigos $w$ completo y verificar que el 100% de las restricciones R1CS se satisfacen estrictamente.

- **FR-1884 (Deterministic Proof Commitment & Tooling)**:
  `EL SISTEMA DEBE` generar un recibo formal `ZK_CIRCUIT_SYNTHESIZER_RECEIPT.json` con hash criptográfico SHA-256 e integrarlo en la CLI `toolchain:zkcirc:*` y la herramienta MCP `eos_zk_circuit_synthesizer_audit`.

---

## 2. BDD Acceptance Criteria

```gherkin
ESCENARIO: BDD-1879 Finite Field Arithmetic Invariants
  DADO el campo escalar BN254 F_p
  CUANDO se ejecutan adiciones, multiplicaciones e inversos modulares
  ENTONCES los resultados preservan la ley distributiva, asociativa y el inverso de Fermat (a * a^(p-2) = 1 mod p).

ESCENARIO: BDD-1880 R1CS Constraint Synthesis
  DADO un grafo de operaciones aritméticas (multiplicaciones intermedias y adiciones lineales)
  CUANDO el sintetizador compila el grafo a restricciones R1CS
  ENTONCES genera matrices esparsas A, B, C que capturan exactamente la relación funcional.

ESCENARIO: BDD-1881 Boolean Enforcement Constraint
  DADO un testigo asignado a una variable declarada como booleana
  CUANDO el valor es 0 o 1, la restricción R1CS se satisface; si el valor es >= 2, la restricción falla inmediatamente.

ESCENARIO: BDD-1882 Conditional Multiplexer Arithmetization
  DADO un selector booleano y dos valores de entrada
  CUANDO se sintetiza y evalúa la restricción de multiplexor
  ENTONCES la salida refleja exactamente la rama seleccionada y rechaza discrepancias.

ESCENARIO: BDD-1883 Automated Witness Synthesis & Full Verification
  DADO un circuito de verificación de pre-imagen criptográfica o computación acotada
  CUANDO se genera el testigo a partir de entradas válidas
  ENTONCES todas las restricciones R1CS evalúan a verdadero con residuo modular cero.

ESCENARIO: BDD-1884 Cryptographic Receipt & Self-Auditing Harness
  DADO el circuito y las restricciones evaluadas
  CUANDO se ejecuta la auditoría del sintetizador de circuitos ZK
  ENTONCES emite el recibo ZK_CIRCUIT_SYNTHESIZER_RECEIPT.json con verificación al 100% y digest SHA-256.
```
