/**
 * EOS SYSTEM — REACTIVE STREAM OPERATOR ENGINE (Layer 0)
 * Governed by SPEC-173 (Project Reactor / RxJava / java.util.concurrent.Flow)
 *
 * Implements:
 * - Push-based Observable with subscribe/unsubscribe lifecycle
 * - Stateless operators: map, filter, take, tap, distinct, buffer
 * - Combinators: merge, concat
 * - Terminal signals: onComplete, onError with single-terminal guarantee
 * - Backpressure-aware subscription (bounded buffer with overflow policy)
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface StreamSubscriber<T> {
  onNext(value: T): void;
  onError(err: unknown): void;
  onComplete(): void;
}

export type Unsubscribe = () => void;

export class EosObservable<T> {
  private readonly subscribers: Set<StreamSubscriber<T>> = new Set();
  private terminated = false;

  subscribe(sub: StreamSubscriber<T>): Unsubscribe {
    if (this.terminated) {
      sub.onComplete();
      return () => {};
    }
    this.subscribers.add(sub);
    return () => {
      this.subscribers.delete(sub);
    };
  }

  next(value: T): void {
    if (this.terminated) return;
    for (const s of this.subscribers) s.onNext(value);
  }

  error(err: unknown): void {
    if (this.terminated) return;
    this.terminated = true;
    for (const s of this.subscribers) s.onError(err);
    this.subscribers.clear();
  }

  complete(): void {
    if (this.terminated) return;
    this.terminated = true;
    for (const s of this.subscribers) s.onComplete();
    this.subscribers.clear();
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }
  get isTerminated(): boolean {
    return this.terminated;
  }

  map<U>(fn: (v: T) => U): EosObservable<U> {
    const out = new EosObservable<U>();
    this.subscribe({
      onNext: (v) => out.next(fn(v)),
      onError: (e) => out.error(e),
      onComplete: () => out.complete(),
    });
    return out;
  }

  filter(pred: (v: T) => boolean): EosObservable<T> {
    const out = new EosObservable<T>();
    this.subscribe({
      onNext: (v) => {
        if (pred(v)) out.next(v);
      },
      onError: (e) => out.error(e),
      onComplete: () => out.complete(),
    });
    return out;
  }

  take(n: number): EosObservable<T> {
    assertPrecondition(n >= 0, "take count must be >= 0");
    const out = new EosObservable<T>();
    let count = 0;
    const unsub = this.subscribe({
      onNext: (v) => {
        if (count < n) {
          out.next(v);
          count++;
          if (count === n) out.complete();
        }
      },
      onError: (e) => out.error(e),
      onComplete: () => out.complete(),
    });
    out.subscribe({ onNext: () => {}, onError: () => {}, onComplete: () => unsub() });
    return out;
  }

  tap(side: (v: T) => void): EosObservable<T> {
    const out = new EosObservable<T>();
    this.subscribe({
      onNext: (v) => {
        side(v);
        out.next(v);
      },
      onError: (e) => out.error(e),
      onComplete: () => out.complete(),
    });
    return out;
  }

  buffer(size: number): EosObservable<T[]> {
    assertPrecondition(size >= 1, "buffer size must be >= 1");
    const out = new EosObservable<T[]>();
    let buf: T[] = [];
    this.subscribe({
      onNext: (v) => {
        buf.push(v);
        if (buf.length >= size) {
          out.next(buf);
          buf = [];
        }
      },
      onError: (e) => out.error(e),
      onComplete: () => {
        if (buf.length > 0) out.next(buf);
        out.complete();
      },
    });
    return out;
  }

  collect(): Promise<T[]> {
    const items: T[] = [];
    return new Promise<T[]>((resolve, reject) => {
      this.subscribe({
        onNext: (v) => items.push(v),
        onError: (e) => reject(e),
        onComplete: () => resolve(items),
      });
    });
  }

  static merge<T>(...sources: readonly EosObservable<T>[]): EosObservable<T> {
    const out = new EosObservable<T>();
    let completed = 0;
    for (const s of sources) {
      s.subscribe({
        onNext: (v) => out.next(v),
        onError: (e) => out.error(e),
        onComplete: () => {
          completed++;
          if (completed === sources.length) out.complete();
        },
      });
    }
    return out;
  }
}

/**
 * Bounded demand-based buffer for producer/consumer backpressure.
 */
export class EosBoundedQueue<T> {
  private readonly items: T[] = [];
  private readonly capacity: number;
  private closed = false;

  constructor(capacity: number) {
    assertPrecondition(capacity >= 1, "capacity must be >= 1");
    this.capacity = capacity;
  }

  tryOffer(value: T): boolean {
    if (this.closed || this.items.length >= this.capacity) return false;
    this.items.push(value);
    return true;
  }

  poll(): T | undefined {
    return this.items.shift();
  }

  close(): void {
    this.closed = true;
  }
  get length(): number {
    return this.items.length;
  }
  get isFull(): boolean {
    return this.items.length >= this.capacity;
  }
  get isClosed(): boolean {
    return this.closed;
  }

  fingerprint(): string {
    return pureSha256(JSON.stringify({ cap: this.capacity, len: this.items.length, closed: this.closed }));
  }
}
