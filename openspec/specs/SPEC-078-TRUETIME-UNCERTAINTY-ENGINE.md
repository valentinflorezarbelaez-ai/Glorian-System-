# SPEC-078 — TRUETIME UNCERTAINTY & COMMIT-WAIT LINEARIZABILITY ENGINE
**Version**: 70.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-062  
**Architecture Decision Record**: ADR-083  
**Domain Layer**: Layer-0 System Core (`src/core/eosTrueTimeEngine.ts`)

---

## 1. Executive Summary
Inspired by Google Spanner globally distributed database architecture and TrueTime hardware synchronization, SPEC-078 formalizes the EOS TrueTime Uncertainty Engine. Operating under Layer-0 purity with zero external npm dependencies, the engine replaces naive scalar wall-clock timestamps with bounded time intervals $T = [t_{\text{earliest}}, t_{\text{latest}}]$ of uncertainty $2\epsilon$. It provides the foundational **Commit-Wait** rule: guaranteeing that for any two distributed transactions $T_1$ and $T_2$, if $T_2$ initiates after $T_1$ commits in the real physical world, then $s(T_1) < s(T_2)$ without requiring a centralized coordinator lock.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-274: Bounded Time Interval Generation with Dynamic Uncertainty Epsilon
**Ubiquitous / Permanent**: EL SISTEMA computará el tiempo actual mediante una tupla de intervalo inmutable $[t_{\text{earliest}}, t_{\text{latest}}]$ donde $t_{\text{latest}} - t_{\text{earliest}} = 2\epsilon$, acotando la incertidumbre de reloj entre cotas físicas verificadas.

### FR-275: Predicados No Bloqueantes TrueTime Before y After
**Ubiquitous / Permanent**: EL SISTEMA evaluará `TrueTime.after(t)` como verdadero únicamente cuando $t < t_{\text{earliest}}$, y `TrueTime.before(t)` únicamente cuando $t > t_{\text{latest}}$, garantizando certidumbre absoluta de ordenamiento causal.

### FR-276: Coordinación y Garantía de Commit-Wait
**Event-Driven**: CUANDO una transacción distribuida $T_1$ asigne su timestamp de commit $s = t_{\text{latest}}$, EL SISTEMA suspenderá la liberación de bloqueos hasta que `TrueTime.after(s)` sea verdadero, garantizando linearizabilidad estricta respecto a cualquier transacción subsecuente.

### FR-277: Detección de Desviación Anómala de Reloj (Clock Drift)
**State-Driven**: MIENTRAS el motor esté en ejecución, SI la incertidumbre observada $\epsilon$ excede el umbral máximo de seguridad tolerado ($\epsilon > \epsilon_{\text{max}}$), ENTONCES EL SISTEMA activará el estado de alerta `CLOCK_DRIFT_UNSAFE` y rechazará transacciones que dependan de linearizabilidad.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-231: Bounded Time Interval and Invariant Monotonicity
```gherkin
ESCENARIO: Generación de Intervalo TrueTime con Incertidumbre Acotada
  DADO un motor TrueTime inicializado con incertidumbre epsilon de 5ms
  CUANDO se consulta el tiempo actual
  ENTONCES el intervalo resultante cumple estrictamente que earliest <= now <= latest
  Y la diferencia entre latest y earliest es exactamente 2 * epsilon
```

### BDD-232: Commit-Wait Strict Linearizability Guarantee
```gherkin
ESCENARIO: Garantía de Ordenamiento Causal con Commit-Wait
  DADO una transacción T1 con timestamp de commit asignado en t.latest
  CUANDO se ejecuta la espera de commit-wait para T1
  ENTONCES cualquier consulta posterior iniciada en T2 obtiene un timestamp estrictamente mayor
  Y no existe posibilidad de lectura desactualizada (stale read)
```
