# CHANGE-199: Autonomous EUV Optical Proximity Correction & Inverse Lithography Wavefront Engine (EUV-OPC)

## 1. Intent & Scope

At sub-2nm semiconductor nodes using $\lambda = 13.5\text{ nm}$ Extreme Ultraviolet (EUV) scanners ($\text{NA} = 0.33$ standard and $\text{NA} = 0.55$ High-NA), low-$k_1$ diffraction blurs mask corners, line-ends shorten, and mirror thermal/figure aberrations distort the pupil wavefront. While `SPEC-254` provides scalar parametric KPI summaries, `CHANGE-199` (`SPEC-337`) introduces `EosEuvInverseLithographyWavefrontCore`: a 2D spatial/pupil solver that computes Zernike pupil wavefront phase maps, Maréchal Strehl ratios, 2D diffraction aerial images, and adjoint-gradient pixel-based Inverse Lithography Technology (ILT) mask synthesis.

## 2. Impacted Components

- `src/core/eosEuvInverseLithographyWavefront.ts`: 2D wavefront, aerial image & ILT mask synthesis engine.
- `src/core/eosEuvInverseLithographyWavefront.types.ts`: domain types.
- `src/core/index.ts`: module exports.
- `bin/commands/cliEuvInverseLithographyWavefront.mjs`: CLI subdispatcher (`toolchain:euvilt:`).
- `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md`.
- `docs/formal/EuvInverseLithographyWavefront.tla` & `.cfg`, `scripts/run-tlc.mjs`.
- `test/eosEuvInverseLithographyWavefront.test.mjs` (BDD-1797..1802).

## 3. Risk Assessment

- **Risk 1**: Unphysical mask transmissions outside $[0, 1]$ during unconstrained gradient steps.
  - _Mitigation_: Parameterize $M(x, y) = \sigma(\beta \psi(x, y)) \in (0, 1)$ with a binarization penalty $M(1 - M)$ and final threshold projection.
- **Risk 2**: Mirror aberrations exceeding Maréchal's diffraction limit ($\sigma_\lambda > \lambda / 14 \implies S < 0.80$).
  - _Mitigation_: Active Zernike phase conjugation / mirror actuator compensation verified before exposure admission.
