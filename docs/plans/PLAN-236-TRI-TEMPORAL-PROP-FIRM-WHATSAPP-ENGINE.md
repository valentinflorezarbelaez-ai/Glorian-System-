# PLAN-236: Sovereign Autonomous Prop-Firm Trader, Tri-Temporal Fractal Engine & Real-Time WhatsApp Dispatcher

- **Plan ID**: PLAN-236
- **Related Spec**: SPEC-374
- **Change Ref**: CHANGE-236
- **Author**: Valentin Florez & Antigravity
- **Date**: 2026-11-19
- **Status**: APPROVED

---

## 1. Architectural Overview

```text
               +-------------------------------------------------------+
               |                  Market Data Feeds                    |
               |          (M15 Macro / M5 Structure / M1 Micro)        |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |        EosTriTemporalPropFirmEngine (Domain Core)     |
               +---------------------------+---------------------------+
                                           |
         +---------------------------------+---------------------------------+
         |                                 |                                 |
         v                                 v                                 v
+------------------+             +-------------------+             +-------------------+
|  Tri-Temporal    |             |  FTMO / Prop-Firm |             | WhatsApp Alert    |
|  Fractal Matrix  |             |  Drawdown Guard   |             | Webhook Dispatcher|
|  (M15->M5->M1)   |             | (-4.5% / -9.0%)   |             | (Open, Close, Sum)|
+------------------+             +-------------------+             +-------------------+
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-236-001: Abstract Webhook & WhatsApp Alert Dispatcher

- **Context**: Directly binding to a specific external WhatsApp gateway (Twilio, Meta Cloud API) requires third-party API keys and external network dependencies that may not be active in hermetic offline test suites.
- **Decision**: Implement an abstract message formatter producing compliant WhatsApp markdown (`*bold*`, emojis, structured tables), with a pluggable dispatch transport:
  1. Configured HTTPS webhook (POST JSON with formatted message).
  2. Local dispatch ledger (`docs/evidence/WHATSAPP_DISPATCH_LOG.json`).
  3. Interactive terminal output.
- **Consequences**: Zero runtime dependencies, 100% testable, and seamless integration with any WhatsApp bridge (Twilio, Baileys, Evolution API, Meta Cloud).

### ADR-236-002: Hard-Stop Prop-Firm Thresholds

- **Context**: Standard FTMO challenge rules disqualify accounts at -5.0% daily loss and -10.0% total drawdown.
- **Decision**: Hardcode conservative internal thresholds: -4.5% daily stop and -9.0% total drawdown. This provides a 0.5% and 1.0% safety cushion against slippage or latency.
- **Consequences**: Guaranteed survival of prop-firm evaluations.
