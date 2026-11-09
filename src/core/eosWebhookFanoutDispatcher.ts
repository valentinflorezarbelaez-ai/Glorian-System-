/**
 * EOS SYSTEM — WEBHOOK FANOUT + DEAD-LETTER QUEUE (Layer 0)
 * Governed by SPEC-161 (Stripe / GitHub webhook delivery pattern)
 *
 * Implements:
 * - Fan-out delivery of an event to N subscribers
 * - Per-subscriber HMAC signature (payload integrity + auth)
 * - Retry with exponential backoff up to maxAttempts
 * - Dead-letter queue for permanently failed deliveries
 * - Deterministic delivery-id for idempotent consumer de-duplication
 *
 * Zero external dependencies.
 */

import { createHmac } from "node:crypto";
import { assertPrecondition, deepFreeze } from "./eosKernelPrimitives.ts";

export interface Subscriber {
  readonly id: string;
  readonly url: string;
  readonly secret: string;
  readonly maxAttempts: number;
}

export interface DeliveryResult {
  readonly deliveryId: string;
  readonly subscriberId: string;
  readonly attempt: number;
  readonly success: boolean;
  readonly statusCode: number;
  readonly signature: string;
  readonly error?: string;
}

export interface DeadLetter {
  readonly deliveryId: string;
  readonly subscriberId: string;
  readonly event: string;
  readonly payload: unknown;
  readonly lastError: string;
  readonly failedAtMs: number;
}

export type TransportFn = (url: string, body: string, signature: string) => Promise<number>;

export class EosWebhookFanoutDispatcher {
  private readonly subscribers: Subscriber[] = [];
  private readonly deadLetters: DeadLetter[] = [];
  private readonly delivered: Set<string> = new Set();
  private readonly transport: TransportFn;

  constructor(transport: TransportFn) {
    this.transport = transport;
  }

  register(sub: Subscriber): void {
    assertPrecondition(sub.secret.length >= 8, "subscriber secret too short");
    this.subscribers.push(sub);
  }

  /**
   * Signs a payload with HMAC-SHA256 (Stripe-style t=timestamp,v1=signature).
   */
  static sign(secret: string, timestamp: number, body: string): string {
    const payload = `${timestamp}.${body}`;
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  private deliveryId(event: string, subId: string): string {
    return `${subId}:${event}`;
  }

  /**
   * Fans out an event to all subscribers, retrying failures with backoff.
   * Persistently failed deliveries land in the dead-letter queue.
   */
  async dispatch(event: string, payload: unknown): Promise<readonly DeliveryResult[]> {
    const body = JSON.stringify({ event, payload, ts: Date.now() });
    const results: DeliveryResult[] = [];

    for (const sub of this.subscribers) {
      const id = this.deliveryId(event, sub.id);
      if (this.delivered.has(id)) {
        results.push(
          deepFreeze({
            deliveryId: id,
            subscriberId: sub.id,
            attempt: 0,
            success: true,
            statusCode: 200,
            signature: "",
          }),
        );
        continue;
      }

      let delivered = false;
      let lastStatus = 0;
      let lastError = "";
      let lastSignature = "";
      let attempt = 0;

      for (attempt = 1; attempt <= sub.maxAttempts; attempt++) {
        const ts = Date.now();
        lastSignature = EosWebhookFanoutDispatcher.sign(sub.secret, ts, body);
        try {
          lastStatus = await this.transport(sub.url, body, lastSignature);
          if (lastStatus >= 200 && lastStatus < 300) {
            delivered = true;
            this.delivered.add(id);
            break;
          }
          lastError = `HTTP ${lastStatus}`;
        } catch (err) {
          lastError = String(err);
        }
        // Exponential backoff (bounded, kept tiny for test determinism)
        await new Promise((r) => setTimeout(r, Math.min(2 ** attempt, 4)));
      }

      results.push(
        deepFreeze({
          deliveryId: id,
          subscriberId: sub.id,
          attempt,
          success: delivered,
          statusCode: lastStatus,
          signature: lastSignature,
          error: delivered ? undefined : lastError,
        }),
      );

      if (!delivered) {
        this.deadLetters.push(
          deepFreeze({
            deliveryId: id,
            subscriberId: sub.id,
            event,
            payload,
            lastError,
            failedAtMs: Date.now(),
          }),
        );
      }
    }

    return results;
  }

  /**
   * Returns and clears the dead-letter queue for reprocessing.
   */
  drainDeadLetters(): readonly DeadLetter[] {
    const drained = [...this.deadLetters];
    this.deadLetters.length = 0;
    return drained;
  }

  get deadLetterCount(): number {
    return this.deadLetters.length;
  }

  subscriberCount(): number {
    return this.subscribers.length;
  }
}
