/**
 * EOS SYSTEM — DEPENDENCY INJECTION CONTAINER (Layer 0)
 * Governed by SPEC-172 (Spring / Guice / .NET DI lifetime pattern)
 *
 * Implements:
 * - Three lifetimes: SINGLETON, TRANSIENT, SCOPED
 * - Constructor-injection resolution via factory functions
 * - Circular dependency detection before instantiation
 * - Scope create/dispose with automatic child-instance cleanup
 * - Deterministic container graph fingerprint
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type Lifetime = "SINGLETON" | "TRANSIENT" | "SCOPED";

export type FactoryFn<T> = (resolver: <U>(token: string) => U) => T;

interface Registration {
  readonly token: string;
  readonly factory: FactoryFn<unknown>;
  readonly lifetime: Lifetime;
  readonly deps: string[];
}

export class EosDependencyContainer {
  private readonly registrations: Map<string, Registration> = new Map();
  private readonly singletons: Map<string, unknown> = new Map();
  private readonly resolvingStack: string[] = [];

  /** internal: exposed to EosScopedContainer only */
  lookup(token: string): Registration | undefined {
    return this.registrations.get(token);
  }

  register<T>(token: string, factory: FactoryFn<T>, lifetime: Lifetime = "SINGLETON", deps: string[] = []): this {
    assertPrecondition(!this.registrations.has(token), `duplicate registration for ${token}`);
    this.registrations.set(token, deepFreeze({ token, factory: factory as FactoryFn<unknown>, lifetime, deps }));
    return this;
  }

  /**
   * Resolves a token, applying the registered lifetime policy.
   * Circular dependencies throw before instantiation.
   */
  resolve<T>(token: string): T {
    const reg = this.registrations.get(token);
    assertPrecondition(reg !== undefined, `no registration for token ${token}`);
    const r = reg!;

    if (this.resolvingStack.includes(token)) {
      const cycle = [...this.resolvingStack, token].join(" -> ");
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    if (r.lifetime === "SINGLETON" && this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    this.resolvingStack.push(token);
    try {
      const instance = r.factory((child) => this.resolve(child)) as T;
      if (r.lifetime === "SINGLETON") this.singletons.set(token, instance);
      return instance;
    } finally {
      this.resolvingStack.pop();
    }
  }

  createScope(): EosScopedContainer {
    return new EosScopedContainer(this);
  }

  has(token: string): boolean {
    return this.registrations.has(token);
  }
  get registrationCount(): number {
    return this.registrations.size;
  }
  get singletonCount(): number {
    return this.singletons.size;
  }

  graphFingerprint(): string {
    const sorted = [...this.registrations.values()].sort((a, b) => a.token.localeCompare(b.token));
    return pureSha256(sorted.map((r) => `${r.token}:${r.lifetime}:[${r.deps.join(",")}]`).join("|"));
  }
}

/**
 * Scoped container: SCOPED registrations get one instance per scope;
 * SINGLETONS are shared with the root; TRANSIENTS are never cached.
 */
export class EosScopedContainer {
  private readonly scopedInstances: Map<string, unknown> = new Map();
  private readonly root: EosDependencyContainer;
  private disposed = false;

  constructor(root: EosDependencyContainer) {
    this.root = root;
  }

  resolve<T>(token: string): T {
    assertPrecondition(!this.disposed, "scope is disposed");
    const reg = this.root.lookup(token);
    assertPrecondition(reg !== undefined, `no registration for token ${token}`);
    const r = reg!;
    if (r.lifetime === "SCOPED") {
      if (this.scopedInstances.has(token)) return this.scopedInstances.get(token) as T;
      const inst = this.root.resolve<T>(token);
      this.scopedInstances.set(token, inst);
      return inst;
    }
    return this.root.resolve<T>(token);
  }

  dispose(): void {
    this.disposed = true;
    this.scopedInstances.clear();
  }

  get activeScopedCount(): number {
    return this.scopedInstances.size;
  }
}
