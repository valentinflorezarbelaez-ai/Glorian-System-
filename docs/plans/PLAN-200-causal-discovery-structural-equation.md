# PLAN-200: Autonomous Causal Discovery & Structural Equation Modeling Engine (SCM)

## 1. Architecture

```
 ┌────────────────────────────────────────────────────────────────────┐
 │           EosCausalStructuralModelCore (SPEC-338)                  │
 │                                                                    │
 │  ┌──────────────────────────┐    ┌──────────────────────────────┐  │
 │  │ DAG & Structural Eqns    │    │ Ancestral Moralization d-Sep │  │
 │  │ • Topological ordering   │───►│ • Confounder blocking        │  │
 │  │ • Cycle guard fail-closed│    │ • Collider v-structure check │  │
 │  └────────────┬─────────────┘    └──────────────┬───────────────┘  │
 │               │                                 │                  │
 │               ▼                                 ▼                  │
 │  ┌──────────────────────────┐    ┌──────────────────────────────┐  │
 │  │ Rung 2: do(X := x)       │    │ Rung 3: Counterfactuals      │  │
 │  │ • Graph mutilation G_X̅   │    │ • Step 1: Abduction (U)      │  │
 │  │ • Backdoor OLS adjustment│    │ • Step 2: Action (do(X:=x')) │  │
 │  └──────────────────────────┘    │ • Step 3: Prediction (Y_x')  │  │
 │                                  └──────────────────────────────┘  │
 └────────────────────────────────────────────────────────────────────┘
```

## 2. Architecture Decision Records

### ADR-200-001: Lauritzen-Spiegelhalter Ancestral Moralization for Exact $d$-Separation

- **Context**: Testing $d$-separation by enumerating all simple paths and checking each triple's chain/fork/collider status can miss subtle descendant-of-collider activations.
- **Decision**: Use the exact Lauritzen-Spiegelhalter ancestral moralization theorem: $X \perp_d Y \mid Z$ in $\mathcal{G}$ if and only if $Z$ separates $X$ and $Y$ in the undirected moral graph $(\mathcal{G}_{\text{Anc}(X \cup Y \cup Z)})^m$, formed by restricting $\mathcal{G}$ to $\text{Anc}(X \cup Y \cup Z)$ and marrying all co-parents that share a child in that ancestral subgraph.
- **Rejected Alternative**: Naive undirected graph separation, which fails completely on collider v-structures ($A \to C \leftarrow B$).

### ADR-200-002: Explicit Graph Mutilation $\mathcal{G}_{\overline{X}}$ for $\text{do}(X := x)$

- **Context**: Observational conditioning $\mathbb{P}(Y \mid X = x)$ propagates information backward to $X$'s ancestors, confounding causal estimates.
- **Decision**: Implement $\text{do}(X := x)$ as a pure structural clone that severs all parent links into $X$ and replaces $f_X(\text{PA}_X, U_X)$ with the constant function $X = x$, leaving all other structural equations invariant (autonomy/modularity principle).
- **Rejected Alternative**: Modifying observational weights in place without severing incoming edges.

### ADR-200-003: Exact Topological Residual Inversion for Counterfactual Abduction

- **Context**: Rung 3 counterfactual queries require unit-level exogenous noise values $U = u$ consistent with factual observations $E = e$.
- **Decision**: Because additive structural models satisfy $X_i = f_i(\text{PA}_i) + U_i$ in topological order, abduction recovers $u_i = e_i - f_i(\text{pa}_i(e))$ deterministically in $\mathcal{O}(V + E)$ time, guaranteeing Pearl's consistency axiom $X(u) = x \implies Y_{X \leftarrow x}(u) = Y(u)$.
- **Rejected Alternative**: Monte Carlo rejection sampling over prior noise distributions, which is slow and approximate for continuous variables.
