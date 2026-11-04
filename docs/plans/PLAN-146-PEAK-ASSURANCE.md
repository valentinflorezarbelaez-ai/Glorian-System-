# PLAN-146 / ADR-0187 — Peak Assurance Architecture

## ADR-0187
Adopt a **minimal Trusted Computing Base (TCB)** for MCP Streamable admission + Law IV, proven with TLA+ bounded simulation and mutation testing, then bind NIST 800-53 subset evidence, then run an adversarial campaign — rather than expanding ceremonial surface area.

## Waves
1. **A Formal**: `eosPeakAssuranceTcb` + `McpStreamableSecurity.tla` + mutation floor 80
2. **B NIST**: Control map + assurance-binder + IV&V playbook
3. **C Adversarial**: Chaos/fuzz campaign script + CI supply-chain gate verification + tip-seal

## Non-goals
Federal FedRAMP ATO, DO-178C certification, or claiming NSA accreditation.
