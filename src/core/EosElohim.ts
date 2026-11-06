/**
 * EOS SYSTEM — EOS ELOHIM: RUNA NOT & KARMIC CIRCUIT BREAKER ENGINE
 *
 * Law I, Law II & Law VI (Pure Layer-0 Theurgic Core):
 * Disyuntor kármico de la Runa NOT que detecta DEADLOCK_MECHANICAL (>5000ms),
 * bucles infinitos entre subagentes o exceso de presupuesto de tokens,
 * aplicando corte quirúrgico instantáneo y sello criptográfico SHA-384.
 *
 * Invariant: Pure Layer-0 TypeScript (dependencies: {}).
 */

import crypto from "node:crypto";

export interface KarmicEvaluationParams {
  tokensConsumed: number;
  elapsedMs: number;
  thoughtHistory?: string[];
  maxTokens?: number;
  maxElapsedMs?: number;
  maxLoopCycles?: number;
}

export interface KarmicEvaluationReceipt {
  readonly status: "PASS_HARMONY" | "RUNA_NOT_SEVERED";
  readonly tripped: boolean;
  readonly violationType?: "TOKEN_LIMIT_EXCEEDED" | "MECHANICAL_DEADLOCK" | "AGENT_CIRCULAR_LOOP";
  readonly message?: string;
  readonly sha384Seal?: string;
  readonly timestamp: string;
}

export class EosElohim {
  public static readonly DEFAULT_MAX_TOKENS = 50000;
  public static readonly DEFAULT_MAX_ELAPSED_MS = 5000;
  public static readonly DEFAULT_MAX_LOOP_CYCLES = 3;

  /**
   * Evaluates system state against the three Karmic thresholds:
   * 1. Token budget exhaustion (>50k tokens)
   * 2. Mechanical thread deadlock (>5,000ms)
   * 3. Repetitive thought/agent circular loops
   */
  public static evaluateKarmicDisruptor(params: KarmicEvaluationParams): KarmicEvaluationReceipt {
    const maxTokens = params.maxTokens ?? EosElohim.DEFAULT_MAX_TOKENS;
    const maxElapsedMs = params.maxElapsedMs ?? EosElohim.DEFAULT_MAX_ELAPSED_MS;
    const maxLoops = params.maxLoopCycles ?? EosElohim.DEFAULT_MAX_LOOP_CYCLES;
    const timestamp = new Date().toISOString();

    // 1. Check Token Budget
    if (params.tokensConsumed > maxTokens) {
      const seal = EosElohim.generateRunaNotSeal(
        "TOKEN_LIMIT_EXCEEDED",
        `Consumo ${params.tokensConsumed} > límite ${maxTokens}`
      );
      return {
        status: "RUNA_NOT_SEVERED",
        tripped: true,
        violationType: "TOKEN_LIMIT_EXCEEDED",
        message: `Runa NOT Disparada: Consumo excesivo de tokens (${params.tokensConsumed} > ${maxTokens}). Bucle kármico cortado quirúrgicamente.`,
        sha384Seal: seal,
        timestamp
      };
    }

    // 2. Check Mechanical Deadlock
    if (params.elapsedMs > maxElapsedMs) {
      const seal = EosElohim.generateRunaNotSeal(
        "MECHANICAL_DEADLOCK",
        `Latencia ${params.elapsedMs}ms > umbral ${maxElapsedMs}ms`
      );
      return {
        status: "RUNA_NOT_SEVERED",
        tripped: true,
        violationType: "MECHANICAL_DEADLOCK",
        message: `Runa NOT Disparada: Deadlock mecánico detectado (${params.elapsedMs}ms > ${maxElapsedMs}ms). Hilo congelado y purgado.`,
        sha384Seal: seal,
        timestamp
      };
    }

    // 3. Check Circular Loop in Agent Thought History
    if (params.thoughtHistory && params.thoughtHistory.length >= maxLoops) {
      const history = params.thoughtHistory;
      let identicalStreak = 1;
      const last = history[history.length - 1];

      for (let i = history.length - 2; i >= 0; i--) {
        if (history[i] === last) {
          identicalStreak++;
        } else {
          break;
        }
      }

      if (identicalStreak >= maxLoops) {
        const seal = EosElohim.generateRunaNotSeal(
          "AGENT_CIRCULAR_LOOP",
          `Repetición exacta de pensamiento durante ${identicalStreak} ciclos consecutivos`
        );
        return {
          status: "RUNA_NOT_SEVERED",
          tripped: true,
          violationType: "AGENT_CIRCULAR_LOOP",
          message: `Runa NOT Disparada: Bucle circular de subagente detectado (${identicalStreak} iteraciones idénticas). Alucinación abortada.`,
          sha384Seal: seal,
          timestamp
        };
      }
    }

    return {
      status: "PASS_HARMONY",
      tripped: false,
      timestamp
    };
  }

  /**
   * Generates a tamper-evident SHA-384 cryptographic seal for Runa NOT severances.
   */
  public static generateRunaNotSeal(violationType: string, details: string): string {
    return crypto
      .createHash("sha384")
      .update(`RUNA_NOT_SEVERANCE:${violationType}:${details}:${new Date().toISOString()}`)
      .digest("hex");
  }
}
