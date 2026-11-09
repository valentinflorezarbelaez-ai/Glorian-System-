/**
 * EOS SYSTEM — CONFIG HOT-RELOAD ENGINE (Layer 0)
 * Governed by SPEC-167 (Apollo / Spring Cloud Config atomic-swap pattern)
 *
 * Implements:
 * - Schema-validated config push (validator gate before swap)
 * - Atomic single-threaded swap with immutable snapshot
 * - Automatic rollback to last-known-good on validation failure
 * - Version history with monotonic integers
 * - Change listeners notified only on successful swap
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface ConfigSnapshot<T> {
  readonly version: number;
  readonly config: Readonly<T>;
  readonly digest: string;
  readonly pushedAtMs: number;
}

export type ValidatorFn<T> = (candidate: T) => string | null; // null = OK
export type ListenerFn<T> = (next: ConfigSnapshot<T>, prev: ConfigSnapshot<T> | null) => void;

export interface ReloadResult<T> {
  readonly accepted: boolean;
  readonly applied?: ConfigSnapshot<T>;
  readonly rejectedReason?: string;
  readonly rolledBackTo?: number;
}

export class EosConfigHotReloadEngine<T extends Record<string, unknown>> {
  private current: ConfigSnapshot<T> | null = null;
  private readonly history: ConfigSnapshot<T>[] = [];
  private readonly listeners: ListenerFn<T>[] = [];
  private readonly validator: ValidatorFn<T>;
  private readonly maxHistory: number;

  constructor(validator: ValidatorFn<T>, maxHistory = 20) {
    this.validator = validator;
    this.maxHistory = maxHistory;
  }

  /**
   * Attempts to apply a new configuration. On validator failure, the previous
   * snapshot is preserved and the rejection reason is returned.
   */
  push(candidate: T): ReloadResult<T> {
    assertPrecondition(candidate !== null && typeof candidate === "object", "candidate must be an object");

    const violation = this.validator(candidate);
    if (violation !== null) {
      return deepFreeze({
        accepted: false,
        rejectedReason: violation,
        rolledBackTo: this.current?.version,
      });
    }

    const frozen = deepFreeze({ ...candidate });
    const snapshot: ConfigSnapshot<T> = deepFreeze({
      version: (this.current?.version ?? 0) + 1,
      config: frozen,
      digest: pureSha256(JSON.stringify(frozen)),
      pushedAtMs: Date.now(),
    });

    const prev = this.current;
    this.current = snapshot;
    this.history.push(snapshot);
    while (this.history.length > this.maxHistory) this.history.shift();

    for (const listener of this.listeners) {
      listener(snapshot, prev);
    }

    return deepFreeze({ accepted: true, applied: snapshot });
  }

  get(): ConfigSnapshot<T> | null {
    return this.current;
  }

  /**
   * Explicit rollback to a specific historical version. Notifies listeners.
   */
  rollback(version: number): ReloadResult<T> {
    const target = this.history.find((s) => s.version === version);
    if (!target) {
      return deepFreeze({ accepted: false, rejectedReason: `version ${version} not in history` });
    }
    const prev = this.current;
    this.current = target;
    for (const listener of this.listeners) listener(target, prev);
    return deepFreeze({ accepted: true, applied: target });
  }

  subscribe(listener: ListenerFn<T>): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  historyVersions(): readonly number[] {
    return this.history.map((s) => s.version);
  }
}
