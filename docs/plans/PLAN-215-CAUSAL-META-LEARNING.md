# PLAN-215: Autonomous Causal Meta-Learning & Counterfactual Policy Engine

- **Change ID**: `CHANGE-215`
- **Spec ID**: `SPEC-353`
- **Component**: `eos-system-control-plane`
- **Status**: `APPROVED`
- **Date**: 2026-11-19
- **Author**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## 1. Architectural Strategy & Clean Hexagonal Isolation

The Causal Meta-Learning & Counterfactual Policy Engine is structured under strict Layer-0 Hexagonal Isolation:

```
+----------------------------------------------------------------------------------+
|                            Presentation & CLI Layer                              |
|           bin/commands/cliCausalMetaLearning.mjs / MCP Phase 8 Tool              |
+----------------------------------------------------------------------------------+
                                       |
                                       v
+----------------------------------------------------------------------------------+
|                               Application Layer                                  |
|         EosCausalPolicyMetaDistiller / Counterfactual Policy Governor            |
+----------------------------------------------------------------------------------+
                                       |
                                       v
+----------------------------------------------------------------------------------+
|                            Core Domain (Pure Layer-0)                            |
|    EosStructuralCausalModel · EosDoCalculusEngine · EosCounterfactualReasoner    |
|               (0 runtime dependencies · Integer/Rational Math)                   |
+----------------------------------------------------------------------------------+
```

---

## 2. Mathematical Formalization

### I. Structural Causal Model (SCM)

An SCM is a 4-tuple $\mathcal{M} = \langle U, V, F, P(U) \rangle$:

- $U = \{U_1, \dots, U_m\}$: Background exogenous variables.
- $V = \{V_1, \dots, V_n\}$: Observable endogenous variables.
- $F = \{f_1, \dots, f_n\}$: Deterministic structural functions where $v_i := f_i(\text{PA}_i, u_i)$.
- $P(U)$: Prior probability distribution over exogenous noise.

### II. Interventional Graph Surgery ($do(X = x)$)

Applying $do(X = x)$ replaces the structural assignment $X := f_X(\text{PA}_X, U_X)$ with the constant assignment $X := x$. In the causal graph $G$, all incoming arrows into $X$ are mutilated, creating the sub-model $\mathcal{M}_x$ on graph $G_{\overline{X}}$.

### III. The Backdoor Criterion

A set of variables $Z$ satisfies the Backdoor Criterion relative to an ordered pair of variables $(X, Y)$ in a DAG $G$ if:

1. No node in $Z$ is a descendant of $X$.
2. $Z$ blocks every path between $X$ and $Y$ that contains an arrow into $X$.

If $Z$ satisfies the Backdoor Criterion, the causal effect of $X$ on $Y$ is identifiable:
$$P(Y = y \mid do(X = x)) = \sum_{z} P(Y = y \mid X = x, Z = z) P(Z = z)$$

### IV. Three-Step Algorithmic Counterfactuals

Given observational evidence $e = (X = x, Y = y)$:

1. **Abduction**: Update $P(U)$ to obtain $P(U \mid e)$ by inverting structural equations.
2. **Action**: Mutilate the structural equation for $X$, setting $X := x'$ to form sub-model $\mathcal{M}_{x'}$.
3. **Prediction**: Compute the counterfactual outcome $Y_{x'}$ by evaluating $\mathcal{M}_{x'}$ under $P(U \mid e)$.

---

## 3. Rejected Alternatives & Trade-Offs

1. **Rejected: External Python/R Causal Discovery Libraries (DoWhy, causal-learn)**
   - _Reason_: Requires heavy Python runtimes, C++ compiler toolchains, and breaks Layer-0 zero-dependency hermeticity.
2. **Rejected: Purely Statistical Linear Regression / Multi-Layer Perceptrons**
   - _Reason_: Collapses interventions to conditional probabilities ($P(Y \mid X)$), suffering from unmitigated confounding bias and failure on out-of-distribution shifts.
3. **Rejected: Non-deterministic Monte Carlo Gibbs Sampling for Counterfactuals**
   - _Reason_: Introduces non-deterministic random state; violates epistemic reproducibility and automated test assertion contracts.
