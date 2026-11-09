/**
 * EOS SYSTEM — CONSUMER-DRIVEN CONTRACT TEST ENGINE (Layer 0)
 * Governed by SPEC-163 (Pact / Microsoft Consumer-Driven Contract pattern)
 *
 * Implements:
 * - Consumer-side expectation matching (path/method/status/body shape)
 * - Provider-side verification against recorded contracts
 * - Backward-compatibility check (added fields OK; removed/changed = BREAK)
 * - Deterministic contract digest for CI gating
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface ContractInteraction {
  readonly consumer: string;
  readonly provider: string;
  readonly description: string;
  readonly request: {
    readonly method: string;
    readonly path: string;
    readonly query?: Record<string, string>;
    readonly body?: unknown;
  };
  readonly response: {
    readonly status: number;
    readonly body?: unknown;
  };
}

export interface ContractVerificationResult {
  readonly interaction: string;
  readonly passed: boolean;
  readonly mismatches: readonly string[];
}

export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly breakingChanges: readonly string[];
}

function shapeOf(value: unknown): Record<string, string> {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object") return { __root__: typeof value };
  const shape: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    shape[k] = Array.isArray(v) ? "array" : v === null ? "null" : typeof v;
  }
  return shape;
}

export class EosContractTestEngine {
  private readonly contracts: ContractInteraction[] = [];

  register(interaction: ContractInteraction): void {
    assertPrecondition(interaction.consumer.length > 0, "consumer required");
    assertPrecondition(interaction.provider.length > 0, "provider required");
    this.contracts.push(deepFreeze(interaction));
  }

  /**
   * Verifies an actual provider response satisfies the recorded contract.
   */
  verify(
    consumer: string,
    description: string,
    actual: { method: string; path: string; status: number; body?: unknown },
  ): ContractVerificationResult {
    const contract = this.contracts.find((c) => c.consumer === consumer && c.description === description);
    if (!contract) {
      return deepFreeze({ interaction: description, passed: false, mismatches: ["CONTRACT_NOT_FOUND"] });
    }

    const mismatches: string[] = [];
    if (actual.method.toUpperCase() !== contract.request.method.toUpperCase()) {
      mismatches.push(`method: expected ${contract.request.method}, got ${actual.method}`);
    }
    if (actual.path !== contract.request.path) {
      mismatches.push(`path: expected ${contract.request.path}, got ${actual.path}`);
    }
    if (actual.status !== contract.response.status) {
      mismatches.push(`status: expected ${contract.response.status}, got ${actual.status}`);
    }
    if (contract.response.body !== undefined) {
      const expectedShape = shapeOf(contract.response.body);
      const actualShape = shapeOf(actual.body);
      for (const [field, type] of Object.entries(expectedShape)) {
        if (!(field in actualShape)) {
          mismatches.push(`body field missing: ${field}`);
        } else if (actualShape[field] !== type) {
          mismatches.push(`body field type: ${field} expected ${type}, got ${actualShape[field]}`);
        }
      }
    }

    return deepFreeze({
      interaction: `${consumer}/${description}`,
      passed: mismatches.length === 0,
      mismatches,
    });
  }

  /**
   * Backward-compatibility check: provider must satisfy all consumer expectations.
   * Adding fields is OK. Removing or changing types breaks the contract.
   */
  checkCompatibility(provider: string, newShape: Record<string, string>): CompatibilityResult {
    const breaking: string[] = [];
    const consumers = new Set(this.contracts.filter((c) => c.provider === provider).map((c) => c.consumer));
    for (const consumer of consumers) {
      const contracts = this.contracts.filter((c) => c.provider === provider && c.consumer === consumer);
      for (const c of contracts) {
        const expectedShape = shapeOf(c.response.body);
        for (const [field, type] of Object.entries(expectedShape)) {
          if (!(field in newShape)) {
            breaking.push(`${consumer}/${c.description}: removed '${field}'`);
          } else if (newShape[field] !== type) {
            breaking.push(`${consumer}/${c.description}: type drift '${field}' ${type}->${newShape[field]}`);
          }
        }
      }
    }
    return deepFreeze({ compatible: breaking.length === 0, breakingChanges: breaking });
  }

  listContracts(provider?: string): readonly ContractInteraction[] {
    return provider ? this.contracts.filter((c) => c.provider === provider) : this.contracts;
  }

  contractDigest(): string {
    const sorted = [...this.contracts].sort((a, b) =>
      `${a.provider}/${a.consumer}/${a.description}`.localeCompare(`${b.provider}/${b.consumer}/${b.description}`),
    );
    return pureSha256(JSON.stringify(sorted));
  }
}
