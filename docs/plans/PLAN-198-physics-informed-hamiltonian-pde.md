# PLAN-198: Autonomous Physics-Informed Neural Network (PINN) & Symplectic Hamiltonian PDE Integrator

## 1. Architecture

```
 ┌────────────────────────────────────────────────────────────────────┐
 │         EosPhysicsInformedHamiltonianPdeCore (SPEC-336)            │
 │                                                                    │
 │  ┌──────────────────────────┐    ┌──────────────────────────────┐  │
 │  │ Symplectic Integrators   │    │ CFL & Fourier Stability      │  │
 │  │ • Störmer-Verlet (2nd)   │    │ • C_adv = |c| dt / dx        │  │
 │  │ • Yoshida (4th order)    │    │ • C_diff = ν dt / dx²        │  │
 │  │ • Liouville det(J) = 1   │    │ • Fail-closed admission      │  │
 │  └────────────┬─────────────┘    └──────────────┬───────────────┘  │
 │               │                                 │                  │
 │               ▼                                 ▼                  │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │      Physics-Informed Collocation & Spectral Solver          │  │
 │  │  L_PINN = w_pde ||R_pde||² + w_bc ||R_bc||² + w_ic ||R_ic||² │  │
 │  └──────────────────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────────────────┘
```

## 2. Architecture Decision Records

### ADR-198-001: 4th-Order Yoshida Composition Over Classical 4th-Order Runge-Kutta (RK4)

- **Context**: While RK4 has 4th-order local truncation error, it is not symplectic; over long integrations of conservative Hamiltonian systems its energy drifts secularly.
- **Decision**: Compose three symmetric Störmer-Verlet sub-steps with Yoshida's real root weights $w_1 = 1 / (2 - 2^{1/3})$, $w_0 = -2^{1/3} / (2 - 2^{1/3})$. Each sub-step is a canonical transformation, so the composition preserves $\mathrm{d}q \wedge \mathrm{d}p$ exactly while achieving $\mathcal{O}(\Delta t^4)$ global accuracy.
- **Rejected Alternative**: Explicit RK4 — dissipates phase-space volume and exhibits linear energy drift over long horizons.

### ADR-198-002: Fail-Closed CFL + Fourier Stability Admission Before Explicit PDE Stepping

- **Context**: Forward-time central-space (FTCS) and upwind discretizations of advection-diffusion PDEs amplify high-wavenumber modes exponentially when $C_{\text{adv}} + 2 C_{\text{diff}} > 1$.
- **Decision**: Compute $C_{\text{adv}}$ and $C_{\text{diff}}$ prior to stepping and reject unstable configurations with `PINN_CFL_INSTABILITY`, reporting the maximum admissible time step $\Delta t_{\max}$.
- **Rejected Alternative**: Post-hoc NaN/Inf detection after numerical blow-up has already corrupted state.

### ADR-198-003: Analytical Basis Derivatives with Central-Difference Cross-Check for PINN Collocation

- **Context**: Evaluating $\partial_t u_\theta$, $\partial_x u_\theta$ and $\partial_{xx} u_\theta$ at collocation points requires accurate differential operators and fast parameter optimization without external autodiff dependencies.
- **Decision**: Represent $u_\theta(x, t) = \sum_{k} \theta_k \phi_k(x, t)$ over a Fourier-time-mode basis with exact analytical partial derivatives for linear collocation solves, paired with a general central-difference residual evaluator for arbitrary black-box functions $u(x, t)$.
- **Rejected Alternative**: First-order finite differences, whose $\mathcal{O}(h)$ truncation error dominates the PDE residual.
