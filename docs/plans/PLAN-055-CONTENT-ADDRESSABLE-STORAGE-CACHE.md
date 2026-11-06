# PLAN-055: Content-Addressable Storage (CAS) & Action Cache Engine Architecture Plan

**Specification**: SPEC-062  
**Status**: APPROVED  
**Architecture Decision Record**: ADR-067  

---

## 1. Architectural Approach
- **Two-Level Sharded Storage**: Files stored under `.eos/cas/<first-2-chars>/<next-2-chars>/<digest>` to prevent filesystem directory saturation.
- **Strict Invariant Validation**: On retrieval, the payload is verified against the claimed SHA-256 hash before returning.
- **Action Cache Decoupling**: Action Keys map to Action Results containing stdout, stderr, exitCode, outputDigests, and CPU time saved.
