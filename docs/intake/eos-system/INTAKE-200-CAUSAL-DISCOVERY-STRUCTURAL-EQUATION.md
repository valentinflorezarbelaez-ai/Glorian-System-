# EOS Intake & Context Record: INTAKE-200 (SPEC-338 / CHANGE-200)

## 1. Context & Business Intent

- **System**: Glorian System (Control Plane & Layer-0 Core Engine)
- **Domain**: Pearl's Structural Causal Models (SCM), $d$-Separation, Backdoor Adjustment, $\text{do}$-Calculus Interventions & Three-Step Counterfactual Reasoning
- **Objective**: Implement a pure Layer-0 TypeScript engine (`EosCausalStructuralModelCore`) with zero external runtime dependencies that represents directed acyclic causal graphs (DAGs) with structural equations $X_i = f_i(\text{PA}_i) + U_i$, enforces DAG acyclicity fail-closed, tests graphical $d$-separation via Bayes-Ball / ancestral moralization, identifies valid backdoor adjustment sets separating spurious confounding from true causal effects, performs mutilated-graph $\text{do}(X := x)$ surgical interventions, and executes Judea Pearl's 3-step counterfactual inference (_Abduction $\to$ Action $\to$ Prediction_).
- **Reference Material**:
  - Judea Pearl: _Causality: Models, Reasoning, and Inference_ (2nd ed., Cambridge University Press, 2009).
  - Peters, Janzing & Schölkopf: _Elements of Causal Inference: Foundations and Learning Algorithms_ (MIT Press, 2017).
  - Spirtes, Glymour & Scheines: _Causation, Prediction, and Search_ (MIT Press, 2000).
  - Ross Shachter: _Bayes-Ball: The Rational Pastime for Determining Irrelevance and Requisite Information in Belief Networks_ (UAI, 1998).

## 2. Core Functional Requirements

1. **Acyclic Structural Causal Model (SCM) Construction**: Register endogenous variables, structural linear/nonlinear equations, and directed causal edges, rejecting any cycle introduction fail-closed (`SCM_CYCLE_DETECTED`).
2. **Exact $d$-Separation & Backdoor Criterion Identification**: Determine whether node set $Z$ $d$-separates $X$ and $Y$ (handling chains, forks/confounders, and collider v-structures $A \to C \leftarrow B$ where conditioning on a collider or its descendant opens the path), and verify/enumerate valid backdoor adjustment sets.
3. **Graph Mutilation & $\text{do}(X := x)$ Interventional Distribution**: Construct the mutilated causal graph $\mathcal{G}_{\overline{X}}$ by severing all incoming edges into $X$, clamping $X := x$, and propagating interventional expectations and Average Treatment Effects ($\text{ATE} = \mathbb{E}[Y \mid \text{do}(X=1)] - \mathbb{E}[Y \mid \text{do}(X=0)]$).
4. **Observational vs Interventional Confounding De-biasing**: Demonstrate and correct Simpson's / confounding bias where naive observational regression $\mathbb{E}[Y \mid X=x]$ diverges from $\mathbb{E}[Y \mid \text{do}(X=x)]$, proving that backdoor-adjusted estimation recovers the true interventional ATE.
5. **Three-Step Counterfactual Inference ($Y\_{X \leftarrow x'}(u)$)**: Given factual evidence $E = e$, (1) _Abduction_: invert structural equations to recover exogenous noise $u$; (2) _Action_: mutilate the SCM with $\text{do}(X := x')$; (3) _Prediction_: propagate $u$ through the mutilated SCM to compute the exact unit-level counterfactual outcome.
6. **Formal Model (TLA+ Model 82)**: `CausalDoCalculusScm.tla` verified with TLC.

## 3. Epistemic Status & Constraints

- **Epistemic State**: `INTAKE_RECORDED`
- **Dependencies**: `dependencies: {}` (zero external npm packages)
- **Module Size**: `<= 800` lines, `>= 12` lines headroom (`SPEC-250`)
- **CLI Parity**: 100% catalog parity verified by `hygiene:audit`
