# PLAN-092: Layer-0 Asymmetric Numeral Systems (ANS/rANS) Entropy Compressor (SPEC-207)

- **Date**: 2026-11-10
- **Architect**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: APPROVED

---

## 1. Technical Strategy

1. **rANS State Constants**:
   - $L = 2^{16} = 65,536$ (lower bound of state $x$).
   - $b = 256$ (radix / 1 byte emitted at a time).
   - $M = 2^{12} = 4096$ (total frequency normalization scale).
   - State $x$ fits within 32-bit unsigned integers ($x \in [L, b \cdot L - 1] = [65536, 16777215]$).
2. **Frequency Table & Cumulative CDF**:
   - Count histogram of 256 byte symbols.
   - Rescale so $\sum f_s = M$, with $f_s \ge 1$ for all present symbols.
   - Cumulative $c_s = \sum_{i < s} f_i$.
   - Decoding lookup table or binary search mapping cumulative index to symbol.
3. **Stream Encoding**:
   - Encode symbols from last to first (rANS is LIFO stack-like).
   - For each symbol $s$:
     - While $x \ge (L / f_s) \cdot b$: emit $x \pmod b$ to byte buffer, $x \leftarrow \lfloor x / b \rfloor$.
     - $x \leftarrow \lfloor x / f_s \rfloor \cdot M + (x \pmod{f_s}) + c_s$.
   - Output header: original length, frequency table encoding, final state $x$ (32-bit uint), and emitted stream bytes.
4. **Stream Decoding**:
   - Read header, reconstruct frequency table and cumulative table.
   - Initialize state $x$ from header.
   - For each symbol from 1 to originalLength:
     - $slot = x \pmod M$.
     - Find symbol $s$ such that $c_s \le slot < c_s + f_s$.
     - Output symbol $s$.
     - $x \leftarrow f_s \cdot \lfloor x / M \rfloor + slot - c_s$.
     - While $x < L$: read byte from stream, $x \leftarrow x \cdot b + \text{byte}$.
5. **Shannon Entropy Telemetry**:
   - $H(X) = -\sum (f_s / M) \log_2(f_s / M)$.
   - Theoretical optimal compressed size: $(H(X) \cdot N) / 8$ bytes.
6. **DbC & Receipts**:
   - Round-trip assertion and SHA-256 receipts.
