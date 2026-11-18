# EOS Intake & Context Record: INTAKE-199 (SPEC-337 / CHANGE-199)

## 1. Context & Business Intent

- **System**: Glorian System (Control Plane & Layer-0 Core Engine)
- **Domain**: Extreme Ultraviolet (EUV, $\lambda = 13.5\text{ nm}$) Wavefront Aberration Metrology, Zernike Pupil Phase Retrieval & Pixel-Based Inverse Lithography Technology (ILT)
- **Objective**: Implement a pure Layer-0 TypeScript engine (`EosEuvInverseLithographyWavefrontCore`) with zero external runtime dependencies that models 2D coherent/partially-coherent diffraction-limited aerial image formation over a pupil cutoff $f_c = \text{NA}/\lambda$, evaluates Zernike pupil wavefront aberrations ($Z_4$ defocus, $Z_5/Z_6$ astigmatism, $Z_7/Z_8$ coma, $Z_{11}$ primary spherical) and Maréchal Strehl ratio $S = \exp(-\sigma_\phi^2)$, and synthesizes curvilinear / pixel-level photomasks via continuous-tone sigmoid Inverse Lithography Technology (ILT) gradient descent to minimize Edge Placement Error (EPE) and wafer pattern fidelity loss.
- **Reference Material**:
  - Max Born & Emil Wolf: _Principles of Optics_ (7th ed., Cambridge University Press, 1999) — Abbe-Hopkins diffraction & Zernike circle polynomials.
    -Chris Mack: _Fundamental Principles of Optical Lithography: The Science of Microfabrication_ (Wiley, 2007).
  - Linyong Pang, Yong Liu & Dan Abrams: _Inverse Lithography Technology (ILT): What, Where, and Why_ (SPIE Photomask Technology, 2006).
  - ASML High-NA EUV ($\text{NA} = 0.33$ and $\text{NA} = 0.55$ anamorphic) optical metrology standards.

## 2. Core Functional Requirements

1. **Zernike Pupil Wavefront & Maréchal Strehl Metrology**: Orthonormal Zernike polynomial expansion over the unit pupil disk $\rho \le 1$, RMS wavefront error $\sigma_\phi$ in radians and nanometers, and Maréchal Strehl ratio $S = \exp(-\sigma_\phi^2)$ with fail-closed diffraction-limited gate ($S \ge 0.80$).
2. **2D Diffraction Point-Spread Function (PSF) & Aerial Image Simulator**: Coherent / multi-point partially coherent aerial image convolution $I(x, y) = \sum_s w_s |h_s \ast M(x, y)|^2$ and sigmoid resist thresholding $R(x, y) = \sigma(\gamma (I(x, y) - I_{\text{th}}))$.
3. **Pixel-Based Inverse Lithography Technology (ILT) Mask Optimizer**: Continuous-transmission parameter field $\psi(x, y) \in \mathbb{R}$ mapped to mask transmission $M = \sigma(\beta \psi) \in [0, 1]$, optimized via analytical adjoint gradient descent on $\mathcal{L}_{\text{ILT}} = \|R(M) - Z^*\|_2^2 + \lambda_{\text{bin}} \|M(1 - M)\|_1$ to reduce Edge Placement Error (EPE) and L2 wafer pattern error monotonically.
4. **Wavefront Phase Compensation**: Conjugate pupil phase correction reducing residual RMS wavefront aberration below $\lambda / 14$ (Maréchal criterion).
5. **Formal Model (TLA+ Model 81)**: `EuvInverseLithographyWavefront.tla` verified with TLC.

## 3. Epistemic Status & Constraints

- **Epistemic State**: `INTAKE_RECORDED`
- **Dependencies**: `dependencies: {}` (zero external npm packages)
- **Module Size**: `<= 800` lines, `>= 12` lines headroom (`SPEC-250`)
- **CLI Parity**: 100% catalog parity verified by `hygiene:audit`
