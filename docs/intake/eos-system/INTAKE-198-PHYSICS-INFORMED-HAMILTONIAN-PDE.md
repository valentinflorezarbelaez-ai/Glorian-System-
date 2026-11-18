# EOS Intake & Context Record: INTAKE-198 (SPEC-336 / CHANGE-198)

## 1. Context & Business Intent

- **System**: Glorian System (Control Plane & Layer-0 Core Engine)
- **Domain**: Symplectic Geometric Numerical Integration, Courant-Friedrichs-Lewy (CFL) Stability Governance & Physics-Informed Collocation PDE Solvers
- **Objective**: Implement a pure Layer-0 TypeScript engine (`EosPhysicsInformedHamiltonianPdeCore`) with zero external runtime dependencies that integrates Hamiltonian dynamical systems using structure-preserving symplectic schemes (Störmer-Verlet leapfrog and 4th-order Yoshida), enforces Courant-Friedrichs-Lewy (CFL) and Fourier diffusion stability bounds fail-closed, and evaluates/minimizes physics-informed differential collocation residuals ($\mathcal{L}_{\text{PINN}} = w_{\text{pde}}\mathcal{L}_{\text{pde}} + w_{\text{bc}}\mathcal{L}_{\text{bc}} + w_{\text{ic}}\mathcal{L}_{\text{ic}}$) over 1D advection-diffusion-reaction PDEs.
- **Reference Material**:
  - Raissi, Perdikaris & Karniadakis: _Physics-Informed Neural Networks: A Deep Learning Framework for Solving Forward and Inverse Problems Involving Nonlinear Partial Differential Equations_ (J. Comput. Phys., 2019).
  - Hairer, Lubich & Wanner: _Geometric Numerical Integration: Structure-Preserving Algorithms for Ordinary Differential Equations_ (Springer, 2006).
  - Haruo Yoshida: _Construction of higher order symplectic integrators_ (Physics Letters A, 1990).
  - Courant, Friedrichs & Lewy: _Über die partiellen Differenzengleichungen der mathematischen Physik_ (Math. Ann., 1928).

## 2. Core Functional Requirements

1. **Symplectic Hamiltonian Integrators**: Störmer-Verlet (2nd order) and Yoshida (4th order) integrators for separable Hamiltonians $H(q, p) = T(p) + V(q)$, preserving symplectic 2-form $\mathrm{d}q \wedge \mathrm{d}p$ and bounding energy drift $|\Delta H|$ orders of magnitude below explicit Euler.
2. **CFL & Diffusion Stability Guard**: Compute advection Courant number $C_{\text{adv}} = |c|\Delta t / \Delta x$ and diffusion Fourier number $C_{\text{diff}} = \nu \Delta t / \Delta x^2$, rejecting unstable step sizes with `PINN_CFL_INSTABILITY` before time marching.
3. **Physics-Informed Collocation Residual Evaluator**: Evaluate differential PDE residuals $\mathcal{R} = \partial_t u + c\,\partial_x u - \nu\,\partial_{xx} u - f(x,t)$, boundary condition losses $\mathcal{L}_{\text{bc}}$ and initial condition losses $\mathcal{L}_{\text{ic}}$ over collocation grids for Fourier-feature / radial basis ansätze.
4. **Physics-Informed Spectral / Collocation Solver**: Optimize ansatz parameters against interior collocation and boundary/initial constraints via damped Gauss-Newton / ridge regression, achieving monotonic physics loss reduction.
5. **Formal Model (TLA+ Model 80)**: `SymplecticHamiltonianPde.tla` verified with TLC proving CFL admission safety, bounded energy drift and monotonic loss reduction.

## 3. Epistemic Status & Constraints

- **Epistemic State**: `INTAKE_RECORDED`
- **Dependencies**: `dependencies: {}` (zero external npm packages)
- **Module Size**: `<= 800` lines, `>= 12` lines headroom (`SPEC-250`)
- **CLI Parity**: 100% catalog parity verified by `hygiene:audit`
