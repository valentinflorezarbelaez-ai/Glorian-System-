# PLAN-199: Autonomous EUV Optical Proximity Correction & Inverse Lithography Wavefront Engine (EUV-OPC)

## 1. Architecture

```
 ┌────────────────────────────────────────────────────────────────────┐
 │       EosEuvInverseLithographyWavefrontCore (SPEC-337)             │
 │                                                                    │
 │  ┌──────────────────────────┐    ┌──────────────────────────────┐  │
 │  │ Zernike Pupil Metrology  │    │ Active Mirror Compensation   │  │
 │  │ • Z4, Z5, Z6, Z7, Z8, Z11│───►│ • Conjugate actuator stroke  │  │
 │  │ • Strehl S = exp(-σ_φ²)  │    │ • Restores S >= 0.80         │  │
 │  └────────────┬─────────────┘    └──────────────┬───────────────┘  │
 │               │                                 │                  │
 │               ▼                                 ▼                  │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │     2D Diffraction PSF & Sigmoid Resist Aerial Simulator     │  │
 │  │       I(x,y) = (K_PSF * M)(x,y)²,  R = σ(γ(I - I_th))        │  │
 │  └──────────────────────────────┬───────────────────────────────┘  │
 │                                 │                                  │
 │                                 ▼                                  │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │     Adjoint-Gradient Inverse Lithography (ILT) Optimizer     │  │
 │  │   min_ψ ||R(σ(βψ)) - Z*||₂² + λ_bin ||M(1-M)||₁  (EPE ↓)     │  │
 │  └──────────────────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────────────────┘
```

## 2. Architecture Decision Records

### ADR-199-001: Orthonormal Zernike Circle Polynomial Basis for Pupil Wavefront Metrology

- **Context**: Because orthonormal Zernike modes satisfy $\frac{1}{\pi}\iint_{\rho \le 1} Z_j Z_k\,\rho\,\mathrm{d}\rho\,\mathrm{d}\theta = \delta_{jk}$, the mean-square wavefront error equals the sum of squared RMS coefficients $\sigma_{\text{nm}}^2 = \sum_{j \ge 4} c_j^2$, enabling closed-form Maréchal Strehl calculation $S = \exp(-(2\pi \sigma_{\text{nm}} / \lambda)^2)$ Cross-checked by 2D polar pupil quadrature.
- **Decision**: Represent pupil aberrations in RMS-normalized Zernike nanometers and verify closed-form vs 2D pupil quadrature agreement.
- **Rejected Alternative**: Unnormalized monomials $x^a y^b$, which are non-orthogonal on the unit disk and couple defocus with spherical aberration.

### ADR-199-002: Continuous-Transmission Sigmoid Reparameterization for Adjoint ILT

- **Context**: Binary mask optimization $M \in \{0, 1\}^{G \times G}$ is NP-hard combinatorial programming.
- **Decision**: Reparameterize $M = \sigma(\beta \psi)$ with steepness $\beta$ and Resist $R = \sigma(\gamma(I - I_{\text{th}}))$, computing the exact discrete adjoint gradient $\nabla_\psi \mathcal{L} = 2 \beta M(1 - M) \cdot [K_{\text{PSF}}^T (2 E \odot \gamma R(1 - R)(R - Z^*))]$ where $E = K_{\text{PSF}} \ast M$.
- **Rejected Alternative**: Finite-difference per-pixel perturbation, which requires $G^2$ forward convolutions per iteration instead of 2.

### ADR-199-003: Fail-Closed Maréchal Criterion Gate ($S \ge 0.80$)

- **Context**: Exposure with an uncompensated pupil whose RMS wavefront error exceeds $\lambda / 14$ ($S < 0.80$) collapses aerial image contrast (NILS) and causes catastrophic bridging/necking across the wafer.
- **Decision**: Enforce $S \ge 0.80$ as a mandatory pre-exposure gate (`EUVILT_MARECHAL_BREACH`) unless active Zernike mirror compensation restores the wavefront.
- **Rejected Alternative**: Proceeding with exposure under degraded pupil Strehl and relying solely on mask OPC.
