# PLAN-190: FP8 / INT8 Quantized Distributed Training & Mixed-Precision Gradient Scaling Engine

**Reference**: `SPEC-328` / `CHANGE-190`  
**System**: Glorian System Control Plane (`eos-system`)  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Architectural Overview

Quantized distributed training combines low-precision arithmetic with adaptive scaling to slash memory usage and collective communication overhead without compromising model convergence. In standard distributed training, model parameters, gradients, and optimizer states consume vast amounts of device memory, while collective gradient All-Reduce saturates cluster interconnects.

The **FP8 / INT8 Quantized Distributed Training & Mixed-Precision Gradient Scaling Engine** (`EosQuantizedDistributedTrainingCore`) provides a unified, sovereign Layer-0 architecture:

```
[Forward Pass (FP8 E4M3)]
  Inputs X (E4M3, scale S_x) x Weights W (E4M3, scale S_w) ===> GEMM Output Y (FP32 Accumulator)
  Max Absolute Value tracking: a_max = max(|X|)
  Delayed Scale update for next step: S_{t+1} = FP8_MAX / max(a_max, eps)

[Loss Computation & Scaling]
  Loss L = Criterion(Y, Target) * S_loss (Dynamic Loss Scale)

[Backward Pass (FP8 E5M2)]
  Gradients dY (FP32) ---> Scaled FP8 E5M2 (extended dynamic range for gradients)
  Backpropagate: dW = X^T * dY, dX = dY * W^T
  Inspect gradients for NaN / Inf:
    - If NaN/Inf detected: Reject step, S_loss = S_loss / 2, clean_steps = 0
    - If clean: S_loss = min(S_loss * 2, S_loss_max) after N_clean steps

[Quantized Distributed All-Reduce]
  dW (FP32) ---> Quantized (FP8/INT8, 1 byte/element, 75% bandwidth reduction vs FP32)
  Distributed All-Reduce across P workers with FP32 accumulator:
  Summed Gradient = sum_{p=1}^P dequantize(dW_p) / P
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-190-001: Separation of Forward (E4M3) and Backward (E5M2) FP8 Formats

- **Context**: FP8 standards define two distinct formats:
  1. `E4M3` (1 sign, 4 exponent, 3 mantissa; bias 7; max 448.0): Higher precision (relative error $\approx 6.25\%$), narrower range.
  2. `E5M2` (1 sign, 5 exponent, 2 mantissa; bias 15; max 57344.0): Wider dynamic range, lower precision (relative error $\approx 12.5\%$).
- **Decision**: Assign `E4M3` strictly to forward activations and model weights (where precision is paramount and values are bounded by normalization layers) and `E5M2` strictly to backward gradients (where values can span several orders of magnitude and are susceptible to underflow/overflow).
- **Consequences**: Matches NVIDIA TransformerEngine and OCP FP8 specifications, preventing activation quantization distortion while preserving gradient tail distributions without gradient explosion or vanishing.

### ADR-190-002: Delayed Scaling Factors vs Synchronous Reduction

- **Context**: Optimal quantization scaling $S = \text{FP8\_MAX} / \max(|X|)$ requires finding $\max(|X|)$ before quantizing. In a distributed multi-GPU setting, computing this synchronously across all ranks incurs expensive cross-device barrier latency.
- **Decision**: Implement delayed scaling factor updates: use the scaling factor $S_t$ computed from the previous iteration $t-1$ (or an exponential moving average / history window) to quantize iteration $t$, while measuring $a_{\max}^{(t)}$ asynchronously to produce $S_{t+1}$.
- **Consequences**: Completely eliminates device-host synchronization barriers during GEMM execution. Saturation detection flags when $a_{\max}^{(t)} \cdot S_t > \text{FP8\_MAX}$, triggering immediate loss scale reduction to prevent numerical degradation.

### ADR-190-003: Dynamic Loss Scaling and Gradient Non-Finite Backoff

- **Context**: Low-precision gradients frequently suffer underflow when values drop below the minimum representable subnormal number, or overflow when gradients spike.
- **Decision**: Dynamically scale loss and backward gradients by $S_{\text{loss}}$. After backward propagation, inspect all gradient values. If any element is non-finite (`NaN` or `Inf`), immediately reject the parameter update, halve $S_{\text{loss}}$, and reset the consecutive clean steps counter. When $N_{\text{clean}}$ consecutive steps succeed without overflow, double $S_{\text{loss}}$ up to $S_{\text{loss\_max}}$.
- **Consequences**: Guarantees zero weight corruption from non-finite gradients while automatically keeping gradients in the optimal representable exponent window of the floating-point format.

---

## 3. Formal Verification Strategy (TLA+ Model 72)

- **Spec**: `docs/formal/QuantizedDistributedTrainingEngine.tla` & `QuantizedDistributedTrainingEngine.cfg`.
- **Model Checkers**: Leslie Lamport's TLC (`scripts/run-tlc.mjs` and native execution).
- **Invariants**:
  - `TypeOK`: State invariants for quantization formats, scaling factors, loss scale, and gradient buffers.
  - `ScaleStability`: Scaling factors remain strictly positive and finite.
  - `SaturationRecovery`: Any step experiencing saturation or overflow triggers immediate mitigation.
  - `BandwidthReduction`: Network communication volume never exceeds 1 byte per quantized element.
  - `WeightIntegrity`: Parameter updates are strictly skipped whenever non-finite gradients are detected.
