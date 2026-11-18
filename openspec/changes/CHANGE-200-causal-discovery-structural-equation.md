# CHANGE-200: Autonomous Causal Discovery & Structural Equation Modeling Engine (SCM)

## 1. Intent & Scope

Purely correlational statistics and predictive models cannot distinguish whether $X$ causes $Y$ or a hidden/observed confounder $Z$ drives both ($X \leftarrow Z \to Y$), nor can they answer counterfactual questions ("what would metric $Y$ have been in incident #42 had we deployed configuration $X = x'$ instead of $X = x$?").

`CHANGE-200` (`SPEC-338`) introduces `EosCausalStructuralModelCore`, equipping Glorian System with Judea Pearl's causal hierarchy:

1. **Rung 1 — Association ($\mathbb{P}(Y \mid X)$)**: $d$-separation via ancestral moralization / Bayes-Ball, distinguishing confounders from colliders.
2. **Rung 2 — Intervention ($\mathbb{P}(Y \mid \text{do}(X := x))$)**: Graph mutilation $\mathcal{G}_{\overline{X}}$, backdoor criterion verification, and OLS backdoor adjustment recovering exact interventional ATE from confounded observational samples.
3. **Rung 3 — Counterfactuals ($\mathbb{P}(Y\_{x'} \mid X=x, Y=y)$)**: Exact 3-step _Abduction-Action-Prediction_ solver over structural equation models.
4. **TLA+ Model 82** (`CausalDoCalculusScm`) verified with Leslie Lamport's TLC.

## 2. Impacted Components

- `src/core/eosCausalStructuralModel.ts`: core SCM, $d$-separation, $\text{do}$-calculus & counterfactual engine.
- `src/core/eosCausalStructuralModel.types.ts`: domain types.
- `src/core/index.ts`: module exports.
- `bin/commands/cliCausalStructuralModel.mjs`: CLI subdispatcher (`toolchain:scm:`).
- `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md`.
- `docs/formal/CausalDoCalculusScm.tla` & `.cfg`, `scripts/run-tlc.mjs`.
- `test/eosCausalStructuralModel.test.mjs` (BDD-1803..1808).

## 3. Risk Assessment

- **Risk 1**: Conditioning on a collider or post-treatment descendant introduces Berkson's selection bias.
  - _Mitigation_: Backdoor criterion verifier explicitly rejects any conditioning set $Z$ that contains descendants of treatment $X$ or opens a collider path.
- **Risk 2**: Cyclic causal graphs invalidating recursive structural evaluation.
  - _Mitigation_: Topological sort / reachability guard rejects any edge that creates a directed cycle with `SCM_CYCLE_DETECTED`.
