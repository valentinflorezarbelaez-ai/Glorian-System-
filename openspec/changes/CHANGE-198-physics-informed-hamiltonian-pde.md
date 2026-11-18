# CHANGE-198: Autonomous Physics-Informed Neural Network (PINN) & Symplectic Hamiltonian PDE Integrator

## 1. Intent & Scope

Standard explicit time-stepping methods (such as forward Euler) violate phase-space volume conservation in Hamiltonian systems, causing unbounded artificial energy inflation over long trajectories, and unconstrained data-driven surrogates violate physical conservation laws away from training points.

`CHANGE-198` introduces `EosPhysicsInformedHamiltonianPdeCore` (`SPEC-336`), providing:

1. **Structure-Preserving Symplectic Integration**: 2nd-order Störmer-Verlet leapfrog and 4th-order Yoshida integrators for separable Hamiltonian systems $H(q,p) = T(p) + V(q)$ with phase-space Jacobian determinant verification ($\det J = 1$) and energy drift tracking.
2. **Fail-Closed CFL & Fourier Stability Governance**: Pre-flight verification of advection ($|c|\Delta t / \Delta x$) and diffusion ($\nu \Delta t / \Delta x^2$) stability numbers for finite-difference PDE time marching.
3. **Physics-Informed Collocation Residual & Boundary Loss Engine**: Analytical and central-difference evaluation of PDE residuals $\mathcal{R}_{\text{PDE}}$, boundary losses $\mathcal{L}_{\text{bc}}$ and initial condition losses $\mathcal{L}_{\text{ic}}$ over configurable collocation grids.
4. **Physics-Guided Collocation Solver**: Ridge-regularized least-squares collocation solver for Fourier-feature neural/spectral basis functions that minimizes composite physics loss $\mathcal{L}_{\text{PINN}}$.
5. **TLA+ Model 80** (`SymplecticHamiltonianPde`) verified with Leslie Lamport's TLC.

## 2. Impacted Components

- `src/core/eosPhysicsInformedHamiltonianPde.ts`: core engine.
- `src/core/eosPhysicsInformedHamiltonianPde.types.ts`: domain types.
- `src/core/index.ts`: module exports.
- `bin/commands/cliPhysicsInformedHamiltonianPde.mjs`: CLI subdispatcher (`toolchain:pinn:`).
- `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md`.
- `docs/formal/SymplecticHamiltonianPde.tla` & `.cfg`, `scripts/run-tlc.mjs`.
- `test/eosPhysicsInformedHamiltonianPde.test.mjs` (BDD-1791..1796).

## 3. Risk Assessment

- **Risk 1**: Numerical blow-up in explicit PDE stepping when $\Delta t$ violates CFL bounds.
  - _Mitigation_: Fail-closed `assessCflStability` guard throws `PINN_CFL_INSTABILITY` before any unstable time step executes.
- **Risk 2**: Ill-conditioned collocation design matrices for high-frequency basis functions.
  - _Mitigation_: Tikhonov ($L_2$ ridge) regularization $\lambda I$ with Cholesky / Gaussian elimination and pivoting.
