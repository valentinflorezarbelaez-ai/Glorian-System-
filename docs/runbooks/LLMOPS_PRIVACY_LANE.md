# LLMOps Privacy Lane (Local / Open-Weight)

**Epistemic state**: `WITHIN_TESTED_SCOPE`  
**Module**: `src/core/eosLlmOpsPrivacyLane.ts`  
**Non-claims**: not a hardware TEE, not Level-5, not NSA_GRADE.

## Purpose

Optional fail-closed lane so Glorian can keep inference on-box (local SLM / open-weight HTTP) without shipping plaintext secrets to frontier cloud APIs.

## Activation

```bash
# Local-only / open-weight lane (synonyms)
set EOS_LLM_PRIVACY_LANE=local
set EOS_LLM_PRIVACY_LANE=open_weight
```

Unset or any other value → `cloud_allowed` (default). Secret scanning still fail-closes.

## Contracts

| Condition                                                    | Decision                  |
| ------------------------------------------------------------ | ------------------------- |
| Payload matches secret regex (sk-, ghp\_, Bearer, AIza, PEM) | `REJECT_PLAINTEXT_SECRET` |
| Lane is `local`/`open_weight` and provider is remote cloud   | `REJECT_REMOTE_PROVIDER`  |
| Lane is `local`/`open_weight` and endpoint is local          | `ALLOW_LOCAL`             |
| Default lane without secrets                                 | `ALLOW_CLOUD`             |

## Recommended local endpoints

- Ollama / open-weight: `http://127.0.0.1:11434/...`
- FinOps tier alignment: prefer `TIER_1_LOCAL_SLM` while the lane is active

## Verification

```bash
node --test test/eosLlmOpsPrivacyLane.test.mjs
```

## Law VI

Never put API keys, tokens, or private keys in prompts, commits, or UI badges. Use opaque credential handles only.
