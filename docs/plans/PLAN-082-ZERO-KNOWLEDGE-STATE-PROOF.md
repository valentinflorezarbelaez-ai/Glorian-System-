# PLAN-082: Zero-Knowledge Merkle State Attestation Engine

## Execution Architecture

1. **Layer 0 Core**: `src/core/eosZkStateProof.ts`
   - State leaf commitments: `leafHash = pureSha256(salt + ":" + claimId + ":" + status + ":" + value)`.
   - Binary Merkle tree construction over $N$ leaves.
   - Sibling audit path generator for selective disclosure proof $O(\log N)$.
   - Constant-time proof verifier comparing candidate root to expected public root.
   - Proof statement generator and SHA-256 tamper-evident receipt.
2. **Package & Module Wiring**:
   - Subpath export `"./zk-proof"` in `package.json`.
   - Re-export in `src/core/index.ts`.
3. **CLI Exposition**:
   - `glorian zk:prove [claim] [--spec=SPEC-NNN] [--json]` in `bin/commands/cliPlatform.mjs`.
   - Documented in `bin/commands/cliKernel.mjs`.
4. **MCP Tool Exposition**:
   - `action: "zk_prove"` and `action: "zk_verify"` on `eos_enterprise_workspace` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
5. **Quality Gate Verification**:
   - Comprehensive test suite in `test/eosZkStateProof.test.mjs`.
   - Synchronize catalog index to 192 specs.
   - Run typecheck, lint, and tests.
   - Git commit & push.
